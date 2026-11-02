-- Run this in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.dilemmas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scenario text not null,
  option_a text not null,
  option_b text not null,
  display_order integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  age_group text not null,
  gender text not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  constraint answers_are_array check (jsonb_typeof(answers) = 'array')
);

alter table public.dilemmas enable row level security;
alter table public.responses enable row level security;

-- Participants can read active prompts. No client-side prompt editing.
create policy "Anyone can read active dilemmas"
on public.dilemmas for select to anon, authenticated
using (is_active = true);

-- Anonymous participation may insert a response; public reads/updates/deletes are denied.
create policy "Anyone can submit response"
on public.responses for insert to anon, authenticated
with check (
  age_group in ('초등 1–3학년','초등 4–6학년','중학생','고등학생','만 19세 이상')
  and gender in ('여성','남성','기타','응답하지 않음')
  and jsonb_typeof(answers) = 'array'
  and jsonb_array_length(answers) = 3
);

-- Do not add a public SELECT policy for responses.
-- For analysis, use Supabase Dashboard SQL Editor (owner access) or a separately
-- authenticated admin interface. Never expose the service_role key in frontend code.

grant select on public.dilemmas to anon, authenticated;
grant insert on public.responses to anon, authenticated;

-- Sample three prompts. Modify them directly in Table Editor after setup.
insert into public.dilemmas (title, scenario, option_a, option_b, display_order)
values
('AI의 추천은 누구를 우선해야 할까?',
 '자율주행 AI가 사고를 피하기 어려운 상황을 감지했습니다. 두 선택 모두 누군가에게 위험을 줄 수 있습니다. AI의 판단 기준을 어떻게 정해야 할까요?',
 '탑승자의 안전을 가장 먼저 고려한다.',
 '주변 사람을 포함해 전체 피해를 줄이는 방향을 고려한다.', 1),
('AI가 편리함을 위해 개인정보를 사용해도 될까?',
 '학교에서 학생의 학습을 돕는 AI 서비스를 도입하려 합니다. 서비스는 더 나은 추천을 위해 학생의 활동 정보를 수집하려 합니다.',
 '도움이 된다면 필요한 정보를 수집하도록 허용한다.',
 '편리함보다 개인정보 보호를 우선하고, 최소한의 정보만 사용한다.', 2),
('AI가 만든 결과물의 책임은 누구에게 있을까?',
 'AI가 만든 자료를 사람이 충분히 확인하지 않고 발표했고, 자료에 잘못된 정보가 포함되어 문제가 생겼습니다.',
 'AI 도구를 제공한 회사가 주된 책임을 져야 한다.',
 'AI를 사용하고 확인한 사람도 책임을 져야 한다.', 3)
on conflict (display_order) do nothing;
