import hashlib
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List, Tuple
import json
from functools import wraps

import httpx
import pandas as pd
from flask import Blueprint, jsonify, render_template, request, session, redirect, url_for, flash, current_app
from twilio.rest import Client
from datetime import datetime
from pathlib import Path
import csv

from app.templates import TEMPLATE_MAP

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

# MSG91 config
MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY")
MSG91_WHATSAPP_SENDER = os.getenv("MSG91_WHATSAPP_SENDER")
MSG91_TEMPLATE_ID = os.getenv("MSG91_TEMPLATE_ID")
MSG91_WHATSAPP_NAMESPACE = os.getenv("MSG91_WHATSAPP_NAMESPACE", "79a7603e_9c5b_4a2f_87c4_de68dbff06d0")
MSG91_BULK_API_URL = os.getenv("MSG91_BULK_API_URL", "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/")
USE_MSG91 = bool(MSG91_AUTH_KEY and MSG91_WHATSAPP_SENDER)

# Template mode switch (use approved templates)
WA_TEMPLATE_MODE = os.getenv("WA_TEMPLATE_MODE", "0").strip().lower() in {"1", "true", "yes", "on"}

# Template names
TPL_OUTAGE_EN   = os.getenv("WA_TPL_OUTAGE_EN",   "").strip()
TPL_OUTAGE_TA   = os.getenv("WA_TPL_OUTAGE_TA",   "").strip()
TPL_RESTORED_EN = os.getenv("WA_TPL_RESTORED_EN", "").strip()
TPL_RESTORED_TA = os.getenv("WA_TPL_RESTORED_TA", "").strip()

# Locales
LANG_EN = os.getenv("WA_LANG_EN", "en_US").strip()
LANG_TA = os.getenv("WA_LANG_TA", "ta_IN").strip()

# Password Protection
PASSWORD_PROTECT = os.getenv("PASSWORD_PROTECT", "false").lower() == "true"
APP_PASSWORD = os.getenv("APP_PASSWORD")


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
    df = pd.read_csv(CSV_PATH, dtype={"phone": "string", "area": "string", "name": "string"})
    req = {"phone", "area"}
    missing = req - set(c.lower() for c in df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")
    df.columns = [c.lower() for c in df.columns]
    if "name" not in df.columns:
        df["name"] = ""
    df["phone"] = df["phone"].astype(str).str.strip()
    df["area"]  = df["area"].astype(str).str.strip()
    return df

def phone_for_channel(raw: str, channel: str, use_wc: bool, use_msg91: bool) -> str:
    raw = raw.strip()
    if channel == "whatsapp":
        if use_msg91:
            # MSG91 for India needs the 91 prefix
            if not raw.startswith("91"):
                return f"91{raw}"
            return raw
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

# -------- Login Gatekeeper --------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if PASSWORD_PROTECT and not session.get('logged_in'):
            return redirect(url_for('main.login'))
        return f(*args, **kwargs)
    return decorated_function

# -------- WhatsApp Cloud senders --------


def send_one_whatsapp_template(to_e164: str, template_name: str, lang_code: str) -> Tuple[str, bool, str]:
    url = f"https://graph.facebook.com/{WC_VER}/{WC_PHONEID}/messages"
    headers = {"Authorization": f"Bearer {WC_TOKEN}", "Content-Type": "application/json"}
    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to_e164,
        "type": "template",
        "template": { "name": template_name, "language": {"code": lang_code} }
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

def send_one_whatsapp_text(to_e164: str, message: str) -> Tuple[str, bool, str]:
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



def send_bulk_whatsapp_msg91(recipients: List[Dict[str, Any]], template_key: str, eta_window: str) -> List[Tuple[str, bool, str]]:
    results: List[Tuple[str, bool, str]] = []
    if not recipients:
        return results

    template_def = TEMPLATE_MAP.get(template_key)
    if not template_def:
        raise ValueError(f"Invalid template key: {template_key}")

    to_numbers = [r["to"] for r in recipients]
    
    # For simplicity, this example sends the same dynamic data to all recipients in the bulk message.
    # In a real-world scenario, you might need to send different data to each recipient.
    
    r = recipients[0] # Use the first recipient's data for the template
    name = (r.get("name") or "").strip() or "Customer"
    area_str = r.get("area") or ""
    
    
    payload_components = {}
    for p in template_def["placeholders"]:
        if p["key"] == "name":
            payload_components[p["component"]] = {"type": "text", "value": name}
        elif p["key"] == "area":
            payload_components[p["component"]] = {"type": "text", "value": area_str}
        elif p["key"] == "eta":
            payload_components[p["component"]] = {"type": "text", "value": eta_window}


    payload = {
        "integrated_number": MSG91_WHATSAPP_SENDER,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": template_def["name"],
                "language": template_def["language"],
                "namespace": template_def["namespace"],
                "to_and_components": [
                    {
                        "to": to_numbers,
                        "components": payload_components
                    }
                ]
            }
        }
    }

    logger.info(f"MSG91 Request Payload: {json.dumps(payload, indent=2)}")

    headers = {"authkey": MSG91_AUTH_KEY, "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=120.0) as cli:
            r = cli.post(MSG91_BULK_API_URL, headers=headers, json=payload)
        
        logger.info(f"MSG91 Response: {r.status_code} {r.text}")

        if r.is_success:
            for rcp in recipients:
                results.append((rcp["to"], True, "ok"))
            return results
        else:
            for rcp in recipients:
                results.append((rcp["to"], False, f"{r.status_code}: {r.text}"))
            return results
    except Exception as e:
        logger.error(f"MSG91 Exception: {e}")
        for rcp in recipients:
            results.append((rcp["to"], False, str(e)))
        return results


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

# -------- Routes --------
@bp.route("/", methods=["GET"])
@login_required
def index():
    return render_template("index.html")

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if not PASSWORD_PROTECT or session.get('logged_in'):
        return redirect(url_for('main.index'))

    if request.method == 'POST':
        password = request.form.get('password')
        if APP_PASSWORD and password == APP_PASSWORD:
            session['logged_in'] = True
            session.permanent = True  # Use the configured timed session
            return redirect(url_for('main.index'))
        else:
            flash('Incorrect password. Please try again.', 'danger')
    return render_template('login.html')

@bp.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('main.login'))

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
@login_required
def api_areas():
    try:
        df = load_customers()
        areas = sorted(a for a in df["area"].dropna().unique() if a)
        customers_by_area: Dict[str, List[Dict[str, Any]]] = {}
        for area_name, group in df.groupby("area"):
            customers_by_area[area_name] = group.to_dict(orient="records")
        counts = df.groupby("area")["phone"].count().to_dict()
        return jsonify({"areas": areas, "counts": counts, "customers": customers_by_area})
    except FileNotFoundError:
        return jsonify({"error": f"CSV not found at {CSV_PATH}"}), 404
    except Exception as e:
        logger.exception("Failed to load areas")
        return jsonify({"error": str(e)}), 500

@bp.route("/api/send", methods=["POST"])
@login_required
def api_send():
    data = request.get_json(silent=True) or {}
    area = (data.get("area") or "").strip()
    channel = (data.get("channel") or "whatsapp").strip().lower()
    message = (data.get("message") or "").strip()  # still used for preview / Twilio text
    dry_run = bool(data.get("dry_run", False))
    msg_type = (data.get("msg_type") or "").strip()  # "outage" or "restored"
    eta_start = (data.get("eta_start") or "").strip()
    eta_end   = (data.get("eta_end") or "").strip()
    eta_str   = f"{eta_start}-{eta_end}" if (eta_start and eta_end) else ""
    pricing_category = (data.get("pricing_category") or DEFAULT_PRICING_CATEGORY).lower()
    unit_price = unit_price_for(pricing_category)

    langs = data.get("langs") or {}
    want_ta = bool(langs.get("ta", True))
    want_en = bool(langs.get("en", True))

    if not area or channel not in {"sms", "whatsapp"}:
        return jsonify({"error": "Need area and channel in {sms, whatsapp}."}), 400

    # recipients
    try:
        df = load_customers()
    except FileNotFoundError:
        return jsonify({"error": f"CSV not found at {CSV_PATH}"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    sub = df[df["area"] == area].copy()
    if sub.empty:
        return jsonify({"error": f"No customers found in area '{area}'."}), 404

    sub["to"] = sub["phone"].apply(lambda p: phone_for_channel(p, channel, USE_WC, USE_MSG91))
    recipients = sub.to_dict(orient="records")
    fp = compute_fingerprint(area, channel, (message or f"{msg_type}:{eta_str}"))

    # estimate for dry-run (per language selection)
    num_langs = (1 if want_en else 0) + (1 if want_ta else 0)
    if dry_run:
        est = unit_price * (len(recipients) * max(1, num_langs))
        return jsonify({
            "dry_run": True,
            "area": area,
            "channel": channel,
            "message_preview": (message or "")[:160],
            "count": len(recipients) * max(1, num_langs),
            "fingerprint": fp,
            "whatsapp_backend": "msg91" if (channel=="whatsapp" and USE_MSG91) else "cloud_api" if (channel=="whatsapp" and USE_WC) else "twilio",
            "pricing_category": pricing_category,
            "unit_price_inr": unit_price,
            "estimated_cost_inr": est,
            "currency": CURRENCY
        })

    # format ETA for templates (human string like '10:00 AM–1:00 PM')
    def fmt_eta(es: str, ee: str) -> str:
        def _fmt(hhmm: str) -> str:
            if not hhmm: return ""
            h, m = [int(x) for x in hhmm.split(":")]
            ampm = "PM" if h >= 12 else "AM"
            h12 = ((h + 11) % 12) + 1
            return f"{h12:02d}:{m:02d} {ampm}"
        return f"{_fmt(es)}–{_fmt(ee)}" if (es and ee) else ""

    eta_window = fmt_eta(eta_start, eta_end)

    successes, failures = 0, 0
    results: List[Dict[str, Any]] = []

    if channel == "whatsapp" and USE_MSG91:
        # Multi-language support for MSG91
        for lang_key, is_wanted in (langs or {}).items():
            if not is_wanted:
                continue
            
            lang_name = "english" if lang_key == "en" else "tamil" if lang_key == "ta" else None
            if not lang_name:
                continue

            template_key = f"{msg_type}_{lang_name}"
            bulk_results = send_bulk_whatsapp_msg91(recipients, template_key, eta_window)
            for to, ok, info in bulk_results:
                successes += 1 if ok else 0
                failures += 0 if ok else 1
                results.append({"to": to, "status": "sent" if ok else "error", "id_or_error": info, "lang": lang_key})

    elif channel == "whatsapp" and USE_WC and WA_TEMPLATE_MODE:
        # choose template + order by msg type & language
        def choose_tpl_and_order(mt: str, lang: str) -> Tuple[str, str]:
            if mt == "restored":
                if lang == "en": return (TPL_RESTORED_EN, LANG_EN)
                if lang == "ta": return (TPL_RESTORED_TA, LANG_TA)
            else:
                if lang == "en": return (TPL_OUTAGE_EN, LANG_EN)
                if lang == "ta": return (TPL_OUTAGE_TA, LANG_TA)
            return ("", "")

        tasks: List[Tuple[str, str, str]] = []
        for row in recipients:
            to = row["to"]
            name = (row.get("name") or "").strip() or "Customer"
            area_str = row.get("area") or area

            for lang_flag, lang_key in [(want_en, "en"), (want_ta, "ta")]:
                if not lang_flag:
                    continue
                tpl_name, locale = choose_tpl_and_order(msg_type or "outage", lang_key)
                if not tpl_name:
                    continue
                tasks.append((to, tpl_name, locale))

        # fallback: if no language selected, at least send English
        if not tasks:
            tpl_name, locale = choose_tpl_and_order(msg_type or "outage", "en")
            for row in recipients:
                to = row["to"]
                name = (row.get("name") or "").strip() or "Customer"
                account = (row.get("account_id") or "").strip() or "SCV-XXXXX"
                area_str = row.get("area") or area
                tasks.append((to, tpl_name, locale))

        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(send_one_whatsapp_template, to, tpl, loc) for (to, tpl, loc) in tasks]
            for fut in as_completed(futures):
                to, ok, info = fut.result()
                successes += 1 if ok else 0
                failures += 0 if ok else 1
                results.append({"to": to, "status": "sent" if ok else "error", "id_or_error": info})
                time.sleep(0.02)

    elif channel == "whatsapp" and USE_WC and not WA_TEMPLATE_MODE:
        # free-form text via Cloud (older behaviour)
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(send_one_whatsapp_text, r["to"], message) for r in recipients]
            for fut in as_completed(futures):
                to, ok, info = fut.result()
                successes += 1 if ok else 0
                failures += 0 if ok else 1
                results.append({"to": to, "status": "sent" if ok else "error", "id_or_error": info})
                time.sleep(0.02)

    else:
        # Twilio path (SMS/WhatsApp via Twilio)
        client = get_twilio_client()
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(send_one_twilio, client, r["to"], channel, message) for r in recipients]
            for fut in as_completed(futures):
                to, ok, info = fut.result()
                successes += 1 if ok else 0
                failures += 0 if ok else 1
                results.append({"to": to, "status": "sent" if ok else "error", "id_or_error": info})
                time.sleep(0.03)

    est_cost = unit_price * successes
    logger.info(f"[{fp}] area={area} channel={channel} type={msg_type} eta={eta_str} sent={successes} fail={failures} "
                f"category={pricing_category} unit={unit_price} est_cost={est_cost} {CURRENCY} tpl_mode={WA_TEMPLATE_MODE}")
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
        "whatsapp_backend": "msg91" if (channel=="whatsapp" and USE_MSG91) else "cloud_api" if (channel=="whatsapp" and USE_WC) else "twilio",
        "pricing_category": pricing_category,
        "unit_price_inr": unit_price,
        "estimated_cost_inr": est_cost,
        "currency": CURRENCY
    })