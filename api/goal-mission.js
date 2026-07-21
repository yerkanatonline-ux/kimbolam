// api/goal-mission.js
// «Мақсат қою» миссиясы — робот-серік дерексіз армандарды нақты, өлшенетін
// мақсатқа айналдыруға көмектеседі. AI ешқашан мақсатты студенттің орнына қоймайды.

const specialtiesKey = require('../data/specialties-key.json');
const { applyCors, handlePreflight, rateLimit, tooManyRequests } = require('../lib/http');
const SPEC_BY_CODE = {};
specialtiesKey.forEach(s => { SPEC_BY_CODE[s.code] = s; });

function buildSystemPrompt(profile) {
  const { hollandCode, hollandNames, mbtiType, topSpecialties } = profile || {};
  const specLines = (topSpecialties || []).map(code => SPEC_BY_CODE[code] ? SPEC_BY_CODE[code].n : null).filter(Boolean).join(', ');

  return `Сен — «Кім болам?» платформасының робот-серігісің. Қазір студентке «Мақсат қою» миссиясында көмектесіп жатырсың: дерексіз арманды 3 айлық (тоқсандық) нақты, өлшенетін мақсатқа айналдыру.

## СТУДЕНТТІҢ ПРОФИЛІ
- Holland коды: ${hollandCode || 'белгісіз'} (${hollandNames || ''})
- Мінез типі: ${mbtiType || 'белгісіз'}
- Сай мамандықтар: ${specLines || 'белгісіз'}

## ҰСТАНЫМЫҢ (ӨТЕ МАҢЫЗДЫ)
- Мақсатты студенттің ОРНЫНА ЕШҚАШАН қойма. Тек сұрақ қой, нақтылауға көмектес.
- Дерексіз армандарды («миллионер болғым келеді», «жақсы оқығым келеді») нақты, өлшенетін,
  уақыты белгілі мақсатқа айналдыруға жетелеп, бағыттаушы сұрақтар қой:
  - «Нақты қашан жеткің келеді?» (уақыт шегі)
  - «Қалай білесің жеткеніңді? Немен өлшенеді?» (өлшем)
  - «Неге бұл дәл қазір сен үшін маңызды?» (мотивация, профильге байланысты)
- Әр жауапта ТЕК БІР нақтылаушы сұрақ қой — студентті сұрақпен жаудырма.
- 3-4 алмасудан кейін студент нақты мақсат тұжырымдай алатындай жағдайға жеткізуге тырыс.
- Студент нақты, өлшенетін мақсат тұжырымдағанда — қолда, растайтын қысқа сөз айт
  (мыс. «Міне, бұл — нақты мақсат! Мерзімі бар, өлшенеді, саған маңызды.»).
- Жылы, қолдаушы, бірақ қысқа жауап бер (2-4 сөйлем, робот-серік үнінде — достық, түсінікті).
- Тек студент айтқан ақпаратқа және тест профиліне сүйен, ойдан факт қоспа.
- Қазақ тілінде жауап бер.`;
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!rateLimit(req, 'goal-mission', { max: 15, windowMs: 60000 })) { tooManyRequests(res); return; }

  try {
    const { profile, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages өрісі керек' });
      return;
    }
    const trimmed = messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 3000),
    }));

    const system = buildSystemPrompt(profile);

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system,
        messages: trimmed,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      res.status(502).json({ error: 'AI қызметі уақытша қолжетімсіз.' });
      return;
    }

    const data = await apiRes.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const reply = textBlock ? textBlock.text : 'Кешіріңіз, қайталап көріңізші.';
    res.status(200).json({ reply });
  } catch (err) {
    console.error('goal-mission handler error:', err);
    res.status(500).json({ error: 'Ішкі қате болды.' });
  }
};
