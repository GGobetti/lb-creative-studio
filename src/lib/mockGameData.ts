import type { PhotoMatchQuestion, TagDetectiveQuestion, SortableStl, AuditQuestion } from '@/types/games'

// ─── Photo Match ─────────────────────────────────────────────────────────────
// isMatch: true = foto e nome batem | false = foto e nome não batem

const BASE = 'https://images.unsplash.com/photo-'

export const mockPhotoMatchQuestions: PhotoMatchQuestion[] = [
  { id: 'pm-1',  imageUrl: BASE + '1578749014140-36f6e9f8d58a?w=400&h=400&fit=crop', title: 'Dragão Articulado - Flexi Print',   description: 'Modelo de dragão articulado impresso em uma peça, sem suporte, flexi-joint.',             isMatch: true  },
  { id: 'pm-2',  imageUrl: BASE + '1610701596007-11502861dffa?w=400&h=400&fit=crop', title: 'Porta Talheres Hexagonal',           description: 'Organizador de talheres com 7 compartimentos em formato de honeycomb.',                  isMatch: true  },
  { id: 'pm-3',  imageUrl: BASE + '1587014382346-57099b2b9b73?w=400&h=400&fit=crop', title: 'Caixa de Remédios Semanal',          description: 'Caixa com 7 compartimentos para organizar remédios por dia da semana.',                   isMatch: false }, // mismatch: foto é de outro objeto
  { id: 'pm-4',  imageUrl: BASE + '1579783902614-e3fb3f4e46a2?w=400&h=400&fit=crop', title: 'Capacete Samurai Full Scale',        description: 'Réplica em escala 1:1 de capacete samurai estilo feudal japonês, 12 partes.',             isMatch: true  },
  { id: 'pm-5',  imageUrl: BASE + '1591195853828-11db59a44f6b?w=400&h=400&fit=crop', title: 'Suporte de Celular para Mesa',       description: 'Suporte ajustável para celular até 7 polegadas, base antiderrapante.',                   isMatch: true  },
  { id: 'pm-6',  imageUrl: BASE + '1578500494198-246f612d08d7?w=400&h=400&fit=crop', title: 'Vaso Geométrico Minimalista',        description: 'Vaso decorativo com faces planas e ângulos agudos, estilo low-poly.',                    isMatch: false },
  { id: 'pm-7',  imageUrl: BASE + '1610889033128-ba37d665fbb5?w=400&h=400&fit=crop', title: 'Chaveiro Mapa do Brasil',            description: 'Chaveiro em forma do mapa do Brasil com furo para corrente.',                            isMatch: true  },
  { id: 'pm-8',  imageUrl: BASE + '1570129477992-3bea49a28968?w=400&h=400&fit=crop', title: 'Miniatura Xadrez - Peão',            description: 'Peça de xadrez estilo moderno minimalista, altura 35mm.',                                isMatch: true  },
  { id: 'pm-9',  imageUrl: BASE + '1609488646857-9f8d87bdf4cf?w=400&h=400&fit=crop', title: 'Clipe de Cabo para Mesa',            description: 'Clipe organizador de cabos USB/HDMI, encaixa na beira da mesa.',                        isMatch: false },
  { id: 'pm-10', imageUrl: BASE + '1599643478518-a784e5dc4c8f?w=400&h=400&fit=crop', title: 'Anel Solitário Clássico',            description: 'Anel solitário com setting para pedra redonda de 8mm, tamanho 17.',                     isMatch: true  },
  { id: 'pm-11', imageUrl: BASE + '1585501033000-a70ebf3a2c3d?w=400&h=400&fit=crop', title: 'Ventilador de Mesa Estilo Retro',    description: 'Carcaça de ventilador vintage para motor N20, projeto decorativo.',                     isMatch: true  },
  { id: 'pm-12', imageUrl: BASE + '1589939705066-5ea266afb923?w=400&h=400&fit=crop', title: 'Suporte para Fones de Ouvido',       description: 'Suporte de parede ou mesa para headset gamer, cabo organizador incluso.',               isMatch: false },
  { id: 'pm-13', imageUrl: BASE + '1611273426858-e6df10bdc866?w=400&h=400&fit=crop', title: 'Polvo Articulado Flexi',             description: 'Polvo com 8 tentáculos articulados, print-in-place sem suporte.',                       isMatch: true  },
  { id: 'pm-14', imageUrl: BASE + '1578500494198-246f612d08d7?w=400&h=400&fit=crop', title: 'Cortador de Biscoito - Estrela',     description: 'Cortador e marcador de biscoito em forma de estrela de 8 pontas.',                      isMatch: true  },
  { id: 'pm-15', imageUrl: BASE + '1593642632505-265cf194a0e6?w=400&h=400&fit=crop', title: 'Pistola de Calibre - FDM',          description: 'Calibrador manual para nozzle e bed leveling de impressoras FDM.',                      isMatch: false },
]

// ─── Tag Detective ───────────────────────────────────────────────────────────
// isRelevant: true = tag correta | false = tag deve ser removida

export const mockTagDetectiveQuestions: TagDetectiveQuestion[] = [
  {
    id: 'td-1', imageUrl: BASE + '1578749014140-36f6e9f8d58a?w=300&h=300&fit=crop', title: 'Dragão Articulado Flexi',
    tags: [
      { text: '#dragao',      isRelevant: true  },
      { text: '#articulado',  isRelevant: true  },
      { text: '#flexi-print', isRelevant: true  },
      { text: '#sem-suporte', isRelevant: true  },
      { text: '#automotivo',  isRelevant: false },
      { text: '#decoracao',   isRelevant: true  },
    ],
  },
  {
    id: 'td-2', imageUrl: BASE + '1578500494198-246f612d08d7?w=300&h=300&fit=crop', title: 'Vaso Geométrico Low-Poly',
    tags: [
      { text: '#vaso',          isRelevant: true  },
      { text: '#low-poly',      isRelevant: true  },
      { text: '#decoracao',     isRelevant: true  },
      { text: '#geometrico',    isRelevant: true  },
      { text: '#rpg',           isRelevant: false },
      { text: '#impressao-3d',  isRelevant: true  },
    ],
  },
  {
    id: 'td-3', imageUrl: BASE + '1579783902614-e3fb3f4e46a2?w=300&h=300&fit=crop', title: 'Capacete Samurai',
    tags: [
      { text: '#capacete',  isRelevant: true  },
      { text: '#samurai',   isRelevant: true  },
      { text: '#cosplay',   isRelevant: true  },
      { text: '#japones',   isRelevant: true  },
      { text: '#cozinha',   isRelevant: false },
      { text: '#fullscale', isRelevant: true  },
    ],
  },
  {
    id: 'td-4', imageUrl: BASE + '1587014382346-57099b2b9b73?w=300&h=300&fit=crop', title: 'Caixa de Remédios Semanal',
    tags: [
      { text: '#saude',      isRelevant: true  },
      { text: '#organizador',isRelevant: true  },
      { text: '#remedios',   isRelevant: true  },
      { text: '#semanal',    isRelevant: true  },
      { text: '#joalheria',  isRelevant: false },
      { text: '#funcional',  isRelevant: true  },
    ],
  },
  {
    id: 'td-5', imageUrl: BASE + '1599643478518-a784e5dc4c8f?w=300&h=300&fit=crop', title: 'Anel Solitário',
    tags: [
      { text: '#anel',       isRelevant: true  },
      { text: '#joalheria',  isRelevant: true  },
      { text: '#solitario',  isRelevant: true  },
      { text: '#resin',      isRelevant: true  },
      { text: '#ferramenta', isRelevant: false },
      { text: '#presente',   isRelevant: true  },
    ],
  },
  {
    id: 'td-6', imageUrl: BASE + '1589939705066-5ea266afb923?w=300&h=300&fit=crop', title: 'Suporte Headset Gamer',
    tags: [
      { text: '#headset',    isRelevant: true  },
      { text: '#gamer',      isRelevant: true  },
      { text: '#suporte',    isRelevant: true  },
      { text: '#setup',      isRelevant: true  },
      { text: '#brinquedo',  isRelevant: false },
      { text: '#desk-setup', isRelevant: true  },
    ],
  },
  {
    id: 'td-7', imageUrl: BASE + '1570129477992-3bea49a28968?w=300&h=300&fit=crop', title: 'Peão de Xadrez Moderno',
    tags: [
      { text: '#xadrez',    isRelevant: true  },
      { text: '#tabuleiro', isRelevant: true  },
      { text: '#jogo',      isRelevant: true  },
      { text: '#minimalista', isRelevant: true },
      { text: '#esporte',   isRelevant: false },
      { text: '#classico',  isRelevant: true  },
    ],
  },
  {
    id: 'td-8', imageUrl: BASE + '1611273426858-e6df10bdc866?w=300&h=300&fit=crop', title: 'Polvo Articulado',
    tags: [
      { text: '#polvo',      isRelevant: true  },
      { text: '#articulado', isRelevant: true  },
      { text: '#animal',     isRelevant: true  },
      { text: '#flexi',      isRelevant: true  },
      { text: '#industrial', isRelevant: false },
      { text: '#decoracao',  isRelevant: true  },
    ],
  },
]

// ─── Category Sort ───────────────────────────────────────────────────────────

export const mockSortableStls: SortableStl[] = [
  { id: 'cs-1',  imageUrl: BASE + '1578749014140-36f6e9f8d58a?w=300&h=300&fit=crop', title: 'Dragão Articulado',         description: 'Figura articulada de dragão para impressão 3D' },
  { id: 'cs-2',  imageUrl: BASE + '1610701596007-11502861dffa?w=300&h=300&fit=crop', title: 'Porta Talheres',            description: 'Organizador de talheres para cozinha'           },
  { id: 'cs-3',  imageUrl: BASE + '1599643478518-a784e5dc4c8f?w=300&h=300&fit=crop', title: 'Anel Solitário',            description: 'Anel com pedra central para joalheria'          },
  { id: 'cs-4',  imageUrl: BASE + '1568602471122-7832951cc4c5?w=300&h=300&fit=crop', title: 'Bola de Futebol Decorativa', description: 'Minibola de futebol decorativa'                 },
  { id: 'cs-5',  imageUrl: BASE + '1578500494198-246f612d08d7?w=300&h=300&fit=crop', title: 'Vaso Geométrico',           description: 'Vaso com design geométrico moderno'             },
  { id: 'cs-6',  imageUrl: BASE + '1607623814075-e51df1bdc82f?w=300&h=300&fit=crop', title: 'Chave Inglesa Didática',    description: 'Réplica de chave inglesa para ensino'          },
  { id: 'cs-7',  imageUrl: BASE + '1569163139394-de4798aa62b1?w=300&h=300&fit=crop', title: 'Letras do Alfabeto',        description: 'Conjunto de letras para uso educacional'        },
  { id: 'cs-8',  imageUrl: BASE + '1611273426858-e6df10bdc866?w=300&h=300&fit=crop', title: 'Polvo Articulado',          description: 'Polvo articulado com tentáculos móveis'        },
  { id: 'cs-9',  imageUrl: BASE + '1591195853828-11db59a44f6b?w=300&h=300&fit=crop', title: 'Suporte Celular',           description: 'Suporte de mesa para smartphone'               },
  { id: 'cs-10', imageUrl: BASE + '1599643478518-a784e5dc4c8f?w=300&h=300&fit=crop', title: 'Brinco Geométrico',         description: 'Par de brincos com design geométrico'          },
  { id: 'cs-11', imageUrl: BASE + '1568602471122-7832951cc4c5?w=300&h=300&fit=crop', title: 'Cone de Treinamento Mini',  description: 'Mini cone para treinos e marcações'           },
  { id: 'cs-12', imageUrl: BASE + '1578500494198-246f612d08d7?w=300&h=300&fit=crop', title: 'Abajur Losangular',         description: 'Abajur com padrão de losangos'                },
  { id: 'cs-13', imageUrl: BASE + '1607623814075-e51df1bdc82f?w=300&h=300&fit=crop', title: 'Testador de Nozzle',        description: 'Ferramenta para testar e calibrar nozzles'    },
  { id: 'cs-14', imageUrl: BASE + '1569163139394-de4798aa62b1?w=300&h=300&fit=crop', title: 'Quebra-cabeça Geométrico',  description: 'Peças de quebra-cabeça geométrico'            },
  { id: 'cs-15', imageUrl: BASE + '1579783902614-e3fb3f4e46a2?w=300&h=300&fit=crop', title: 'Capacete Samurai',          description: 'Miniatura de capacete de samurai'             },
]

export function getCategorySortRounds() {
  return [...mockSortableStls].sort(() => Math.random() - 0.5).slice(0, 8)
}

// ─── Quality Audit ───────────────────────────────────────────────────────────

export const mockAuditQuestions: AuditQuestion[] = [
  {
    id: 'qa-1',
    imageUrl: BASE + '1578749014140-36f6e9f8d58a?w=600&h=400&fit=crop',
    title: 'Dragão Articulado - Flexi Print v2',
    description: 'Modelo de dragão articulado com 18 segmentos flexíveis. Impresso em uma única peça sem suporte. Testado em PLA e TPU. Escala padrão 150mm de comprimento.',
    tags: ['#dragao', '#articulado', '#flexi', '#sem-suporte'],
    fileName: 'dragon_flexi_v2.stl',
    shouldApprove: true,
  },
  {
    id: 'qa-2',
    imageUrl: BASE + '1586349884129-37cdde760bb2?w=600&h=400&fit=crop',
    title: 'STL modelo',
    description: 'arquivo stl',
    tags: [],
    fileName: 'modelo.stl',
    shouldApprove: false,
    issues: ['Nome genérico', 'Descrição vazia', 'Sem tags', 'Imagem não enviada'],
  },
  {
    id: 'qa-3',
    imageUrl: BASE + '1579783902614-e3fb3f4e46a2?w=600&h=400&fit=crop',
    title: 'Capacete Mandalorian - Wearable Full Scale',
    description: 'Réplica do capacete Mandalorian da série The Mandalorian. Escala usável (circunferência cabeça 56cm). 14 partes separadas para facilitar impressão. Testado em PLA+ com 20% infill.',
    tags: ['#mandalorian', '#starwars', '#cosplay', '#capacete', '#wearable'],
    fileName: 'mandalorian_helmet_v3.stl',
    shouldApprove: true,
  },
  {
    id: 'qa-4',
    imageUrl: BASE + '1591195853828-11db59a44f6b?w=600&h=400&fit=crop',
    title: 'Suporte Genérico',
    description: 'Suporte para coisas',
    tags: ['#suporte'],
    fileName: 'suporte.stl',
    shouldApprove: false,
    issues: ['Descrição insuficiente (menos de 20 palavras)', 'Poucas tags', 'Título não descritivo'],
  },
  {
    id: 'qa-5',
    imageUrl: BASE + '1609488646857-9f8d87bdf4cf?w=600&h=400&fit=crop',
    title: 'Organizador de Cabos para Mesa - 6 Slots',
    description: 'Organizador de cabos com 6 slots de diâmetros variados (4mm a 12mm). Instala na beira da mesa sem cola. Material recomendado: PETG ou PLA. Dimensões: 120×40×30mm.',
    tags: ['#organizador', '#cabos', '#desk', '#funcional', '#home-office'],
    fileName: 'cable_organizer_6slot.stl',
    shouldApprove: true,
  },
  {
    id: 'qa-6',
    imageUrl: BASE + '1578500494198-246f612d08d7?w=600&h=400&fit=crop',
    title: 'Vaso Flower Pot Wavy Design',
    description: 'Vaso decorativo com design ondulado, perfeito para plantas pequenas. Fundo fechado com furos de drenagem. Impresso em modo vase (espiral). Altura: 120mm.',
    tags: ['#vaso', '#plantas', '#decoracao', '#vase-mode', '#ondulado'],
    fileName: 'wavy_flower_pot.stl',
    shouldApprove: true,
  },
  {
    id: 'qa-7',
    imageUrl: BASE + '1586349884129-37cdde760bb2?w=600&h=400&fit=crop',
    title: 'xxx adult content',
    description: 'modelo adulto',
    tags: ['#nsfw'],
    fileName: 'adult.stl',
    shouldApprove: false,
    issues: ['Conteúdo adulto/inapropriado'],
  },
  {
    id: 'qa-8',
    imageUrl: BASE + '1607623814075-e51df1bdc82f?w=600&h=400&fit=crop',
    title: 'Chave de Fenda Magnética - Handle Ergonômico',
    description: 'Handle ergonômico para chave de fenda com slot para bit 1/4". Inclui porta para 4 bits extras. Design antiderrapante com texturas de grip. Compatível com bits padrão.',
    tags: ['#ferramenta', '#chave-de-fenda', '#ergonomico', '#diy', '#workshop'],
    fileName: 'magnetic_screwdriver_handle.stl',
    shouldApprove: true,
  },
]
