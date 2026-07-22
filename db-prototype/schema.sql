-- «Кім болам?» дерекқор схемасы (Supabase / Postgres)
-- Supabase жобасында: SQL Editor → осы файлдың мазмұнын қойып, Run басыңыз.

-- 1) Сыныптар кестесі — мектеппен/сыныппен жұмыс істегенде қолданылады
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- мыс. '7B-K3M9', ОҚУШЫЛАРҒА таратылатын код (тек save-result үшін)
  teacher_code text unique not null,  -- мыс. 'T-XY7Q-K3M9', ТЕК МҰҒАЛІМГЕ арналған құпия код
                                        -- (get-class-results тек осымен ашылады, оқушының коды жеткіліксіз)
  school_name text,
  class_name text,                     -- мыс. '7 "Ә" сынып'
  created_at timestamptz default now()
);

-- 2) Тест нәтижелері кестесі
create table if not exists test_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  student_name text not null,          -- аты-жөні (міндетті)
  class_code text references classes(code),  -- мұғалім берген класс коды (бос болса = жеке)
  student_class text,                  -- еркін мәтін (мыс. '9 Ә') — болашақ аналитика үшін, әзірге UI-де жоқ
  promo_code text,                     -- осы нәтиже қай промокодпен ашылғанын жазып қоямыз

  holland_code text,                   -- мыс. 'ISA'
  holland_scores jsonb,                -- {"R":4,"I":99,"A":75,"S":99,"E":50,"C":25}
  klimov_top jsonb,                    -- ["Адам","Таңба"]
  mbti_type text,                      -- мыс. 'INFP'
  confidence text,                     -- 'Жоғары' | 'Орташа' | 'Ізденіс керек'
  matched_specialties jsonb            -- [{"code":"B041","n":"Психология","pct":98}, ...]
);

-- 3) Промокодтар кестесі — платный доступ (гейтте тексеріледі, save-result-те қолданылды деп белгіленеді)
create table if not exists promo_codes (
  code text primary key,               -- мыс. 'KB-A1B2C'
  used boolean not null default false, -- бір рет қана қолданылады
  used_by text,                        -- кім қолданды (оқушының аты)
  used_at timestamptz
);

-- Іздеуді жылдамдату үшін индекстер
create index if not exists idx_test_results_class_code on test_results(class_code);
create index if not exists idx_test_results_created_at on test_results(created_at);

-- Қауіпсіздік: RLS (Row Level Security) қосамыз, тек backend (service role key)
-- арқылы жазу/оқу рұқсат етіледі, браузерден тікелей қатынау жабық болады.
alter table classes enable row level security;
alter table test_results enable row level security;
alter table promo_codes enable row level security;
-- Ешбір policy қоспаймыз әдейі — демек тек service_role key арқылы (backend-те) қатынауға болады.
