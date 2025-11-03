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

  // Theme state, default to dark
  let isLight = localStorage.getItem("theme") === "light";

  function setTheme(light) {
    const themeIcon = document.getElementById("themeIcon");
    const themeText = document.getElementById("themeText");

    document.body.classList.toggle("light-mode", light);
    if (themeIcon) {
      themeIcon.className = light ? 'bi bi-brightness-high-fill' : 'bi bi-moon-stars-fill';
    }
    if (themeText) {
      themeText.textContent = light ? 'Light' : 'Dark';
    }
    localStorage.setItem("theme", light ? "light" : "dark");
    isLight = light;
  }

  // Set initial theme
  setTheme(isLight);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTheme(!isLight);
    });
  }

  const areaSel   = document.getElementById("area");
  const areaCount = document.getElementById("areaCount");
  const msgBox    = document.getElementById("message");
  const templatePreview = document.getElementById("templatePreview");
  const sendBtn   = document.getElementById("sendBtn");
  const dryRunBtn = document.getElementById("dryRunBtn");
  const statusDiv = document.getElementById("status");
  const langTamil = document.getElementById("langTamil");
  const langEng   = document.getElementById("langEnglish");
  const etaStart  = document.getElementById("etaStart");
  const etaEnd    = document.getElementById("etaEnd");
  const etaSection = document.getElementById("etaSection");
  const msgTypeRadios = document.querySelectorAll('input[name="msgType"]');
  const channelRadios = document.querySelectorAll("input[name='channel']");
  const msgTypeLabel = document.querySelector("label[for='msg_type']");

  // Quick pick handlers
  document.querySelectorAll(".quick-picks .chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-pick");
      applyQuickPick(kind);
    });
  });

  function handleMsgTypeChange() {
    const msgType = getCurrentMsgType();
    if (etaSection) {
      if (msgType === 'outage') {
        etaSection.style.display = 'block';
      } else {
        etaSection.style.display = 'none';
        setTimeInputs("", ""); // Clear ETA when not an outage
      }
    }
    updateComposed();
  }

  function currentChannel() {
    const r = Array.from(channelRadios).find(x => x.checked);
    return r ? r.value : "whatsapp";
  }

  function getCurrentMsgType() {
    const checked = Array.from(msgTypeRadios).find(r => r.checked);
    return checked ? checked.value : null;
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
      searchPlaceholderValue: 'Type to search for an area...',
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
      
      // Add/remove class for styling the selected state
      const container = areaChoices.containerOuter.element;
      if (a) {
        container.classList.add('is-selected');
      } else {
        container.classList.remove('is-selected');
      }

      updateComposed();
      updateEstimates(lastRecipientCount);
    }
    areaSel.addEventListener("change", updateCount);
    updateCount();
  } catch (e) {
    console.error("Failed to load area data:", e);
    setStatus("error", `Error loading areas: ${e.message}`);
  }

  // --- State & Disabling Logic ---
  function disableSendBtn() {
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.disabled = true;
    }
  }

  // Compose interactions
  msgTypeRadios.forEach(r => r.addEventListener("change", () => {
    handleMsgTypeChange();
    disableSendBtn();
  }));
  areaSel.addEventListener("change", () => {
    updateCount();
    disableSendBtn();
  });
  langTamil.addEventListener("change", () => { updateComposed(); disableSendBtn(); });
  langEng.addEventListener("change", () => { updateComposed(); disableSendBtn(); });
  etaStart.addEventListener("change", () => { updateComposed(); disableSendBtn(); });
  etaEnd.addEventListener("change", () => { updateComposed(); disableSendBtn(); });
  channelRadios.forEach(r => r.addEventListener("change", () => {
    updateChannelUI();
    updateComposed();
    disableSendBtn();
  }));

  // Set initial state
  updateChannelUI();
  updateComposed();
  handleMsgTypeChange();

  // --- Send Logic ---
  async function sendRequest(isDryRun) {
    const area = areaChoices ? areaChoices.getValue(true) : "";
    const msg_type = getCurrentMsgType();
    const selectedLang = document.querySelector('input[name="lang"]:checked');

    // --- VALIDATION ---
    if (!area) {
      setStatus("error", "Please select an area before sending.");
      return;
    }
    if (!msg_type) {
      setStatus("error", "Please select a message type (Outage or Restored).");
      return;
    }
    if (!selectedLang) {
      setStatus("error", "Please select a language before sending.");
      return;
    }

    const message = msgBox.value;
    const channel = currentChannel();
    const eta_start = etaStart.value;
    const eta_end = etaEnd.value;
    const pricing_category = pricing.defaultCategory;
    
    const langs = {
        en: selectedLang.value === 'en' || selectedLang.value === 'both',
        ta: selectedLang.value === 'ta' || selectedLang.value === 'both'
    };

    const payload = { area, channel, message, msg_type, dry_run: isDryRun, eta_start, eta_end, pricing_category, langs };

    sendBtn.disabled = true; // Always disable during a request
    dryRunBtn.disabled = true;
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
        sendBtn.disabled = false; // Enable live send button after successful dry run
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
      // If the session expired, notify the user and start a countdown to reload.
      // The user can change the countdown timer here.
      // The value is in seconds.
      let countdown = 1800; // 30 minutes
      const updateMessage = () => {
        const secondsText = countdown === 1 ? "second" : "seconds";
        setStatus("warn", `Your session has expired. Redirecting in ${countdown} ${secondsText}...`);
      };

      updateMessage(); // Initial message
      const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          updateMessage();
        } else {
          clearInterval(interval);
          window.location.reload();
        }
      }, 1000);
      return; // Stop further execution in the 'finally' block
    } finally {
      dryRunBtn.disabled = false; // Always re-enable dry run button
    }
  }

  dryRunBtn.addEventListener("click", () => sendRequest(true));
  sendBtn.addEventListener("click", () => sendRequest(false));
});
