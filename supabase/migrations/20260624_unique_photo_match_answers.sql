-- Prevent vote flooding on photo_match_answers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'photo_match_answers_user_stl_unique'
      AND conrelid = 'public.photo_match_answers'::regclass
  ) THEN
    ALTER TABLE public.photo_match_answers
      ADD CONSTRAINT photo_match_answers_user_stl_unique
      UNIQUE (user_id, stl_id);
  END IF;
END $$;
