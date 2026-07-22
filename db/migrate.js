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

async function runMigration() {
  const raw =
    process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!raw) {
    throw new Error('POSTGRES_URL_NON_POOLING да, POSTGRES_URL да табылмады');
  }
  // sslmode параметрін алып тастаймыз — әйтпесе pg оны алдымен қолданып,
  // біздің ssl объектімізді (rejectUnauthorized:false) елемей, Supabase-тың
  // self-signed сертификатына сүрінеді.
  const connectionString = raw.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(SCHEMA_SQL);
    const { rows } = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name in ('classes','test_results')
       order by table_name`,
    );
    return { ok: true, tables: rows.map(r => r.table_name) };
  } finally {
    await client.end();
  }
}

module.exports = { runMigration, SCHEMA_SQL };
