// api/save-result.js
// Оқушы тестті аяқтағанда шақырылады — нәтижені дерекқорға жазады
// (локалда SQLite, продта Supabase — backend/db/index.js арқылы таңдалады).
const db = require('../db');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!rateLimit(req, 'save-result', { max: 20, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const {
      studentName, classCode, studentClass, promoCode,
      hollandCode, hollandScores, klimovTop, mbtiType, confidence, matchedSpecialties,
    } = req.body || {};

    if (!studentName || !studentName.trim()) {
      res.status(400).json({ error: 'studentName өрісі керек' });
      return;
    }

    // classCode берілсе — сол кодтың шынымен бар-жоғын тексереміз (қате код жазса, үнсіз "жеке" болып сақталады)
    let validClassCode = null;
    if (classCode && classCode.trim()) {
      const cls = await db.findClassByCode(classCode.trim().toUpperCase());
      validClassCode = cls ? cls.code : null;
    }

    const normalizedPromo = promoCode ? promoCode.trim().toUpperCase() : null;

    // Нәтижені ӘРҚАШАН сақтаймыз — оқушының 15 минуттық жұмысы ешқашан жоғалмасын
    // (plan-eng-review D2). Промокодты жою — бөлек, best-effort қадам.
    const saved = await db.insertTestResult({
      studentName: studentName.trim(),
      classCode: validClassCode,
      studentClass: studentClass ? studentClass.trim() : null,
      promoCode: normalizedPromo,
      hollandCode, hollandScores, klimovTop, mbtiType, confidence, matchedSpecialties,
    });

    // Промокодты атомды түрде "қолданылды" деп белгілейміз (CAS: used=false болғанда ғана).
    // Егер код бұрыннан қолданылған болса (race/қайта жіберу) — нәтиже сақталды, тек лог жазамыз.
    let promoConsumed = false;
    if (normalizedPromo) {
      try {
        const r = await db.consumePromoCode(normalizedPromo, studentName.trim());
        promoConsumed = r.consumed;
        if (!promoConsumed) {
          console.warn(`save-result: промокод ${normalizedPromo} бұрын қолданылған (нәтиже бәрібір сақталды, id=${saved.id})`);
        }
      } catch (e) {
        console.error('save-result: промокодты жою қатесі:', e);
      }
    }

    res.status(200).json({
      id: saved.id,
      savedAt: saved.createdAt,
      linkedToClass: !!validClassCode,
      promoConsumed,
    });
  } catch (err) {
    console.error('save-result error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
