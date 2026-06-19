-- Add columns to track removal status
ALTER TABLE telegram_indexed_stls
ADD COLUMN IF NOT EXISTS marked_for_removal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS removal_reason text,
ADD COLUMN IF NOT EXISTS removal_marked_at timestamp with time zone;

-- Create index for admin review
CREATE INDEX IF NOT EXISTS telegram_indexed_stls_marked_for_removal_idx
ON telegram_indexed_stls(marked_for_removal)
WHERE marked_for_removal = true;

-- RPC: Aggregate photo match votes and mark STLs for removal if consensus reached
CREATE OR REPLACE FUNCTION tally_photo_match_votes()
RETURNS TABLE(
  stl_id uuid,
  total_votes int,
  yes_votes int,
  no_votes int,
  no_percentage float,
  action text
) AS $$
DECLARE
  v_stl_id uuid;
  v_total int;
  v_yes int;
  v_no int;
  v_no_pct float;
  v_photo_count int;
  v_consensus_threshold float := 0.80; -- 80%
BEGIN
  -- Process each STL that has photo match votes
  FOR v_stl_id IN
    SELECT DISTINCT stl_id FROM photo_match_answers
    WHERE created_at > (now() - interval '7 days')
  LOOP
    -- Count votes
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE user_answer = correct_answer),
      COUNT(*) FILTER (WHERE user_answer != correct_answer)
    INTO v_total, v_yes, v_no
    FROM photo_match_answers
    WHERE stl_id = v_stl_id;

    -- Calculate percentage of "No matches"
    IF v_total > 0 THEN
      v_no_pct := v_no::float / v_total::float;

      -- If 80%+ voted "No confere", check photo count
      IF v_no_pct >= v_consensus_threshold THEN
        SELECT array_length(photos, 1)
        INTO v_photo_count
        FROM telegram_indexed_stls
        WHERE id = v_stl_id;

        -- Mark for removal if this is the only photo or if photo_count is null/1
        IF v_photo_count IS NULL OR v_photo_count <= 1 THEN
          UPDATE telegram_indexed_stls
          SET
            marked_for_removal = true,
            removal_reason = 'photo_mismatch_consensus',
            removal_marked_at = now()
          WHERE id = v_stl_id;

          RETURN QUERY SELECT
            v_stl_id,
            v_total,
            v_yes,
            v_no,
            v_no_pct,
            'MARKED_FOR_REMOVAL'::text;
        ELSE
          -- Multiple photos exist - remove this one instead (not implemented in SQL yet)
          RETURN QUERY SELECT
            v_stl_id,
            v_total,
            v_yes,
            v_no,
            v_no_pct,
            'PHOTO_REMOVAL_NEEDED'::text;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create table to track admin decisions on marked STLs
CREATE TABLE IF NOT EXISTS stl_removal_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stl_id uuid NOT NULL REFERENCES telegram_indexed_stls(id) ON DELETE CASCADE,
  marked_reason text NOT NULL,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  admin_notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stl_removal_decisions_stl_id_idx ON stl_removal_decisions(stl_id);
CREATE INDEX IF NOT EXISTS stl_removal_decisions_admin_user_id_idx ON stl_removal_decisions(admin_user_id);
