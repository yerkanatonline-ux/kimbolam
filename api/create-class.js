// api/create-class.js
// Мұғалім/Ерқанат жаңа сынып жасайды: ОҚУШЫЛАРҒА арналған қысқа код (code) +
// ТЕК МҰҒАЛІМГЕ арналған құпия код (teacherCode) шығады. teacherCode-ты ешқашан
// оқушыларға таратпау керек — тек соның көмегімен сынып нәтижелерін көруге болады
// (get-class-results.js). Бұл бөліну маңызды: бұрын нәтижені де, роликті де бір
// ғана code арқылы алуға болатын, яғни кез келген оқушы сыныптастарының дерегін
// көре алатын.
const db = require('../db');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');

function genSegment(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O/0, I/1 секілді шатастыратын таңбалар алынып тасталды
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!rateLimit(req, 'create-class', { max: 8, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const { schoolName, className } = req.body || {};
    if (!className) { res.status(400).json({ error: 'className өрісі керек' }); return; }

    let code;
    for (let attempts = 0; attempts < 5; attempts++) {
      code = genSegment(6);
      if (!(await db.codeExists(code))) break;
    }

    let teacherCode;
    for (let attempts = 0; attempts < 5; attempts++) {
      teacherCode = 'T-' + genSegment(4) + '-' + genSegment(4);
      if (!(await db.teacherCodeExists(teacherCode))) break;
    }

    const cls = await db.createClass({ schoolName, className, code, teacherCode });
    res.status(200).json({
      code: cls.code,
      teacherCode: cls.teacherCode,
      className: cls.className,
      schoolName: cls.schoolName,
    });
  } catch (err) {
    console.error('create-class error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
