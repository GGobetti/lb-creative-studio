alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

comment on column public.profiles.onboarding_completed
  is 'True após o usuário completar ou pular o tour de onboarding';
