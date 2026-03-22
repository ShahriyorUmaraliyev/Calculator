/*
  /api/rates — Foydalanuvchi so'rovlari
  
  MUHIM: Bu endpoint HECH QACHON tashqi API ga urmaydigan
  Faqat KV (Vercel storage) dan o'qiydi
  
  Kesh strategiyasi:
  - Bugungi official: s-maxage=3600 (1 soat)
  - Bugungi live:     s-maxage=300  (5 daqiqa)
  - Eski kurs:        s-maxage=60   (1 daqiqa, tez yangilansin)
*/

const { kv } = require('@vercel/kv');

const KV_OFFICIAL      = 'rates:official';
const KV_LIVE          = 'rates:live';
const KV_OFFICIAL_DATE = 'rates:official_date';
const KV_LIVE_UPDATED  = 'rates:live_updated';

function todayUzb() {
  const d  = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    /* KV dan parallel o'qiymiz — tashqi API ga URMAYMIZ */
    const [official, live, officialDate, liveUpdated] = await Promise.all([
      kv.get(KV_OFFICIAL).catch(() => null),
      kv.get(KV_LIVE).catch(() => null),
      kv.get(KV_OFFICIAL_DATE).catch(() => null),
      kv.get(KV_LIVE_UPDATED).catch(() => null)
    ]);

    const today         = todayUzb();
    const officialToday = officialDate === today;
    const liveAge       = liveUpdated ? Date.now() - liveUpdated : Infinity;
    const liveFresh     = liveAge < 20 * 60 * 1000; /* 20 daqiqadan yangi */

    /* Kesh muddati — eng yangi ma'lumotga qarab */
    const maxAge = (officialToday && liveFresh) ? 300 : 60;
    res.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=30`);

    return res.status(200).json({
      official:      official || null,
      live:          live     || null,
      officialToday,
      liveFresh,
      liveAgeMin:    liveUpdated ? Math.round(liveAge / 60000) : null,
      serverDate:    today
    });

  } catch(err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: err.message });
  }
};
