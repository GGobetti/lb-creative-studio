-- Script to create test users with different plans
-- Run this in the Supabase SQL Editor AFTER the update_plans_to_free_pro_max migration has been applied.

-- Important: We cannot easily inject users with raw SQL because Supabase Auth requires them to exist in auth.users
-- Since this is for testing, the best way is to instruct the sysadmin to:
-- 1. Sign up 3 dummy emails in the app (e.g., test.free@example.com, test.pro@example.com, test.max@example.com)
-- 2. Use the SysAdmin "Gerenciador de Usuários" UI to set their plans and credits.

-- OR, if you just want to update existing users to these plans via SQL, find their IDs and run:

-- UPDATE public.profiles SET plan = 'free', credits = 10 WHERE email = 'test.free@example.com';
-- UPDATE public.profiles SET plan = 'pro', credits = 100 WHERE email = 'test.pro@example.com';
-- UPDATE public.profiles SET plan = 'max', credits = 9999 WHERE email = 'test.max@example.com';

-- You can also check existing users with:
-- SELECT id, email, plan, credits FROM public.profiles;
