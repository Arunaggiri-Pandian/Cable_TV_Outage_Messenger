function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function buildMessage({area, msgType, ta, en, etaStart, etaEnd}) {
  const etaStr = (etaStart && etaEnd) ? `${fmtTime(etaStart)}–${fmtTime(etaEnd)}` : "";

  // ---------- Tamil ----------
  let taTxt = "";
  if (ta) {
    if (msgType === "outage") {
      taTxt =
        `அன்புள்ள வாடிக்கையாளர், ${area} பகுதியில் சேவை தடை ஏற்பட்டுள்ளது.` +
        (etaStr ? ` மதிப்பிடப்பட்ட செயலிழப்பு நேரம் ${etaStr}.` : "") +
        ` எங்கள் குழு விரைவில் சரிசெய்கிறது. சேவை மீண்டும் இயங்கும் போது தகவல் தரப்படும். – KGM Cables`;
    } else {
      taTxt =
        `சிறந்த செய்தி: ${area} பகுதியில் சேவை மீண்டும் இயங்குகிறது. உங்கள் பொறுமைக்கு நன்றி. – KGM Cables`;
    }
  }

  // ---------- English ----------
  let enTxt = "";
  if (en) {
    if (msgType === "outage") {
      enTxt =
        `Dear customer, there is a service outage in ${area}.` +
        (etaStr ? ` Estimated downtime ${etaStr}.` : "") +
        ` Our team is working to restore it ASAP. We’ll notify you once it’s back. – KGM Cables`;
    } else {
      enTxt =
        `Good news: service has been restored in ${area}. Thank you for your patience. – KGM Cables`;
    }
  }

  // Join with a blank line if both present
  if (taTxt && enTxt) return `${taTxt}\n\n${enTxt}`;
  return taTxt || enTxt;
}

document.addEventListener("DOMContentLoaded", async () => {
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
    const composed = buildMessage({
      area,
      msgType: currentMsgType(),
      ta: langTamil.checked,
      en: langEng.checked,
      etaStart: etaStart.value,
      etaEnd: etaEnd.value
    });
    msgBox.value = composed;
  }

  // Load areas
  try {
    const res = await fetch("/api/areas");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load areas");

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
      areaCount.textContent = `${n} recipient${n === 1 ? "" : "s"} in this area`;
      updateComposed();
    }
    areaSel.addEventListener("change", updateCount);
    updateCount();
  } catch (e) {
    setStatus("error", `Error loading areas: ${e.message}`);
  }

  // Wire up composer inputs
  [...msgTypeRadios].forEach(r => r.addEventListener("change", updateComposed));
  langTamil.addEventListener("change", updateComposed);
  langEng.addEventListener("change", updateComposed);
  etaStart.addEventListener("change", updateComposed);
  etaEnd.addEventListener("change", updateComposed);

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
      channel: "whatsapp",              // WhatsApp-first rollout
      message,
      dry_run,
      msg_type: currentMsgType(),
      eta_start: etaStart.value || null,
      eta_end: etaEnd.value || null,
      langs: {
        ta: langTamil.checked,
        en: langEng.checked
      }
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

      if (data.dry_run) {
        setStatus("info",
          `Dry run ✅<br>Area: <b>${data.area}</b> | Type: <b>${payload.msg_type}</b><br>` +
          (payload.eta_start && payload.eta_end ? `ETA: <b>${fmtTime(payload.eta_start)}–${fmtTime(payload.eta_end)}</b><br>` : "") +
          `Recipients: <b>${data.count}</b><br>` +
          `Fingerprint: <code>${data.fingerprint}</code><br>` +
          `Backend: <code>${data.whatsapp_backend}</code>`
        );
      } else {
        setStatus((data.failed ?? 0) === 0 ? "success" : "warn",
          `Done ✅ Type: <b>${payload.msg_type}</b> | Sent: <b>${data.sent}</b> | Failed: <b>${data.failed}</b><br>` +
          `Fingerprint: <code>${data.fingerprint}</code>`
        );
      }
    } catch (e) {
      setStatus("error", `Error: ${e.message}`);
    } finally {
      sendBtn.disabled = false;
    }
  });

  // first pass
  updateComposed();
});