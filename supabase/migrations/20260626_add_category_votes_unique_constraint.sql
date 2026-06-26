-- Adiciona constraint de unique em category_votes para user_id,stl_id
-- Isso permite fazer UPSERT corretamente

-- Verifica se a constraint já existe antes de criar
ALTER TABLE category_votes
  ADD CONSTRAINT category_votes_user_stl_unique UNIQUE (user_id, stl_id);
