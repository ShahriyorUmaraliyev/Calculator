/*
  /api/update-rates — FAQAT CRON chaqiradi
  
  Cron jadval (vercel.json):
    CBU:        har kuni 06:00 UTC (11:00 Toshkent)
    fawazahmed0: har 15 daqiqada
  
  Foydalanuvchi bu endpointni CHAQIRMAYDI
  /api/rates faqat KV dan o'qiydi — API ga urmaydi
*/

const { kv } = require('@vercel/kv');

const CURRENCIES      = ['USD', 'EUR', 'RUB', 'AED', 'GBP', 'KZT'];
const TIMEOUT_MS      = 10000;
const KV_OFFICIAL     = 'rates:official';
const KV_LIVE         = 'rates:live';
const KV_OFFICIAL_DATE = 'rates:official_date';
const KV_LIVE_UPDATED  = 'rates:live_updated';

function todayUzb() {
  const d  = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

async function fetchT(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    return r;
  } catch(e) { clearTimeout(timer); throw e; }
}

async function fetchOfficial() {
  const r = await fetchT('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
  if (!r.ok) throw new Error('cbu ' + r.status);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error('cbu empty');
  const rates = { UZS: 1 };
  arr.forEach(item => {
    if (CURRENCIES.includes(item.Ccy)) {
      const v = parseFloat(item.Rate), n = parseFloat(item.Nominal)||1;
      if (v > 0) rates[item.Ccy] = v / n;
    }
  });
  if (!rates.USD) throw new Error('no USD');
  return { rates, source:'cbu', effectiveDate: arr[0]?.Date || todayUzb(), type:'official' };
}

async function fetchLive() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json'
  ];
  for (const url of urls) {
    try {
      const r = await fetchT(url);
      if (!r.ok) continue;
      const data = await r.json();
      const usd  = data.usd || data.USD;
      if (!usd || !usd.uzs || usd.uzs <= 0) continue;
      const rates = { UZS: 1, USD: usd.uzs };
      ['eur','rub','aed','gbp','kzt'].forEach(k => {
        if (usd[k] > 0) rates[k.toUpperCase()] = usd.uzs / usd[k];
      });
      return { rates, source:'fawazahmed0', effectiveDate: data.date||'', type:'market' };
    } catch(_) {}
  }
  throw new Error('live all failed');
}

module.exports = async function handler(req, res) {
  const mode = req.query.mode || 'live'; /* ?mode=official yoki ?mode=live */

  try {
    if (mode === 'official') {
      const data = await fetchOfficial();
      await Promise.all([
        kv.set(KV_OFFICIAL,      data),
        kv.set(KV_OFFICIAL_DATE, todayUzb())
      ]);
      return res.status(200).json({ ok: true, mode: 'official', date: todayUzb() });
    } else {
      const data = await fetchLive();
      await Promise.all([
        kv.set(KV_LIVE,         data),
        kv.set(KV_LIVE_UPDATED, Date.now())
      ]);
      return res.status(200).json({ ok: true, mode: 'live', updatedAt: Date.now() });
    }
  } catch(err) {
    return res.status(500).json({ error: err.message, mode });
  }
};
