-- ============================================================
-- Migração: Mesclagem de Partes de STL do Telegram
-- Adiciona parent_id (relação pai-filho) e parts_count (desnormalizado)
-- ============================================================

-- 1. Adicionar coluna parent_id (FK auto-referencial, nullable)
ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS parent_id UUID
    REFERENCES public.telegram_indexed_stls(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_indexed_stls_parent_id
  ON public.telegram_indexed_stls(parent_id);

-- 2. Adicionar coluna parts_count (desnormalizada, mantida por trigger)
ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS parts_count INT NOT NULL DEFAULT 0;

-- 3. Inicializar parts_count para registros existentes
UPDATE public.telegram_indexed_stls AS parent
SET parts_count = (
  SELECT COUNT(*)
  FROM public.telegram_indexed_stls AS child
  WHERE child.parent_id = parent.id
);

-- 4. Criar função do trigger
CREATE OR REPLACE FUNCTION public.update_parts_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- INSERT de um filho: incrementa o pai
  IF (TG_OP = 'INSERT') THEN
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE public.telegram_indexed_stls
        SET parts_count = parts_count + 1
        WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE de um filho: decrementa o pai
  IF (TG_OP = 'DELETE') THEN
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE public.telegram_indexed_stls
        SET parts_count = GREATEST(0, parts_count - 1)
        WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: pode ter mudado o parent_id
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
      -- Decrementa pai antigo
      IF OLD.parent_id IS NOT NULL THEN
        UPDATE public.telegram_indexed_stls
          SET parts_count = GREATEST(0, parts_count - 1)
          WHERE id = OLD.parent_id;
      END IF;
      -- Incrementa novo pai
      IF NEW.parent_id IS NOT NULL THEN
        UPDATE public.telegram_indexed_stls
          SET parts_count = parts_count + 1
          WHERE id = NEW.parent_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- 5. Criar trigger na tabela
DROP TRIGGER IF EXISTS trg_update_parts_count ON public.telegram_indexed_stls;
CREATE TRIGGER trg_update_parts_count
  AFTER INSERT OR UPDATE OF parent_id OR DELETE
  ON public.telegram_indexed_stls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_parts_count();
