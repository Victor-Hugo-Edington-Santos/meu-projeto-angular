import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

// Perfil real: profiles + posts + saved_posts + storage avatars.
// Espelha loadProfile/loadPosts/loadSavedPosts/loadStats/save (perfil.js).
// Tudo com fallback MOCK local em caso de erro/RLS.
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './perfil.css',
  templateUrl: './perfil.html',
})
export class Perfil implements OnInit, OnDestroy {
  // --- Estado explícito p/ debug do template ---
  perfil: Record<string, unknown> | null = null;
  carregando = true;
  erro: string | null = null;
  private rotaSub: { unsubscribe(): void } | null = null;
  // --- Aba interna ativa ---
  abaInterna = 'posts';

  // --- Modal de edição ---
  mostrarEdicao = false;

  // --- Stats (loadStats perfil.js:460 → colunas do perfil) ---
  seguindo = 0;
  seguidores = 0;
  contribuicoes = 0;

  // --- Listas por aba (reais; MOCK se vazio/erro) ---
  meusPosts: Array<{ id: string; texto: string; tempo: string; tempoRel: string; curtidas: number; comentarios: number; imagem?: string; video?: string }> = [];
  salvos: Array<{ id: string; texto: string; tempo: string }> = [];
  // Respostas/curtidas: o original (perfil.js renderCurrentTab) deixa vazio — MOCK + TODO.
  // TODO SUPABASE: from('comments').select().eq('author_id', id) e from('likes').select('post_id, posts(*)').eq('user_id', id) quando as tabelas existirem.

  // --- Perfil alvo (?id= outro usuário ou próprio) — espelha targetUserId do perfil.js ---
  perfilAlvoId: string | null = null;
  ehMeuPerfil = true;

  // --- Campos do perfil exibido (próprio ou de terceiros) ---
  nomePerfil = 'Carregando...';
  handlePerfil = '@carregando';
  bioPerfil = 'Sem bio.';
  avatarPerfil = 'img/foto-padrão.jpg';
  temAvatar = false;
  bannerPerfil = '';
  temBanner = false;
  localizacao = '';
  website = '';
  websiteLabel = '';
  dataEntrada = '...';
  isAdmin = false;
  isVerified = false;
  // ID da URL existe mas não há linha correspondente em profiles
  perfilNaoEncontrado = false;

  // --- Destaques (posts salvos) + Quem seguir (MOCK + TODO) ---
  destaques: Array<{ id: string; titulo: string; imagem?: string }> = [];
  sugestoesSeguir: Array<{ id: string; nome: string; username: string; avatar: string }> = [];
  private seguindoIds = new Set<string>();

  // --- Arquivos pendentes de upload ---
  private avatarArquivo: File | null = null;
  private bannerArquivo: File | null = null;
  // --- Previews locais (object URL) + moldura ---
  previewAvatar: string | null = null;
  previewBanner: string | null = null;
  moldura: string = 'none';
  readonly molduras = [
    { id: 'none', titulo: 'Sem moldura' },
    { id: 'gold', titulo: 'Dourada' },
    { id: 'purple', titulo: 'Roxa' },
    { id: 'neon', titulo: 'Neon' },
    { id: 'rainbow', titulo: 'Arco-íris' },
  ];

  @ViewChild('bioTexto') bioTexto!: ElementRef<HTMLElement>;
  @ViewChild('contadorBio') contadorBio!: ElementRef<HTMLElement>;

  constructor(
    private readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    private readonly host: ElementRef<HTMLElement>,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.exporSondaDebug();
    // Inscrição na rota (não snapshot): recarrega ao navegar entre perfis sem recriar o componente
    this.rotaSub = this.route.paramMap.subscribe((pm) => {
      void this.iniciar(pm.get('id'));
    });
  }

  ngOnDestroy(): void {
    try {
      this.rotaSub?.unsubscribe();
    } catch {
      // ignora
    }
    this.rotaSub = null;
  }

  private async iniciar(idUrl: string | null): Promise<void> {
    this.carregando = true;
    this.erro = null;
    this.perfil = null;
    this.perfilNaoEncontrado = false;
    this.cdr.detectChanges();
    // ID da URL (/comunidade/perfil/:id) ou próprio logado (espelha ?id= do perfil.js)
    // Valor síncrono primeiro (nunca trava); sessão real só para comparar dono
    const localId = this.auth.getUsuarioAtual()?.id ?? null;
    this.perfilAlvoId = idUrl ?? localId;
    this.ehMeuPerfil = !idUrl;
    try {
      const meuId = await this.comTimeout(this.resolverMeuId(), 6000);
      if (idUrl && meuId) this.ehMeuPerfil = idUrl === meuId;
      if (!idUrl) {
        this.perfilAlvoId = meuId ?? localId;
        this.ehMeuPerfil = true;
      }
    } catch {
      // Sessão indisponível: segue com o ID da URL (perfil de terceiros funciona sem login)
    }
    // Carregamentos independentes: um não bloqueia o outro.
    // Destaques por último: depende de salvos + meusPosts já preenchidos.
    await Promise.allSettled([
      this.comTimeout(this.carregarPerfil(), 10000),
      this.comTimeout(this.carregarListas(), 10000),
      this.comTimeout(this.carregarRespostas(), 10000),
      this.comTimeout(this.carregarCurtidas(), 10000),
      this.comTimeout(this.carregarSugestoes(), 10000),
      this.comTimeout(this.carregarContribuicoes(), 10000),
    ]);
    await this.carregarDestaques();
    this.carregando = false;
    this.cdr.detectChanges();
  }

  // Corrida com timeout p/ Promise que pode pendurar sem resolver nem rejeitar.
  private comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout após ' + ms + 'ms')), ms);
      promessa.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  private async resolverMeuId(): Promise<string | null> {
    try {
      const { data } = await this.supabase.getClient().auth.getSession();
      return data.session?.user.id ?? this.auth.getUsuarioAtual()?.id ?? null;
    } catch {
      return this.auth.getUsuarioAtual()?.id ?? null;
    }
  }

  // --- URLs fantasmas do banco (arquivos que não existem em public/img) → tratar como vazio ---
  private normalizarMidia(url: unknown): string | null {
    if (typeof url !== 'string') return null;
    const u = url.trim();
    if (!u) return null;
    const base = u.toLowerCase();
    if (base.includes('avatar-padrao.png') || base.includes('grupo-padrao.png')) return null;
    return u;
  }
  get nome(): string {
    return this.auth.getUsuarioAtual()?.nome ?? 'Visitante';
  }

  get email(): string {
    return this.auth.getUsuarioAtual()?.email ?? 'carregando@email.com';
  }

  get avatar(): string {
    return this.auth.getUsuarioAtual()?.avatarUrl ?? 'img/foto-padrão.jpg';
  }

  get handle(): string {
    return '@' + this.nome.toLowerCase().replace(/\s+/g, '');
  }

  // --- Carrega profiles.* do alvo (próprio ou ?id) — espelha loadProfile/renderProfile ---
  private async carregarPerfil(): Promise<void> {
    const alvo = this.perfilAlvoId;
    if (!alvo || alvo === 'local' || alvo.startsWith('mock-')) {
      this.aplicarPerfilFallback('Usuário', null);
      return;
    }
    try {
      const sb = this.supabase.getClient();
      console.log('[perfil] Buscando id:', alvo);
      // ID pode ser UUID ou username (ex: navegação com MOCK 'u-david')
      const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alvo);
      const consulta = ehUuid
        ? sb.from('profiles').select('*').eq('id', alvo)
        : sb.from('profiles').select('*').ilike('username', alvo.replace(/^u-/, ''));
      const { data: perfil, error } = await consulta.maybeSingle();
      console.log('[perfil] Response:', { data: perfil, error });
      if (error) {
        const e = error as { code?: string; message?: string; hint?: string; details?: string };
        console.error('[perfil] ERRO:', e.code, e.message, e.hint ?? e.details ?? '');
        this.erro = 'Erro ao carregar perfil: ' + (e.message ?? e.code ?? 'desconhecido');
        this.cdr.detectChanges();
        throw error;
      }
      if (!perfil) {
        console.warn('[perfil] Perfil não encontrado para id:', alvo);
        this.erro = 'Perfil não encontrado';
        this.perfilNaoEncontrado = true;
        this.aplicarPerfilFallback('Usuário', null);
        this.cdr.detectChanges();
        return;
      }
      this.perfil = perfil as Record<string, unknown>;
      const p = perfil as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
      const num = (v: unknown) => (typeof v === 'number' ? v : 0);
      const nome = str(p['username']) ?? str(p['full_name']) ?? 'Usuário';
      this.nomePerfil = nome;
      this.handlePerfil = '@' + nome.toLowerCase().replace(/\s+/g, '');
      this.bioPerfil = str(p['bio']) ?? 'Sem bio.';
      const avatar = this.normalizarMidia(str(p['avatar_url']));
      this.temAvatar = !!avatar;
      this.avatarPerfil = avatar || 'img/foto-padrão.jpg';
      const banner = this.normalizarMidia(str(p['banner_url']));
      this.temBanner = !!banner;
      this.bannerPerfil = banner || '';
      const loc = str(p['location']);
      this.localizacao = loc ?? '';
      const site = str(p['website']) ?? str(p['link']) ?? '';
      this.website = site && (site.startsWith('http') ? site : 'https://' + site);
      this.websiteLabel = site.replace(/^https?:\/\//, '');
      this.isAdmin = p['is_admin'] === true;
      this.isVerified = p['is_verified'] === true;
      this.moldura = str(p['frame']) ?? 'none';
      this.seguidores = num(p['followers_count']);
      this.seguindo = num(p['following_count']);
      this.contribuicoes = num(p['contribution_count']);
      const criado = str(p['created_at']);
      if (criado) {
        const d = new Date(criado);
        if (!isNaN(d.getTime())) {
          this.dataEntrada = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        }
      }
      if (this.ehMeuPerfil) {
        this.auth.atualizarUsuarioLocal({
          nome,
          ...(avatar ? { avatarUrl: avatar } : {}),
        });
        try {
          localStorage.setItem('userName', nome);
          localStorage.setItem('userBio', this.bioPerfil);
          if (avatar) localStorage.setItem('userAvatar', avatar);
        } catch {
          // ignora
        }
      }
      document.title = `${nome} — Amor NeuroDivergente`;
      // Breadcrumb do shell: mostra @username em vez do UUID
      try {
        window.dispatchEvent(new CustomEvent('pagina-trilha', { detail: this.handlePerfil }));
      } catch {
        // ignora
      }
      console.log('[perfil] Perfil carregado:', {
        id: alvo,
        username: nome,
        bio: this.bioPerfil,
        is_admin: this.isAdmin,
        created_at: criado,
        followers: this.seguidores,
        following: this.seguindo,
      });
      this.cdr.detectChanges();
    } catch (e) {
      console.error('[perfil] Exceção:', e);
      if (!this.erro) this.erro = 'Erro inesperado';
      this.aplicarPerfilFallback('Usuário', null);
      this.cdr.detectChanges();
    }
  }

  // --- Cria perfil básico se não existir (para próprio usuário) ---
  // REMOVIDO: não criar do zero — apenas ler o perfil existente da pessoa.
  // Se a linha não existe, a página mostra fallback + "Perfil não encontrado".

  private aplicarPerfilFallback(nome: string, local: { email?: string; avatarUrl?: string } | null | undefined): void {
    this.nomePerfil = nome;
    this.handlePerfil = '@' + nome.toLowerCase().replace(/\s+/g, '');
    try {
      this.bioPerfil = localStorage.getItem('userBio') || 'Sem bio.';
      const av = localStorage.getItem('userAvatar');
      this.temAvatar = !!av;
      this.avatarPerfil = av || local?.avatarUrl || 'img/foto-padrão.jpg';
    } catch {
      this.bioPerfil = 'Sem bio.';
      this.avatarPerfil = local?.avatarUrl || 'img/foto-padrão.jpg';
    }
    this.temBanner = false;
    this.bannerPerfil = '';
  }

  // --- Listas: posts do alvo + salvos (espelha loadPosts/loadSavedPosts) ---
  // Sem filtros/order server-side (coluna ausente = 400): ordena/filtra no cliente.
  private async carregarListas(): Promise<void> {
    const uid = this.perfilAlvoId;
    console.log('[perfil] Carregando listas para uid:', uid);
    if (!uid || uid === 'local' || uid.startsWith('mock-')) {
      console.warn('[perfil] UID inválido p/ listas:', uid);
      return;
    }
    try {
      const sb = this.supabase.getClient();
      let linhas: Array<Record<string, unknown>> = [];
      try {
        const { data: posts, error: postsError } = await sb
          .from('posts')
          .select('*')
          .eq('author_id', uid)
          .limit(20);
        if (postsError) throw postsError;
        linhas = (posts ?? []) as Array<Record<string, unknown>>;
        console.log('[perfil] Posts diretos:', linhas.length);
      } catch (diretoErr) {
        // Fallback: mesma RPC do fórum, filtrada pelo autor (espelha apiGetPosts)
        console.warn('[perfil] posts direto falhou, tentando get_posts:', diretoErr);
        try {
          const { data, error } = await sb.rpc('get_posts', { p_limit: 50, p_offset: 0 });
          if (error) throw error;
          const todos = (data ?? []) as Array<Record<string, unknown>>;
          console.log('[perfil] get_posts retornou:', todos.length, '| authors:', [
            ...new Set(todos.map((p) => String(p['author_id'] ?? p['user_id'] ?? '?'))),
          ]);
          linhas = todos.filter(
            (p) => String(p['author_id'] ?? p['user_id'] ?? '') === uid,
          );
          console.log('[perfil] Posts filtrados p/ uid:', linhas.length);
        } catch (rpcErr) {
          console.error('[perfil] Erro ao buscar posts:', rpcErr);
        }
      }
      // Filtro is_active só se a coluna existir; ordenação no cliente
      linhas = linhas
        .filter((p) => !('is_active' in p) || p['is_active'] !== false)
        .sort((a, b) => String(b['created_at'] ?? '').localeCompare(String(a['created_at'] ?? '')));
      this.meusPosts = linhas.map((p) => ({
        id: String(p['id']),
        texto: String(p['content'] ?? p['body'] ?? p['texto'] ?? p['text'] ?? ''),
        tempo: this.formatarDataPerfil(String(p['created_at'] ?? '')),
        tempoRel: this.tempoRelativo(String(p['created_at'] ?? '')),
        curtidas: Number(p['likes'] ?? p['likes_count'] ?? 0),
        comentarios: Number(p['comment_count'] ?? p['comments_count'] ?? 0),
        imagem: this.normalizarMidia(p['image_url'] ?? p['media_url'] ?? p['image'] ?? p['photo_url']) ?? undefined,
        video: this.normalizarMidia(p['video_url']) ?? undefined,
      }));
      console.log('[perfil/RENDER] this.meusPosts.length =', this.meusPosts.length);
      console.log('[perfil/RENDER] primeiro post:', this.meusPosts[0]);
      if (linhas[0]) console.log('[perfil] colunas do post:', Object.keys(linhas[0]));
      const { data: salvos, error: salvosError } = await sb.from('saved_posts').select('*').eq('user_id', uid).limit(20);
      if (salvosError) {
        console.warn('[perfil] Erro ao buscar salvos:', salvosError);
      } else {
        console.log('[perfil] Salvos:', (salvos ?? []).length);
      }
      const ids = ((salvos ?? []) as Array<Record<string, unknown>>).map((s) =>
        String(s['post_id'] ?? s['post'] ?? s['id'] ?? ''),
      ).filter(Boolean);
      if (ids.length) {
        const { data: salvosPosts } = await sb.from('posts').select('*').in('id', ids);
        this.salvos = ((salvosPosts ?? []) as Array<Record<string, unknown>>).map((p) => ({
          id: String(p['id']),
          texto: String(p['content'] ?? p['body'] ?? p['texto'] ?? p['text'] ?? ''),
          tempo: this.formatarDataPerfil(String(p['created_at'] ?? '')),
        }));
      }
      console.log('[perfil/RENDER] this.salvos.length =', this.salvos.length);
    } catch (e) {
      console.error('[perfil] Listas falharam:', e);
    }
  }

  // --- Tempo relativo (12h, 3d — espelha formatDate do original) ---
  private tempoRelativo(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso).getTime();
    if (isNaN(d)) return '';
    const diff = Date.now() - d;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const dias = Math.floor(h / 24);
    if (dias < 7) return `${dias}d`;
    return this.formatarDataPerfil(iso);
  }

  // --- Formata data para posts do perfil (DD/MM/YYYY HH:mm) ---
  private formatarDataPerfil(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  }

  // --- Troca de aba interna ---
  trocarAba(aba: string): void {
    this.abaInterna = aba;
  }

  // --- Respostas: comentários do alvo (reais; vazio se tabela/coluna não existir) ---
  respostas: Array<{ id: string; texto: string; tempo: string }> = [];

  private async carregarRespostas(): Promise<void> {
    const uid = this.perfilAlvoId;
    if (!uid || uid === 'local' || uid.startsWith('mock-')) return;
    const sb = this.supabase.getClient();
    for (const coluna of ['author_id', 'user_id']) {
      try {
        const { data, error } = await sb
          .from('comments')
          .select('*')
          .eq(coluna, uid)
          .limit(20);
        if (error) throw error;
        const linhas = ((data ?? []) as Array<Record<string, unknown>>).sort((a, b) =>
          String(b['created_at'] ?? '').localeCompare(String(a['created_at'] ?? '')),
        );
        console.log(`[perfil] Respostas via comments.${coluna}:`, linhas.length);
        this.respostas = linhas.map((c) => ({
          id: String(c['id']),
          texto: String(c['content'] ?? c['body'] ?? c['texto'] ?? c['text'] ?? ''),
          tempo: this.formatarDataPerfil(String(c['created_at'] ?? '')),
        }));
        console.log('[perfil/RENDER] this.respostas.length =', this.respostas.length);
        console.log('[perfil/RENDER] primeira resposta:', this.respostas[0]);
        return;
      } catch (e) {
        console.warn(`[perfil] comments.${coluna} falhou:`, e);
      }
    }
    this.respostas = [];
  }

  // --- Curtidas: posts curtidos pelo alvo (reais; vazio se tabela não existir) ---
  curtidas: Array<{ id: string; texto: string; tempo: string }> = [];

  private async carregarCurtidas(): Promise<void> {
    const uid = this.perfilAlvoId;
    if (!uid || uid === 'local' || uid.startsWith('mock-')) return;
    const sb = this.supabase.getClient();
    try {
      // Tentativa 1: join embutido
      try {
        const { data, error } = await sb
          .from('likes')
          .select('post_id, posts(*)')
          .eq('user_id', uid)
          .limit(20);
        if (error) throw error;
        const linhas = (data ?? []) as Array<Record<string, unknown>>;
        console.log('[perfil] Curtidas via likes join:', linhas.length);
        this.curtidas = linhas.map((l) => {
          const post = (l['posts'] ?? {}) as Record<string, unknown>;
          return {
            id: String(l['post_id'] ?? post['id'] ?? ''),
            texto: String(post['content'] ?? post['body'] ?? ''),
            tempo: this.formatarDataPerfil(String(post['created_at'] ?? '')),
          };
        });
        console.log('[perfil/RENDER] this.curtidas.length =', this.curtidas.length);
        return;
      } catch (joinErr) {
        console.warn('[perfil] likes join falhou, tentando ids:', joinErr);
      }
      // Tentativa 2: só ids + busca posts
      const { data, error } = await sb.from('likes').select('post_id').eq('user_id', uid).limit(20);
      if (error) throw error;
      const ids = ((data ?? []) as Array<Record<string, unknown>>).map((l) => String(l['post_id']));
      console.log('[perfil] Curtidas ids:', ids.length);
      if (!ids.length) {
        this.curtidas = [];
        return;
      }
      const { data: posts } = await sb.from('posts').select('*').in('id', ids);
      this.curtidas = ((posts ?? []) as Array<Record<string, unknown>>).map((p) => ({
        id: String(p['id']),
        texto: String(p['content'] ?? p['body'] ?? ''),
        tempo: this.formatarDataPerfil(String(p['created_at'] ?? '')),
      }));
      console.log('[perfil/RENDER] this.curtidas.length =', this.curtidas.length);
    } catch (e) {
      console.warn('[perfil] likes falhou:', e);
      this.curtidas = [];
    }
  }

  // --- Sonda de debug: rode no Console p/ ver os dados REAIS das tabelas ---
  // Uso: window.__debugPerfil('4ab296ca-99f9-4398-b14e-3401d6dd63b6')
  private exporSondaDebug(): void {
    try {
      const sb = this.supabase.getClient();
      (window as unknown as Record<string, unknown>)['__debugPerfil'] = async (uid?: string) => {
        const alvo = uid ?? this.perfilAlvoId;
        console.log('=== DEBUG PERFIL p/ uid:', alvo, '===');
        const tentativas: Array<[string, () => PromiseLike<unknown>]> = [
          ['profiles', () => sb.from('profiles').select('*').eq('id', String(alvo)).maybeSingle()],
          ['posts', () => sb.from('posts').select('*').eq('author_id', String(alvo)).limit(5)],
          ['comments', () => sb.from('comments').select('*').eq('author_id', String(alvo)).limit(5)],
          ['likes', () => sb.from('likes').select('*').eq('user_id', String(alvo)).limit(5)],
          ['saved_posts', () => sb.from('saved_posts').select('*').eq('user_id', String(alvo)).limit(5)],
          ['get_posts', () => sb.rpc('get_posts', { p_limit: 5, p_offset: 0 })],
        ];
        for (const [nome, fn] of tentativas) {
          try {
            const r = (await fn()) as { data?: unknown; error?: { code?: string; message?: string } };
            console.log(`[${nome}]`, r.error ? { ERRO: `${r.error.code}: ${r.error.message}` } : r.data);
          } catch (e) {
            console.log(`[${nome}] EXCEÇÃO:`, e);
          }
        }
        console.log('=== FIM DEBUG === (copie e cole tudo aqui no chat)');
      };
    } catch {
      // ignora
    }
  }

  // --- Mídia: posts próprios com imagem/vídeo (espelha filtro midia do perfil.js) ---
  get postsMidia(): typeof this.meusPosts {
    return this.meusPosts.filter((p) => p.imagem || p.video);
  }

  // --- Mensagens de aba vazia (espelha emptyMessageForTab do perfil.js) ---
  mensagemVazia(aba: string): string {
    switch (aba) {
      case 'posts': return 'Quando você postar, aparecerá aqui.';
      case 'respostas': return 'Nenhuma resposta ainda.';
      case 'midia': return 'Nenhuma mídia publicada ainda.';
      case 'curtidas': return 'Nenhuma curtida ainda.';
      case 'salvos': return 'Nenhum post salvo ainda — salve no fórum para vê-los aqui.';
      default: return '';
    }
  }

  // --- Compartilha o perfil (clipboard da URL atual) ---
  compartilhar(): void {
    void navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
  }

  // --- Estatísticas reais: posts + comments (espelha loadStats do perfil.js) ---
  private async carregarContribuicoes(): Promise<void> {
    const uid = this.perfilAlvoId;
    if (!uid || uid === 'local' || uid.startsWith('mock-')) return;
    try {
      const sb = this.supabase.getClient();
      const { count: pc } = await sb
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', uid)
        .eq('is_active', true);
      const { count: cc } = await sb
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', uid)
        .eq('is_active', true);
      this.contribuicoes = (pc ?? 0) + (cc ?? 0);
    } catch {
      // mantém contadores do perfil
    }
  }

  // --- Destaques: posts salvos como cards (espelha renderHighlights) ---
  private async carregarDestaques(): Promise<void> {
    await this.carregarContribuicoes();
    this.destaques = this.salvos.slice(0, 10).map((s) => {
      const post = this.meusPosts.find((p) => p.id === s.id);
      return {
        id: s.id,
        titulo: s.texto.length > 60 ? s.texto.slice(0, 60) + '...' : s.texto || 'Post salvo',
        imagem: post?.imagem,
      };
    });
  }

  // --- Quem seguir: outros perfis (MOCK + TODO; sem tabela follows no original) ---
  // TODO SUPABASE: tabela follows/seguidores quando existir; botão Seguir hoje é local.
  private async carregarSugestoes(): Promise<void> {
    try {
      const sb = this.supabase.getClient();
      const { data } = await sb.from('profiles').select('id, username, avatar_url').limit(6);
      const linhas = ((data ?? []) as Array<Record<string, unknown>>).filter(
        (p) => String(p['id']) !== this.perfilAlvoId,
      );
      if (!linhas.length) throw new Error('sem sugestões');
      this.sugestoesSeguir = linhas.slice(0, 4).map((p, i) => ({
        id: String(p['id'] ?? `s-${i}`),
        nome: String(p['username'] ?? 'Usuário'),
        username: '@' + String(p['username'] ?? 'usuario').toLowerCase(),
        avatar: (p['avatar_url'] as string) || 'img/foto-padrão.jpg',
      }));
    } catch {
      this.sugestoesSeguir = [
        { id: 's1', nome: 'Luti Christóforo', username: '@luti', avatar: 'img/foto-padrão.jpg' },
        { id: 's2', nome: 'David', username: '@david', avatar: 'img/foto-padrão.jpg' },
      ];
    }
  }

  estaSeguindo(id: string): boolean {
    return this.seguindoIds.has(id);
  }

  alternarSeguir(id: string): void {
    if (this.seguindoIds.has(id)) {
      this.seguindoIds.delete(id);
    } else {
      this.seguindoIds.add(id);
      this.seguindo += 1;
    }
  }

  // --- Preenche o formulário de edição ao abrir (espelha populateEditForm) ---
  abrirEdicao(): void {
    if (!this.ehMeuPerfil) return;
    this.previewAvatar = null;
    this.previewBanner = null;
    this.avatarArquivo = null;
    this.bannerArquivo = null;
    this.mostrarEdicao = true;
    setTimeout(() => {
      try {
        const root = this.host.nativeElement;
        const setVal = (sel: string, v: string) => {
          const el = root.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
          if (el) el.value = v;
        };
        setVal('#editName', this.nomePerfil === 'Carregando...' ? '' : this.nomePerfil);
        setVal('#editUsername', this.handlePerfil.replace('@', ''));
        setVal('#editBio', this.bioPerfil === 'Sem bio.' ? '' : this.bioPerfil);
        setVal('#editLocation', this.localizacao);
        setVal('#editLink', this.websiteLabel);
        const bio = (root.querySelector('#editBio') as HTMLTextAreaElement | null)?.value ?? '';
        if (this.contadorBio) this.contadorBio.nativeElement.textContent = String(bio.length);
      } catch {
        // ignora
      }
    });
  }

  corrigirAvatarSugestao(e: Event): void {
    (e.target as HTMLImageElement).src = 'img/foto-padrão.jpg';
  }
  aoDigitarBio(e: Event): void {
    const len = (e.target as HTMLTextAreaElement).value.length;
    if (this.contadorBio) this.contadorBio.nativeElement.textContent = String(len);
  }

  // --- Arquivos escolhidos: preview local imediato; upload no salvar ---
  aoEscolherAvatar(e: Event): void {
    const arquivo = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.avatarArquivo = arquivo;
    if (this.previewAvatar) URL.revokeObjectURL(this.previewAvatar);
    this.previewAvatar = arquivo ? URL.createObjectURL(arquivo) : null;
    this.cdr.detectChanges();
  }

  aoEscolherBanner(e: Event): void {
    const arquivo = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.bannerArquivo = arquivo;
    if (this.previewBanner) URL.revokeObjectURL(this.previewBanner);
    this.previewBanner = arquivo ? URL.createObjectURL(arquivo) : null;
    this.cdr.detectChanges();
  }

  selecionarMoldura(id: string): void {
    this.moldura = id;
  }

  fecharEdicao(): void {
    this.mostrarEdicao = false;
    if (this.previewAvatar) URL.revokeObjectURL(this.previewAvatar);
    if (this.previewBanner) URL.revokeObjectURL(this.previewBanner);
    this.previewAvatar = null;
    this.previewBanner = null;
    this.avatarArquivo = null;
    this.bannerArquivo = null;
  }

  // --- Salva edição: upload avatars + update profiles (espelha perfil.js) ---
  async salvarEdicao(nome: string, bio: string): Promise<void> {
    const root = this.host.nativeElement;
    const get = (sel: string) => (root.querySelector(sel) as HTMLInputElement | null)?.value.trim() ?? '';
    const username = get('#editUsername');
    const localizacao = get('#editLocation');
    const link = get('#editLink');
    try {
      const sb = this.supabase.getClient();
      const { data: sess } = await sb.auth.getSession();
      const uid = sess.session?.user.id ?? this.auth.getUsuarioAtual()?.id;
      if (!uid || uid === 'local') throw new Error('sem sessão');

      let avatarUrl: string | undefined;
      if (this.avatarArquivo) {
        const nomeArq = `${uid}/avatar-${Date.now()}`;
        const { error: upErr } = await sb.storage.from('avatars').upload(nomeArq, this.avatarArquivo, { upsert: true });
        if (upErr) throw upErr;
        const { data } = sb.storage.from('avatars').getPublicUrl(nomeArq);
        avatarUrl = data.publicUrl;
      }
      let bannerUrl: string | undefined;
      if (this.bannerArquivo) {
        const nomeArq = `${uid}/banner-${Date.now()}`;
        const { error: upErr } = await sb.storage.from('avatars').upload(nomeArq, this.bannerArquivo, { upsert: true });
        if (upErr) throw upErr;
        const { data } = sb.storage.from('avatars').getPublicUrl(nomeArq);
        bannerUrl = data.publicUrl;
      }

      const updates: Record<string, unknown> = {};
      if (nome.trim()) updates['username'] = nome.trim();
      if (username) updates['username'] = username;
      updates['bio'] = bio;
      if (localizacao) updates['location'] = localizacao;
      if (link) updates['link'] = link;
      if (avatarUrl) updates['avatar_url'] = avatarUrl;
      if (bannerUrl) updates['banner_url'] = bannerUrl;
      updates['frame'] = this.moldura;

      const { error: updateErr } = await sb.from('profiles').update(updates).eq('id', uid);
      if (updateErr) throw updateErr;

      if (nome.trim()) localStorage.setItem('userName', nome.trim());
      localStorage.setItem('userBio', bio);
      if (this.previewAvatar) URL.revokeObjectURL(this.previewAvatar);
      if (this.previewBanner) URL.revokeObjectURL(this.previewBanner);
      this.previewAvatar = null;
      this.previewBanner = null;
      this.avatarArquivo = null;
      this.bannerArquivo = null;
      await this.carregarPerfil();
      await this.carregarListas();
      this.mostrarToast('Perfil salvo com sucesso!');
    } catch (e) {
      console.warn('Save MOCK (profiles falhou):', e);
      if (nome.trim()) localStorage.setItem('userName', nome.trim());
      localStorage.setItem('userBio', bio);
      if (this.bioTexto) this.bioTexto.nativeElement.textContent = bio || 'Sem bio.';
      this.mostrarToast('Não foi possível salvar no servidor. Dados guardados localmente.', true);
    }
    this.mostrarEdicao = false;
    window.dispatchEvent(new StorageEvent('storage', { key: 'userName' }));
  }

  // --- Toast simples do perfil ---
  toastPerfil = '';
  toastPerfilErro = false;
  private toastPerfilTimer: ReturnType<typeof setTimeout> | null = null;

  mostrarToast(msg: string, erro = false): void {
    this.toastPerfil = msg;
    this.toastPerfilErro = erro;
    if (this.toastPerfilTimer) clearTimeout(this.toastPerfilTimer);
    this.toastPerfilTimer = setTimeout(() => {
      this.toastPerfil = '';
      this.cdr.detectChanges();
    }, 3000);
    this.cdr.detectChanges();
  }
}
