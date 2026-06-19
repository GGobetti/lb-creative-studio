-- ============================================================
-- Script de Seed: Inserção de Dados de Telegram STLs com Carrossel e Downloads
-- Execute no Editor SQL do seu Supabase Dashboard
-- ============================================================

-- Limpar dados anteriores para evitar duplicações
truncate table public.telegram_indexed_stls cascade;

insert into public.telegram_indexed_stls (
  title, 
  description, 
  thumbnail_url, 
  telegram_group_id, 
  telegram_group_name, 
  telegram_message_id, 
  file_name, 
  file_size_bytes, 
  tags,
  photos,
  download_count
) values
(
  'Super Mario Figure - High Detail',
  'Estatueta detalhada do Super Mario segurando um cogumelo. Pronto para impressão com suportes mínimos.',
  'https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=500&q=80',
  '-100123456789',
  '3D Print Masters',
  1001,
  'super_mario_high_detail.stl',
  25165824, -- 24 MB
  array['mario', 'nintendo', 'action figure', 'geek', 'brinquedo'],
  array[
    'https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=500&q=80',
    'https://images.unsplash.com/photo-1608889174637-3c44f6326f1a?w=500&q=80',
    'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=500&q=80'
  ],
  142
),
(
  'Mario Planter',
  'Vaso de plantas decorativo no formato do cano/cabeça do Mario. Fica ótimo em escritórios.',
  'https://images.unsplash.com/photo-1596755486829-d5ebce1c5040?w=500&q=80',
  '-100987654321',
  'Geeky STLs',
  2045,
  'mario_pipe_planter.stl',
  12582912, -- 12 MB
  array['mario', 'nintendo', 'vaso', 'decoracao', 'planta'],
  array[
    'https://images.unsplash.com/photo-1596755486829-d5ebce1c5040?w=500&q=80',
    'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&q=80'
  ],
  67
),
(
  'Bowser Castle Dice Tower',
  'Torre de dados incrível inspirada no castelo do Bowser. Perfeito para jogos de RPG e tabuleiro.',
  'https://images.unsplash.com/photo-1580237072617-771c3ecc4a24?w=500&q=80',
  '-100123456789',
  '3D Print Masters',
  1050,
  'bowser_castle_dice_tower.stl',
  163577856, -- 156 MB
  array['bowser', 'castle', 'dice', 'tower', 'rpg', 'boardgame', 'nintendo'],
  array[
    'https://images.unsplash.com/photo-1580237072617-771c3ecc4a24?w=500&q=80',
    'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=500&q=80'
  ],
  210
),
(
  'Luigi Mansion Keychain',
  'Chaveirinho com o logotipo clássico do Luigi Mansion. Impressão rápida de 15 minutos.',
  'https://images.unsplash.com/photo-1585856488737-2917e3f847d0?w=500&q=80',
  '-100555555555',
  'Free STL Daily',
  5002,
  'luigi_mansion_keychain.stl',
  3145728, -- 3 MB
  array['luigi', 'keychain', 'mansion', 'nintendo', 'chaveiro'],
  array[
    'https://images.unsplash.com/photo-1585856488737-2917e3f847d0?w=500&q=80'
  ],
  18
),
(
  'Yoshi Articulated Toy',
  'Brinquedo articulado do Yoshi. Todas as partes se movem e é impresso em uma única peça (print-in-place).',
  'https://images.unsplash.com/photo-1534080519391-49033320f784?w=500&q=80',
  '-100987654321',
  'Geeky STLs',
  2100,
  'yoshi_articulated_pip.stl',
  47185920, -- 45 MB
  array['yoshi', 'nintendo', 'articulado', 'toy', 'dinossauro'],
  array[
    'https://images.unsplash.com/photo-1534080519391-49033320f784?w=500&q=80',
    'https://images.unsplash.com/photo-1566577134770-3d85bb3a9cc4?w=500&q=80'
  ],
  95
),
(
  'Mario Kart Trophy',
  'Troféu da Copa Especial do Mario Kart. Excelente peça de exibição ou premiação para torneios.',
  'https://images.unsplash.com/photo-1605901309584-818e25960b8f?w=500&q=80',
  '-100123456789',
  '3D Print Masters',
  1105,
  'mario_kart_cup_trophy.stl',
  92274688, -- 88 MB
  array['mario', 'kart', 'trofeu', 'nintendo', 'corrida'],
  array[
    'https://images.unsplash.com/photo-1605901309584-818e25960b8f?w=500&q=80'
  ],
  34
);
