// Supabase/Postgres схемасын автоматты құру (идемпотентті, деструктивті емес).
// @supabase/supabase-js (PostgREST) DDL (CREATE TABLE) жасай алмайды, сондықтан
// мұнда Vercel интеграциясы берген ТІКЕЛЕЙ Postgres байланысын қолданамыз
// (POSTGRES_URL_NON_POOLING — pooler емес, DDL үшін дұрысы осы).
// Схема db-prototype/schema.sql-мен бірдей (сол файл — адам оқитын дереккөз).
const { Client } = require('pg');

const SCHEMA_SQL = `
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  teacher_code text unique not null,
  school_name text,
  class_name text,
  created_at timestamptz default now()
);
create table if not exists test_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  student_name text not null,
  class_code text references classes(code),
  student_class text,
  promo_code text,
  holland_code text,
  holland_scores jsonb,
  klimov_top jsonb,
  mbti_type text,
  confidence text,
  matched_specialties jsonb
);
create index if not exists idx_test_results_class_code on test_results(class_code);
create index if not exists idx_test_results_created_at on test_results(created_at);
create table if not exists promo_codes (
  code text primary key,
  used boolean not null default false,
  used_by text,
  used_at timestamptz
);
-- Бұрыннан бар test_results болса, жаңа бағандарды идемпотентті қосу
alter table test_results add column if not exists student_class text;
alter table test_results add column if not exists promo_code text;
alter table classes enable row level security;
alter table test_results enable row level security;
alter table promo_codes enable row level security;
`;

function makeClient() {
  const raw =
    process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!raw) {
    throw new Error('POSTGRES_URL_NON_POOLING да, POSTGRES_URL да табылмады');
  }
  // sslmode параметрін алып тастаймыз — әйтпесе pg оны алдымен қолданып,
  // біздің ssl объектімізді (rejectUnauthorized:false) елемей, Supabase-тың
  // self-signed сертификатына сүрінеді.
  const connectionString = raw.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } });
}

async function runMigration() {
  const client = makeClient();
  await client.connect();
  try {
    await client.query(SCHEMA_SQL);
    // PostgREST (supabase-js) жаңа кестені бірден көрмейді — схема кэшін қайта оқытамыз,
    // әйтпесе рантайм endpoint-тері 'table not in schema cache' қатесін береді.
    try { await client.query(`notify pgrst, 'reload schema'`); } catch {}
    const { rows } = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name in ('classes','test_results','promo_codes')
       order by table_name`,
    );
    return { ok: true, tables: rows.map(r => r.table_name) };
  } finally {
    await client.end();
  }
}

// Промокодтарды ТІКЕЛЕЙ pg арқылы жүктейді (PostgREST кэшіне тәуелсіз).
// unnest арқылы бір сұраныспен, бар кодты аттап кетеді (ON CONFLICT DO NOTHING).
async function seedPromoCodes(codes) {
  if (!Array.isArray(codes) || !codes.length) return { added: 0, received: 0 };
  const client = makeClient();
  await client.connect();
  try {
    const before = await client.query(`select count(*)::int as n from promo_codes`);
    await client.query(
      `insert into promo_codes (code)
       select unnest($1::text[])
       on conflict (code) do nothing`,
      [codes],
    );
    const after = await client.query(`select count(*)::int as n from promo_codes`);
    return { received: codes.length, added: after.rows[0].n - before.rows[0].n, total: after.rows[0].n };
  } finally {
    await client.end();
  }
}

// Прод-тестінің із-қалдықтарын өшіреді (тек нақты тест-белгілер бойынша, қауіпсіз).
async function cleanupTestData() {
  const client = makeClient();
  await client.connect();
  try {
    const r1 = await client.query(`delete from test_results where student_name = 'ПРОД-ТЕСТ-ОКУШЫ'`);
    const r2 = await client.query(`delete from classes where class_name = 'ПРОД-ТЕСТ-КЛАСС'`);
    const r3 = await client.query(`delete from promo_codes where code = 'ZZ-PRODTEST'`);
    return { results: r1.rowCount, classes: r2.rowCount, promo: r3.rowCount };
  } finally {
    await client.end();
  }
}

module.exports = { runMigration, seedPromoCodes, cleanupTestData, SCHEMA_SQL };
