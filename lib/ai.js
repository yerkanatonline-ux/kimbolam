// lib/ai.js
// Барлық AI хендлерлері (chat, essay-coach, goal-mission, broad-suggestions) қолданатын
// ортақ, ПРОВАЙДЕР-АГНОСТИК қабат. Есептеу/сәйкестендіру логикасына АРАЛАСПАЙДЫ —
// тек LLM-ге сұраныс жіберіп, мәтін жауабын қайтарады (CLAUDE.md «АСА МАҢЫЗДЫ ШЕШІМ»).
//
// Провайдер таңдау (автоматты):
//   1. AI_PROVIDER=openai    → әрқашан OpenAI
//   2. AI_PROVIDER=anthropic → әрқашан Anthropic
//   3. Айқын көрсетілмесе: OPENAI_API_KEY бар болса — OpenAI (Ерқанат OpenAI-ге көшті),
//      әйтпесе ANTHROPIC_API_KEY арқылы Anthropic.
// Осылай env-де тек OPENAI_API_KEY тұрса, бөлек AI_PROVIDER қоспай-ақ OpenAI іске қосылады.

function pickProvider() {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase();
  if (explicit === 'openai') return 'openai';
  if (explicit === 'anthropic') return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'anthropic';
}

async function callAnthropic({ system, messages, maxTokens }) {
  const body = {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!apiRes.ok) {
    const t = await apiRes.text();
    throw new Error(`Anthropic ${apiRes.status}: ${t}`);
  }
  const data = await apiRes.json();
  const block = (data.content || []).find(b => b.type === 'text');
  return block ? block.text : '';
}

async function callOpenAI({ system, messages, maxTokens }) {
  // OpenAI-де system бөлек өріс емес — messages басына role:'system' болып қосылады.
  const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: msgs,
    }),
  });
  if (!apiRes.ok) {
    const t = await apiRes.text();
    throw new Error(`OpenAI ${apiRes.status}: ${t}`);
  }
  const data = await apiRes.json();
  return data.choices && data.choices[0] ? data.choices[0].message.content : '';
}

// Ортақ кіру нүктесі. { system?, messages, maxTokens } → жауап мәтіні (string).
// messages — [{ role: 'user'|'assistant', content: string }] форматында.
async function callAI({ system, messages, maxTokens = 700 }) {
  const provider = pickProvider();
  return provider === 'openai'
    ? callOpenAI({ system, messages, maxTokens })
    : callAnthropic({ system, messages, maxTokens });
}

module.exports = { callAI, pickProvider };
