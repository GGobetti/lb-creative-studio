-- ============================================================
-- Migração: STL Bundling — user_acquired_stls
-- Tabela de aquisições de STL por usuário, com suporte a bundles
-- (um STL pai adquirido automaticamente traz todos os filhos)
--
-- Reversível: DROP TABLE IF EXISTS public.user_acquired_stls CASCADE;
--             DROP VIEW IF EXISTS public.vw_user_stl_portfolio CASCADE;
--             DROP FUNCTION IF EXISTS public.get_stl_group(UUID) CASCADE;
--             DROP FUNCTION IF EXISTS public.insert_stl_bundle(UUID, UUID, TEXT) CASCADE;
--             DROP FUNCTION IF EXISTS public.acquire_stl_bundle(UUID, TEXT, INT) CASCADE;
-- ============================================================

-- ─── 1. Tabela principal ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_acquired_stls (
  id           UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id)              ON DELETE CASCADE,
  stl_id       UUID        NOT NULL REFERENCES public.telegram_indexed_stls(id) ON DELETE CASCADE,
  -- fonte da aquisição: download direto, parte de bundle, brinde, etc.
  source       TEXT        NOT NULL DEFAULT 'direct'
                           CHECK (source IN ('direct', 'bundle_child', 'gift', 'import')),
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_acquired_stls_pkey PRIMARY KEY (id),
  -- idempotência: mesma (user, stl) nunca duplica
  CONSTRAINT user_acquired_stls_unique_pair UNIQUE (user_id, stl_id)
);

-- ─── 2. Índices de performance (50 k STLs × N usuários) ──────

-- Todas as aquisições de um usuário (listagem de biblioteca)
CREATE INDEX IF NOT EXISTS idx_uas_user_id
  ON public.user_acquired_stls (user_id);

-- Verificação de posse (user_id + stl_id) — hit frequente
CREATE INDEX IF NOT EXISTS idx_uas_user_stl
  ON public.user_acquired_stls (user_id, stl_id);

-- Filtros por fonte de aquisição dentro do portfólio do usuário
CREATE INDEX IF NOT EXISTS idx_uas_user_source
  ON public.user_acquired_stls (user_id, source);

-- ─── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE public.user_acquired_stls ENABLE ROW LEVEL SECURITY;

-- Usuário vê, cria e deleta apenas suas próprias aquisições
DROP POLICY IF EXISTS "user_acquired_stls: own all" ON public.user_acquired_stls;
CREATE POLICY "user_acquired_stls: own all"
  ON public.user_acquired_stls
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Administradores (sysadmin) têm acesso irrestrito
DROP POLICY IF EXISTS "user_acquired_stls: admin all" ON public.user_acquired_stls;
CREATE POLICY "user_acquired_stls: admin all"
  ON public.user_acquired_stls
  FOR ALL
  USING (public.is_admin());

-- ─── 4. VIEW — portfólio completo com metadados do STL ───────

DROP VIEW IF EXISTS public.vw_user_stl_portfolio CASCADE;
CREATE VIEW public.vw_user_stl_portfolio AS
SELECT
  uas.id              AS acquisition_id,
  uas.user_id,
  uas.source,
  uas.acquired_at,
  s.id                AS stl_id,
  s.title,
  s.description,
  s.thumbnail_url,
  s.file_name,
  s.file_size_bytes,
  s.tags,
  s.categories,
  s.parent_id,
  s.parts_count,
  s.telegram_group_id,
  s.created_at        AS stl_created_at
FROM public.user_acquired_stls uas
JOIN public.telegram_indexed_stls s ON s.id = uas.stl_id;

-- ─── 4b. RLS explícita na view ───────────────────────────────
-- Embora SECURITY INVOKER herde a policy da tabela base,
-- adicionar policy própria na view garante conformidade com spec.
DROP POLICY IF EXISTS "vw_user_stl_portfolio: own view" ON public.vw_user_stl_portfolio;
CREATE POLICY "vw_user_stl_portfolio: own view"
  ON public.vw_user_stl_portfolio FOR SELECT
  USING (auth.uid() = user_id);

-- ─── 5. Função: get_stl_group(stl_id) ────────────────────────
-- Retorna o pai (se existir) + todos os filhos diretos de um STL.
-- Utilizada para descobrir quais IDs compõem um bundle.

DROP FUNCTION IF EXISTS public.get_stl_group(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_stl_group(p_stl_id UUID)
RETURNS TABLE (
  id        UUID,
  parent_id UUID,
  role      TEXT   -- 'root', 'parent', 'child', 'self'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_root_id   UUID;
BEGIN
  -- Descobre o pai do STL informado
  SELECT s.parent_id INTO v_parent_id
    FROM public.telegram_indexed_stls s
   WHERE s.id = p_stl_id;

  -- Determina a raiz do grupo:
  -- Se o STL já é filho → a raiz é seu pai
  -- Se o STL não tem pai → ele mesmo é a raiz
  IF v_parent_id IS NOT NULL THEN
    v_root_id := v_parent_id;
  ELSE
    v_root_id := p_stl_id;
  END IF;

  -- 1. Retorna a raiz
  RETURN QUERY
    SELECT s.id,
           s.parent_id,
           CASE WHEN s.id = p_stl_id THEN 'self' ELSE 'parent' END::TEXT AS role
      FROM public.telegram_indexed_stls s
     WHERE s.id = v_root_id;

  -- 2. Retorna todos os filhos da raiz (exceto o STL de entrada que já veio acima)
  RETURN QUERY
    SELECT s.id,
           s.parent_id,
           CASE WHEN s.id = p_stl_id THEN 'self' ELSE 'child' END::TEXT AS role
      FROM public.telegram_indexed_stls s
     WHERE s.parent_id = v_root_id
       AND s.id <> v_root_id;  -- raiz já incluída acima se for filho
END;
$$;

-- ─── 6. Função: insert_stl_bundle(user_id, stl_id, source) ───
-- Insere o STL informado + todos do mesmo grupo (pai + irmãos/filhos).
-- Usa ON CONFLICT DO NOTHING para idempotência total.

DROP FUNCTION IF EXISTS public.insert_stl_bundle(UUID, UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.insert_stl_bundle(
  p_user_id UUID,
  p_stl_id  UUID,
  p_source  TEXT DEFAULT 'direct'
)
RETURNS INT   -- nº de novas linhas inseridas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted  INT := 0;
  v_row_count INT := 0;
  v_row       RECORD;
  v_src       TEXT;
BEGIN
  -- Itera sobre todo o grupo (pai + filhos)
  FOR v_row IN
    SELECT g.id, g.role FROM public.get_stl_group(p_stl_id) g
  LOOP
    -- STL solicitado diretamente mantém o source original;
    -- os demais são marcados como 'bundle_child'
    IF v_row.id = p_stl_id THEN
      v_src := p_source;
    ELSE
      v_src := 'bundle_child';
    END IF;

    INSERT INTO public.user_acquired_stls (user_id, stl_id, source)
    VALUES (p_user_id, v_row.id, v_src)
    ON CONFLICT (user_id, stl_id) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_inserted := v_inserted + v_row_count;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- ─── 7. Trigger automático ────────────────────────────────────
-- Quando um STL é adquirido (INSERT em user_acquired_stls),
-- dispara insert_stl_bundle para garantir que os filhos sejam
-- adicionados automaticamente.

CREATE OR REPLACE FUNCTION public.trg_fn_auto_bundle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só age se o STL inserido tem filhos (parts_count > 0)
  -- ou se é filho de outro (parent_id IS NOT NULL), evitando
  -- recursão infinita ao inserir bundle_child (source check).
  IF NEW.source <> 'bundle_child' THEN
    PERFORM public.insert_stl_bundle(NEW.user_id, NEW.stl_id, NEW.source);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_bundle ON public.user_acquired_stls;
CREATE TRIGGER trg_auto_bundle
  AFTER INSERT ON public.user_acquired_stls
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_auto_bundle();

-- ─── 8. RPC pública: acquire_stl_bundle(stl_id, source, credit_cost) ──
-- Chamada atômica pelo cliente: debita créditos, insere bundle e
-- registra transação. Retorna JSON com resultado da operação.
--
-- Fluxo:
--   1. Valida autenticação
--   2. Valida source
--   3. Valida créditos suficientes (se p_credit_cost > 0)
--   4. Debita créditos em profiles (FOR UPDATE — evita race condition)
--   5. Insere o bundle em user_acquired_stls (idempotente)
--   6. Registra log em transactions (credits_added negativo = débito)

DROP FUNCTION IF EXISTS public.acquire_stl_bundle(UUID, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.acquire_stl_bundle(UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.acquire_stl_bundle(
  p_stl_id      UUID,
  p_source      TEXT DEFAULT 'direct',
  p_credit_cost INT  DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_count         INT;
  v_credits_atual INT;
BEGIN
  -- 1. Resolve o usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- 2. Valida source
  IF p_source NOT IN ('direct', 'bundle_child', 'gift', 'import') THEN
    RAISE EXCEPTION 'Invalid source: %', p_source USING ERRCODE = '22023';
  END IF;

  -- 3 & 4. Valida e debita créditos (somente quando há custo)
  IF p_credit_cost > 0 THEN
    -- FOR UPDATE trava a linha para evitar race condition de saldo negativo
    SELECT credits INTO v_credits_atual
      FROM public.profiles
     WHERE id = v_user_id
       FOR UPDATE;

    IF v_credits_atual IS NULL OR v_credits_atual < p_credit_cost THEN
      RAISE EXCEPTION 'Insufficient credits: have %, need %',
        coalesce(v_credits_atual, 0), p_credit_cost
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.profiles
       SET credits    = credits - p_credit_cost,
           updated_at = now()
     WHERE id = v_user_id;

    -- 6. Registra débito em transactions
    INSERT INTO public.transactions (user_id, credits_added, description, item_id)
    VALUES (
      v_user_id,
      -p_credit_cost,
      'Download STL: ' || p_stl_id::text,
      p_stl_id
    );
  END IF;

  -- 5. Insere o bundle (idempotente via ON CONFLICT DO NOTHING)
  v_count := public.insert_stl_bundle(v_user_id, p_stl_id, p_source);

  RETURN json_build_object(
    'ok',           true,
    'stl_id',       p_stl_id,
    'user_id',      v_user_id,
    'source',       p_source,
    'acquired',     v_count,
    'credits_used', p_credit_cost
  );
END;
$$;

-- Permite que usuários autenticados chamem o RPC via anon key
GRANT EXECUTE ON FUNCTION public.acquire_stl_bundle(UUID, TEXT, INT) TO authenticated;
