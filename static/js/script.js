function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function buildMessage({area, msgType, ta, en, etaStart, etaEnd, customerName, accountId}) {
  const etaStr = (etaStart && etaEnd) ? `${fmtTime(etaStart)}–${fmtTime(etaEnd)}` : "no ETA";

  let taTxt = "";
  if (ta) {
    taTxt = (msgType === "outage")
      ? `வணக்கம் *${customerName}*,\n${area} பகுதியில் உள்ள உங்கள் KGM Cables இணைப்பு (கணக்கு : ${accountId}) சேவை தடையால் பாதிக்கப்பட்டுள்ளது.\nமதிப்பிடப்பட்ட செயலிழப்பு நேரம் *${etaStr}*.\nசேவை மீண்டும் இயங்கும்போது தகவல் தரப்படும்.\n- கேஜிஎம் கேபிள்ஸ்`
      : `வணக்கம் *${customerName}*,\n${area} பகுதியில் உள்ள உங்கள் KGM Cables இணைப்பில் (கணக்கு : ${accountId}) சேவை மீண்டும் இயங்குகிறது.\nஉங்கள் பொறுமைக்கு நன்றி.\n- கேஜிஎம் கேபிள்ஸ்`;
  }

  let enTxt = "";
  if (en) {
    enTxt = (msgType === "outage")
      ? `Hi *${customerName}*,\nYour KGM Cables connection (Account : ${accountId}) in ${area} is affected by a service outage.\nEstimated downtime *${etaStr}*.\nWe’ll message you once it’s restored.\n- KGM Cables`
      : `Hi *${customerName}*,\nService has been restored for your KGM Cables connection (Account : ${accountId}) in ${area}.\nThank you for your patience.\n- KGM Cables`;
  }

  return (taTxt && enTxt) ? `${taTxt}\n\n${enTxt}` : (taTxt || enTxt);
}

// ---- Pricing config (from backend; sidebar-only UI) ----
const pricing = {
  currency: "INR",
  prices: { service: 0, utility: 0, marketing: 0 },
  defaultCategory: "utility"
};

function currencyINR(amount) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${(Math.round(amount * 100) / 100).toFixed(2)}`;
  }
}

function unitPrice() {
  const key = (pricing.defaultCategory || "utility").toLowerCase();
  return pricing.prices[key] ?? 0;
}

function updateRateDisplays() {
  const unit = unitPrice();
  const cat  = (pricing.defaultCategory || "utility");
  const rateHint = document.getElementById("rateHint");
  if (rateHint) rateHint.textContent = `Rate: ${currencyINR(unit)} per delivered message`;

  const sbCat = document.getElementById("sbCategory");
  const sbRate = document.getElementById("sbRate");
  if (sbCat) sbCat.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
  if (sbRate) sbRate.textContent = `${currencyINR(unit)} / delivered`;
}

function updateEstimates(recipientCount, explicitTotal) {
  const unit = unitPrice();
  const total = (typeof explicitTotal === "number") ? explicitTotal : unit * (recipientCount || 0);

  const sbRecipients = document.getElementById("sbRecipients");
  const sbTotal = document.getElementById("sbTotal");
  if (sbRecipients) sbRecipients.textContent = String(recipientCount || 0);
  if (sbTotal) sbTotal.textContent = currencyINR(total);
}

function roundToNext5(date) {
  const d = new Date(date.getTime());
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const delta = (5 - (m % 5)) % 5;
  d.setMinutes(m + delta);
  return d;
}
function toHHMM(date) {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
function setTimeInputs(startHHMM, endHHMM) {
  const s = document.getElementById("etaStart");
  const e = document.getElementById("etaEnd");
  if (s) {
    if (s._flatpickr) s._flatpickr.setDate(startHHMM, true, "H:i");
    else s.value = startHHMM;
  }
  if (e) {
    if (e._flatpickr) e._flatpickr.setDate(endHHMM, true, "H:i");
    else e.value = endHHMM;
  }
  // trigger compose refresh
  const evt = new Event("change");
  s.dispatchEvent(evt);
  e.dispatchEvent(evt);
}

function applyQuickPick(kind) {
  const now = roundToNext5(new Date());
  if (kind === "plus_30m" || kind === "plus_1h" || kind === "plus_2h") {
    const start = new Date(now);
    const end = new Date(now);
    const minutes = (kind === "plus_30m") ? 30 : (kind === "plus_1h" ? 60 : 120);
    end.setMinutes(end.getMinutes() + minutes);
    setTimeInputs(toHHMM(start), toHHMM(end));
    return;
  }
  if (kind === "slot_14_16") { setTimeInputs("14:00", "16:00"); return; }
  if (kind === "slot_16_18") { setTimeInputs("16:00", "18:00"); return; }
  if (kind === "slot_22_01") { setTimeInputs("22:00", "01:00"); return; }
  if (kind === "clear") { setTimeInputs("", ""); return; }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Bootstrap tooltips
  if (window.bootstrap?.Tooltip) {
    const tEls = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tEls.forEach(el => new bootstrap.Tooltip(el));
  }

  // Flatpickr time pickers
  if (window.flatpickr) {
    const opts = { enableTime: true, noCalendar: true, dateFormat: "H:i", altInput: true, altFormat: "h:i K", time_24hr: false };
    flatpickr("#etaStart", opts);
    flatpickr("#etaEnd",   opts);
  }

  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.querySelector('label[for="themeToggle"] i');

  function setTheme(isLight) {
    document.body.classList.toggle("light-mode", isLight);
    themeIcon.className = isLight ? "bi bi-brightness-high-fill" : "bi bi-moon-stars-fill";
    localStorage.setItem("theme", isLight ? "light" : "dark");
    if (themeToggle) themeToggle.checked = isLight;
  }

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    setTheme(savedTheme === "light");
  }

  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      setTheme(themeToggle.checked);
    });
  }

  const areaSel   = document.getElementById("area");
  const areaCount = document.getElementById("areaCount");
  const msgBox    = document.getElementById("message");
  const sendBtn   = document.getElementById("sendBtn");
  const statusDiv = document.getElementById("status");
  const dryRunChk = document.getElementById("dryRun");
  const langTamil = document.getElementById("langTamil");
  const langEng   = document.getElementById("langEnglish");
  const etaStart  = document.getElementById("etaStart");
  const etaEnd    = document.getElementById("etaEnd");
  const msgTypeRadios = document.querySelectorAll("input[name='msgType']");

  // Quick pick handlers
  document.querySelectorAll(".quick-picks .chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-pick");
      applyQuickPick(kind);
    });
  });

  function currentMsgType() {
    const r = Array.from(msgTypeRadios).find(x => x.checked);
    return r ? r.value : "outage";
  }

  function setStatus(kind, html) {
    statusDiv.className = `status ${kind}`;
    statusDiv.innerHTML = html;
  }

  function updateComposed() {
    const area = areaSel.value || "your area";
    const customers = customersByArea[area] || [];
    const firstCustomer = customers.length > 0 ? customers[0] : { name: "Customer", account_id: "SCV-XXXXX" };

    const composed = buildMessage({
      area,
      msgType: currentMsgType(),
      ta: langTamil.checked,
      en: langEng.checked,
      etaStart: etaStart.value,
      etaEnd: etaEnd.value,
      customerName: firstCustomer.name,
      accountId: firstCustomer.account_id
    });
    msgBox.value = composed;
  }

  // Load pricing/public config
  try {
    const res = await fetch("/api/public_config");
    const cfg = await res.json();
    if (res.ok && cfg) {
      pricing.currency = cfg.currency || "INR";
      pricing.prices = cfg.prices || pricing.prices;
      pricing.defaultCategory = (cfg.default_pricing_category || "utility").toLowerCase();
    }
  } catch {}
  updateRateDisplays();

  // Load areas and initialize estimates
  let lastRecipientCount = 0;
  let customersByArea = {};
  try {
    const res = await fetch("/api/areas");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load areas");

    customersByArea = data.customers || {};
    areaSel.innerHTML = "";
    data.areas.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      areaSel.appendChild(opt);
    });

    function updateCount() {
      const a = areaSel.value;
      const n = data.counts[a] || 0;
      lastRecipientCount = n;
      areaCount.textContent = `${n} recipient${n === 1 ? "" : "s"} in this area`;
      updateComposed();
      updateEstimates(lastRecipientCount);
    }
    areaSel.addEventListener("change", updateCount);
    updateCount();
  } catch (e) {
    setStatus("error", `Error loading areas: ${e.message}`);
  }

  // Compose interactions
  [...msgTypeRadios].forEach(r => r.addEventListener("change", updateComposed));
  langTamil.addEventListener("change", updateComposed);
  langEng.addEventListener("change", updateComposed);
  etaStart.addEventListener("change", updateComposed);
  etaEnd.addEventListener("change", updateComposed);

  // Send
  sendBtn.addEventListener("click", async () => {
    const area = areaSel.value;
    const message = msgBox.value.trim();
    const dry_run = !!dryRunChk.checked;

    if (!area || !message) {
      setStatus("error", "Please choose an area and keep a message.");
      return;
    }

    const payload = {
      area,
      channel: "whatsapp",
      message,
      dry_run,
      msg_type: currentMsgType(),
      eta_start: etaStart.value || null,
      eta_end: etaEnd.value || null
    };

    sendBtn.disabled = true;
    setStatus("sending", "Sending…");

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      const unit = (data.unit_price_inr != null) ? data.unit_price_inr : unitPrice();

      if (data.dry_run) {
        const previewEst = unit * data.count;
        setStatus("info",
          `Dry run ✅<br>Area: <b>${data.area}</b> | Type: <b>${payload.msg_type}</b><br>` +
          (payload.eta_start && payload.eta_end ? `ETA: <b>${fmtTime(payload.eta_start)}–${fmtTime(payload.eta_end)}</b><br>` : "") +
          `Recipients: <b>${data.count}</b><br>` +
          `Pricing: <b>${(data.pricing_category || pricing.defaultCategory)}</b> @ <b>${currencyINR(unit)}</b> → ` +
          `<b>${currencyINR(previewEst)}</b>`
        );
        updateEstimates(data.count, previewEst);
      } else {
        const runCost = (typeof data.estimated_cost_inr === "number") ? data.estimated_cost_inr : unit * (data.sent || 0);

        setStatus((data.failed ?? 0) === 0 ? "success" : "warn",
          `Done ✅ Type: <b>${payload.msg_type}</b> | Sent: <b>${data.sent}</b> | Failed: <b>${data.failed}</b><br>` +
          `Pricing: <b>${(data.pricing_category || pricing.defaultCategory)}</b> @ <b>${currencyINR(unit)}</b> → ` +
          `<b>${currencyINR(runCost)}</b>`
        );
        updateEstimates((data.sent || 0), runCost);
      }
    } catch (e) {
      setStatus("error", `Error: ${e.message}`);
    } finally {
      sendBtn.disabled = false;
    }
  });

  // Initial compose
  updateComposed();
});