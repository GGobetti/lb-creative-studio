-- supabase/migrations/20260624_title_suggestion_status.sql

-- 1. Adicionar coluna de status às sugestões
ALTER TABLE public.stl_audit_suggestions
  ADD COLUMN IF NOT EXISTS status text
  NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'pre_approved', 'applied', 'rejected'));

CREATE INDEX IF NOT EXISTS stl_audit_suggestions_status_idx
  ON public.stl_audit_suggestions(status)
  WHERE status = 'pre_approved';

-- 2. Função: quando um STL é aprovado pela comunidade,
--    marca a sugestão de título mais votada como pre_approved
CREATE OR REPLACE FUNCTION public.mark_top_title_suggestion_pre_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top_suggestion_id uuid;
BEGIN
  -- Só age quando final_status mudar para 'approved'
  IF NEW.final_status = 'approved' AND
     (OLD.final_status IS DISTINCT FROM 'approved') THEN

    -- Busca a sugestão de título mais votada para este STL
    SELECT id INTO v_top_suggestion_id
    FROM public.stl_audit_suggestions
    WHERE stl_id = NEW.stl_id
      AND suggested_title IS NOT NULL
      AND suggested_title <> ''
      AND status = 'pending'
    ORDER BY upvote_count DESC
    LIMIT 1;

    IF v_top_suggestion_id IS NOT NULL THEN
      UPDATE public.stl_audit_suggestions
      SET status = 'pre_approved'
      WHERE id = v_top_suggestion_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_stl_audit_approved
  AFTER UPDATE OF final_status ON public.stl_audit_results
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_top_title_suggestion_pre_approved();

-- 3. Policy: admins podem atualizar status das sugestões
CREATE POLICY "Admins can update suggestion status"
  ON public.stl_audit_suggestions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
