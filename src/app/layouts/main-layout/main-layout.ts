import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, Usuario } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

// --- Shell compartilhado: sidebar + header + hub + auth + AcolherIA (movido do Home) ---
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-main-layout',
  standalone: true,
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout implements AfterViewInit, OnDestroy {
  // --- Referências aos elementos do sidebar ---
  @ViewChild('sidebarToggleBtn') sidebarToggleBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('sidebar') sidebar!: ElementRef<HTMLElement>;
  @ViewChild('sidebarOverlay') sidebarOverlay!: ElementRef<HTMLElement>;
  @ViewChild('profileToggle') profileToggle!: ElementRef<HTMLButtonElement>;
  @ViewChild('profileDetail') profileDetail!: ElementRef<HTMLElement>;

  // --- Referências ao header com efeito de scroll ---
  @ViewChild('headerGlass') headerGlass!: ElementRef<HTMLElement>;

  // --- Referências ao hub flutuante de ajuda ---
  @ViewChild('floatingHubToggle') floatingHubToggle!: ElementRef<HTMLButtonElement>;
  @ViewChild('floatingHubMenu') floatingHubMenu!: ElementRef<HTMLElement>;
  @ViewChild('floatingOverlay') floatingOverlay!: ElementRef<HTMLElement>;

  // --- Só estas rotas exigem login (feed e páginas públicas são livres) ---
  private readonly rotasProtegidas = ['/comunidade/perfil', '/configuracoes'];

  // --- Handlers do sidebar (guardados para remover no OnDestroy) ---
  private onToggleSidebarClick = (e: Event) => {
    e.stopPropagation();
    this.toggleSidebar();
  };
  private onOverlayClick = () => this.closeSidebar();
  private onProfileToggleClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const detail = this.profileDetail.nativeElement;
    const toggle = this.profileToggle.nativeElement;
    const isHidden = detail.hasAttribute('hidden');
    if (isHidden) {
      detail.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      detail.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };
  // --- Fecha o perfil ao clicar fora de .sidebar-profile (idêntico ao original) ---
  private onDocumentClickCloseProfile = (e: MouseEvent) => {
    const container = document.querySelector('.sidebar-profile');
    if (container && !container.contains(e.target as Node)) {
      this.profileDetail?.nativeElement.setAttribute('hidden', '');
      this.profileToggle?.nativeElement.setAttribute('aria-expanded', 'false');
    }
  };
  // --- Fecha o sidebar com ESC apenas se estiver aberto (idêntico ao original) ---
  private onSidebarEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.sidebar?.nativeElement.classList.contains('open')) {
      this.closeSidebar();
    }
  };
  // --- Re-sincroniza perfil quando outra aba altera o localStorage ---
  private onStorageSync = (e: StorageEvent) => {
    if (e.key === 'userAvatar' || e.key === 'userName' || e.key === 'userEmail') {
      this.syncProfile();
    }
  };

  // --- Liga/desliga .scrolled conforme scrollY > 50 (idêntico ao original) ---
  private onWindowScroll = () => {
    this.headerGlass?.nativeElement.classList.toggle('scrolled', window.scrollY > 50);
  };

  // --- Handlers do hub flutuante (guardados para remover no OnDestroy) ---
  private onHubToggleClick = (e: Event) => {
    e.stopPropagation();
    this.toggleHub();
  };
  private onHubOverlayClick = () => this.closeHub();
  private onHubEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.closeHub();
  };

  // --- Assinatura reativa da sessão (desassinada no OnDestroy) ---
  private authSub: Subscription | null = null;

  // --- Reaplica cadeados a cada navegação (páginas entram via outlet depois) ---
  private navSub: Subscription | null = null;
  private breadcrumbRenderTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Botão "Sair" criado no header quando logado (espelha auth-global) ---
  private headerLogoutBtn: HTMLAnchorElement | null = null;

  // --- Elementos do modal AcolherIA (resolvidos por query, HTML intacto) ---
  private acolheriaOverlay: HTMLElement | null = null;
  private acolheriaOverlayBg: HTMLElement | null = null;
  private acolheriaClose: HTMLElement | null = null;
  private acolheriaInput: HTMLTextAreaElement | null = null;
  private acolheriaSend: HTMLElement | null = null;
  private acolheriaChatBody: HTMLElement | null = null;
  private acolheriaSuggestions: HTMLElement | null = null;
  private acolheriaSuggestionBtns: HTMLElement[] = [];
  private acolheriaFocusTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Intercepta clique em link com cadeado (captura, como no original) ---
  private onDocumentoClickCadeado = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest?.('a.is-locked') as HTMLAnchorElement | null;
    if (!link || !this.host.nativeElement.contains(link)) return;
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Faça login para acessar esta área. Ir para o login?')) {
      void this.router.navigate(['/login']);
    }
  };

  // --- Clique no #logoutBtn da sidebar: sai (logado) ou vai ao login ---
  private onLogoutBtnClick = (e: Event) => {
    e.preventDefault();
    // Deslogado: navega para a página de login da SPA
    if (!this.auth.estaLogado()) {
      void this.router.navigate(['/login']);
      return;
    }
    // Logado: o próprio AuthService confirma ('Tem certeza que deseja sair...?');
    // sem confirm duplo aqui. Só navega se o logout realmente ocorreu.
    void this.auth.logout().then(() => {
      if (!this.auth.estaLogado()) void this.router.navigate(['/login']);
    });
  };

  // --- Handlers do modal AcolherIA (guardados para remover no OnDestroy) ---
  // Intercepta links para /chat-Ia ou /Chat-Ia (header, footer, hub) e abre o modal
  private onAcolheriaOpenCapture = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || !this.host.nativeElement.contains(link)) return;
    if (!/chat-ia\/chat-ia\.html$/i.test(link.getAttribute('href') ?? '')) return;
    e.preventDefault();
    e.stopPropagation();
    this.openAcolheria();
  };
  private onAcolheriaCloseClick = () => this.closeAcolheria();
  private onAcolheriaBgClick = () => this.closeAcolheria();
  private onAcolheriaEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.acolheriaOverlay && !this.acolheriaOverlay.hidden) {
      this.closeAcolheria();
    }
  };
  private onAcolheriaSendClick = () => void this.enviarMensagemAcolheria();
  private onAcolheriaInputKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void this.enviarMensagemAcolheria();
    }
  };
  // Auto-resize do textarea até 100px (idêntico ao original)
  private onAcolheriaInputAutoresize = () => {
    if (!this.acolheriaInput) return;
    this.acolheriaInput.style.height = 'auto';
    this.acolheriaInput.style.height = Math.min(this.acolheriaInput.scrollHeight, 100) + 'px';
  };
  // Sugestão: preenche o input com o data-prompt e envia
  private onAcolheriaSuggestionClick = (e: Event) => {
    const btn = e.currentTarget as HTMLElement;
    const prompt = btn.getAttribute('data-prompt') || btn.textContent?.trim() || '';
    if (this.acolheriaInput && prompt) {
      this.acolheriaInput.value = prompt;
      void this.enviarMensagemAcolheria();
    }
  };

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly viewportScroller: ViewportScroller,
    private readonly supabase: SupabaseService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  // --- Inicializa o shell após a view existir ---
  ngAfterViewInit(): void {
    this.renderizarBreadcrumb(this.router.url);
    window.addEventListener('pagina-trilha', this.onTrilhaExtra);
    this.initSidebar();
    this.initHeaderScroll();
    this.initFloatingHub();
    this.initAuth();
    this.initAcolheria();
  }

  // --- Limpa listeners e assinaturas do shell ---
  ngOnDestroy(): void {
    window.removeEventListener('pagina-trilha', this.onTrilhaExtra);
    // Sidebar
    this.sidebarToggleBtn?.nativeElement.removeEventListener('click', this.onToggleSidebarClick);
    this.sidebarOverlay?.nativeElement.removeEventListener('click', this.onOverlayClick);
    this.profileToggle?.nativeElement.removeEventListener('click', this.onProfileToggleClick);
    document.removeEventListener('click', this.onDocumentClickCloseProfile);
    document.removeEventListener('keydown', this.onSidebarEsc);
    window.removeEventListener('storage', this.onStorageSync);
    // Header + hub
    window.removeEventListener('scroll', this.onWindowScroll);
    this.floatingHubToggle?.nativeElement.removeEventListener('click', this.onHubToggleClick);
    this.floatingOverlay?.nativeElement.removeEventListener('click', this.onHubOverlayClick);
    document.removeEventListener('keydown', this.onHubEsc);
    // Auth
    this.authSub?.unsubscribe();
    this.authSub = null;
    this.navSub?.unsubscribe();
    this.navSub = null;
    if (this.breadcrumbRenderTimer) clearTimeout(this.breadcrumbRenderTimer);
    this.breadcrumbRenderTimer = null;
    document.removeEventListener('click', this.onDocumentoClickCadeado, true);
    this.host.nativeElement
      .querySelector('#logoutBtn')
      ?.removeEventListener('click', this.onLogoutBtnClick);
    this.headerLogoutBtn?.removeEventListener('click', this.onLogoutBtnClick);
    this.headerLogoutBtn = null;
    // AcolherIA
    document.removeEventListener('click', this.onAcolheriaOpenCapture, true);
    this.acolheriaClose?.removeEventListener('click', this.onAcolheriaCloseClick);
    this.acolheriaOverlayBg?.removeEventListener('click', this.onAcolheriaBgClick);
    document.removeEventListener('keydown', this.onAcolheriaEsc);
    this.acolheriaSend?.removeEventListener('click', this.onAcolheriaSendClick);
    this.acolheriaInput?.removeEventListener('keydown', this.onAcolheriaInputKeydown);
    this.acolheriaInput?.removeEventListener('input', this.onAcolheriaInputAutoresize);
    this.acolheriaSuggestionBtns.forEach((b) =>
      b.removeEventListener('click', this.onAcolheriaSuggestionClick),
    );
    this.acolheriaSuggestionBtns = [];
    if (this.acolheriaFocusTimer) clearTimeout(this.acolheriaFocusTimer);
    this.acolheriaFocusTimer = null;
  }

  // =============================================
  // SIDEBAR (espelha sidebar.js)
  // =============================================

  // --- Liga toggle, overlay, perfil, ESC, sync e storage ---
  private initSidebar(): void {
    if (!this.sidebar) return;

    // Click no botão abre/fecha (com stopPropagation)
    this.sidebarToggleBtn?.nativeElement.addEventListener('click', this.onToggleSidebarClick);

    // Click no overlay fecha
    this.sidebarOverlay?.nativeElement.addEventListener('click', this.onOverlayClick);

    // Fecha com ESC (só se aberto)
    document.addEventListener('keydown', this.onSidebarEsc);

    // Perfil colapsável + fechar ao clicar fora
    if (this.profileToggle && this.profileDetail) {
      this.profileToggle.nativeElement.addEventListener('click', this.onProfileToggleClick);
      document.addEventListener('click', this.onDocumentClickCloseProfile);
    }

    // Sincroniza nome/email/avatar do localStorage + observa outras abas
    this.syncProfile();
    window.addEventListener('storage', this.onStorageSync);
  }

  // --- Abre: class "open" + overlay "active" + trava scroll + aria ---
  private openSidebar(): void {
    if (!this.sidebar) return;
    this.sidebar.nativeElement.classList.add('open');
    this.sidebarOverlay?.nativeElement.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.sidebarToggleBtn?.nativeElement.setAttribute('aria-expanded', 'true');
  }

  // --- Fecha: remove classes + libera scroll + aria ---
  private closeSidebar(): void {
    if (!this.sidebar) return;
    this.sidebar.nativeElement.classList.remove('open');
    this.sidebarOverlay?.nativeElement.classList.remove('active');
    document.body.style.overflow = '';
    this.sidebarToggleBtn?.nativeElement.setAttribute('aria-expanded', 'false');
  }

  // --- Alterna conforme presença da class "open" ---
  private toggleSidebar(): void {
    if (!this.sidebar) return;
    if (this.sidebar.nativeElement.classList.contains('open')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  // --- Lê userName/userEmail/userAvatar do localStorage (idêntico ao original) ---
  private syncProfile(): void {
    const savedName = localStorage.getItem('userName');
    const savedEmail = localStorage.getItem('userEmail');
    const savedAvatar = localStorage.getItem('userAvatar');

    const avatar = document.getElementById('sidebarAvatar') as HTMLImageElement | null;
    const userName = document.getElementById('sidebarUserName');
    const userEmail = document.getElementById('sidebarUserEmail');

    if (avatar && savedAvatar) {
      avatar.src = savedAvatar;
      avatar.onerror = () => { avatar.src = 'img/foto-padrão.jpg'; };
    }
    if (userName && savedName) userName.textContent = savedName;
    if (userEmail && savedEmail) userEmail.textContent = savedEmail;
  }

  // =============================================
  // HEADER SCROLL (espelha inicio.js:469-477)
  // =============================================

  // --- Ouve o scroll da janela e reflete no header ---
  private initHeaderScroll(): void {
    if (!this.headerGlass) return;
    window.addEventListener('scroll', this.onWindowScroll);
  }

  // =============================================
  // HUB FLUTUANTE (espelha inicio.js:316-347)
  // =============================================

  // --- Liga toggle, overlay e ESC do hub ---
  private initFloatingHub(): void {
    if (!this.floatingHubToggle || !this.floatingHubMenu || !this.floatingOverlay) return;

    // Click no "?" abre/fecha (com stopPropagation)
    this.floatingHubToggle.nativeElement.addEventListener('click', this.onHubToggleClick);

    // Click no overlay fecha
    this.floatingOverlay.nativeElement.addEventListener('click', this.onHubOverlayClick);

    // ESC fecha
    document.addEventListener('keydown', this.onHubEsc);
  }

  // --- Alterna menu + overlay (hidden) e aria-expanded ---
  private toggleHub(): void {
    const menu = this.floatingHubMenu.nativeElement;
    const overlay = this.floatingOverlay.nativeElement;
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    overlay.hidden = isOpen;
    this.floatingHubToggle.nativeElement.setAttribute('aria-expanded', String(!isOpen));
  }

  // --- Fecha menu + overlay e marca aria-expanded false ---
  private closeHub(): void {
    this.floatingHubMenu.nativeElement.hidden = true;
    this.floatingOverlay.nativeElement.hidden = true;
    this.floatingHubToggle.nativeElement.setAttribute('aria-expanded', 'false');
  }

  // =============================================
  // AUTH (espelha auth-global.js:55-220)
  // =============================================

  // --- Breadcrumb: trilha clicável (Início > Seção > Sub) + nome da página atual ---
  paginaAtual = 'Início';
  trilha: Array<{ rotulo: string; url: string | null }> = [{ rotulo: 'Início', url: null }];
  // Rótulo extra vindo da página (ex: perfil informa o @username via evento 'pagina-trilha')
  private rotuloExtra: string | null = null;

  private readonly onTrilhaExtra = (e: Event) => {
    const rotulo = (e as CustomEvent<string>).detail;
    this.rotuloExtra = typeof rotulo === 'string' && rotulo ? rotulo : null;
    this.renderizarBreadcrumb(this.router.url);
  };

  private renderizarBreadcrumb(url: string): void {
    this.atualizarBreadcrumb(url);
    this.cdr.detectChanges();
    if (this.breadcrumbRenderTimer) clearTimeout(this.breadcrumbRenderTimer);
    this.breadcrumbRenderTimer = setTimeout(() => {
      this.breadcrumbRenderTimer = null;
      this.cdr.detectChanges();
    }, 0);
  }

  private atualizarBreadcrumb(url: string): void {
    const base = url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    const segs = base
      .split('/')
      .filter(Boolean)
      .map((segmento) => {
        try {
          return decodeURIComponent(segmento);
        } catch {
          return segmento;
        }
      });

    const inicio: { rotulo: string; url: string | null } = { rotulo: 'Início', url: '/' };
    if (!segs.length) {
      this.trilha = [inicio];
      this.paginaAtual = 'Início';
      return;
    }

    // O UUID é apenas o identificador da rota. Nunca deve aparecer no breadcrumb.
    const ehRotaPerfil = segs[0] === 'comunidade' && segs[1] === 'perfil';
    if (ehRotaPerfil) {
      const id = segs[2];
      const trilha: Array<{ rotulo: string; url: string | null }> = [
        inicio,
        { rotulo: 'Comunidade', url: '/comunidade' },
        { rotulo: 'Perfil', url: null },
      ];

      if (!id) {
        // Perfil próprio sem :id.
        trilha.push({ rotulo: 'Meu Perfil', url: null });
      } else if (this.rotuloExtra?.trim()) {
        // O PerfilComponent publica @username depois de carregar os dados.
        const usuario = this.rotuloExtra.trim();
        trilha.push({
          rotulo: usuario.startsWith('@') ? usuario : '@' + usuario.replace(/^@+/, ''),
          url: null,
        });
      }
      // Enquanto o username não chega, mantém somente ... > Perfil.
      this.trilha = trilha;
      this.paginaAtual = trilha[trilha.length - 1].rotulo;
      return;
    }

    const trilha: Array<{ rotulo: string; url: string | null }> = [inicio];
    let acumulado = '';
    segs.forEach((s, i) => {
      // Evita expor qualquer UUID em rotas futuras que não tenham um rótulo próprio.
      if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s)) return;
      acumulado += '/' + s;
      const ultimo = i === segs.length - 1;
      trilha.push({ rotulo: this.nomeSegmento(s), url: ultimo ? null : acumulado });
    });
    this.trilha = trilha.length > 1 ? trilha : [inicio];
    this.paginaAtual = this.trilha[this.trilha.length - 1].rotulo;
  }

  private nomeSegmento(s: string): string {
    const mapa: Record<string, string> = {
      explorar: 'Explorar',
      comunidade: 'Comunidade',
      perfil: 'Perfil',
      direitos: 'Seus Direitos',
      arquivo3leis: 'Arquivo 3 Leis',
      blog: 'Blog',
      'post-masking': 'Post',
      recursos: 'Recursos',
      loja: 'Loja',
      apoiar: 'Apoiar',
      configuracoes: 'Configurações',
      eventos: 'Eventos',
      grupos: 'Grupos',
      moderacao: 'Moderação',
      sac: 'SAC',
      login: 'Login',
      'redefinir-senha': 'Redefinir Senha',
      'politica-privacidade': 'Política de Privacidade',
      'termos-de-uso': 'Termos de Uso',
      'painel-admin': 'Painel Admin',
    };
    if (mapa[s]) return mapa[s];
    try {
      const dec = decodeURIComponent(s);
      return dec.charAt(0).toUpperCase() + dec.slice(1);
    } catch {
      return s;
    }
  }

  // --- Assina usuario$ e liga intercept de cadeado + logout ---
  private initAuth(): void {
    // Reage a login/logout atualizando header, sidebar e cadeados
    this.authSub = this.auth.usuario$.subscribe((u) => this.refreshAuthUI(u));

    // Reaplica cadeados a cada navegação (páginas entram pelo outlet depois)
    // + fecha o sidebar e volta ao topo (SPA não recarrega como o site antigo)
    // + atualiza o breadcrumb com o nome da página atual
    this.navSub = this.router.events.subscribe((ev) => {
      if (!(ev instanceof NavigationEnd)) return;
      this.refreshAuthUI(this.auth.getUsuarioAtual());
      // Limpa rótulo de página anterior (ex: @ de outro perfil); a página nova reenvia se preciso
      this.rotuloExtra = null;
      this.renderizarBreadcrumb(ev.urlAfterRedirects);
      this.closeSidebar();
      this.viewportScroller.scrollToPosition([0, 0]);
    });

    // Intercepta clique em links com cadeado (captura, como no original)
    document.addEventListener('click', this.onDocumentoClickCadeado, true);

    // Botão Sair/Entrar da sidebar
    this.host.nativeElement
      .querySelector('#logoutBtn')
      ?.addEventListener('click', this.onLogoutBtnClick);
  }

  // --- Redesenha header + sidebar + cadeados a cada emissão de usuario$ ---
  private refreshAuthUI(u: Usuario | null): void {
    const root = this.host.nativeElement;
    const logado = !!u;

    // --- Header dinâmico: Entrar/Criar visíveis só deslogado; Sair só logado ---
    const nav = root.querySelector('.nav-actions');
    const entrar = nav?.querySelector('a.btn-text:not(#headerLogoutBtn)') as HTMLElement | null;
    const criar = nav?.querySelector('a.btn-primary') as HTMLElement | null;
    const sair = this.ensureHeaderLogoutBtn();
    if (entrar) entrar.style.display = logado ? 'none' : '';
    if (criar) criar.style.display = logado ? 'none' : '';
    if (sair) sair.style.display = logado ? '' : 'none';

    // --- Sidebar: nome/email/avatar do usuário ou padrões de visitante ---
    const nomeEl = root.querySelector('#sidebarUserName');
    const emailEl = root.querySelector('#sidebarUserEmail');
    const avatarEl = root.querySelector('#sidebarAvatar') as HTMLImageElement | null;
    if (nomeEl) nomeEl.textContent = u?.nome ?? 'Visitante';
    if (emailEl) emailEl.textContent = u?.email ?? 'carregando@email.com';
    if (avatarEl && u?.avatarUrl) {
      avatarEl.src = u.avatarUrl;
      avatarEl.onerror = () => { avatarEl.src = 'img/foto-padrão.jpg'; };
    }

    // --- Botão da sidebar vira Sair (logado) ou Entrar (deslogado) ---
    const logoutBtn = root.querySelector('#logoutBtn') as HTMLAnchorElement | null;
    if (logoutBtn) {
      logoutBtn.innerHTML = logado
        ? '<i class="fa-solid fa-arrow-right-from-bracket"></i> Sair'
        : '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
      logoutBtn.setAttribute('href', logado ? '#' : '/login');
    }

    // --- Cadeados só para visitantes ---
    this.aplicarCadeados(logado);
  }

  // --- Cria uma vez o botão Sair no header (reaproveita nas próximas) ---
  private ensureHeaderLogoutBtn(): HTMLAnchorElement | null {
    if (this.headerLogoutBtn) return this.headerLogoutBtn;
    const nav = this.host.nativeElement.querySelector('.nav-actions');
    if (!nav) return null;
    const btn = document.createElement('a');
    btn.id = 'headerLogoutBtn';
    btn.href = '#';
    btn.className = 'btn-text';
    btn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Sair';
    btn.addEventListener('click', this.onLogoutBtnClick);
    nav.appendChild(btn);
    this.headerLogoutBtn = btn;
    return btn;
  }

  // --- Marca/desmarca .is-locked nos links de rotas protegidas ---
  private aplicarCadeados(logado: boolean): void {
    const links = this.host.nativeElement.querySelectorAll('a[href]');
    links.forEach((link) => {
      const a = link as HTMLAnchorElement;
      // Botões de auth do header/sidebar nunca levam cadeado
      if (a.id === 'headerLogoutBtn' || a.id === 'logoutBtn') return;
      if (!this.isRotaProtegida(a.getAttribute('href'))) return;

      if (logado) {
        // Libera: restaura href original e remove o cadeado visual
        a.classList.remove('is-locked');
        a.removeAttribute('aria-disabled');
        a.removeAttribute('tabindex');
        if (a.dataset['originalHref']) {
          a.setAttribute('href', a.dataset['originalHref']);
          delete a.dataset['originalHref'];
        }
        a.querySelector('.lock-icon')?.remove();
      } else {
        // Bloqueia: guarda href, desabilita e pendura o cadeado (uma vez só)
        if (!a.dataset['originalHref']) a.dataset['originalHref'] = a.getAttribute('href') ?? '';
        a.classList.add('is-locked');
        a.setAttribute('aria-disabled', 'true');
        a.setAttribute('tabindex', '-1');
        if (!a.querySelector('.lock-icon')) {
          const lock = document.createElement('i');
          lock.className = 'fa-solid fa-lock lock-icon';
          lock.setAttribute('aria-hidden', 'true');
          a.appendChild(lock);
        }
      }
    });
  }

  // --- Substring case-insensitive, como o isProtectedRoute original ---
  private isRotaProtegida(href: string | null): boolean {
    if (!href) return false;
    const lower = href.toLowerCase();
    return this.rotasProtegidas.some((r) => lower.includes(r));
  }

  // =============================================
  // ACOLHERIA (espelha Acolher-IA.js:12-336, MOCK)
  // =============================================

  // --- Resolve elementos e liga abrir/fechar/envio/sugestões ---
  private initAcolheria(): void {
    const root = this.host.nativeElement;
    this.acolheriaOverlay = root.querySelector('#acolheriaOverlay');
    this.acolheriaOverlayBg = root.querySelector('#acolheriaOverlayBg');
    this.acolheriaClose = root.querySelector('#acolheriaClose');
    this.acolheriaInput = root.querySelector('#acolheriaInput');
    this.acolheriaSend = root.querySelector('#acolheriaSend');
    this.acolheriaChatBody = root.querySelector('#acolheriaChatBody');
    this.acolheriaSuggestions = root.querySelector('#acolheriaSuggestions');
    if (!this.acolheriaOverlay || !this.acolheriaChatBody) return;

    // Abrir via links /chat-Ia e /Chat-Ia (captura, antes da navegação)
    document.addEventListener('click', this.onAcolheriaOpenCapture, true);

    // Fechar via X, fundo e ESC
    this.acolheriaClose?.addEventListener('click', this.onAcolheriaCloseClick);
    this.acolheriaOverlayBg?.addEventListener('click', this.onAcolheriaBgClick);
    document.addEventListener('keydown', this.onAcolheriaEsc);

    // Envio via botão, Enter e auto-resize
    this.acolheriaSend?.addEventListener('click', this.onAcolheriaSendClick);
    this.acolheriaInput?.addEventListener('keydown', this.onAcolheriaInputKeydown);
    this.acolheriaInput?.addEventListener('input', this.onAcolheriaInputAutoresize);

    // Sugestões com data-prompt
    this.acolheriaSuggestionBtns = Array.from(root.querySelectorAll('.acolheria-suggestion'));
    this.acolheriaSuggestionBtns.forEach((b) =>
      b.addEventListener('click', this.onAcolheriaSuggestionClick),
    );
  }

  // --- Abre: mostra overlays, trava scroll, boas-vindas se vazio, foca input ---
  private openAcolheria(): void {
    if (!this.acolheriaOverlay || !this.acolheriaOverlayBg || !this.acolheriaChatBody) return;
    this.acolheriaOverlay.hidden = false;
    this.acolheriaOverlayBg.hidden = false;
    document.body.style.overflow = 'hidden';

    // Boas-vindas só na primeira abertura (mantém histórico da sessão)
    if (this.acolheriaChatBody.children.length === 0) {
      this.addMensagemAcolheria(this.getMensagemBoasVindas(), false);
    }

    if (this.acolheriaFocusTimer) clearTimeout(this.acolheriaFocusTimer);
    this.acolheriaFocusTimer = setTimeout(() => this.acolheriaInput?.focus(), 400);
  }

  // --- Fecha: esconde overlays, libera scroll, limpa input e typing ---
  private closeAcolheria(): void {
    if (!this.acolheriaOverlay || !this.acolheriaOverlayBg) return;
    this.acolheriaOverlay.hidden = true;
    this.acolheriaOverlayBg.hidden = true;
    document.body.style.overflow = '';
    if (this.acolheriaInput) {
      this.acolheriaInput.value = '';
      this.acolheriaInput.style.height = 'auto';
    }
    this.removeDigitandoAcolheria();
  }

  // --- Texto de boas-vindas idêntico ao getModalWelcomeMessage original ---
  private getMensagemBoasVindas(): string {
    return `💜 **Bem-vinde à AcolherIA!**

Eu sou a assistente virtual do projeto **Amor NeuroDivergente** — uma comunidade dedicada a apoiar pessoas neurodivergentes (TDAH, autismo, dislexia, AHSD e outras variações neurológicas).

**O que você pode perguntar:**
 TDAH e Autismo (TEA)
 Direitos e legislação
 Organização e produtividade
 Crises sensoriais e regulação
 Diagnóstico e avaliação
 Terapias e tratamentos
 Neurodiversidade em geral

**Vamos conversar?** Me faça qualquer pergunta sobre neurodiversidade! 💜`;
  }

  // --- Insere bolha usuário/IA com a mesma estrutura e formatação do original ---
  private addMensagemAcolheria(text: string, isUser: boolean): void {
    if (!this.acolheriaChatBody) return;

    const msg = document.createElement('div');
    msg.className = `acolheria-msg${isUser ? ' acolheria-msg-user' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'acolheria-avatar';
    avatar.innerHTML = isUser ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

    const bubble = document.createElement('div');
    bubble.className = 'acolheria-bubble';
    bubble.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    this.acolheriaChatBody.appendChild(msg);

    // Auto-scroll para o final
    const body = this.acolheriaChatBody;
    setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
  }

  // --- Bolha "digitando..." com os 3 pontos animados ---
  private showDigitandoAcolheria(): void {
    if (!this.acolheriaChatBody) return;
    this.removeDigitandoAcolheria();
    const typing = document.createElement('div');
    typing.className = 'acolheria-msg acolheria-typing';
    typing.id = 'acolheriaTypingIndicator';
    typing.innerHTML = `
      <div class="acolheria-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="acolheria-bubble"><span>● ● ●</span></div>`;
    this.acolheriaChatBody.appendChild(typing);
    this.acolheriaChatBody.scrollTop = this.acolheriaChatBody.scrollHeight;
  }

  private removeDigitandoAcolheria(): void {
    document.getElementById('acolheriaTypingIndicator')?.remove();
  }

  // --- Fluxo de envio: esconde sugestões, bolha user, typing, resposta, scroll ---
  private async enviarMensagemAcolheria(): Promise<void> {
    if (!this.acolheriaInput) return;
    const text = this.acolheriaInput.value.trim();
    if (!text) return;

    // Esconde as sugestões após a primeira mensagem
    if (this.acolheriaSuggestions) this.acolheriaSuggestions.style.display = 'none';

    this.addMensagemAcolheria(text, true);
    this.acolheriaInput.value = '';
    this.acolheriaInput.style.height = 'auto';
    this.showDigitandoAcolheria();

    try {
      const resposta = await this.obterRespostaIA(text);
      this.removeDigitandoAcolheria();
      this.addMensagemAcolheria(resposta, false);
    } catch {
      this.removeDigitandoAcolheria();
      this.addMensagemAcolheria('💜 Desculpe, tive um pequeno problema. Pode repetir sua pergunta?', false);
    }
  }

  // --- Resposta real via edge function 'acolheria' ({ message } → { answer }) ---
  // Verificado em supabase/functions/acolheria/index.ts do projeto original.
  private async obterRespostaIA(texto: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.getClient().functions.invoke('acolheria', {
        body: { message: texto },
      });
      if (error) throw error;
      const resposta = (data as { answer?: string } | null)?.answer?.trim();
      if (!resposta) throw new Error('resposta vazia');
      return resposta;
    } catch (e) {
      console.warn('AcolherIA real falhou, usando MOCK:', e);
      return this.respostaMock(texto);
    }
  }

  // --- MOCK por palavra-chave (fallback offline) ---
  private async respostaMock(texto: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 800));
    const msg = texto.toLowerCase();

    if (msg.includes('tdah')) {
      return `💜 **TDAH de forma simples**\n\nO TDAH envolve desatenção, hiperatividade e impulsividade em graus variados. Estratégias que ajudam: dividir tarefas em passos pequenos, usar timers, reduzir distrações visuais e ter rotinas previsíveis.\n\nQuer dicas de **organização** ou de **regulação** em momentos difíceis?`;
    }
    if (msg.includes('autismo') || msg.includes('tea')) {
      return `💜 **Autismo de forma simples**\n\nO autismo (TEA) é uma variação neurológica que afeta comunicação, interação social e processamento sensorial — cada pessoa é única. Respeitar o ritmo, oferecer previsibilidade e aceitar estímulos (stims) faz diferença.\n\nPosso falar sobre **crises sensoriais** ou **direitos** também.`;
    }
    if (msg.includes('crise') || msg.includes('sensorial')) {
      return `💜 **Em uma crise sensorial**\n\n1. Reduza estímulos: luz, som e toques.\n2. Vá para um lugar previsível e seguro.\n3. Use um objeto de conforto ou stim que acalme.\n4. Respire devagar, sem pressa de "voltar ao normal".\n\nSe puder, avise alguém de confiança sobre o que te ajuda. 💜`;
    }
    if (msg.includes('direito')) {
      return `💜 **Seus direitos**\n\nPessoas neurodivergentes têm direitos garantidos em saúde, educação e trabalho — como adaptações, atendimento prioritário e benefícios específicos. Veja a seção **Seus Direitos** aqui no site para o guia traduzido sem juridiquês.`;
    }
    if (msg.includes('organiz') || msg.includes('produtiv') || msg.includes('procrastin')) {
      return `💜 **Organização sem culpa**\n\n1. Uma tarefa por vez, em blocos curtos.\n2. Listas visuais (papel ou app simples).\n3. Método dos 5 minutos: comece só por 5.\n4. Celebre concluir, não a perfeição.\n\nQuer uma rotina de exemplo para o seu dia?`;
    }
    if (msg.includes('desabaf')) {
      return `💜 **Estou aqui com você**\n\nPode desabafar no seu ritmo, sem pressa e sem julgamento. O que você sente é válido — às vezes só colocar em palavras já alivia um pouco.\n\nQuando quiser, me conta o que está pesando hoje. 💜`;
    }
    return `Ainda estou aprendendo sobre isso. Pode reformular ou escolher um dos temas?`;
  }
}
