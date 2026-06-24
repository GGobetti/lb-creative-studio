-- supabase/migrations/20260624_title_suggestion_status.sql
-- Reprodutível do zero: idempotente em todos os objetos.
-- Inclui: CHECK constraint correto, FOR UPDATE SKIP LOCKED, DROP TRIGGER guard.

-- 1. Adicionar coluna de status às sugestões
--    CHECK constraint inclui 'pre_approved' (não 'approved') — valor correto desde o início.
ALTER TABLE public.stl_audit_suggestions
  ADD COLUMN IF NOT EXISTS status text
  NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'pre_approved', 'applied', 'rejected'));

-- Garantir que o constraint correto existe (idempotência: remove versão antiga se houver)
DO $$
BEGIN
  -- Remove constraint com valores incorretos, caso exista de aplicação anterior
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stl_audit_suggestions'::regclass
      AND contype = 'c'
      AND conname = 'stl_audit_suggestions_status_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%pre_approved%'
  ) THEN
    ALTER TABLE public.stl_audit_suggestions
      DROP CONSTRAINT stl_audit_suggestions_status_check;
    ALTER TABLE public.stl_audit_suggestions
      ADD CONSTRAINT stl_audit_suggestions_status_check
      CHECK (status IN ('pending', 'pre_approved', 'applied', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stl_audit_suggestions_status_idx
  ON public.stl_audit_suggestions(status)
  WHERE status = 'pre_approved';

-- 2. Função: quando um STL é aprovado pela comunidade,
--    marca a sugestão de título mais votada como pre_approved.
--    Usa FOR UPDATE SKIP LOCKED para evitar race conditions em atualizações concorrentes.
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
    -- FOR UPDATE SKIP LOCKED evita race condition se dois updates chegarem ao mesmo tempo
    SELECT id INTO v_top_suggestion_id
    FROM public.stl_audit_suggestions
    WHERE stl_id = NEW.stl_id
      AND suggested_title IS NOT NULL
      AND suggested_title <> ''
      AND status = 'pending'
    ORDER BY upvote_count DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_top_suggestion_id IS NOT NULL THEN
      UPDATE public.stl_audit_suggestions
      SET status = 'pre_approved'
      WHERE id = v_top_suggestion_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Trigger idempotente: remove antes de criar para evitar erro em re-execução
DROP TRIGGER IF EXISTS on_stl_audit_approved ON public.stl_audit_results;

CREATE TRIGGER on_stl_audit_approved
  AFTER UPDATE OF final_status ON public.stl_audit_results
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_top_title_suggestion_pre_approved();

-- 4. Policy: admins podem atualizar status das sugestões
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.stl_audit_suggestions'::regclass
      AND polname = 'Admins can update suggestion status'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can update suggestion status"
        ON public.stl_audit_suggestions FOR UPDATE
        USING (public.is_admin())
        WITH CHECK (public.is_admin())
    $policy$;
  END IF;
END $$;
