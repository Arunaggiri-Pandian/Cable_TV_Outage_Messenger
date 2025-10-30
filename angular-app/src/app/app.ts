import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class App implements OnInit {
  sidebarOpen = false;
  pricing: any = { prices: {} };
  areas: string[] = [];
  customersByArea: any = {};
  selectedArea: string = '';
  recipientCount = 0;
  msgType = 'outage';
  langTamil = true;
  langEnglish = true;
  etaStart = '';
  etaEnd = '';
  dryRun = true;
  composedMessage = '';
  sending = false;
  status: { kind: string, html: string } = { kind: '', html: '' };

  constructor(private apiService: ApiService) { }

  ngOnInit() {
    this.loadPublicConfig();
    this.loadAreas();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleTheme() {
    document.body.classList.toggle('light-mode');
  }

  loadPublicConfig() {
    this.apiService.getPublicConfig().subscribe(config => {
      this.pricing = config;
    });
  }

  loadAreas() {
    this.apiService.getAreas().subscribe(
      data => {
        this.areas = data.areas;
        this.customersByArea = data.customers;
        if (this.areas.length > 0) {
          this.selectedArea = this.areas[0];
          this.updateCount();
        }
      },
      error => {
        console.error('Error loading areas:', error);
      }
    );
  }

  updateCount() {
    this.recipientCount = this.customersByArea[this.selectedArea]?.length || 0;
    this.updateComposed();
  }

  updateComposed() {
    const firstCustomer = this.customersByArea[this.selectedArea]?.[0] || { name: 'Customer', account_id: 'SCV-XXXXX' };
    this.composedMessage = this.buildMessage({
      area: this.selectedArea,
      msgType: this.msgType,
      ta: this.langTamil,
      en: this.langEnglish,
      etaStart: this.etaStart,
      etaEnd: this.etaEnd,
      customerName: firstCustomer.name,
      accountId: firstCustomer.account_id
    });
  }

  buildMessage({ area, msgType, ta, en, etaStart, etaEnd, customerName, accountId }: any) {
    const etaStr = (etaStart && etaEnd) ? `${this.fmtTime(etaStart)}–${this.fmtTime(etaEnd)}` : 'no ETA';
    let taTxt = '';
    if (ta) {
      taTxt = (msgType === 'outage')
        ? `வணக்கம் *${customerName}*,\n${area} பகுதியில் உள்ள உங்கள் KGM Cables இணைப்பு (கணக்கு : ${accountId}) சேவை தடையால் பாதிக்கப்பட்டுள்ளது.\nமதிப்பிடப்பட்ட செயலிழப்பு நேரம் *${etaStr}*.\nசேவை மீண்டும் இயங்கும்போது தகவல் தரப்படும்.\n- கேஜிஎம் கேபிள்ஸ்`
        : `வணக்கம் *${customerName}*,\n${area} பகுதியில் உள்ள உங்கள் KGM Cables இணைப்பில் (கணக்கு : ${accountId}) சேவை மீண்டும் இயங்குகிறது.\nஉங்கள் பொறுமைக்கு நன்றி.\n- கேஜிஎம் கேபிள்ஸ்`;
    }
    let enTxt = '';
    if (en) {
      enTxt = (msgType === 'outage')
        ? `Hi *${customerName}*,\nYour KGM Cables connection (Account : ${accountId}) in ${area} is affected by a service outage.\nEstimated downtime *${etaStr}*.\nWe’ll message you once it’s restored.\n- KGM Cables`
        : `Hi *${customerName}*,\nService has been restored for your KGM Cables connection (Account : ${accountId}) in ${area}.\nThank you for your patience.\n- KGM Cables`;
    }
    return (taTxt && enTxt) ? `${taTxt}\n\n${enTxt}` : (taTxt || enTxt);
  }

  fmtTime(hhmm: string) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  applyQuickPick(kind: string) {
    const now = this.roundToNext5(new Date());
    if (kind.startsWith('plus_')) {
      const start = new Date(now);
      const end = new Date(now);
      const minutes = parseInt(kind.split('_')[1], 10) * (kind.endsWith('h') ? 60 : 1);
      end.setMinutes(end.getMinutes() + minutes);
      this.etaStart = this.toHHMM(start);
      this.etaEnd = this.toHHMM(end);
    } else if (kind.startsWith('slot_')) {
      const [start, end] = kind.split('_').slice(1).map(t => `${t.padStart(2, '0')}:00`);
      this.etaStart = start;
      this.etaEnd = end;
    } else if (kind === 'clear') {
      this.etaStart = '';
      this.etaEnd = '';
    }
    this.updateComposed();
  }

  roundToNext5(date: Date) {
    const d = new Date(date.getTime());
    d.setSeconds(0, 0);
    const m = d.getMinutes();
    const delta = (5 - (m % 5)) % 5;
    d.setMinutes(m + delta);
    return d;
  }

  toHHMM(date: Date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  unitPrice() {
    const key = (this.pricing.default_pricing_category || 'utility').toLowerCase();
    return this.pricing.prices[key] || 0;
  }

  totalCost() {
    return this.unitPrice() * this.recipientCount;
  }

  sendMessage() {
    const payload = {
      area: this.selectedArea,
      channel: 'whatsapp',
      message: this.composedMessage,
      dry_run: this.dryRun,
      msg_type: this.msgType,
      eta_start: this.etaStart || null,
      eta_end: this.etaEnd || null
    };

    this.sending = true;
    this.setStatus('sending', 'Sending…');

    this.apiService.sendMessages(payload).subscribe(
      data => {
        this.sending = false;
        if (data.dry_run) {
          this.setStatus('info', `Dry run ✅<br>Area: <b>${data.area}</b> | Type: <b>${payload.msg_type}</b><br>Recipients: <b>${data.count}</b>`);
        } else {
          this.setStatus(data.failed > 0 ? 'warn' : 'success', `Done ✅ Type: <b>${payload.msg_type}</b> | Sent: <b>${data.sent}</b> | Failed: <b>${data.failed}</b>`);
        }
      },
      error => {
        this.sending = false;
        this.setStatus('error', `Error: ${error.error.error}`);
      }
    );
  }

  setStatus(kind: string, html: string) {
    this.status = { kind, html };
  }
}
