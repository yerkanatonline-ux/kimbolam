// api/broad-suggestions.js
// «Кеңірек қарасаң» — 117 ресми мамандықпен ШЕКТЕЛМЕЙТІН, кең нарықтағы рөлдер
// бойынша AI-дің пікірі. Бұл ЕСЕПТЕЛГЕН нәтиже ЕМЕС (әдіснама шегі: есептеу/сәйкестендіру
// логикасына AI араласпайды) — тек қосымша идея. Google Sheets/Gemini орнына келді.
//
// Провайдер-агностик: провайдер таңдау lib/ai.js-те (OPENAI_API_KEY болса — OpenAI,
// әйтпесе Anthropic; AI_PROVIDER арқылы мәжбүрлеуге болады). Кодты өзгертпей env арқылы ауысады.
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');
const { callAI } = require('../lib/ai');

const KLIMOV_DESC = {
  'Табиғат': 'тірі табиғатпен (өсімдік, жануар)',
  'Техника': 'техникамен (машина, механизм)',
  'Адам': 'адамдармен (оқыту, көмек, қарым-қатынас)',
  'Таңба': 'таңбалық жүйемен (сан, мәтін, код)',
  'Көркем': 'көркем бейнемен (өнер, дизайн)',
};

function buildPrompt({ hollandCode, klimovTop, mbtiType }) {
  const klim = (klimovTop || []).map(t => `${t} — ${KLIMOV_DESC[t] || ''}`).join(', ');
  return 'Сен қазақстандық мектеп оқушысына арналған профориентация көмекшісісің.\n' +
    'Оқушының тест профилі:\n' +
    `- Holland коды: ${hollandCode || 'белгісіз'}\n` +
    `- Климов бейімділігі: ${klim || 'белгісіз'}\n` +
    `- Мінез типі (MBTI дәстүрінде): ${mbtiType || 'белгісіз'}\n\n` +
    'Ресми БББТ 117 мамандық тізімімен ШЕКТЕЛМЕ — қазіргі еңбек нарығындағы кез келген ' +
    'заманауи мамандықты/рөлді ұсына аласың (IT, бизнес, креативті сала, т.б.).\n' +
    'Дәл 6 мамандық ұсын. ТЕК JSON массив қайтар, басқа мәтінсіз, дәл мына форматта:\n' +
    '[{"n":"мамандық атауы","why":"неге сәйкес, 1 қысқа сөйлем қазақша"}]';
}

// AI жауабынан JSON массивін төзімді түрде шығарып алу (```json блоктарын тазалайды).
function parseList(text) {
  const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const json = (start !== -1 && end !== -1) ? cleaned.slice(start, end + 1) : cleaned;
  const list = JSON.parse(json);
  if (!Array.isArray(list)) throw new Error('массив емес');
  return list
    .filter(x => x && x.n)
    .slice(0, 6)
    .map(x => ({ n: String(x.n), why: String(x.why || '') }));
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!rateLimit(req, 'broad-suggestions', { max: 10, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const { hollandCode, klimovTop, mbtiType } = req.body || {};
    if (!hollandCode && !(klimovTop && klimovTop.length)) {
      res.status(400).json({ ok: false, error: 'Тест профилі керек' });
      return;
    }

    const prompt = buildPrompt({ hollandCode, klimovTop, mbtiType });

    let raw;
    try {
      raw = await callAI({ messages: [{ role: 'user', content: prompt }], maxTokens: 700 });
    } catch (e) {
      console.error('broad-suggestions AI error:', e);
      res.status(502).json({ ok: false, error: 'AI қызметі уақытша қолжетімсіз.' });
      return;
    }

    let list;
    try {
      list = parseList(raw);
    } catch (e) {
      console.error('broad-suggestions parse error:', e, '| raw:', raw);
      res.status(200).json({ ok: false, error: 'Жауапты өңдеу қатесі' });
      return;
    }

    res.status(200).json({ ok: true, list });
  } catch (err) {
    console.error('broad-suggestions error:', err);
    res.status(500).json({ ok: false, error: 'Ішкі қате болды.' });
  }
};
