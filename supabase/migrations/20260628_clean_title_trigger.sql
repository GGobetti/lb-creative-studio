-- Trigger de limpeza automática de título no INSERT
-- Aplica regras básicas de normalização ao campo `title` antes de salvar.
-- Regras mais complexas (CJK, hashes longos, Multipartes/NO-AMS) continuam
-- sendo tratadas pelo script TypeScript aplicar-limpeza.ts quando necessário.

CREATE OR REPLACE FUNCTION clean_stl_title()
RETURNS TRIGGER AS $$
DECLARE
  t TEXT;
  has_multipartes BOOLEAN;
  has_no_ams BOOLEAN;
  suffix TEXT;
  words TEXT[];
  word TEXT;
  result TEXT[];
  i INT;
  lower_words TEXT[] := ARRAY['de','do','da','dos','das','e','a','o','os','as','the','of','and','in','for','no','na'];
BEGIN
  t := COALESCE(NEW.title, '');

  -- Não reprocessar títulos já limpos (evita loop em UPDATEs do próprio script)
  -- Só roda em INSERTs ou quando o title mudou
  IF TG_OP = 'UPDATE' AND NEW.title = OLD.title THEN
    RETURN NEW;
  END IF;

  -- ── 1. Detectar flags ────────────────────────────────────────────────────
  has_multipartes := t ~* 'multi[\s_-]?p(art(es?|i[eè]ces?)?|artes?)|multipieces?';
  has_no_ams      := t ~* 'no[\s_-]?ams|sem[\s_-]?ams|noams';

  -- ── 2. Remover variantes de Multipartes e NO-AMS ─────────────────────────
  t := regexp_replace(t, '[-_\s]*multi[\s_-]?p(art(es?|i[eè]ces?)?|artes?)[-_\s]*', ' ', 'gi');
  t := regexp_replace(t, '[-_\s]*multipieces?[-_\s]*', ' ', 'gi');
  t := regexp_replace(t, '[-_\s]*MULTI[\s_-]PART[-_\s]*', ' ', 'g');
  t := regexp_replace(t, '[-_\s]*no[\s_-]?ams[-_\s]*', ' ', 'gi');
  t := regexp_replace(t, '[-_\s]*sem[\s_-]?ams[-_\s]*', ' ', 'gi');
  t := regexp_replace(t, '[-_\s]*noams[-_\s]*', ' ', 'gi');

  -- ── 3. Remover @canais ───────────────────────────────────────────────────
  t := regexp_replace(t, '_?@\w+', '', 'g');

  -- ── 4. Remover hashes de upload (_YYYYMMDD_N_XXXX) ───────────────────────
  t := regexp_replace(t, '_\d{8}_\d+_[a-z0-9]{4,}', '', 'gi');

  -- ── 5. Remover datas de 8 dígitos (isoladas ou coladas) ──────────────────
  t := regexp_replace(t, '20\d{6}', '', 'g');

  -- ── 6. Remover prefixos de criadores ─────────────────────────────────────
  t := regexp_replace(t, '^Whale3D[-–\s]*Studio\s*', '', 'i');
  t := regexp_replace(t, '^Whale3D[-–\s]*', '', 'i');
  t := regexp_replace(t, '^STLflix\s*[-–]\s*', '', 'i');
  t := regexp_replace(t, '^3DXM\s*[-–]\s*', '', 'i');
  t := regexp_replace(t, '^YoshStudios\s*', '', 'i');
  t := regexp_replace(t, '^DecorMaster\s*', '', 'i');
  t := regexp_replace(t, '^GeekSculpt3D[-–]?\s*', '', 'i');
  t := regexp_replace(t, '^Hex3D[-–]?\s*', '', 'i');
  t := regexp_replace(t, '^@?[Oo]3dlab[-–]?\s*', '', 'i');
  t := regexp_replace(t, '^\s*T\.me\s*', '', 'i');

  -- ── 7. Remover sufixos de criadores ──────────────────────────────────────
  t := regexp_replace(t, '\s*\(Aslan3D\)\s*', ' ', 'gi');
  t := regexp_replace(t, '[-_\s]+rtprops\b', '', 'gi');
  t := regexp_replace(t, '[-_\s]+DecorMaster\b', '', 'gi');
  t := regexp_replace(t, '[-_\s]+GeekSculpt3D\b', '', 'gi');
  t := regexp_replace(t, '[-_\s]+Hex3D\b', '', 'gi');
  t := regexp_replace(t, '[-_\s]+O3dlab\b', '', 'gi');
  t := regexp_replace(t, '[-_.,\s]+model[-_\s]*files?\b', '', 'gi');

  -- ── 8. Remover impressoras e slicers ─────────────────────────────────────
  t := regexp_replace(t, '\mBambu\s*Laba?\d*\M', '', 'gi');
  t := regexp_replace(t, '\mBambu\s*Lab\M', '', 'gi');
  t := regexp_replace(t, '\mBambulab\M', '', 'gi');
  t := regexp_replace(t, '\mBambu\s*Studio\M', '', 'gi');
  t := regexp_replace(t, '\mBambustudio\M', '', 'gi');
  t := regexp_replace(t, '\mBambulabprinter\M', '', 'gi');
  t := regexp_replace(t, '\mLABA1\M', '', 'gi');
  t := regexp_replace(t, '\mBambu\M', '', 'gi');
  t := regexp_replace(t, '\mChitubox\M', '', 'gi');
  t := regexp_replace(t, '\mA1\s*Mini\M', '', 'gi');

  -- ── 9. Remover termos genéricos ───────────────────────────────────────────
  t := regexp_replace(t, '[-_\s]+stls\b', '', 'gi');
  t := regexp_replace(t, '\mmultiparts3mf\M', '', 'gi');
  t := regexp_replace(t, '\m3mf\d*\M', '', 'gi');
  t := regexp_replace(t, '\mFan\s*Art\M', '', 'gi');
  t := regexp_replace(t, '\mFinal\M', '', 'gi');
  t := regexp_replace(t, '\mPLA\s*[en]\s*PA\M', '', 'gi');
  t := regexp_replace(t, '\mPLA\M', '', 'gi');
  t := regexp_replace(t, '\mT\.me\M', '', 'gi');

  -- ── 10. Substituir + e _ por espaço ──────────────────────────────────────
  t := replace(t, '+', ' ');
  t := replace(t, '_', ' ');

  -- ── 11. Remover extensões embutidas e parênteses vazios ──────────────────
  t := regexp_replace(t, '\.(3mf|stl)\M', '', 'gi');
  t := regexp_replace(t, '\(\s*\)', '', 'g');
  t := regexp_replace(t, '\[\s*\]', '', 'g');
  t := regexp_replace(t, '\s*\(\d+\)\s*$', '');

  -- ── 12. Normalizar espaços e hífens ──────────────────────────────────────
  t := regexp_replace(t, '\s{2,}', ' ', 'g');
  t := regexp_replace(t, '\s*[-–—]\s*', ' - ', 'g');
  t := regexp_replace(t, '(\s+-\s+)+', ' - ', 'g');
  t := regexp_replace(t, '^[\s\-–—.,]+|[\s\-–—.,]+$', '', 'g');
  t := btrim(t);

  -- ── 13. Se ficou vazio ou só números/lixo → TBD ──────────────────────────
  IF t = '' OR t ~ '^[\d\s\-_.#()/\\]+$' OR length(t) < 2 THEN
    NEW.title := 'TBD';
    RETURN NEW;
  END IF;

  -- ── 14. Title Case suave ─────────────────────────────────────────────────
  words := string_to_array(t, ' ');
  result := '{}';
  FOR i IN 1..array_length(words, 1) LOOP
    word := words[i];
    IF word = '' THEN
      result := array_append(result, word);
      CONTINUE;
    END IF;
    -- Siglas (2-5 chars maiúsculos): preservar
    IF word ~ '^[A-Z0-9]{2,5}$' THEN
      result := array_append(result, word);
    -- Artigos/preposições (não primeira palavra): minúsculo
    ELSIF i > 1 AND lower(word) = ANY(lower_words) THEN
      result := array_append(result, lower(word));
    -- Demais: primeira letra maiúscula
    ELSE
      result := array_append(result, upper(left(lower(word), 1)) || right(lower(word), -1));
    END IF;
  END LOOP;
  t := array_to_string(result, ' ');

  -- ── 15. Sufixo padronizado ────────────────────────────────────────────────
  IF has_multipartes OR has_no_ams THEN
    IF has_multipartes AND has_no_ams THEN
      suffix := ' - (Multipartes - NO-AMS)';
    ELSIF has_multipartes THEN
      suffix := ' - (Multipartes)';
    ELSE
      suffix := ' - (NO-AMS)';
    END IF;
    t := t || suffix;
  END IF;

  NEW.title := t;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: roda em todo INSERT e em UPDATE quando title ou file_name mudam
DROP TRIGGER IF EXISTS trg_clean_stl_title ON telegram_indexed_stls;
CREATE TRIGGER trg_clean_stl_title
  BEFORE INSERT OR UPDATE OF title, file_name
  ON telegram_indexed_stls
  FOR EACH ROW
  EXECUTE FUNCTION clean_stl_title();
