-- tag_detective_votes: um voto por (user, stl, tag)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tag_detective_votes_user_stl_tag_unique'
      AND conrelid = 'public.tag_detective_votes'::regclass
  ) THEN
    ALTER TABLE public.tag_detective_votes
      ADD CONSTRAINT tag_detective_votes_user_stl_tag_unique
      UNIQUE (user_id, stl_id, tag);
  END IF;
END $$;

-- category_votes: um voto por (user, stl)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'category_votes_user_stl_unique'
      AND conrelid = 'public.category_votes'::regclass
  ) THEN
    ALTER TABLE public.category_votes
      ADD CONSTRAINT category_votes_user_stl_unique
      UNIQUE (user_id, stl_id);
  END IF;
END $$;
