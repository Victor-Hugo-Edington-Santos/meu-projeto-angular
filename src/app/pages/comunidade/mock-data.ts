// --- Seed MOCK da comunidade (sem backend). Estrutura espelha o que as RPCs
// do Supabase retornariam (ver docs/sql/03_create_rpcs.sql).
// TODO SUPABASE: trocar cada uso por sb.rpc(...) / sb.from(...) + realtime.

export interface ComentarioMock {
  id: string;
  autor: string;
  avatar: string;
  texto: string;
  tempo: string;
}

export interface PostMock {
  id: string;
  autor: string;
  avatar: string;
  tempo: string;
  texto: string;
  curtidas: number;
  curtido: boolean;
  comentarios: ComentarioMock[];
  mostrarComentarios: boolean;
  // Design novo do fórum: 4 reações + imagem de capa (-1 = sem imagem)
  reacoes: [number, number, number, number];
  ligadas: [boolean, boolean, boolean, boolean];
  imgIdx: number;
  // Mídia real (image_url/video_url do banco; TODO player custom do original)
  imagem?: string;
  video?: string;
  // Categoria do fórum (FORUM_CATEGORIES do original; TODO coluna category em posts)
  categoria?: string;
}

export const SEED_POSTS: PostMock[] = [  {
    id: 'mock-post-1',
    autor: 'Luti Christóforo',
    avatar: 'img/foto-padrão.jpg',
    tempo: 'há 2 horas',
    texto:
      'Boas-vindas à comunidade! Aqui você pode compartilhar experiências, tirar dúvidas e encontrar apoio. Como foi seu dia hoje?',
    curtidas: 24,
    curtido: false,
    mostrarComentarios: false,
    reacoes: [1, 3, 24, 0],
    ligadas: [false, false, false, false],
    imgIdx: 0,
    comentarios: [
      {
        id: 'mock-c1',
        autor: 'Visitante',
        avatar: 'img/foto-padrão.jpg',
        texto: 'Que espaço acolhedor! Cheguei agora e já me sinto em casa.',
        tempo: 'há 1 hora',
      },
    ],
  },
  {
    id: 'mock-post-2',
    autor: 'Visitante',
    avatar: 'img/foto-padrão.jpg',
    tempo: 'há 5 horas',
    texto:
      'Descobri meu diagnóstico de TDAH adulto esse mês. Alguém mais passou por isso depois dos 30? Como foi o processo de vocês?',
    curtidas: 18,
    curtido: false,
    mostrarComentarios: false,
    comentarios: [],
    reacoes: [0, 1, 18, 2],
    ligadas: [false, false, false, false],
    imgIdx: 1,
  },
  {
    id: 'mock-post-3',
    autor: 'Visitante',
    avatar: 'img/foto-padrão.jpg',
    tempo: 'há 1 dia',
    texto:
      'Dica que mudou minha rotina: timer visual de 25 minutos + pausas com stim. Quem mais usa time blocking adaptado?',
    curtidas: 31,
    curtido: false,
    mostrarComentarios: false,
    comentarios: [],
    reacoes: [0, 2, 31, 5],
    ligadas: [false, false, false, false],
    imgIdx: 2,
  },
  {
    id: 'mock-post-4',
    autor: 'Visitante',
    avatar: 'img/foto-padrão.jpg',
    tempo: 'há 2 dias',
    texto:
      'Quando o barulho pesa, uma pausa sensorial de 5 minutos me ajuda a recomeçar. O que funciona para vocês?',
    curtidas: 12,
    curtido: false,
    mostrarComentarios: false,
    comentarios: [],
    reacoes: [2, 0, 12, 1],
    ligadas: [false, false, false, false],
    imgIdx: 3,
  },
];

// --- MOCK telas Grupos/Eventos/Conversa (Parte B: RPCs + realtime) ---
// TODO SUPABASE: groups (tabela groups/group_members), events, conversations/messages.

export interface GrupoMock {
  id: string;
  nome: string;
  descricao: string;
  membros: number;
  participo: boolean;
  categoria: string;
  codigoConvite?: string;
  imagem?: string;
  privado?: boolean;
}

export interface EventoMock {
  id: string;
  titulo: string;
  data: string;
  dataIso?: string;
  descricao: string;
  participantes: number;
  participando: boolean;
  rsvp: 'vou' | 'nao' | 'talvez' | null;
}

export interface MensagemMock {
  id: string;
  senderId: string;
  autor: string;
  avatar: string;
  texto: string;
  tempo: string;
  minha: boolean;
}

export interface ConversaMock {
  id: string;
  nome: string;
  membros: string;
  mensagens: MensagemMock[];
  naoLidas: number;
}

export interface AmigoMock {
  id: string;
  nome: string;
  username: string;
  avatar: string;
  avatar_url?: string;
  friend_id?: string;
  conversation_id?: string;
}

export const SEED_GRUPOS: GrupoMock[] = [
  { id: 'g1', nome: 'TDAH Adulto', descricao: 'Estratégias e apoio para adultos com TDAH.', membros: 128, participo: false, categoria: 'Apoio' },
  { id: 'g2', nome: 'Pais Atípicos', descricao: 'Rede de apoio para pais e mães.', membros: 86, participo: false, categoria: 'Social' },
];

export const SEED_EVENTOS: EventoMock[] = [
  { id: 'e1', titulo: 'Roda de conversa: rotina e TDAH', data: 'Sábado, 10h', descricao: '', participantes: 23, participando: false, rsvp: null },
  { id: 'e2', titulo: 'Workshop: organização visual', data: 'Quarta, 19h', descricao: '', participantes: 45, participando: false, rsvp: null },
  { id: 'e3', titulo: 'Encontro de boas-vindas', data: 'Domingo, 16h', descricao: '', participantes: 67, participando: false, rsvp: null },
];

export const SEED_CONVERSAS: ConversaMock[] = [
  {
    id: 'c-geral',
    nome: 'Geral',
    membros: '1.2k membros',
    naoLidas: 2,
    mensagens: [
      { id: 'm1', senderId: 'u-luti', autor: 'Luti', avatar: 'img/foto-padrão.jpg', texto: 'Bem-vindos ao canal geral! Apresentem-se', tempo: '10:00', minha: false },
    ],
  },
  {
    id: 'c-apoio',
    nome: 'Apoio mútuo',
    membros: '340 membros',
    naoLidas: 0,
    mensagens: [
      { id: 'm2', autor: 'Visitante', avatar: 'img/foto-padrão.jpg', texto: 'Alguém tem dica para crises sensoriais no trabalho?', tempo: '11:20', minha: false, senderId: 'u-visitante' },
    ],
  },
];

export const SEED_AMIGOS: AmigoMock[] = [
  { id: 'a1', nome: 'Luti Christóforo', username: 'luti', avatar: 'img/foto-padrão.jpg', friend_id: 'a1', conversation_id: '' },
];

// --- Usuários do mini-perfil hover (MOCK inicial; real via from('profiles')) ---
export interface UsuarioHover {
  id: string;
  nome: string;
  username: string;
  avatar: string;
  bio: string;
  role: 'admin' | 'membro' | 'voce';
  seguidores: number;
  contribuicoes: number;
  capa: string | null;
  adicionado: boolean;
  // Campos reais (fetchPerfilPorNome) — espelham fetchProfileByName do original
  banner?: string | null;
  is_admin?: boolean;
  is_collaborator?: boolean;
}

export const USUARIOS_HOVER: UsuarioHover[] = [
  {
    id: 'u-david',
    nome: 'David',
    username: '@david',
    avatar: 'img/foto-padrão.jpg',
    bio: 'o cara gosta de animes',
    role: 'admin',
    seguidores: 0,
    contribuicoes: 6,
    capa: null,
    adicionado: false,
  },
  {
    id: 'u-luti',
    nome: 'Luti Christóforo',
    username: '@luti',
    avatar: 'img/foto-padrão.jpg',
    bio: 'Psicólogo e colunista da comunidade.',
    role: 'admin',
    seguidores: 1204,
    contribuicoes: 87,
    capa: null,
    adicionado: false,
  },
  {
    id: 'u-visitante',
    nome: 'Visitante',
    username: '@visitante',
    avatar: 'img/foto-padrão.jpg',
    bio: 'Sem bio',
    role: 'membro',
    seguidores: 0,
    contribuicoes: 0,
    capa: null,
    adicionado: false,
  },
];
