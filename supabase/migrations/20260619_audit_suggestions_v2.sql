-- Expand stl_audit_suggestions with tags, categories and upvote counter
ALTER TABLE stl_audit_suggestions
  ADD COLUMN IF NOT EXISTS suggested_tags        text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suggested_categories  text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS upvote_count          int    DEFAULT 0;

-- Table for upvoting community suggestions
CREATE TABLE IF NOT EXISTS stl_audit_suggestion_upvotes (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id  uuid NOT NULL REFERENCES stl_audit_suggestions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  created_at     timestamp with time zone DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS audit_suggestion_upvotes_suggestion_idx
  ON stl_audit_suggestion_upvotes(suggestion_id);

ALTER TABLE stl_audit_suggestion_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert upvotes"
  ON stl_audit_suggestion_upvotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own upvotes"
  ON stl_audit_suggestion_upvotes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can view upvotes"
  ON stl_audit_suggestion_upvotes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Trigger: keep upvote_count in sync automatically
CREATE OR REPLACE FUNCTION sync_suggestion_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stl_audit_suggestions SET upvote_count = upvote_count + 1 WHERE id = NEW.suggestion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE stl_audit_suggestions SET upvote_count = GREATEST(0, upvote_count - 1) WHERE id = OLD.suggestion_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_suggestion_upvote_change
  AFTER INSERT OR DELETE ON stl_audit_suggestion_upvotes
  FOR EACH ROW EXECUTE FUNCTION sync_suggestion_upvote_count();

-- Allow authenticated users to read all pending suggestions (for community review)
CREATE POLICY "Authenticated users can view pending suggestions"
  ON stl_audit_suggestions FOR SELECT
  USING (auth.role() = 'authenticated');
