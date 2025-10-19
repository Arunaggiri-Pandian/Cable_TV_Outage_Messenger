import hashlib
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List, Tuple

import httpx
import pandas as pd
from flask import Blueprint, jsonify, render_template, request
from twilio.rest import Client
from datetime import datetime
from pathlib import Path
import csv

bp = Blueprint("main", __name__)

# ---- Logging ----
logger = logging.getLogger("kgm")
logger.setLevel(logging.INFO)
if not logger.handlers:
    fh = logging.FileHandler("logs/app.log")
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

# ---- Config ----
CSV_PATH = os.getenv("CSV_PATH", "data/customers.csv")
MSID = os.getenv("TWILIO_MESSAGING_SERVICE_SID")
FROM_SMS = os.getenv("TWILIO_FROM_SMS")
FROM_WA  = os.getenv("TWILIO_FROM_WHATSAPP")

WC_TOKEN   = os.getenv("WHATSAPP_CLOUD_TOKEN")
WC_PHONEID = os.getenv("WHATSAPP_CLOUD_PHONE_ID")
WC_VER     = os.getenv("WHATSAPP_CLOUD_API_VERSION", "v22.0")
USE_WC     = bool(WC_TOKEN and WC_PHONEID)

# Pricing (server-side copy so audit logs record it)
CURRENCY = os.getenv("CURRENCY", "INR")
DEFAULT_PRICING_CATEGORY = os.getenv("DEFAULT_PRICING_CATEGORY", "utility").lower()
PRICE_SERVICE   = float(os.getenv("PRICE_INR_SERVICE", "0"))
PRICE_UTILITY   = float(os.getenv("PRICE_INR_UTILITY", "0"))
PRICE_MARKETING = float(os.getenv("PRICE_INR_MARKETING", "0"))

AUDIT_CSV  = Path("logs/sends.csv")
AUDIT_CSV.parent.mkdir(exist_ok=True)

def get_twilio_client() -> Client:
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    tok = os.getenv("TWILIO_AUTH_TOKEN")
    if not sid or not tok:
        raise RuntimeError("Twilio credentials missing in .env")
    return Client(sid, tok)

def load_customers() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH, dtype={"phone": "string", "area": "string", "name": "string", "account_id": "string"})
    req = {"phone", "area", "account_id"}
    missing = req - set(c.lower() for c in df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")
    df.columns = [c.lower() for c in df.columns]
    if "name" not in df.columns:
        df["name"] = ""
    df["phone"] = df["phone"].astype(str).str.strip()
    df["area"]  = df["area"].astype(str).str.strip()
    df["account_id"] = df["account_id"].astype(str).str.strip()
    return df

def phone_for_channel(raw: str, channel: str, use_wc: bool) -> str:
    raw = raw.strip()
    if channel == "whatsapp":
        return raw if use_wc else (raw if raw.startswith("whatsapp:") else f"whatsapp:{raw}")
    return raw

def compute_fingerprint(area: str, channel: str, message: str) -> str:
    h = hashlib.sha256()
    h.update(area.encode()); h.update(channel.encode()); h.update(message.encode())
    return h.hexdigest()[:16]

def unit_price_for(category: str) -> float:
    c = (category or "").lower()
    if c == "service":
        return PRICE_SERVICE
    if c == "marketing":
        return PRICE_MARKETING
    return PRICE_UTILITY  # default utility

def append_audit(area: str, channel: str, count: int, sent: int, failed: int, fp: str,
                 msg_type: str | None = None, eta: str | None = None,
                 pricing_category: str | None = None, unit_price_inr: float | None = None,
                 estimated_cost_inr: float | None = None):
    new = not AUDIT_CSV.exists()
    with AUDIT_CSV.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow([
                "timestamp_iso", "area", "channel", "count", "sent", "failed", "fingerprint",
                "msg_type", "eta",
                "pricing_category", "unit_price_inr", "estimated_cost_inr", "currency"
            ])
        w.writerow([
            datetime.utcnow().isoformat(), area, channel, count, sent, failed, fp,
            msg_type or "", eta or "",
            (pricing_category or ""), (unit_price_inr or 0), (estimated_cost_inr or 0), CURRENCY
        ])

def send_one_twilio(client: Client, to: str, channel: str, message: str) -> Tuple[str, bool, str]:
    try:
        if MSID:
            msg = client.messages.create(messaging_service_sid=MSID, to=to, body=message)
        else:
            if channel == "whatsapp":
                if not FROM_WA:
                    raise RuntimeError("TWILIO_FROM_WHATSAPP not set")
                msg = client.messages.create(from_=FROM_WA, to=to, body=message)
            else:
                if not FROM_SMS:
                    raise RuntimeError("TWILIO_FROM_SMS not set")
                msg = client.messages.create(from_=FROM_SMS, to=to, body=message)
        return to, True, msg.sid
    except Exception as e:
        return to, False, str(e)

def send_one_whatsapp_cloud(to_e164: str, message: str) -> Tuple[str, bool, str]:
    url = f"https://graph.facebook.com/{WC_VER}/{WC_PHONEID}/messages"
    headers = {"Authorization": f"Bearer {WC_TOKEN}", "Content-Type": "application/json"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to_e164,
        "type": "text",
        "text": {"preview_url": False, "body": message},
    }
    try:
        with httpx.Client(timeout=20.0) as cli:
            r = cli.post(url, headers=headers, json=payload)
        if r.is_success:
            sid = r.json().get("messages", [{}])[0].get("id", "")
            return to_e164, True, sid or "ok"
        return to_e164, False, f"{r.status_code}: {r.text}"
    except Exception as e:
        return to_e164, False, str(e)

@bp.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@bp.route("/api/public_config", methods=["GET"])
def api_public_config():
    return jsonify({
        "currency": CURRENCY,
        "default_pricing_category": DEFAULT_PRICING_CATEGORY,
        "prices": {
            "service": PRICE_SERVICE,
            "utility": PRICE_UTILITY,
            "marketing": PRICE_MARKETING
        }
    })

@bp.route("/api/areas", methods=["GET"])
def api_areas():
    try:
        df = load_customers()
        areas = sorted(a for a in df["area"].dropna().unique() if a)
        
        # Group customer data by area
        customers_by_area = {}
        for area_name, group in df.groupby("area"):
            customers_by_area[area_name] = group.to_dict(orient="records")

        counts = df.groupby("area")["phone"].count().to_dict()
        return jsonify({
            "areas": areas, 
            "counts": counts,
            "customers": customers_by_area
        })
    except FileNotFoundError:
        return jsonify({"error": f"CSV not found at {CSV_PATH}"}), 404
    except Exception as e:
        logger.exception("Failed to load areas")
        return jsonify({"error": str(e)}), 500

@bp.route("/api/send", methods=["POST"])
def api_send():
    data = request.get_json(silent=True) or {}
    area = (data.get("area") or "").strip()
    channel = (data.get("channel") or "whatsapp").strip().lower()
    message = (data.get("message") or "").strip()
    dry_run = bool(data.get("dry_run", False))
    msg_type = (data.get("msg_type") or "").strip()  # "outage" or "restored"
    eta_start = (data.get("eta_start") or "").strip()
    eta_end   = (data.get("eta_end") or "").strip()
    eta_str   = f"{eta_start}-{eta_end}" if (eta_start and eta_end) else ""
    pricing_category = (data.get("pricing_category") or DEFAULT_PRICING_CATEGORY).lower()
    unit_price = unit_price_for(pricing_category)

    if not area or not message or channel not in {"sms", "whatsapp"}:
        return jsonify({"error": "Need area, channel in {sms, whatsapp}, and message."}), 400

    try:
        df = load_customers()
    except FileNotFoundError:
        return jsonify({"error": f"CSV not found at {CSV_PATH}"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    sub = df[df["area"] == area].copy()
    if sub.empty:
        return jsonify({"error": f"No customers found in area '{area}'."}), 404

    sub["to"] = sub["phone"].apply(lambda p: phone_for_channel(p, channel, USE_WC))
    recipients = sub["to"].tolist()
    fp = compute_fingerprint(area, channel, message)

    if dry_run:
        est = unit_price * len(recipients)
        return jsonify({
            "dry_run": True,
            "area": area,
            "channel": channel,
            "message_preview": message[:160],
            "count": len(recipients),
            "fingerprint": fp,
            "whatsapp_backend": "cloud_api" if (channel=="whatsapp" and USE_WC) else "twilio",
            "pricing_category": pricing_category,
            "unit_price_inr": unit_price,
            "estimated_cost_inr": est,
            "currency": CURRENCY
        })

    successes, failures = 0, 0
    results: List[Dict[str, Any]] = []

    if channel == "whatsapp" and USE_WC:
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(send_one_whatsapp_cloud, to, message) for to in recipients]
            for fut in as_completed(futures):
                to, ok, info = fut.result()
                successes += 1 if ok else 0
                failures += 0 if ok else 1
                results.append({"to": to, "status": "sent" if ok else "error", "id_or_error": info})
                time.sleep(0.02)
    else:
        client = get_twilio_client()
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(send_one_twilio, client, to, channel, message) for to in recipients]
            for fut in as_completed(futures):
                to, ok, info = fut.result()
                successes += 1 if ok else 0
                failures += 0 if ok else 1
                results.append({"to": to, "status": "sent" if ok else "error", "id_or_error": info})
                time.sleep(0.03)

    est_cost = unit_price * successes
    logger.info(f"[{fp}] area={area} channel={channel} type={msg_type} eta={eta_str} sent={successes} fail={failures} category={pricing_category} unit={unit_price} est_cost={est_cost} {CURRENCY}")
    append_audit(area, channel, len(recipients), successes, failures, fp,
                 msg_type or None, eta_str or None, pricing_category, unit_price, est_cost)

    return jsonify({
        "dry_run": False,
        "area": area,
        "channel": channel,
        "count": len(recipients),
        "sent": successes,
        "failed": failures,
        "fingerprint": fp,
        "results_sample": results[:10],
        "whatsapp_backend": "cloud_api" if (channel=="whatsapp" and USE_WC) else "twilio",
        "pricing_category": pricing_category,
        "unit_price_inr": unit_price,
        "estimated_cost_inr": est_cost,
        "currency": CURRENCY
    })