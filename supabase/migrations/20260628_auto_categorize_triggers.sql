-- Auto-categorização automática: INSERT e UPDATE
-- Triggers que auto-categorizam STLs quando inseridos ou quando título/arquivo mudam
--
-- INSERT: novo STL é categorizado automaticamente baseado em nome/arquivo
-- UPDATE: se título ou file_name mudam, re-categoriza (preserva categorias existentes)

CREATE OR REPLACE FUNCTION auto_categorize_stl(stl_id UUID, stl_title TEXT, stl_file_name TEXT, stl_tags TEXT)
RETURNS TEXT[] AS $$
DECLARE
  cats TEXT[] := '{}';
  new_cats TEXT[];
BEGIN
  SELECT categories INTO cats FROM telegram_indexed_stls WHERE id = stl_id;
  IF cats IS NULL THEN cats := '{}'; END IF;

  -- Franquias → Personagens & Figuras
  IF (stl_title ~* 'marvel|dc comics|star wars|disney|harry potter|pokémon|sonic|mario|dragon ball|one piece|ghibli' OR
      stl_file_name ~* 'marvel|dc comics|star wars|disney|harry potter|pokemon|sonic|mario|dragon ball|one piece|ghibli') THEN
    new_cats := array_append(ARRAY['Personagens & Figuras'], 'Personagens & Figuras');
  END IF;

  -- Keywords: bust/figure/herói → Personagens & Figuras
  IF (stl_title ~* 'bust|figure|figurine|chibi|boneco|heroi|hero|personagem|mascote|estatua|statue' OR
      stl_file_name ~* 'bust|figure|figurine|chibi|boneco|heroi|hero|personagem|mascote|estatua') THEN
    new_cats := array_append(new_cats, 'Personagens & Figuras');
  END IF;

  -- Keywords: sculpture/art → Esculturas & Arte
  IF (stl_title ~* 'escultura|sculpture|retrato|portrait|diorama|relief|arte|art' OR
      stl_file_name ~* 'escultura|sculpture|retrato|portrait|diorama|relief|arte') THEN
    new_cats := array_append(new_cats, 'Esculturas & Arte');
  END IF;

  -- Keywords: multipart/NO AMS → Multipartes/NO AMS
  IF (stl_title ~* 'multipart|multi.part|no.ams|no-ams|no ams' OR
      stl_file_name ~* 'multipart|multi.part|no.ams|no-ams|no ams' OR
      stl_tags ~* 'multipart|multi.part|no.ams|no-ams|no ams') THEN
    new_cats := array_append(new_cats, 'Multipartes/NO AMS');
  END IF;

  -- Keywords: toy/fidget → Brinquedos
  IF (stl_title ~* 'brinquedo|toy|fidget|spinner|lego|jogo|game' OR
      stl_file_name ~* 'brinquedo|toy|fidget|spinner|lego') THEN
    new_cats := array_append(new_cats, 'Brinquedos');
  END IF;

  -- Keywords: vehicles → Veículos
  IF (stl_title ~* 'carro|truck|moto|motorcycle|aviao|airplane|nave|navio|rocket|foguete|tanque|helicopter|veiculo|vehicle|bicicleta|bike' OR
      stl_file_name ~* 'carro|truck|moto|motorcycle|aviao|navio|rocket|foguete|tanque|helicopter|veiculo|vehicle|bicicleta|bike') THEN
    new_cats := array_append(new_cats, 'Veículos');
  END IF;

  -- Keywords: animals/nature → Natureza & Animais
  IF (stl_title ~* 'animal|flor|flower|planta|plant|arvore|tree|passaro|bird|cachorro|dog|gato|cat|peixe|fish|dinossauro|dino' OR
      stl_file_name ~* 'animal|flor|flower|planta|plant|arvore|tree|passaro|bird|cachorro|dog|gato|cat|peixe|fish|dinossauro|dino') THEN
    new_cats := array_append(new_cats, 'Natureza & Animais');
  END IF;

  -- Keywords: sports → Esportes
  IF (stl_title ~* 'esporte|sport|futebol|soccer|basquete|basketball|tenis|tennis|volei' OR
      stl_file_name ~* 'esporte|sport|futebol|soccer|basquete|basketball|tenis|tennis|volei') THEN
    new_cats := array_append(new_cats, 'Esportes');
  END IF;

  -- Keywords: kitchen/home → Casa & Cozinha
  IF (stl_title ~* 'cozinha|kitchen|caneca|cup|colher|prato|plate|banheiro|bathroom' OR
      stl_file_name ~* 'cozinha|kitchen|caneca|cup|colher|prato|plate|banheiro|bathroom') THEN
    new_cats := array_append(new_cats, 'Casa & Cozinha');
  END IF;

  -- Keywords: education/science → Educação
  IF (stl_title ~* 'educacao|education|escola|school|ciencia|science|anatomia|biology|quimica|chemistry|math' OR
      stl_file_name ~* 'educacao|education|escola|school|ciencia|science|anatomia|biology|quimica|math') THEN
    new_cats := array_append(new_cats, 'Educação');
  END IF;

  -- Keywords: decoration → Decoração
  IF (stl_title ~* 'decor|vaso|vase|luminaria|lamp|prateleira|shelf|ornamento|espelho|mirror|relógio|clock' OR
      stl_file_name ~* 'decor|vaso|vase|luminaria|lamp|prateleira|shelf|ornamento|espelho|relógio|clock') THEN
    new_cats := array_append(new_cats, 'Decoração');
  END IF;

  -- Keywords: utilities → Utilidades
  IF (stl_title ~* 'suporte|holder|organizador|organizer|gancho|hook|caixa|box|case|adaptador|adapter|cabo|cable' OR
      stl_file_name ~* 'suporte|holder|organizador|organizer|gancho|hook|caixa|box|case|adaptador|adapter|cabo|cable') THEN
    new_cats := array_append(new_cats, 'Utilidades');
  END IF;

  -- Keywords: miniatures/RPG → Miniaturas & RPG
  IF (stl_title ~* 'miniatura|tabletop|diorama|warhammer|rpg|dnd|lord of the rings' OR
      stl_file_name ~* 'miniatura|tabletop|diorama|warhammer|rpg|dnd') THEN
    new_cats := array_append(new_cats, 'Miniaturas & RPG');
  END IF;

  -- Merge com categorias existentes, remove duplicatas, mantém ordem
  RETURN array(SELECT DISTINCT unnest(cats || new_cats) ORDER BY 1);
END;
$$ LANGUAGE plpgsql;

-- Trigger para INSERT: auto-categoriza novo STL
CREATE OR REPLACE FUNCTION auto_categorize_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = false THEN
    NEW.categories := auto_categorize_stl(NEW.id, NEW.title, NEW.file_name, (NEW.tags::TEXT));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para UPDATE: re-categoriza se título ou arquivo mudam
CREATE OR REPLACE FUNCTION auto_categorize_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = false AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.file_name IS DISTINCT FROM OLD.file_name) THEN
    NEW.categories := auto_categorize_stl(NEW.id, NEW.title, NEW.file_name, (NEW.tags::TEXT));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Instala os triggers
DROP TRIGGER IF EXISTS trg_auto_categorize_insert ON telegram_indexed_stls;
DROP TRIGGER IF EXISTS trg_auto_categorize_update ON telegram_indexed_stls;

CREATE TRIGGER trg_auto_categorize_insert
BEFORE INSERT ON telegram_indexed_stls
FOR EACH ROW
EXECUTE FUNCTION auto_categorize_on_insert();

CREATE TRIGGER trg_auto_categorize_update
BEFORE UPDATE ON telegram_indexed_stls
FOR EACH ROW
EXECUTE FUNCTION auto_categorize_on_update();
