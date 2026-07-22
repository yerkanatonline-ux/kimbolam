// api/check-code.js
// Гейтте оқушы промокод енгізгенде шақырылады — код жарамды әрі әлі қолданылмаған ба?
// Кодты ӨЗІ ЖОЙМАЙДЫ (тек тексереді) — нақты "қолданылды" деп белгілеу тест біткен соң
// save-result.js-те атомды түрде жасалады (жұмыс жоғалмас үшін, plan-eng-review D2).
const db = require('../db');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Промокодты болжап табуды қиындату үшін қатаң лимит
  if (!rateLimit(req, 'check-code', { max: 15, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const { code } = req.body || {};
    if (!code || !code.trim()) {
      res.status(400).json({ valid: false, reason: 'empty' });
      return;
    }
    const result = await db.checkPromoCode(code.trim().toUpperCase());
    res.status(200).json(result); // { valid, reason? }
  } catch (err) {
    console.error('check-code error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
