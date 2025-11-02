function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function buildMessage({area, msgType, ta, en, etaStart, etaEnd, customerName}) {
  const etaStr = (etaStart && etaEnd) ? `${fmtTime(etaStart)}–${fmtTime(etaEnd)}` : "no ETA";

  let taTxt = "";
  if (ta) {
    taTxt = (msgType === "outage")
      ? `வணக்கம் *${customerName}*,\n${area} பகுதியில் உள்ள உங்கள் KGM Cables இணைப்பு சேவை தடையால் பாதிக்கப்பட்டுள்ளது.\nமதிப்பிடப்பட்ட செயலிழப்பு நேரம் *${etaStr}*.\nசேவை மீண்டும் இயங்கும்போது தகவல் தரப்படும்.\n- கேஜிஎம் கேபிள்ஸ்`
      : `வணக்கம் *${customerName}*,\n${area} பகுதியில் உள்ள உங்கள் KGM Cables இணைப்பில் சேவை மீண்டும் இயங்குகிறது.\nஉங்கள் பொறுமைக்கு நன்றி.\n- கேஜிஎம் கேபிள்ஸ்`;
  }

  let enTxt = "";
  if (en) {
    enTxt = (msgType === "outage")
      ? `Hi *${customerName}*,\nYour KGM Cables connection in ${area} is affected by a service outage.\nEstimated downtime *${etaStr}*.\nWe’ll message you once it’s restored.\n- KGM Cables`
      : `Hi *${customerName}*,\nService has been restored for your KGM Cables connection in ${area}.\nThank you for your patience.\n- KGM Cables`;
  }

  return (taTxt && enTxt) ? `${taTxt}\n\n${enTxt}` : (taTxt || enTxt);
}

function buildTemplatePreview({area, msgType, etaStart, etaEnd, customerName, ta, en}) {
    const etaStr = (etaStart && etaEnd) ? `${fmtTime(etaStart)}–${fmtTime(etaEnd)}` : "{{3}}";
    const name = customerName || "{{1}}";
    const areaName = area || "{{2}}";

    let enTxt = "";
    if (en) {
        if (msgType === "restored") {
            enTxt = `Service Update\nHi ${name},\nService has been restored for your Cable TV connection in ${areaName}.\nThank you for your patience.\n\n- KGM Cables`;
        } else {
            enTxt = `Service Outage\nHi ${name},\nYour Cable connection in ${areaName} is affected by a service outage.\nEstimated downtime is ${etaStr}.\nWe’ll message you once it is restored.\n\n- KGM Cables`;
        }
    }

    let taTxt = "";
    if (ta) {
        if (msgType === "restored") {
            taTxt = `சேவை அறிவிப்பு\nவணக்கம் ${name},\n${areaName} பகுதியில் உள்ள உங்கள் கேபிள் டிவி இணைப்பில் சேவை மீண்டும் இயங்குகிறது.\nஉங்கள் பொறுமைக்கு நன்றி.\n\n- கேஜிஎம் கேபிள்ஸ்`;
        } else {
            taTxt = `சேவை தடை\nவணக்கம் ${name},\n${areaName} பகுதியில் உள்ள உங்கள் கேபிள் இணைப்பு சேவை தடையால் பாதிக்கப்பட்டுள்ளது.\nமதிப்பிடப்பட்ட செயலிழப்பு நேரம் ${etaStr}.\nசேவை மீண்டும் இயங்கும்போது தகவல் தரப்படும்.\n\n- கேஜிஎம் கேபிள்ஸ்`;
        }
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
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 4 }).format(amount);
  } catch {
    return `₹${(Math.round(amount * 10000) / 10000).toFixed(4)}`;
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
  const templatePreview = document.getElementById("templatePreview");
  const sendBtn   = document.getElementById("sendBtn");
  const statusDiv = document.getElementById("status");
  const dryRunChk = document.getElementById("dryRun");
  const langTamil = document.getElementById("langTamil");
  const langEng   = document.getElementById("langEnglish");
  const etaStart  = document.getElementById("etaStart");
  const etaEnd    = document.getElementById("etaEnd");
  const msgTypeRadios = document.querySelectorAll('input[name="msgType"]');
  const msgTypeHelp = document.getElementById("msgTypeHelp");
  const channelRadios = document.querySelectorAll("input[name='channel']");
  const msgTypeLabel = document.querySelector("label[for='msg_type']");

  // Tooltip content for the message type toggle
  const msgTypeTooltips = {
    outage: "Sends a one-way outage alert to the selected area with optional ETA.",
    restored: "Sends a one-way notice that service is restored for the selected area."
  };

  // Function to update the tooltip content
  function updateMsgTypeHelp() {
    if (!msgTypeHelp) return;
    const currentType = getCurrentMsgType();
    const tooltipText = msgTypeTooltips[currentType];
    
    // Update the tooltip's title attribute
    msgTypeHelp.setAttribute('data-bs-title', tooltipText);

    // If the tooltip is already initialized by Bootstrap, you need to update it
    const tooltipInstance = bootstrap.Tooltip.getInstance(msgTypeHelp);
    if (tooltipInstance) {
      tooltipInstance.setContent({ '.tooltip-inner': tooltipText });
    }
  }

  // Quick pick handlers
  document.querySelectorAll(".quick-picks .chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-pick");
      applyQuickPick(kind);
    });
  });

  function currentChannel() {
    const r = Array.from(channelRadios).find(x => x.checked);
    return r ? r.value : "whatsapp";
  }

  function getCurrentMsgType() {
    const checked = Array.from(msgTypeRadios).find(r => r.checked);
    return checked ? checked.value : "outage";
  }

  function updateChannelUI() {
    const isWhatsApp = currentChannel() === 'whatsapp';
    msgBox.style.display = isWhatsApp ? 'none' : 'block';
    templatePreview.style.display = isWhatsApp ? 'block' : 'none';
    if (msgTypeLabel) msgTypeLabel.style.display = isWhatsApp ? 'none' : 'block';
  }

  function setStatus(kind, html) {
    statusDiv.className = `status ${kind}`;
    statusDiv.innerHTML = html;
  }

    function updateComposed() {

      const area = areaChoices ? areaChoices.getValue(true) : "";

      if (!area) return;

  

      const customers = customersByArea[area] || [];

      const firstCustomer = customers.length > 0 ? customers[0] : { name: "Customer" };

      const msgType = getCurrentMsgType();

      const selectedLang = document.querySelector('input[name="lang"]:checked')?.value;

  

      // For SMS (legacy)

      const composedSms = buildMessage({

        area,

        msgType: msgType,

        ta: selectedLang === 'ta' || selectedLang === 'both',

        en: selectedLang === 'en' || selectedLang === 'both',

        etaStart: etaStart.value,

        etaEnd: etaEnd.value,

        customerName: firstCustomer.name

      });

      msgBox.value = composedSms;

  

      // For WhatsApp (template preview)

      const composedWa = buildTemplatePreview({

          area,

          msgType: msgType,

          etaStart: etaStart.value,

          etaEnd: etaEnd.value,

          customerName: firstCustomer.name,

          ta: selectedLang === 'ta' || selectedLang === 'both',

          en: selectedLang === 'en' || selectedLang === 'both'

      });

      templatePreview.textContent = composedWa;

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
  let areaChoices = null; // To hold the Choices.js instance

  try {
    const res = await fetch("/api/areas");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load areas");

    if (data.customers) {
      customersByArea = data.customers;
    }

    // Clear existing options
    areaSel.innerHTML = '<option value="">Select an area...</option>';
    
    // Create an array of choices for the library
    const areaOptions = data.areas.map(a => ({
      value: a,
      label: a,
      selected: false,
      disabled: false,
    }));

    // Destroy previous instance if it exists
    if (areaChoices) {
      areaChoices.destroy();
    }

    // Initialize Choices.js
    areaChoices = new Choices(areaSel, {
      choices: areaOptions,
      searchEnabled: true,
      itemSelectText: 'Press to select',
      removeItemButton: false,
      placeholder: true,
      placeholderValue: 'Select an area...'
    });

    function updateCount() {
      const a = areaChoices.getValue(true); // Get value from Choices.js instance
      const n = a ? (data.counts[a] || 0) : 0;
      lastRecipientCount = n;
      areaCount.textContent = a ? `${n} recipient${n === 1 ? "" : "s"} in this area` : "";
      updateComposed();
      updateEstimates(lastRecipientCount);
    }
    areaSel.addEventListener("change", updateCount);
    updateCount();
  } catch (e) {
    console.error("Failed to load area data:", e);
    setStatus("error", `Error loading areas: ${e.message}`);
  }

  // Compose interactions
  msgTypeRadios.forEach(r => r.addEventListener("change", () => {
    updateComposed();
    updateMsgTypeHelp();
  }));
  langTamil.addEventListener("change", updateComposed);
  langEng.addEventListener("change", updateComposed);
  etaStart.addEventListener("change", updateComposed);
  etaEnd.addEventListener("change", updateComposed);
  channelRadios.forEach(r => r.addEventListener("change", () => {
    updateChannelUI();
    updateComposed();
  }));

  // Set initial state
  updateChannelUI();
  updateComposed();
  updateMsgTypeHelp();

  // Send
  sendBtn.addEventListener("click", async () => {
    const area = areaChoices ? areaChoices.getValue(true) : "";
    const dry_run = dryRunChk.checked;
    const message = msgBox.value;
    const msg_type = getCurrentMsgType();
    const channel = currentChannel();
    const eta_start = etaStart.value;
    const eta_end = etaEnd.value;
    const pricing_category = pricing.defaultCategory;
    
    const selectedLang = document.querySelector('input[name="lang"]:checked')?.value;
    const langs = {
        en: selectedLang === 'en' || selectedLang === 'both',
        ta: selectedLang === 'ta' || selectedLang === 'both'
    };

    if (!area) {
        // This function doesn't exist, so I'm replacing it with a standard alert.
        alert('Please select an area first.');
        return;
    }

    const payload = { area, channel, message, msg_type, dry_run, eta_start, eta_end, pricing_category, langs };

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
          `Messages (incl. both languages): <b>${data.count}</b><br>` +
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
});
