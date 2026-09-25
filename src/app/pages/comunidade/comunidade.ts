import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { PostMock, SEED_POSTS } from './mock-data';
import {
  AmigoMock,
  CHAT_GERAL_ID,
  ConversaMock,
  EventoMock,
  GrupoMock,
  MensagemMock,
  SEED_AMIGOS,
  SEED_CONVERSAS,
  SEED_EVENTOS,
  SEED_GRUPOS,
  USUARIOS_HOVER,
  UsuarioHover,
} from './mock-data';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PARTE A — Abas + feed MOCK (render/criar/curtir/responder).
// PARTE B (pendente): amizades/convites, grupos/membros, canais/chat, eventos,
// upload de vídeo, realtime, moderação (moderation-integration.js) e
// honeypot anti-spam (honeypot.js). Telas e modais já no template com TODOs.
@Component({
  selector: 'app-comunidade',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './comunidade.css',
  templateUrl: './comunidade.html',
})
export class Comunidade implements OnInit, OnDestroy {
  // --- Aba ativa da subnav ---
  aba: 'forum' | 'grupos' | 'eventos' | 'conversa' = 'forum';

  // --- Feed: começa VAZIO; get_posts preenche, MOCK só em falha ---
  posts: PostMock[] = [];

  // --- Seed MOCK (só usado se o Supabase falhar) ---
  private seedMock(): void {
    this.posts = SEED_POSTS.map((p) => ({
      ...p,
      comentarios: p.comentarios.map((c) => ({ ...c })),
    }));
  }

  // --- Modais de post/resposta ---
  mostrarModalPost = false;
  mostrarModalResposta = false;
  respostaAlvo: PostMock | null = null;

  // --- Modal de código de convite (MOCK visual; TODO: invite codes reais) ---
  mostrarModalConvite = false;

  // --- Regras da comunidade (espelha showCommunityRules do original) ---
  mostrarModalRegras = false;
  readonly regrasComunidade = [
    { icone: 'fa-hands-holding', titulo: 'Respeito mútuo, sempre', texto: 'Cada pessoa tem seu ritmo e sua história.' },
    { icone: 'fa-user-xmark', titulo: 'Bullying dá ban', texto: 'Xingamento, preconceito ou ataque: tolerância zero.' },
    { icone: 'fa-book', titulo: 'Privacidade não se expõe', texto: 'Nada de dados pessoais — seus ou dos outros.' },
    { icone: 'fa-person-circle-exclamation', titulo: 'Assédio é ban direto', texto: 'Insistência e invasão não têm segunda chance.' },
    { icone: 'fa-ribbon', titulo: 'Acolha quem chega', texto: 'Gentileza também é contribuição.' },
    { icone: 'fa-child-reaching', titulo: 'Para todas as idades', texto: 'Nada impróprio para menores.' },
    { icone: 'fa-infinity', titulo: 'Assunto: neurodiversidade', texto: 'Spam e polêmica fora do tema ficam de fora.' },
  ];

  // --- Dados sociais começam vazios; seeds MOCK são apenas fallback de falha ---
  grupos: GrupoMock[] = [];

  // --- Eventos reais: from events ativos/futuros (espelha renderEvents) ---
  // Fallback: seed MOCK. RSVP via event_participants (espelha o original).
  async carregarEventos(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('events')
        .select('*')
        .eq('is_active', true)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(20);
      if (error) throw error;
      const linhas = (data ?? []) as Array<Record<string, unknown>>;
      if (!linhas.length) return;
      this.eventos = linhas.map((ev) => {
        const d = new Date(String(ev['date']));
        const dia = String(d.getDate()).padStart(2, '0');
        // Filtro do original: WHERE active = true AND date >= now() ORDER BY date
        return {
          id: String(ev['id']),
          titulo: String(ev['title'] ?? 'Evento'),
          data: isNaN(d.getTime()) ? '' : `${dia}/${d.getMonth() + 1} ${d.getHours()}h`,
          dataIso: isNaN(d.getTime()) ? '' : d.toISOString(),
          descricao: String(ev['description'] ?? ''),
          participantes: Number(ev['participants'] ?? 0),
          participando: false,
          rsvp: null,
        };
      }).filter((e) => {
        if (!e.dataIso) return true; // sem data: mantém (MOCK/legado)
        return new Date(e.dataIso).getTime() >= Date.now() - 24 * 3600 * 1000;
      });
    } catch (e) {
      console.warn('Eventos MOCK (tabela events falhou):', e);
    }
  }

  // --- Busca + pills da aba Grupos (MOCK local) ---
  readonly categoriasGrupos = ['Todos', 'Apoio', 'Educação', 'Trabalho', 'Social', 'Arte', 'Geral'];
  filtroGrupoCat = 'Todos';
  buscaGrupo = '';

  // Grupos de teste/lixo vindos do banco: ocultos da grade (não deletados)
  private readonly gruposOcultos = ['fdsfgdsfds', 'geral'];

  get gruposFiltrados(): GrupoMock[] {
    const termo = this.buscaGrupo.trim().toLowerCase();
    return this.grupos.filter((g) => {
      if (this.gruposOcultos.includes(g.nome.trim().toLowerCase())) return false;
      if (this.filtroGrupoCat !== 'Todos' && g.categoria !== this.filtroGrupoCat) return false;
      if (termo && !(g.nome + ' ' + g.descricao).toLowerCase().includes(termo)) return false;
      return true;
    });
  }

  filtrarGrupos(cat: string): void {
    this.filtroGrupoCat = cat;
  }

  aoBuscarGrupos(e: Event): void {
    this.buscaGrupo = (e.target as HTMLInputElement).value;
  }
  eventos: EventoMock[] = SEED_EVENTOS.map((e) => ({ ...e }));
  conversas: ConversaMock[] = SEED_CONVERSAS.map((c) => ({
    ...c,
    mensagens: c.mensagens.map((m) => ({ ...m })),
  }));
  conversaAtiva: ConversaMock | null = this.conversas[0] ?? null;
  amigos: AmigoMock[] = [];

  // --- Menu de moderação por post (MOCK: Denunciar/Ocultar locais) ---
  menuModId: string | null = null;
  postsOcultos = new Set<string>();

  // --- Mini-perfil hover (MOCK imediato + real via from('profiles')) ---
  usuarioHover: UsuarioHover | null = null;
  avatarHoverQuebrado = false;
  hoverX = 0;
  hoverY = 0;
  private hoverMostrarTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverFecharTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly perfilCache = new Map<string, UsuarioHover>();

  // --- Resolve o usuário do post (3 fictícios + "Você" logado) ---
  private usuarioDoPost(post: PostMock): UsuarioHover {
    const logado = this.auth.getUsuarioAtual();
    if (logado && post.autor === logado.nome) {
      return {
        id: 'u-voce',
        nome: logado.nome,
        username: '@' + logado.nome.toLowerCase().replace(/\s+/g, ''),
        avatar: logado.avatarUrl ?? 'img/foto-padrão.jpg',
        bio: 'Este é você.',
        role: 'voce',
        seguidores: 0,
        contribuicoes: post.comentarios.length,
        capa: null,
        adicionado: false,
      };
    }
    return (
      USUARIOS_HOVER.find((u) => u.nome === post.autor) ?? {
        id: `u-${post.id}`,
        nome: post.autor,
        username: '@usuario',
        avatar: post.avatar,
        bio: 'Sem bio',
        seguidores: 0,
        contribuicoes: 0,
        capa: null,
        role: 'membro' as const,
        adicionado: false,
      }
    );
  }

  // --- Mouseenter no nome/avatar: MOCK imediato + real após 400ms (desligado no mobile) ---
  mostrarPerfil(post: PostMock, e: MouseEvent): void {
    if (window.innerWidth < 768) return;
    this.cancelarHoverTimers();
    const alvo = e.currentTarget as HTMLElement;
    this.hoverMostrarTimer = setTimeout(() => {
      this.avatarHoverQuebrado = false;
      this.usuarioHover = this.usuarioDoPost(post);
      const r = alvo.getBoundingClientRect();
      const largura = 380;
      this.hoverX = r.right + 12 + largura > window.innerWidth ? Math.max(8, r.left - largura - 12) : r.right + 12;
      this.hoverY = Math.min(Math.max(8, r.bottom - 100), Math.max(8, window.innerHeight - 480));
      // Enriquece com o perfil real (espelha fetchProfileByName do original)
      void this.enriquecerHover(post.autor);
    }, 400);
  }

  // --- Busca perfil real pelo nome (ilike username + contagens; cache local) ---
  private async enriquecerHover(nomeAutor: string): Promise<void> {
    if (!nomeAutor) return;
    const chave = 'name:' + nomeAutor.toLowerCase();
    const emCache = this.perfilCache.get(chave);
    if (emCache) {
      if (this.usuarioHover) this.usuarioHover = { ...this.usuarioHover, ...emCache };
      return;
    }
    try {
      const sb = this.supabase.getClient();
      const { data: profile, error } = await sb
        .from('profiles')
        .select('*')
        .ilike('username', nomeAutor)
        .maybeSingle();
      if (error || !profile) return;
      const p = profile as Record<string, unknown>;
      const id = String(p['id'] ?? '');
      let contribuicoes = 0;
      try {
        const { count: pc } = await sb
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', id)
          .eq('is_active', true);
        const { count: cc } = await sb
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', id)
          .eq('is_active', true);
        contribuicoes = (pc ?? 0) + (cc ?? 0);
      } catch {
        // contagens best-effort
      }
      const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
      const real: Partial<UsuarioHover> = {
        id: id || this.usuarioHover?.id || '',
        nome: str(p['username']) ?? nomeAutor,
        username: '@' + (str(p['username']) ?? nomeAutor).toLowerCase(),
        avatar: str(p['avatar_url']) || 'img/foto-padrão.jpg',
        bio: str(p['bio']) || 'Membro da comunidade',
        banner: str(p['banner_url']) ?? null,
        role: p['is_admin'] === true ? 'admin' : 'membro',
        is_admin: p['is_admin'] === true,
        is_collaborator: p['is_collaborator'] === true,
        seguidores: typeof p['followers_count'] === 'number' ? p['followers_count'] : 0,
        contribuicoes,
      };
      this.perfilCache.set(chave, real as UsuarioHover);
      if (this.usuarioHover) this.usuarioHover = { ...this.usuarioHover, ...real };
    } catch {
      // Segue com MOCK
    }
  }

  // --- Mouseleave: fecha após 200ms (tempo de alcançar o popup) ---
  esconderPerfil(): void {
    this.cancelarHoverTimers();
    this.hoverFecharTimer = setTimeout(() => {
      this.usuarioHover = null;
    }, 200);
  }

  // --- Mouse dentro do popup: mantém aberto ---
  manterPerfilAberto(): void {
    this.cancelarHoverTimers();
  }

  private cancelarHoverTimers(): void {
    if (this.hoverMostrarTimer) clearTimeout(this.hoverMostrarTimer);
    if (this.hoverFecharTimer) clearTimeout(this.hoverFecharTimer);
    this.hoverMostrarTimer = null;
    this.hoverFecharTimer = null;
  }

  // --- Amigo em foco no modal de perfil (espelha openFriendProfile) ---
  amigoAlvo: UsuarioHover | null = null;

  // --- Ações do popup: Ver Perfil navega p/ /comunidade/perfil/:id (espelha irParaPerfil) ---
  irParaPerfil(u: UsuarioHover | AmigoMock): void {
    this.usuarioHover = null;
    const eu = this.auth.getUsuarioAtual()?.nome ?? 'Você';
    const role = (u as UsuarioHover).role;
    if (u.nome === eu || role === 'voce') {
      void this.router.navigate(['/comunidade/perfil']);
      return;
    }
    // Outro usuário: página de perfil com ID (original: perfil.html?id=)
    void this.router.navigate(['/comunidade/perfil', u.id]);
  }

  // --- Hover: botão Mensagem abre (ou cria) a DM (espelha hoverMsgBtn) ---
  mensagemHover(): void {
    const u = this.usuarioHover;
    this.usuarioHover = null;
    if (u) void this.abrirConversaCom(u.id, u.nome);
  }

  // --- Do modal de amigo: abre (ou cria) a conversa privada e vai à aba ---
  mensagemParaAmigo(): void {
    const alvo = this.amigoAlvo;
    this.amigoAlvo = null;
    this.aba = 'conversa';
    if (alvo) void this.abrirConversaCom(alvo.id, alvo.nome);
  }

  // --- ITEM 5: DM via rpc create_private_conversation (fallback direto, espelha apiCreatePrivateConversation) ---
  async abrirConversaCom(userId: string, nome: string): Promise<void> {
    // Reaproveita conversa existente
    const existente = this.conversas.find((c) => c.id === userId || c.nome === `@${nome}` || c.nome === nome);
    if (existente) {
      await this.selecionarConversa(existente);
      return;
    }
    this.mostrarToast(`Criando conversa com ${nome}...`);
    try {
      const { data, error } = await this.supabase
        .getClient()
        .rpc('create_private_conversation', { p_friend_id: userId });
      if (error) throw error;
      const r = data as { success?: boolean; conversation_id?: string; id?: string; message?: string } | null;
      const chatId = r?.conversation_id || r?.id;
      if (!chatId) throw new Error(r?.message || 'Resposta vazia da RPC');
      this.conversas.unshift({ id: chatId, nome: `@${nome}`, membros: '', mensagens: [], naoLidas: 0 });
      await this.selecionarConversa(this.conversas[0]);
      this.resultadosBusca = [];
      this.mostrarToast(`Conversa com ${nome} iniciada!`);
    } catch (e) {
      console.warn('DM MOCK (create_private_conversation falhou):', e);
      // Fallback direto: conversations + conversation_participants (igual ao original)
      try {
        const eu = this.auth.getUsuarioAtual()?.id;
        if (!eu) throw new Error('Não autenticado');
        const sb = this.supabase.getClient();
        const novoId = crypto.randomUUID();
        const { error: convErr } = await sb.from('conversations').insert({
          id: novoId, name: nome, type: 'private', created_by: eu, created_at: new Date().toISOString(),
        });
        if (convErr) throw convErr;
        await sb.from('conversation_participants').insert([
          { conversation_id: novoId, user_id: eu, joined_at: new Date().toISOString() },
          { conversation_id: novoId, user_id: userId, joined_at: new Date().toISOString() },
        ]);
        this.conversas.unshift({ id: novoId, nome: `@${nome}`, membros: '', mensagens: [], naoLidas: 0 });
        await this.selecionarConversa(this.conversas[0]);
        this.resultadosBusca = [];
        this.mostrarToast(`Conversa com ${nome} iniciada!`);
      } catch (e2) {
        console.warn('DM fallback falhou:', e2);
        this.mostrarToast('Não foi possível criar a conversa.');
      }
    }
  }

  // --- Estado do botão Adicionar: livre | pendente | amigos ---
  estadoAmizade(id: string): 'adicionar' | 'pendente' | 'amigos' {
    if (this.amigos.some((a) => a.id === id)) return 'amigos';
    if (this.solicitacoes.some((s) => s.id === id)) return 'pendente';
    return 'adicionar';
  }

  mensagemPara(u: UsuarioHover): void {
    this.usuarioHover = null;
    this.aba = 'conversa';
  }

  alternarAdicionar(u: UsuarioHover): void {
    void this.adicionarAmigoReal(u);
  }

  // --- Adicionar via rpc send_friend_request (fallback: toggle local) ---
  private async adicionarAmigoReal(u: UsuarioHover): Promise<void> {
    try {
      const { error } = await this.supabase.getClient().rpc('send_friend_request', { p_receiver_id: u.id });
      if (error) throw error;
      u.adicionado = true;
      this.mostrarToast('Convite enviado!');
    } catch (e) {
      console.warn('Adicionar MOCK (send_friend_request falhou):', e);
      u.adicionado = !u.adicionado;
    }
  }

  // --- Posts expandidos (Saiba Mais) + toast de link copiado ---
  postsExpandidos = new Set<string>();

  @ViewChild('postRapido') postRapido!: ElementRef<HTMLInputElement>;
  @ViewChild('buscaUsuario') buscaUsuarioInput!: ElementRef<HTMLInputElement>;

  // --- ITEM 5: "+" ao lado de Conversas foca a busca de usuário ---
  focarBuscaUsuario(): void {
    this.aba = 'conversa';
    setTimeout(() => this.buscaUsuarioInput?.nativeElement.focus(), 50);
  }
  @ViewChild('textoNovoPost') textoNovoPost!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('textoResposta') textoResposta!: ElementRef<HTMLTextAreaElement>;

  // --- Fecha modais com ESC (removido no OnDestroy) ---
  private onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.fecharModais();
  };

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly supabase: SupabaseService,
    private readonly host: ElementRef<HTMLElement>,
    private readonly cdr: ChangeDetectorRef,
  ) {
    document.addEventListener('keydown', this.onEsc);
  }

  // --- Carga inicial real (com fallback MOCK se o backend falhar) ---
  // --- Feed vazio inicial: mostra "carregando" até a primeira carga terminar ---
  carregandoForum = true;

  async ngOnInit(): Promise<void> {
    this.carregarNotificacoes();
    await this.carregarFeed();
    // get_friends/get_user_groups dependem do JWT. Aguarda a restauração
    // antes de decidir se a resposta vazia é uma lista válida ou uma corrida.
    await this.aguardarSessaoSupabase();
    await this.carregarAmigos();
    await this.carregarGrupos();
    await this.carregarEventos();
    await this.carregarCanais();
    this.carregandoForum = false;
    this.cdr.detectChanges();
    this.assinarRealtime();
    // Garante o grupo geral (espelha ensure_geral_group do original)
    try {
      await this.supabase.getClient().rpc('ensure_geral_group');
    } catch {
      // Sem backend: segue no MOCK
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onEsc);
    this.cancelarHoverTimers();
    this.cancelarRealtime();
    this.pararPollingChat();
  }

  // --- Realtime posts/comments/messages; recarrega o afetado ---
  private realtimeChannel: { unsubscribe: () => void } | null = null;

  private assinarRealtime(): void {
    try {
      // Realtime direto (WebSocket não passa pelo proxy de dev).
      const sb = this.supabase.getRealtimeClient();
      const canal = sb
        .channel('posts-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          void this.carregarFeed();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
          void this.carregarFeed();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          if (this.conversaAtiva) void this.carregarMensagens(this.conversaAtiva);
          // DM fora da conversa ativa → notificação local (TODO: tabela notifications)
          const nova = (payload as { new?: Record<string, unknown> })?.new;
          const cid = String(nova?.['conversation_id'] ?? '');
          const eu = this.auth.getUsuarioAtual()?.id ?? '';
          if (cid && cid !== this.conversaAtiva?.id && String(nova?.['sender_id'] ?? '') !== eu) {
            this.pushNotificacao('Nova mensagem na conversa', 'fa-comment-dots');
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships' }, () => {
          void this.carregarAmigos();
          this.pushNotificacao('Novo pedido de amizade', 'fa-user-plus');
        })
        .subscribe();
      this.realtimeChannel = canal;
    } catch {
      // Sem backend: segue no MOCK
    }
  }

  private cancelarRealtime(): void {
    try {
      this.realtimeChannel?.unsubscribe();
    } catch {
      // Ignora
    }
    this.realtimeChannel = null;
    try {
      this.realtimeConversa?.unsubscribe();
    } catch {
      // Ignora
    }
    this.realtimeConversa = null;
  }

  // --- Avatar do usuário logado ou padrão ---
  get avatarUsuario(): string {
    return this.auth.getUsuarioAtual()?.avatarUrl ?? 'img/foto-padrão.jpg';
  }

  // --- Avatares com erro (mostra inicial, idêntico ao fallback original) ---
  private avataresQuebrados = new Set<string>();

  ocultarAvatarPost(e: Event, postId: string): void {
    (e.target as HTMLImageElement).style.display = 'none';
    this.avataresQuebrados.add(postId);
  }

  avatarQuebrado(postId: string): boolean {
    return this.avataresQuebrados.has(postId);
  }

  // --- Postagem rápida: vazio→toast; senão preenche o modal e abre ---
  postarRapido(): void {
    const texto = this.postRapido?.nativeElement.value.trim() ?? '';
    if (!texto) {
      this.mostrarToast('Digite algo para postar');
      return;
    }
    if (!this.auth.estaLogado()) {
      this.mostrarToast('Faça login para postar');
      return;
    }
    this.postEditandoId = null;
    this.mostrarModalPost = true;
    setTimeout(() => {
      if (this.textoNovoPost) {
        this.textoNovoPost.nativeElement.value = texto;
        this.textoNovoPost.nativeElement.focus();
      }
    }, 100);
  }

  // --- Copia o link do post (TODO SUPABASE: slug/id real no lugar do mock) ---
  copiarLink(post: PostMock): void {
    const url = `${window.location.origin}/comunidade#${post.id}`;
    console.log('[MOCK] link do post copiado:', url);
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    this.mostrarToast('Link copiado!');
  }

  // --- Saiba Mais: expande/contrai o texto ---
  estaExpandido(post: PostMock): boolean {
    return this.postsExpandidos.has(post.id);
  }

  alternarExpandido(post: PostMock): void {
    if (this.postsExpandidos.has(post.id)) this.postsExpandidos.delete(post.id);
    else this.postsExpandidos.add(post.id);
  }

  // --- Toast mínimo (inline, sem CSS novo) ---
  mostrarToast(msg: string): void {
    document.querySelector('.forum-toast')?.remove();
    const t = document.createElement('div');
    t.className = 'forum-toast';
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:12px;' +
      'font-size:14px;font-weight:500;z-index:10000;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // --- Nome para o placeholder de resposta ---
  get nomeComentario(): string {
    return this.auth.getUsuarioAtual()?.nome ?? 'Você';
  }

  // --- Comentar inline (real: create_comment_direct; fallback MOCK) ---
  comentarRapido(post: PostMock, input: HTMLInputElement): void {
    const texto = input.value.trim();
    if (!texto) return;
    if (this.verificarHoneypot(texto, 'comentario')) return;
    const u = this.auth.getUsuarioAtual();
    post.comentarios.push({
      id: `mock-c-${Date.now()}`,
      autor: u?.nome ?? 'Você',
      avatar: u?.avatarUrl ?? 'img/foto-padrão.jpg',
      texto,
      tempo: 'agora mesmo',
    });
    input.value = '';
  }

  // --- Fallback se o avatar quebrar (ícone quebrado relatado) ---
  corrigirAvatar(e: Event): void {
    const img = e.target as HTMLImageElement;
    if (!img.src.endsWith('img/foto-padrão.jpg')) img.src = 'img/foto-padrão.jpg';
  }

  // --- Cor de fallback para avatar do amigo (hash do ID → cor fixa) ---
  private readonly amigoCores = ['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6'];
  corAmigo(id: string): string {
    if (!id) return this.amigoCores[0];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return this.amigoCores[Math.abs(hash) % this.amigoCores.length];
  }

  // --- Fallback avatar amigo: troca img quebrada por div friend-avatar-fallback colorida ---
  corrigirAvatarAmigo(e: Event, amigo: AmigoMock): void {
    const img = e.target as HTMLImageElement;
    const fallback = document.createElement('div');
    fallback.className = 'friend-avatar-fallback';
    fallback.style.background = this.corAmigo(amigo.friend_id || amigo.id);
    fallback.textContent = (amigo.nome || 'U').charAt(0).toUpperCase();
    img.replaceWith(fallback);
  }

  // --- Abre conversa com amigo da lista (reusa abrirConversaCom) ---
  mensagemAmigo(amigo: AmigoMock): void {
    void this.abrirConversaCom(amigo.friend_id || amigo.id, amigo.nome);
  }

  // --- Troca de aba da subnav (Fórum recarrega o feed) ---
  trocarAba(aba: 'forum' | 'grupos' | 'eventos' | 'conversa'): void {
    this.aba = aba;
    if (aba === 'forum') void this.carregarFeed();
    if (aba === 'grupos') void this.carregarGrupos();
    if (aba === 'conversa') {
      void this.carregarAmigos();
      this.iniciarPollingChat();
    } else {
      this.pararPollingChat();
    }
  }

  // --- Polling de fallback do chat (5s) enquanto a Conversa está ativa ---
  // Realtime pode falhar (WS/CORS); o polling garante mensagens sem F5.
  private pollingChat: ReturnType<typeof setInterval> | null = null;

  private get currentChatId(): string | null {
    return this.conversaAtiva?.id ?? null;
  }

  private iniciarPollingChat(): void {
    this.pararPollingChat();
    const conversationId = this.currentChatId;
    if (!conversationId || !UUID_REGEX.test(conversationId)) return;

    this.pollingChat = setInterval(() => {
      const conversa = this.conversaAtiva;
      const id = this.currentChatId;
      if (this.aba !== 'conversa' || !conversa || !id || !UUID_REGEX.test(id)) {
        this.pararPollingChat();
        return;
      }
      void this.carregarMensagens(conversa);
    }, 5000);
  }

  private pararPollingChat(): void {
    if (this.pollingChat) clearInterval(this.pollingChat);
    this.pollingChat = null;
  }

  // --- Abre o modal de novo post ---
  abrirModalPost(): void {
    this.mostrarModalPost = true;
  }

  // --- Cria post: edição própria, senão rpc create_post (fallback MOCK) ---
  // Extrai "📹 Vídeo: <url>" como o original (comunidade.js:2061-2070).
  async criarPost(): Promise<void> {
    const texto = this.textoNovoPost?.nativeElement.value.trim() ?? '';
    if (!texto) {
      this.mostrarToast('Digite algo para postar');
      return;
    }
    if (this.verificarHoneypot(texto, 'novo-post')) return;
    // Edição de post próprio reaproveita o modal
    if (this.salvarEdicaoPost(texto)) {
      this.textoNovoPost.nativeElement.value = '';
      this.mostrarModalPost = false;
      return;
    }
    const videoMatch = texto.match(/📹 Vídeo: (https?:\/\/[^\s]+)/);
    const videoUrl = videoMatch ? videoMatch[1] : null;
    let limpo = texto;
    if (videoUrl) {
      limpo = texto.replace(/📹 Vídeo: https?:\/\/[^\s]+\s*/, '').trim();
      if (!limpo && videoUrl) limpo = 'Vídeo compartilhado';
    }
    try {
      // Espelha apiCreatePost: RPC, senão INSERT direto
      const { data, error } = await this.supabase
        .getClient()
        .rpc('create_post', { p_content: limpo, p_video_url: videoUrl });
      if (error || !data) {
        const { data: post, error: insErr } = await this.supabase
          .getClient()
          .from('posts')
          .insert({
            content: limpo,
            video_url: videoUrl,
            author_id: this.auth.getUsuarioAtual()?.id,
            is_active: true,
            likes: 0,
            comment_count: 0,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        console.log('Post via INSERT:', (post as { id?: string })?.id);
      }
      await this.carregarFeed();
      this.mostrarToast('Post publicado!');
    } catch (e) {
      if (this.tratarErroAuth(e, 'create_post')) {
        this.textoNovoPost.nativeElement.value = '';
        this.mostrarModalPost = false;
        return;
      }
      console.warn('Post MOCK (create_post falhou):', e);
      this.adicionarPost(limpo);
    }
    this.textoNovoPost.nativeElement.value = '';
    this.mostrarModalPost = false;
  }

  // --- Feed real via rpc get_posts; MOCK SÓ em falha (atribuição direta) ---
  async carregarFeed(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .rpc('get_posts', { p_limit: 50, p_offset: 0 });
      if (error) throw error;
      const linhas = (data ?? []) as Array<Record<string, unknown>>;
      if (!linhas.length) throw new Error('feed vazio');
      this.posts = linhas.map((p) => this.mapearPost(p));
    } catch (e) {
      console.warn('Feed MOCK (get_posts falhou):', e);
      // Só usa seed se ainda não há nada (nunca sobrescreve dados reais)
      if (!this.posts.length) this.seedMock();
    }
    // Garante repintura mesmo se a resolução vier fora da zona do Angular
    this.cdr.detectChanges();
  }

  // --- Erros de auth/permissão: 401 → /login; 403/RLS → toast amigável ---
  // Retorna true se tratou (chamador deve abortar o fallback silencioso).
  private tratarErroAuth(err: unknown, contexto: string): boolean {
    const msg = err instanceof Error ? err.message : String(err ?? '');
    const codigo = (err as { code?: string; status?: number })?.code ?? '';
    const status = (err as { status?: number })?.status ?? 0;
    if (status === 401 || codigo === '401' || /jwt|auth.*requir|not authenticated/i.test(msg)) {
      void this.router.navigate(['/login']);
      return true;
    }
    if (status === 403 || /rls|policy|permission|forbidden/i.test(msg)) {
      this.mostrarToast('Sem permissão para esta ação. Fale com a equipe.');
      console.warn(`[RLS 403] ${contexto}:`, msg);
      return true;
    }
    return false;
  }

  // --- Upload de vídeo p/ bucket 'videos' (espelha comunidade.js:2105-2163) ---
  // Valida 50MB + mp4/webm/ogg; anexa "📹 Vídeo: <url>" no texto (idêntico).
  videoEnviando = false;

  async aoEscolherVideo(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    if (arquivo.size > 50 * 1024 * 1024) {
      this.mostrarToast('Vídeo muito grande! Máx 50MB');
      input.value = '';
      return;
    }
    if (!['video/mp4', 'video/webm', 'video/ogg'].includes(arquivo.type)) {
      this.mostrarToast('Formato não suportado. Use MP4, WebM ou OGG');
      input.value = '';
      return;
    }
    const uid = this.auth.getUsuarioAtual()?.id ?? 'anon';
    this.videoEnviando = true;
    try {
      const ext = arquivo.name.split('.').pop() ?? 'mp4';
      const nome = `${uid}/${Date.now()}.${ext}`;
      const { error } = await this.supabase
        .getClient()
        .storage.from('videos')
        .upload(nome, arquivo, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data } = this.supabase.getClient().storage.from('videos').getPublicUrl(nome);
      if (this.textoNovoPost && data.publicUrl) {
        const atual = this.textoNovoPost.nativeElement.value;
        this.textoNovoPost.nativeElement.value = `${atual}\n📹 Vídeo: ${data.publicUrl}\n`;
        this.mostrarToast('Vídeo pronto para postar!');
      }
    } catch (err) {
      console.warn('Upload MOCK (bucket videos falhou):', err);
      this.mostrarToast('Erro ao enviar vídeo');
    } finally {
      this.videoEnviando = false;
      input.value = '';
    }
  }
  private mapearPost(p: Record<string, unknown>): PostMock {
    const str = (v: unknown, fb = '') => (typeof v === 'string' ? v : fb);
    const num = (v: unknown, fb = 0) => (typeof v === 'number' ? v : fb);
    const img = str(p['image_url'], '');
    const vid = str(p['video_url'], '');
    return {
      id: String(p['id'] ?? `mock-${Date.now()}`),
      autor: str(p['author_name'], 'Usuário'),
      avatar: str(p['author_avatar'], 'img/foto-padrão.jpg'),
      tempo: this.tempoRelativo(str(p['created_at'], '')),
      texto: str(p['content'], ''),
      curtidas: num(p['likes'], 0),
      curtido: p['is_liked'] === true,
      comentarios: [],
      mostrarComentarios: false,
      reacoes: [0, 0, num(p['likes'], 0), 0],
      ligadas: [false, false, p['is_liked'] === true, false],
      imgIdx: -1,
      imagem: img && img !== 'null' ? img : undefined,
      video: vid && vid !== 'null' ? vid : undefined,
      categoria: str(p['category'], 'conversa'),
    };
  }

  private tempoRelativo(iso: string): string {
    if (!iso) return 'agora mesmo';
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    return `há ${Math.floor(h / 24)} dias`;
  }
  private adicionarPost(texto: string): void {
    const u = this.auth.getUsuarioAtual();
    this.posts.unshift({
      id: `mock-post-${Date.now()}`,
      autor: u?.nome ?? 'Você',
      avatar: u?.avatarUrl ?? 'img/foto-padrão.jpg',
      tempo: 'agora mesmo',
      texto,
      curtidas: 0,
      curtido: false,
      comentarios: [],
      mostrarComentarios: false,
      reacoes: [0, 0, 0, 0],
      ligadas: [false, false, false, false],
      imgIdx: -1,
      categoria: this.categoriaNovoPost,
    });
  }

  // --- Curtir/descurtir via rpc toggle_like (fallback: MOCK otimista) ---
  async alternarCurtida(post: PostMock): Promise<void> {
    post.curtido = !post.curtido;
    post.curtidas += post.curtido ? 1 : -1;
    try {
      const { error } = await this.supabase.getClient().rpc('toggle_like', { p_post_id: post.id });
      if (error) throw error;
    } catch (e) {
      console.warn('Like MOCK (toggle_like falhou):', e);
    }
  }

  // --- Expande/recolhe os comentários ---
  alternarComentarios(post: PostMock): void {
    post.mostrarComentarios = !post.mostrarComentarios;
  }

  // --- Abre o modal de resposta com o post pai ---
  abrirModalResposta(post: PostMock): void {
    this.respostaAlvo = post;
    this.mostrarModalResposta = true;
  }

  // --- Envia resposta via rpc create_comment_direct (fallback: MOCK) ---
  async enviarResposta(): Promise<void> {
    const texto = this.textoResposta?.nativeElement.value.trim() ?? '';
    if (!texto || !this.respostaAlvo) return;
    if (this.verificarHoneypot(texto, 'resposta')) return;
    const alvo = this.respostaAlvo;
    try {
      const { error } = await this.supabase
        .getClient()
        .rpc('create_comment_direct', { p_post_id: alvo.id, p_content: texto });
      if (error) throw error;
      try {
        await this.supabase.getClient().rpc('update_comment_count', { p_post_id: alvo.id });
      } catch {
        // Contador é acessório; segue o fluxo
      }
    } catch (e) {
      console.warn('Resposta MOCK (create_comment_direct falhou):', e);
    }
    const u = this.auth.getUsuarioAtual();
    alvo.comentarios.push({
      id: `mock-c-${Date.now()}`,
      autor: u?.nome ?? 'Você',
      avatar: u?.avatarUrl ?? 'img/foto-padrão.jpg',
      texto,
      tempo: 'agora mesmo',
    });
    alvo.mostrarComentarios = true;
    this.textoResposta.nativeElement.value = '';
    this.fecharModais();
  }

  fecharModais(): void {
    this.mostrarModalPost = false;
    this.mostrarModalResposta = false;
    this.respostaAlvo = null;
  }

  // --- Moderação MOCK: Denunciar remove do feed; Ocultar esconde ---
  // TODO SUPABASE: rpc report_post / block_user (moderation-integration.js).
  alternarMenuMod(postId: string): void {
    this.menuModId = this.menuModId === postId ? null : postId;
  }

  denunciarPost(post: PostMock): void {
    if (!confirm(`Denunciar o post de ${post.autor}?`)) return;
    void this.denunciarReal(post);
    this.posts = this.posts.filter((p) => p.id !== post.id);
    this.menuModId = null;
  }

  // --- Denúncia real: rpc create_moderation_log + fallback + tabela reports ---
  // Espelha moderation-integration.js:409-446 (sem painel admin: exige is_moderator).
  private async denunciarReal(post: PostMock, motivo = 'Conteúdo inadequado'): Promise<void> {
    try {
      const uid = this.auth.getUsuarioAtual()?.id;
      const { data, error } = await this.supabase.getClient().rpc('create_moderation_log', {
        p_type: 'post',
        p_reason: motivo,
        p_description: null,
        p_target_id: post.id,
        p_target_type: 'post',
      });
      if (error) {
        const { error: insErr } = await this.supabase
          .getClient()
          .from('moderation_logs')
          .insert({
            type: 'post',
            reason: motivo,
            description: null,
            target_id: post.id,
            target_type: 'post',
            reported_by: uid,
            status: 'pendente',
          });
        if (insErr) throw insErr;
      } else if (!(data as { success?: boolean } | null)?.success) {
        throw new Error((data as { error?: string } | null)?.error || 'registro falhou');
      }
      await this.supabase
        .getClient()
        .from('reports')
        .insert({
          reporter_id: uid,
          target_type: 'post',
          target_id: post.id,
          reason: motivo,
          description: null,
          moderation_log_id: (data as { log_id?: string } | null)?.log_id ?? null,
        });
      this.mostrarToast('Denúncia enviada! A equipe irá analisar.');
    } catch (e) {
      console.warn('Denúncia MOCK (moderação falhou):', e);
    }
  }

  ocultarPost(post: PostMock): void {
    this.postsOcultos.add(post.id);
    this.menuModId = null;
  }

  postVisivel(post: PostMock): boolean {
    return !this.postsOcultos.has(post.id);
  }

  // --- Amigos reais: get_friends + get_pending_requests (fallback: seed) ---
  solicitacoes: Array<{ id: string; nome: string; avatar: string }> = [];
  resultadosBusca: Array<{ id: string; nome: string; avatar: string }> = [];

  // --- URL fantasma do banco (avatar-padrao.png não existe em public/img) → padrão ---
  private avatarValido(url: unknown): string {
    if (typeof url !== 'string') return 'img/foto-padrão.jpg';
    const u = url.trim();
    if (!u || u.toLowerCase().includes('avatar-padrao.png')) return 'img/foto-padrão.jpg';
    return u;
  }

  private async aguardarSessaoSupabase(): Promise<void> {
    try {
      const { data } = await this.supabase.getClient().auth.getSession();
      console.log('[auth] Sessão para dados sociais:', data.session?.user?.id ?? 'anônima');
    } catch (e) {
      console.warn('[auth] Falha ao restaurar sessão antes dos dados sociais:', e);
    }
  }

  async carregarAmigos(): Promise<void> {
    const sb = this.supabase.getClient();

    try {
      const { data: amigos, error } = await sb.rpc('get_friends');
      console.log('[amigos] Recebidos do Supabase:', amigos?.length ?? 0);
      if (error) throw error;

      // Uma resposta vazia é válida: não substitui por MOCK.
      this.amigos = ((amigos ?? []) as Array<Record<string, unknown>>).map((f) => ({
        id: String(f['friend_id'] ?? f['id'] ?? ''),
        nome: String(f['username'] ?? 'Usuário'),
        username: String(f['username'] ?? 'usuario').toLowerCase(),
        avatar: this.avatarValido(f['avatar_url']),
        friend_id: String(f['friend_id'] ?? f['id'] ?? ''),
        conversation_id: String(f['conversation_id'] ?? ''),
      }));
    } catch (e) {
      console.warn('Amigos MOCK (get_friends falhou):', e);
      this.amigos = SEED_AMIGOS.map((a) => ({ ...a }));
    }

    // Solicitações são um recurso separado; uma falha aqui não deve
    // restaurar amigos MOCK depois de get_friends ter retornado dados reais.
    try {
      const { data: pends, error } = await sb.rpc('get_pending_requests');
      if (error) throw error;
      this.solicitacoes = ((pends ?? []) as Array<Record<string, unknown>>).map((f) => ({
        id: String(f['friendship_id'] ?? f['id'] ?? ''),
        nome: String(f['username'] ?? 'Usuário'),
        avatar: this.avatarValido(f['avatar_url']),
      }));
    } catch (e) {
      console.warn('Solicitações de amizade (get_pending_requests falhou):', e);
      this.solicitacoes = [];
    }

    this.cdr.detectChanges();
  }

  // --- Busca usuários via rpc search_users (espelha o original) ---
  async buscarUsuarios(termo: string): Promise<void> {
    const q = termo.trim();
    if (!q) {
      this.resultadosBusca = [];
      return;
    }
    try {
      const { data, error } = await this.supabase.getClient().rpc('search_users', { p_query: q });
      if (error) throw error;
      this.resultadosBusca = ((data ?? []) as Array<Record<string, unknown>>).map((u) => ({
        id: String(u['id']),
        nome: String(u['username'] ?? 'Usuário'),
        avatar: (u['avatar_url'] as string) || 'img/foto-padrão.jpg',
      }));
    } catch (e) {
      console.warn('Busca MOCK (search_users falhou):', e);
      this.resultadosBusca = [];
    }
  }

  // --- Convite via rpc send_friend_request (espelha o original) ---
  async enviarConviteAmizade(id: string): Promise<void> {
    try {
      const { error } = await this.supabase.getClient().rpc('send_friend_request', { p_receiver_id: id });
      if (error) throw error;
      this.mostrarToast('Convite enviado!');
      this.resultadosBusca = [];
    } catch (e) {
      console.warn('Convite MOCK:', e);
      this.mostrarToast('Convite registrado (MOCK).');
    }
  }

  // --- Responder solicitação via rpc respond_friend_request ---
  async responderConvite(id: string, acao: 'aceitar' | 'recusar'): Promise<void> {
    try {
      const { error } = await this.supabase
        .getClient()
        .rpc('respond_friend_request', { p_friendship_id: id, p_action: acao });
      if (error) throw error;
      await this.carregarAmigos();
    } catch (e) {
      console.warn('Resposta MOCK:', e);
      this.solicitacoes = this.solicitacoes.filter((s) => s.id !== id);
    }
  }

  // --- Grupos reais via rpc get_user_groups (fallback: seed somente em erro) ---
  async carregarGrupos(): Promise<void> {
    try {
      const { data, error } = await this.supabase.getClient().rpc('get_user_groups');
      console.log('[grupos] Recebidos do Supabase:', data?.length ?? 0);
      if (error) throw error;

      // Resposta vazia significa que o usuário não pertence a grupos;
      // não deve ser trocada pelos dois cards MOCK.
      this.grupos = ((data ?? []) as Array<Record<string, unknown>>).map((g) => ({
        id: String(g['id'] ?? ''),
        nome: String(g['name'] ?? 'Grupo'),
        descricao: String(g['description'] ?? 'Sem descrição'),
        membros: Number(g['members'] ?? 0),
        participo: g['is_member'] === true,
        categoria: String(g['category'] ?? 'Geral'),
        // Coluna image_url do banco (original comunidade.js:2477); vazio = inicial
        imagem: typeof g['image_url'] === 'string' && g['image_url'] ? (g['image_url'] as string) : undefined,
      }));
    } catch (e) {
      console.warn('Grupos MOCK (get_user_groups falhou):', e);
      this.grupos = SEED_GRUPOS.map((g) => ({ ...g }));
    }

    this.cdr.detectChanges();
  }

  // --- Entrar/sair via *_with_cleanup (espelha o original; fallback MOCK) ---
  async alternarGrupo(g: GrupoMock): Promise<void> {
    const entrando = !g.participo;
    g.participo = entrando;
    g.membros += entrando ? 1 : -1;
    try {
      const uid = this.auth.getUsuarioAtual()?.id;
      const rpc = entrando ? 'join_group_with_cleanup' : 'leave_group_with_cleanup';
      const { error } = await this.supabase
        .getClient()
        .rpc(rpc, { p_group_id: g.id, p_user_id: uid });
      if (error) throw error;
    } catch (e) {
      console.warn('Grupo MOCK (RPC falhou):', e);
    }
  }

  // --- Img de grupo quebrada: esconde (original: onerror display none, caixa neutra vazia) ---
  esconderImgGrupo(e: Event): void {
    (e.target as HTMLImageElement).style.display = 'none';
  }
  irParaConversa(): void {
    this.aba = 'conversa';
    if (this.conversaAtiva) {
      void this.selecionarConversa(this.conversaAtiva);
    } else {
      this.iniciarPollingChat();
    }
  }

  // --- Eventos: lista real, RSVP real (event_participants) ---
  alternarEvento(e: EventoMock): void {
    e.participando = !e.participando;
    e.participantes += e.participando ? 1 : -1;
  }

  // --- Canais reais via rpc get_user_chat_channels (fallback: seed) ---
  async carregarCanais(): Promise<void> {
    try {
      const { data, error } = await this.supabase.getClient().rpc('get_user_chat_channels');
      if (error) throw error;
      const linhas = (data ?? []) as Array<Record<string, unknown>>;
      if (!linhas.length) {
        const fallback = this.conversaAtiva ?? this.conversas[0];
        if (fallback) await this.selecionarConversa(fallback);
        return;
      }
      this.conversas = linhas.map((c) => ({
        id: String(c['id']),
        nome: String(c['name'] ?? 'Canal'),
        membros: String(c['members'] ?? ''),
        mensagens: [],
        naoLidas: 0,
      }));
      // Deduplica por id (o backend pode retornar "Geral" + duplicata)
      const vistos = new Set<string>();
      this.conversas = this.conversas.filter((c) => {
        const chave = c.id + '|' + c.nome.toLowerCase();
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
      this.conversaAtiva = this.conversas[0] ?? null;
      if (this.conversaAtiva) {
        await this.selecionarConversa(this.conversaAtiva);
      }
    } catch (e) {
      console.warn('Canais MOCK (get_user_chat_channels falhou):', e);
      const fallback = this.conversaAtiva ?? this.conversas[0];
      if (fallback) await this.selecionarConversa(fallback);
    }
  }

  // --- Mensagens via rpc get_messages + nomes/avatares via profiles ---
  async carregarMensagens(c: ConversaMock): Promise<void> {
    // IDs de seed não podem ser enviados para uma RPC cujo argumento é UUID.
    // O canal legado "Geral" é normalizado para o UUID persistido no banco.
    let conversationId = c.id?.trim() ?? '';
    if (!UUID_REGEX.test(conversationId)) {
      this.pararPollingChat();
      conversationId = CHAT_GERAL_ID;
      c.id = conversationId;
    }

    try {
      const { data, error } = await this.supabase
        .getClient()
        .rpc('get_messages', { p_conversation_id: conversationId, p_limit: 50 });
      if (error) throw error;
      const uid = this.auth.getUsuarioAtual()?.id ?? '';
      const linhas = (data ?? []) as Array<Record<string, unknown>>;
      // Enriquece autor/avatar via profiles quando a RPC não traz
      const semNome = linhas.filter((m) => !m['sender_name'] && m['sender_id']);
      let perfis = new Map<string, { nome: string; avatar: string }>();
      if (semNome.length) {
        try {
          const ids = Array.from(new Set(semNome.map((m) => String(m['sender_id']))));
          const { data: profs } = await this.supabase
            .getClient()
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', ids);
          perfis = new Map(
            ((profs ?? []) as Array<Record<string, unknown>>).map((p) => [
              String(p['id']),
              {
                nome: String(p['username'] ?? 'Membro'),
                avatar: (p['avatar_url'] as string) || 'img/foto-padrão.jpg',
              },
            ]),
          );
        } catch {
          // Segue com fallbacks
        }
      }
      const vistos = new Set<string>();
      c.mensagens = linhas
        .map((m, i) => {
          const sid = String(m['sender_id'] ?? '');
          const perf = perfis.get(sid);
          const nome = String(m['sender_name'] ?? m['username'] ?? m['autor'] ?? perf?.nome ?? 'Membro');
          return {
            id: String(m['id'] ?? `m-${i}`),
            senderId: sid,
            autor: nome,
            avatar: String(m['sender_avatar'] ?? m['avatar'] ?? perf?.avatar ?? 'img/foto-padrão.jpg'),
            texto: String(m['content'] ?? m['texto'] ?? ''),
            tempo: this.formatarHoraChat(String(m['created_at'] ?? '')),
            minha: !!sid && !!uid && sid === uid,
          };
        })
        .filter((m) => {
          if (vistos.has(m.id)) return false;
          vistos.add(m.id);
          return true;
        })
        .sort((a, b) => (a.id > b.id ? 1 : -1));
      this.rolarChatFinal();
    } catch (e) {
      console.warn('Mensagens MOCK (get_messages falhou):', e);
    }
  }

  // --- HH:MM do created_at (espelha formatChatTime) ---
  private formatarHoraChat(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // --- Scroll ao final (100ms, idêntico ao original) ---
  private rolarChatFinal(): void {
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector('.chat-messages-container');
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
  }

  // --- Conversa: seleciona, zera lidas, carrega mensagens e assina realtime da conversa ---
  async selecionarConversa(c: ConversaMock): Promise<void> {
    const rawId = c.id?.trim() ?? '';
    const conversationId = UUID_REGEX.test(rawId) ? rawId : CHAT_GERAL_ID;
    if (conversationId !== rawId) this.pararPollingChat();
    c.id = conversationId;

    this.conversaAtiva = c;
    c.naoLidas = 0;
    this.assinarConversa(conversationId);
    // Sempre consulta o backend: o seed pode conter uma mensagem demonstrativa,
    // mas não deve impedir a carga das mensagens persistidas.
    await this.carregarMensagens(c);
    if (this.aba === 'conversa' && UUID_REGEX.test(rawId)) this.iniciarPollingChat();
  }

  // --- ITEM 5: realtime por conversation_id (espelha channel messages:conversation_id=eq.X) ---
  private realtimeConversa: { unsubscribe: () => void } | null = null;

  private assinarConversa(conversationId: string): void {
    try {
      this.realtimeConversa?.unsubscribe();
    } catch {
      // Ignora
    }
    this.realtimeConversa = null;
    try {
      const sb = this.supabase.getRealtimeClient();
      this.realtimeConversa = sb
        .channel(`messages:conversation_id=eq.${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          () => {
            if (this.conversaAtiva) void this.carregarMensagens(this.conversaAtiva);
          },
        )
        .subscribe();
    } catch {
      // Sem backend: segue com polling
    }
  }

  // --- Envio via rpc send_message (fallback: MOCK local) ---
  async enviarChat(texto: string, input: HTMLInputElement): Promise<void> {
    const msg = texto.trim();
    if (!msg || !this.conversaAtiva) return;
    if (this.verificarHoneypot(msg, 'chat')) return;
    const conversa = this.conversaAtiva;
    try {
      const { error } = await this.supabase
        .getClient()
        .rpc('send_message', { p_conversation_id: conversa.id, p_content: msg });
      if (error) throw error;
      await this.carregarMensagens(conversa);
    } catch (e) {
      console.warn('Chat MOCK (send_message falhou):', e);
      const u = this.auth.getUsuarioAtual();
      conversa.mensagens.push({
        id: `m-${Date.now()}`,
        senderId: u?.id ?? '',
        autor: u?.nome ?? 'Você',
        avatar: u?.avatarUrl ?? 'img/foto-padrão.jpg',
        texto: msg,
        tempo: 'agora',
        minha: true,
      });
      this.rolarChatFinal();
    }
    input.value = '';
  }

  // --- ÁUDIO no chat (MediaRecorder → Storage chat-audios → send_message) ---
  // Sem tabela/coluna de áudio no backend: o player é detectado pelo prefixo AUDIO:: no conteúdo.
  // TODO SUPABASE: bucket 'chat-audios' público + coluna messages.audio_url.
  gravandoAudio = false;
  private gravador: MediaRecorder | null = null;
  private partesAudio: Blob[] = [];

  urlAudioMsg(m: MensagemMock): string | null {
    const t = m.texto || '';
    if (!t.startsWith('AUDIO::')) return null;
    const url = t.slice('AUDIO::'.length).trim();
    return url || null;
  }

  async alternarGravacaoAudio(): Promise<void> {
    if (this.gravandoAudio) {
      this.gravador?.stop();
      return;
    }
    if (!this.conversaAtiva) {
      this.mostrarToast('Escolha uma conversa primeiro.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      this.partesAudio = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) this.partesAudio.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        this.gravandoAudio = false;
        const blob = new Blob(this.partesAudio, { type: rec.mimeType || 'audio/webm' });
        this.partesAudio = [];
        if (blob.size) void this.enviarAudio(blob);
        this.cdr.detectChanges();
      };
      this.gravador = rec;
      rec.start();
      this.gravandoAudio = true;
    } catch (e) {
      console.warn('Microfone indisponível:', e);
      this.mostrarToast('Não foi possível acessar o microfone.');
    }
  }

  private async enviarAudio(blob: Blob): Promise<void> {
    const conversa = this.conversaAtiva;
    if (!conversa) return;
    const u = this.auth.getUsuarioAtual();
    let url: string | null = null;
    try {
      const nome = `${u?.id ?? 'anon'}/${Date.now()}.webm`;
      const { error } = await this.supabase.getClient().storage.from('chat-audios').upload(nome, blob, {
        contentType: 'audio/webm',
        upsert: true,
      });
      if (error) throw error;
      url = this.supabase.getClient().storage.from('chat-audios').getPublicUrl(nome).data.publicUrl;
    } catch (e) {
      console.warn('Upload de áudio falhou (preview local):', e);
    }
    const conteudo = `AUDIO::${url ?? URL.createObjectURL(blob)}`;
    try {
      const { error } = await this.supabase
        .getClient()
        .rpc('send_message', { p_conversation_id: conversa.id, p_content: conteudo });
      if (error) throw error;
      await this.carregarMensagens(conversa);
    } catch (e) {
      console.warn('Áudio MOCK (send_message falhou):', e);
      conversa.mensagens.push({
        id: `m-${Date.now()}`,
        senderId: u?.id ?? '',
        autor: u?.nome ?? 'Você',
        avatar: u?.avatarUrl ?? 'img/foto-padrão.jpg',
        texto: conteudo,
        tempo: 'agora',
        minha: true,
      });
      this.rolarChatFinal();
    }
  }

  // --- Apagar mensagem própria (delete direto; local se falhar) ---
  async apagarMensagem(m: MensagemMock): Promise<void> {
    if (!m.minha) return;
    if (!confirm('Apagar esta mensagem?')) return;
    const conversa = this.conversaAtiva;
    try {
      // IDs MOCK (m-...) só existem localmente
      if (!m.id.startsWith('m-')) {
        const { error } = await this.supabase.getClient().from('messages').delete().eq('id', m.id);
        if (error) throw error;
      }
      if (conversa) {
        conversa.mensagens = conversa.mensagens.filter((x) => x.id !== m.id);
        await this.carregarMensagens(conversa);
      }
    } catch (e) {
      console.warn('Apagar mensagem falhou:', e);
      if (conversa) conversa.mensagens = conversa.mensagens.filter((x) => x.id !== m.id);
      this.mostrarToast('Mensagem apagada localmente.');
    }
  }

  // --- Apagar/sair da conversa (leave; local se falhar) ---
  async apagarConversa(): Promise<void> {
    const conversa = this.conversaAtiva;
    if (!conversa) return;
    if (!confirm(`Apagar a conversa "${conversa.nome}"?`)) return;
    try {
      const eu = this.auth.getUsuarioAtual()?.id;
      if (eu && !conversa.id.startsWith('mock') && !conversa.id.startsWith('seed')) {
        const { error } = await this.supabase
          .getClient()
          .from('conversation_participants')
          .delete()
          .eq('conversation_id', conversa.id)
          .eq('user_id', eu);
        if (error) throw error;
      }
      this.conversas = this.conversas.filter((c) => c.id !== conversa.id);
      this.conversaAtiva = this.conversas[0] ?? null;
      if (this.conversaAtiva) await this.selecionarConversa(this.conversaAtiva);
      this.mostrarToast('Conversa apagada.');
    } catch (e) {
      console.warn('Apagar conversa falhou:', e);
      this.mostrarToast('Não foi possível apagar.');
    }
  }

  // =============================================
  // FÓRUM EXTRA (novo: não existia no original)
  // =============================================

  // --- Feed visível (ocultos + bloqueados fora) + ordenação ---
  filtroForum: 'recentes' | 'curtidos' | 'meus' = 'recentes';

  get postsFiltrados(): PostMock[] {
    const lista = this.posts.filter((p) => this.postVisivelMod(p));
    const porCategoria =
      this.filtroCategoriaForum === 'todas' ? lista : lista.filter((p) => (p.categoria || 'conversa') === this.filtroCategoriaForum);
    if (this.filtroForum === 'curtidos') return [...porCategoria].sort((a, b) => b.curtidas - a.curtidas);
    if (this.filtroForum === 'meus') {
      const eu = this.auth.getUsuarioAtual()?.nome ?? 'Você';
      return porCategoria.filter((p) => p.autor === eu);
    }
    return porCategoria;
  }

  // --- Quem curtiu (MOCK: nomes fictícios; TODO: tabela likes) ---
  curtidasExpandidasId: string | null = null;

  quemCurtiu(post: PostMock): string[] {
    const base = ['Luti Christóforo', 'Visitante'];
    return base.slice(0, Math.min(base.length, post.curtidas));
  }

  alternarCurtidas(post: PostMock): void {
    this.curtidasExpandidasId = this.curtidasExpandidasId === post.id ? null : post.id;
  }

  // --- Dono do post (pode editar/excluir) ---
  ehMeuPost(post: PostMock): boolean {
    const eu = this.auth.getUsuarioAtual()?.nome ?? 'Você';
    return post.autor === eu;
  }

  // --- Edição: abre o modal pré-preenchido; salvar no criarPost ---
  postEditandoId: string | null = null;

  editarPost(post: PostMock): void {
    if (!this.ehMeuPost(post)) return;
    this.postEditandoId = post.id;
    this.menuModId = null;
    this.mostrarModalPost = true;
    setTimeout(() => {
      if (this.textoNovoPost) this.textoNovoPost.nativeElement.value = post.texto;
    });
  }

  salvarEdicaoPost(texto: string): boolean {
    if (!this.postEditandoId) return false;
    const post = this.posts.find((p) => p.id === this.postEditandoId);
    if (post && texto.trim()) {
      post.texto = texto.trim();
      // TODO SUPABASE: update em posts.
    }
    this.postEditandoId = null;
    return true;
  }

  // --- Exclusão real: sem RPC no original → delete direto (só remove local se OK) ---
  async excluirPost(post: PostMock): Promise<void> {
    if (!this.ehMeuPost(post)) return;
    if (!confirm('Excluir este post?')) return;
    try {
      const { error } = await this.supabase.getClient().from('posts').delete().eq('id', post.id);
      if (error) throw error;
      this.posts = this.posts.filter((p) => p.id !== post.id);
      this.menuModId = null;
    } catch (e) {
      console.warn('Exclusão falhou:', e);
      this.mostrarToast('Não foi possível excluir');
    }
  }

  // --- Citar: abre resposta com quote (novo; TODO: reply com parent_id) ---
  citarPost(post: PostMock): void {
    this.menuModId = null;
    this.abrirModalResposta(post);
    setTimeout(() => {
      if (this.textoResposta) {
        this.textoResposta.nativeElement.value = `> ${post.autor}: ${post.texto}\n\n`;
      }
    });
  }

  // =============================================
  // HOVER EXTRA (Seguir + copiar @)
  // =============================================
  seguindoHover = new Set<string>();

  seguirHover(u: UsuarioHover): void {
    if (this.seguindoHover.has(u.id)) {
      this.seguindoHover.delete(u.id);
      u.seguidores = Math.max(0, u.seguidores - 1);
    } else {
      this.seguindoHover.add(u.id);
      u.seguidores += 1;
    }
    // TODO SUPABASE: tabela follows.
  }

  estaSeguindo(u: UsuarioHover): boolean {
    return this.seguindoHover.has(u.id);
  }

  copiarUsername(u: UsuarioHover): void {
    void navigator.clipboard?.writeText(u.username).catch(() => undefined);
    this.mostrarToast('Nome de usuário copiado!');
  }

  // =============================================
  // GRUPOS EXTRA (criar, membros, convite)
  // =============================================
  mostrarModalGrupo = false;
  membrosVisiveisId: string | null = null;

  // --- Imagem do grupo: upload p/ bucket 'group-images' (espelha o original) ---
  imagemGrupoUrl: string | null = null;

  async aoEscolherImagemGrupo(e: Event): Promise<void> {
    const arquivo = (e.target as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    const uid = this.auth.getUsuarioAtual()?.id ?? 'anon';
    try {
      const nome = `${uid}/grupo-${Date.now()}`;
      const { error } = await this.supabase
        .getClient()
        .storage.from('group-images')
        .upload(nome, arquivo, { upsert: true });
      if (error) throw error;
      const { data } = this.supabase.getClient().storage.from('group-images').getPublicUrl(nome);
      this.imagemGrupoUrl = data.publicUrl;
      this.mostrarToast('Imagem pronta!');
    } catch (err) {
      console.warn('Imagem MOCK (bucket group-images falhou):', err);
      this.mostrarToast('Erro ao enviar imagem');
    }
  }

  criarGrupo(nome: string, descricao: string, categoria: string, imagemUrl = '', privado = false): void {
    if (!nome.trim()) return;
    const url = imagemUrl.trim() || undefined;
    if (url) this.imagemGrupoUrl = url;
    void this.criarGrupoReal(nome.trim(), descricao.trim(), categoria || 'Geral', privado);
    this.mostrarModalGrupo = false;
  }

  // --- Criação real: insert em groups + convite se privado + msg sistema (fallback MOCK) ---
  private async criarGrupoReal(nome: string, descricao: string, categoria: string, privado: boolean): Promise<void> {
    const imagem = this.imagemGrupoUrl;
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('groups')
        .insert({
          name: nome,
          description: descricao || 'Sem descrição',
          category: categoria,
          image_url: imagem,
          is_private: privado,
        })
        .select('id')
        .single();
      if (error) throw error;
      const gid = (data as { id?: string })?.id;
      console.log('Grupo criado:', gid);
      this.imagemGrupoUrl = null;
      await this.carregarGrupos();
      if (gid) {
        if (privado) {
          // Grupo privado: gera convite (espelha original: gera + mostra)
          const alvo = this.grupos.find((g) => g.id === gid);
          if (alvo) {
            alvo.privado = true;
            await this.gerarConviteReal(alvo);
          }
        } else {
          await this.mensagemSistemaGrupo(
            gid,
            `Grupo "${nome}" criado! Boas-vindas à comunidade.`,
          );
        }
      }
    } catch (e) {
      console.warn('Grupo MOCK (insert falhou):', e);
      this.grupos.unshift({
        id: `g-${Date.now()}`,
        nome,
        descricao: descricao || 'Sem descrição',
        membros: 1,
        participo: true,
        categoria,
        codigoConvite: this.gerarCodigo(),
        privado,
      });
      this.imagemGrupoUrl = null;
    }
  }

  private gerarCodigo(): string {
    return Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  alternarMembros(g: GrupoMock): void {
    this.membrosVisiveisId = this.membrosVisiveisId === g.id ? null : g.id;
  }

  membrosMock(g: GrupoMock): string[] {
    return ['Luti Christóforo', 'Visitante', 'Você'].slice(0, Math.min(3, g.membros));
  }

  copiarConvite(g: GrupoMock): void {
    if (!g.codigoConvite) g.codigoConvite = this.gerarCodigo();
    void navigator.clipboard?.writeText(g.codigoConvite).catch(() => undefined);
    this.mostrarToast('Código copiado!');
    // TODO SUPABASE: tabela group_invites.
  }

  // --- Categorias do fórum (FORUM_CATEGORIES do original; filtro local + TODO coluna) ---
  readonly categoriasForum = [
    { id: 'duvida', rotulo: 'Dúvida', icone: 'fa-circle-question' },
    { id: 'experiencia', rotulo: 'Experiência', icone: 'fa-comment-dots' },
    { id: 'dica', rotulo: 'Dica', icone: 'fa-lightbulb' },
    { id: 'conquista', rotulo: 'Conquista', icone: 'fa-trophy' },
    { id: 'neurodivergencia', rotulo: 'Neurodivergência', icone: 'fa-brain' },
    { id: 'estudos', rotulo: 'Estudos', icone: 'fa-book-open' },
    { id: 'trabalho', rotulo: 'Trabalho', icone: 'fa-briefcase' },
    { id: 'acessibilidade', rotulo: 'Acessibilidade', icone: 'fa-universal-access' },
    { id: 'conversa', rotulo: 'Conversa', icone: 'fa-comments' },
    { id: 'ajuda', rotulo: 'Preciso de Ajuda', icone: 'fa-hand-holding-heart' },
  ];
  filtroCategoriaForum = 'todas';
  categoriaNovoPost = 'conversa';

  // =============================================
  // ADICIONAR AMIGO AO GRUPO (espelha apiAddFriendToGroup)
  // =============================================
  mostrarModalAddAmigo = false;
  grupoAlvoAddAmigo: GrupoMock | null = null;
  buscaAmigoGrupo = '';
  mostrarModalEscolherGrupo = false;
  amigoAlvoGrupo: { id: string; nome: string } | null = null;

  abrirAddAmigo(g: GrupoMock): void {
    this.grupoAlvoAddAmigo = g;
    this.buscaAmigoGrupo = '';
    this.mostrarModalAddAmigo = true;
  }

  get amigosFiltradosAddGrupo(): AmigoMock[] {
    const q = this.buscaAmigoGrupo.trim().toLowerCase();
    if (!q) return this.amigos;
    return this.amigos.filter((a) => (a.nome + ' ' + (a.username || '')).toLowerCase().includes(q));
  }

  async adicionarAmigoAoGrupo(amigoId: string): Promise<void> {
    const grupo = this.grupoAlvoAddAmigo ?? this.grupos.find((g) => g.id === this.grupoAlvoAddAmigo?.id);
    const gid = this.grupoAlvoAddAmigo?.id;
    if (!gid) return;
    try {
      const { data, error } = await this.supabase
        .getClient()
        .rpc('add_friend_to_group', { p_friend_id: amigoId, p_group_id: gid });
      if (error) throw error;
      const r = data as { success?: boolean; error?: string } | null;
      if (r && r.success === false) throw new Error(r.error || 'Não foi possível adicionar');
      this.mostrarToast('Amigo adicionado ao grupo!');
      this.mostrarModalAddAmigo = false;
      await this.carregarGrupos();
    } catch (e) {
      console.warn('AddAmigo RPC falhou, fallback direto:', e);
      // Fallback direto (espelha apiAddFriendToGroup): group_members + participants + contador
      try {
        const sb = this.supabase.getClient();
        const { data: ja } = await sb
          .from('group_members')
          .select('id')
          .eq('group_id', gid)
          .eq('user_id', amigoId)
          .maybeSingle();
        if (ja) {
          this.mostrarToast('Esta pessoa já é membro do grupo.');
          return;
        }
        const { error: insErr } = await sb
          .from('group_members')
          .insert({ group_id: gid, user_id: amigoId, joined_at: new Date().toISOString() });
        if (insErr) throw insErr;
        await sb.from('conversation_participants').insert({
          conversation_id: gid,
          user_id: amigoId,
          joined_at: new Date().toISOString(),
        });
        if (grupo) grupo.membros += 1;
        this.mostrarToast('Amigo adicionado ao grupo!');
        this.mostrarModalAddAmigo = false;
      } catch (e2) {
        console.warn('AddAmigo fallback falhou:', e2);
        this.mostrarToast('Não foi possível adicionar (MOCK).');
      }
    }
  }

  abrirEscolherGrupo(amigo: { id: string; nome: string }): void {
    this.amigoAlvo = null;
    this.amigoAlvoGrupo = amigo;
    this.mostrarModalEscolherGrupo = true;
  }

  async escolherGrupoParaAmigo(gid: string): Promise<void> {
    const amigo = this.amigoAlvoGrupo;
    if (!amigo) return;
    this.grupoAlvoAddAmigo = this.grupos.find((g) => g.id === gid) ?? null;
    this.mostrarModalEscolherGrupo = false;
    await this.adicionarAmigoAoGrupo(amigo.id);
    this.amigoAlvoGrupo = null;
  }

  // =============================================
  // CONVITES REAIS (espelha apiGenerateGroupInvite + fallback group_invites)
  // =============================================
  mostrarModalCodigo = false;
  grupoAlvoCodigo: GrupoMock | null = null;
  codigoConviteAtual = '';
  codigoConviteExpira = '';

  async gerarConviteReal(g: GrupoMock): Promise<void> {
    this.grupoAlvoCodigo = g;
    try {
      const { data, error } = await this.supabase
        .getClient()
        .rpc('generate_group_invite', { p_group_id: g.id });
      if (error) throw error;
      const r = data as { success?: boolean; code?: string; expires_at?: string; error?: string } | null;
      if (!r || r.success !== true || !r.code) throw new Error(r?.error || 'Resposta vazia da RPC');
      this.aplicarCodigoConvite(g, r.code, r.expires_at);
    } catch (e) {
      console.warn('Convite RPC falhou, fallback group_invites:', e);
      try {
        const sb = this.supabase.getClient();
        const codigo = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
        const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await sb.from('group_invites').update({ active: false }).eq('group_id', g.id);
        const eu = this.auth.getUsuarioAtual()?.id;
        const { error: insErr } = await sb.from('group_invites').insert({
          group_id: g.id,
          code: codigo,
          created_by: eu,
          expires_at: expira,
          active: true,
        });
        if (insErr) throw insErr;
        this.aplicarCodigoConvite(g, codigo, expira);
      } catch (e2) {
        console.warn('Convite fallback falhou (MOCK local):', e2);
        if (!g.codigoConvite) g.codigoConvite = this.gerarCodigo();
        this.aplicarCodigoConvite(g, g.codigoConvite, '');
      }
    }
    this.mostrarModalCodigo = true;
  }

  private aplicarCodigoConvite(g: GrupoMock, codigo: string, expiraIso?: string): void {
    g.codigoConvite = codigo;
    this.codigoConviteAtual = codigo;
    this.codigoConviteExpira = expiraIso ? `Expira em ${this.formatarDataConvite(expiraIso)}` : 'Expira em 7 dias';
  }

  private formatarDataConvite(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '7 dias';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  copiarCodigoConvite(): void {
    if (!this.codigoConviteAtual) return;
    void navigator.clipboard?.writeText(this.codigoConviteAtual).catch(() => undefined);
    this.mostrarToast('Código copiado!');
  }

  async regenerarCodigo(): Promise<void> {
    if (this.grupoAlvoCodigo) await this.gerarConviteReal(this.grupoAlvoCodigo);
  }

  // =============================================
  // MENSAGEM DE SISTEMA DO GRUPO (insert_system_message → send_message → direto)
  // =============================================
  private async mensagemSistemaGrupo(groupId: string, conteudo: string): Promise<void> {
    const sb = this.supabase.getClient();
    try {
      const { error } = await sb.rpc('insert_system_message', {
        p_conversation_id: groupId,
        p_content: conteudo,
      });
      if (error) throw error;
      return;
    } catch (e) {
      console.warn('insert_system_message falhou, tentando send_message:', e);
    }
    try {
      const { error } = await sb.rpc('send_message', { p_conversation_id: groupId, p_content: conteudo });
      if (error) throw error;
    } catch (e) {
      console.warn('send_message falhou, inserção direta:', e);
      try {
        const eu = this.auth.getUsuarioAtual();
        await sb.from('messages').insert({
          conversation_id: groupId,
          sender_id: eu?.id,
          sender_name: 'Sistema',
          content: conteudo,
          created_at: new Date().toISOString(),
        });
      } catch (e2) {
        console.warn('Mensagem de sistema falhou:', e2);
      }
    }
  }

  // =============================================
  // NOTIFICAÇÕES LOCAIS (sem tabela no original → MOCK + TODO; sino no fórum)
  // TODO SUPABASE: tabela notifications (user_id, texto, lida, created_at) + realtime.
  // =============================================
  notificacoes: Array<{ id: string; texto: string; tempo: string; lida: boolean; icone: string }> = [];
  mostrarPainelNotif = false;

  get notificacoesNaoLidas(): number {
    return this.notificacoes.filter((n) => !n.lida).length;
  }

  private carregarNotificacoes(): void {
    try {
      const raw = localStorage.getItem('cx_notificacoes');
      const lista = raw ? (JSON.parse(raw) as typeof this.notificacoes) : [];
      this.notificacoes = Array.isArray(lista) ? lista : [];
    } catch {
      this.notificacoes = [];
    }
  }

  private salvarNotificacoes(): void {
    try {
      localStorage.setItem('cx_notificacoes', JSON.stringify(this.notificacoes.slice(0, 30)));
    } catch {
      // ignora
    }
  }

  pushNotificacao(texto: string, icone = 'fa-bell'): void {
    this.notificacoes.unshift({
      id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      texto,
      tempo: 'agora',
      lida: false,
      icone,
    });
    this.notificacoes = this.notificacoes.slice(0, 30);
    this.salvarNotificacoes();
  }

  marcarTodasLidas(): void {
    this.notificacoes = this.notificacoes.map((n) => ({ ...n, lida: true }));
    this.salvarNotificacoes();
    this.mostrarPainelNotif = false;
  }

  alternarPainelNotif(): void {
    this.mostrarPainelNotif = !this.mostrarPainelNotif;
  }
  async usarCodigoConvite(codigo: string): Promise<void> {
    const code = codigo.trim().toUpperCase();
    if (!code) return;
    try {
      const { error } = await this.supabase.getClient().rpc('use_invite_code', { p_code: code });
      if (error) throw error;
      await this.carregarGrupos();
      this.mostrarToast('Você entrou no grupo!');
      return;
    } catch (e) {
      console.warn('Convite MOCK (use_invite_code falhou):', e);
    }
    const grupo = this.grupos.find((g) => g.codigoConvite === code);
    if (grupo && !grupo.participo) {
      grupo.participo = true;
      grupo.membros += 1;
      this.mostrarToast(`Você entrou em ${grupo.nome}!`);
    } else if (!grupo) {
      this.mostrarToast('Código não encontrado (MOCK).');
    }
  }

  // =============================================
  // EVENTOS EXTRA (criar, RSVP, detalhes)
  // =============================================
  mostrarModalEvento = false;
  detalhesEventoId: string | null = null;

  criarEvento(titulo: string, data: string, descricao = ''): void {
    if (!titulo.trim()) return;
    void this.criarEventoReal(titulo.trim(), data.trim(), descricao.trim());
    this.mostrarModalEvento = false;
  }

  // --- Criação real: insert em events (fallback: MOCK local) ---
  private async criarEventoReal(titulo: string, data: string, descricao: string): Promise<void> {
    try {
      const sb = this.supabase.getClient();
      const eu = this.auth.getUsuarioAtual()?.id;
      // Data livre ("Sábado, 10h") não parseia: salva null e exibe o texto (TODO coluna data_texto)
      const parsed = new Date(data).getTime();
      const { error } = await sb.from('events').insert({
        title: titulo,
        description: descricao || '',
        date: isNaN(parsed) ? null : new Date(data).toISOString(),
        is_active: true,
        created_by: eu,
      });
      if (error) throw error;
      await this.carregarEventos();
      this.mostrarToast('Evento criado!');
    } catch (e) {
      console.warn('Evento MOCK (insert falhou):', e);
      this.eventos.unshift({
        id: `e-${Date.now()}`,
        titulo,
        data: data || 'Data a definir',
        descricao,
        participantes: 1,
        participando: true,
        rsvp: 'vou',
      });
    }
  }

  definirRsvp(e: EventoMock, r: 'vou' | 'nao' | 'talvez'): void {
    void this.definirRsvpReal(e, r);
  }

  // --- RSVP real: event_participants select/delete/upsert (espelha o original) ---
  private async definirRsvpReal(e: EventoMock, r: 'vou' | 'nao' | 'talvez'): Promise<void> {
    const uid = this.auth.getUsuarioAtual()?.id;
    if (!uid || uid === 'local') {
      this.mostrarToast('Faça login para participar');
      return;
    }
    if (e.rsvp === r) {
      try {
        const { error } = await this.supabase
          .getClient()
          .from('event_participants')
          .delete()
          .eq('event_id', e.id)
          .eq('user_id', uid);
        if (error) throw error;
      } catch (err) {
        console.warn('RSVP MOCK (delete falhou):', err);
      }
      e.rsvp = null;
      e.participantes = Math.max(0, e.participantes - 1);
      e.participando = false;
      return;
    }
    try {
      const { error } = await this.supabase
        .getClient()
        .from('event_participants')
        .upsert({ event_id: e.id, user_id: uid }, { onConflict: 'event_id,user_id', ignoreDuplicates: true });
      if (error && (error as { code?: string }).code !== '23505') throw error;
      if (!e.participando) e.participantes += 1;
      e.rsvp = r;
      e.participando = r === 'vou';
      this.mostrarToast(r === 'vou' ? 'Presença confirmada!' : 'Resposta registrada!');
    } catch (err) {
      console.warn('RSVP MOCK (upsert falhou):', err);
      if (!e.participando) e.participantes += 1;
      e.rsvp = r;
      e.participando = r === 'vou';
    }
  }

  alternarDetalhesEvento(e: EventoMock): void {
    this.detalhesEventoId = this.detalhesEventoId === e.id ? null : e.id;
  }

  // =============================================
  // CONVERSA EXTRA (anexo, lidas, busca)
  // =============================================
  buscaChat = '';
  anexoNome: string | null = null;

  // TODO SUPABASE: storage upload (perfil.js usa bucket avatars como referência).
  aoAnexarArquivo(e: Event): void {
    const arquivo = (e.target as HTMLInputElement).files?.[0];
    this.anexoNome = arquivo ? arquivo.name : null;
    console.log('[MOCK] anexo guardado em memória:', this.anexoNome);
  }

  get mensagensFiltradas(): MensagemMock[] {
    const lista = this.conversaAtiva?.mensagens ?? [];
    const termo = this.buscaChat.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((m) => (m.autor + ' ' + m.texto).toLowerCase().includes(termo));
  }

  // =============================================
  // MODERAÇÃO EXTRA (bloquear; painel admin exige role — adiado)
  // =============================================
  usuariosBloqueados = new Set<string>();

  bloquearUsuario(post: PostMock): void {
    if (!confirm(`Bloquear ${post.autor}? Você não verá mais posts dessa pessoa.`)) return;
    this.usuariosBloqueados.add(post.autor);
    this.menuModId = null;
    // TODO SUPABASE: rpc block_user.
  }

  postVisivelMod(post: PostMock): boolean {
    return !this.postsOcultos.has(post.id) && !this.usuariosBloqueados.has(post.autor);
  }

  // =============================================
  // HONEYPOT ANTI-SPAM (espelha honeypot.js, sem redirect)
  // Padrões XSS/SQLi; loga via rpc log_attack_simple (fire-and-forget).
  // NÃO redireciona para hacker-trap (página não migrada).
  // =============================================
  private readonly padroesAtaque: RegExp[] = [
    /<script/i,
    /javascript:/i,
    /onerror/i,
    /onclick/i,
    /<iframe/i,
    /drop\s+table/i,
    /union\s+select/i,
    /or\s+1\s*=\s*1/i,
  ];

  verificarHoneypot(texto: string, origem: string): boolean {
    if (!texto) return false;
    for (const padrao of this.padroesAtaque) {
      if (padrao.test(texto)) {
        console.warn('[HONEYPOT] padrão suspeito em', origem, ':', padrao.source);
        // Espelha logAttack (honeypot.js:72): fire-and-forget, sem redirect.
        void (async () => {
          try {
            await this.supabase
              .getClient()
              .rpc('log_attack_simple', { p_attack_type: 'xss', p_payload: texto.slice(0, 500) });
          } catch {
            // Silencioso por diseño (monitoramento não bloqueia)
          }
        })();
        return true;
      }
    }
    return false;
  }
}
