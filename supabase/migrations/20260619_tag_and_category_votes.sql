-- ─── tag_detective_votes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tag_detective_votes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stl_id       uuid NOT NULL REFERENCES telegram_indexed_stls(id) ON DELETE CASCADE,
  tag          text NOT NULL,
  is_irrelevant boolean NOT NULL,
  created_at   timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tag_detective_votes_stl_tag_idx ON tag_detective_votes(stl_id, tag);
CREATE INDEX IF NOT EXISTS tag_detective_votes_user_idx    ON tag_detective_votes(user_id);

ALTER TABLE tag_detective_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their tag votes"
  ON tag_detective_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their tag votes"
  ON tag_detective_votes FOR SELECT
  USING (auth.uid() = user_id);

-- ─── category_votes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS category_votes (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stl_id               uuid NOT NULL REFERENCES telegram_indexed_stls(id) ON DELETE CASCADE,
  categories           text[] NOT NULL DEFAULT '{}',
  suggested_categories text[] NOT NULL DEFAULT '{}',
  created_at           timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS category_votes_stl_idx  ON category_votes(stl_id);
CREATE INDEX IF NOT EXISTS category_votes_user_idx ON category_votes(user_id);

ALTER TABLE category_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their category votes"
  ON category_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their category votes"
  ON category_votes FOR SELECT
  USING (auth.uid() = user_id);
