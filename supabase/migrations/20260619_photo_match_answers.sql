-- Create photo_match_answers table
CREATE TABLE IF NOT EXISTS photo_match_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stl_id uuid NOT NULL REFERENCES telegram_indexed_stls(id) ON DELETE CASCADE,
  user_answer boolean NOT NULL,
  correct_answer boolean NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS photo_match_answers_user_id_idx ON photo_match_answers(user_id);
CREATE INDEX IF NOT EXISTS photo_match_answers_stl_id_idx ON photo_match_answers(stl_id);
CREATE INDEX IF NOT EXISTS photo_match_answers_user_created_idx ON photo_match_answers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photo_match_answers_is_correct_idx ON photo_match_answers(is_correct);

-- Enable RLS
ALTER TABLE photo_match_answers ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own answers
CREATE POLICY "Users can view their own photo match answers" ON photo_match_answers
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Only authenticated users can insert
CREATE POLICY "Users can insert their own photo match answers" ON photo_match_answers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
