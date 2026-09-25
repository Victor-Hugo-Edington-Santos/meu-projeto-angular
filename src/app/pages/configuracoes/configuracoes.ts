import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

type Aba =
  | 'minhaConta'
  | 'perfil'
  | 'idioma'
  | 'privacidade'
  | 'aparencia'
  | 'acessibilidade'
  | 'notificacoes'
  | 'acolheria'
  | 'leitura';

interface Favorito {
  title?: string;
  author?: string;
  image?: string;
  url?: string;
}

interface LeituraAtual {
  title?: string;
  author?: string;
  chapter?: string;
  progress?: number;
  image?: string;
}

const AVATAR_PADRAO = 'img/foto-padrão.jpg';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrl: './configuracoes.css',
  templateUrl: './configuracoes.html',
})
export class Configuracoes implements OnInit, AfterViewInit, OnDestroy {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('avatarInput') avatarInput?: ElementRef<HTMLInputElement>;
  @ViewChild('bannerInput') bannerInput?: ElementRef<HTMLInputElement>;

  abaAtiva: Aba = 'minhaConta';
  busca = '';
  carregando = true;
  salvando = false;
  enviandoAvatar = false;

  // Perfil
  userId: string | null = null;
  nome = 'Utilizador';
  email = 'utilizador@email.com';
  telefone = '';
  bio = '';
  avatarUrl = AVATAR_PADRAO;
  bannerUrl = '';

  // Preferências
  idioma: 'pt' | 'en' | 'es' = 'pt';
  perfilPublico = true;
  mostrarAtividade = true;
  notifEventos = true;
  notifComunidade = true;
  leitura = {
    continueReading: true,
    readingMode: true,
    saveProgress: true,
    metadata: true,
    guideIndex: true,
  };
  darkMode = false;
  reduceMotion = false;
  dyslexiaFont = false;
  highlightLinks = false;
  tituloPagina = 'Configurações do Aplicativo';

  // Leitura / favoritos (local + Supabase quando disponível)
  favoritos: Favorito[] = [];
  leituraAtual: LeituraAtual | null = null;
  previews = {
    artigo: 'Nenhum artigo publicado',
    blog: 'Nenhum post publicado',
    guia: 'Nenhum guia publicado',
  };

  // Toast próprio
  toastMsg = '';
  toastErro = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Modal senha
  modalSenhaAberto = false;
  senhaAtual = '';
  novaSenha = '';
  verSenhaAtual = false;
  verNovaSenha = false;
  trocandoSenha = false;

  // Modal confirmação conta (substitui prompt/confirm)
  confirmAberto = false;
  confirmTitulo = '';
  confirmMensagem = '';
  confirmTexto = 'Confirmar';
  confirmDanger = false;
  confirmExigePalavra = false;
  confirmPalavra = '';
  private confirmResolve: ((v: boolean) => void) | null = null;

  private readonly onStorage = (e: StorageEvent): void => {
    if (!e.key) return;
    try {
      if (e.key === 'userName' && e.newValue) this.nome = e.newValue;
      if (e.key === 'userEmail' && e.newValue) this.email = e.newValue;
      if (e.key === 'userBio' && e.newValue !== null) this.bio = e.newValue;
      if (e.key === 'userAvatar' && e.newValue) this.avatarUrl = e.newValue;
      if (e.key === 'userLang' && (e.newValue === 'pt' || e.newValue === 'en' || e.newValue === 'es')) {
        this.aplicarIdioma(e.newValue, false);
      }
    } catch {
      // evento de storage malformado: ignora
    }
  };

  private readonly onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.modalSenhaAberto) this.fecharModalSenha();
      if (this.confirmAberto) this.resolverConfirm(false);
    }
  };

  async ngOnInit(): Promise<void> {
    this.lerPreferencias();
    this.lerLocais();
    // Preenchimento síncrono imediato (espelho local do AuthService):
    // a página nunca fica vazia mesmo se o Supabase travar.
    const sessaoLocal = this.auth.getUsuarioAtual();
    if (sessaoLocal) {
      if (sessaoLocal.nome) this.nome = sessaoLocal.nome;
      if (sessaoLocal.email) this.email = sessaoLocal.email;
      if (sessaoLocal.avatarUrl) this.avatarUrl = sessaoLocal.avatarUrl;
    }
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('keydown', this.onKeydown);
    // Timeout: se o Supabase pendurar (rede/DNS), libera a página com fallback local.
    try {
      await this.comTimeout(this.carregarPerfil(), 8000);
    } catch (e) {
      console.warn('[configuracoes] carga com fallback local:', e);
    } finally {
      this.carregando = false; // ← ESSENCIAL: sempre libera o loading
    }
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

  ngAfterViewInit(): void {
    // Rede de segurança: mesmo que ngOnInit trave antes do finally,
    // o loading é liberado aqui (não depende de Promise alguma).
    setTimeout(() => {
      if (this.carregando) {
        console.warn('[configuracoes] safety-net: liberando loading travado');
        this.carregando = false;
      }
    }, 10000);
    // Listeners nativos (search + fallback Enter) — removidos no OnDestroy
    const input = this.searchInput?.nativeElement;
    if (input) {
      input.addEventListener('input', this.onSearchNative);
    }
    this.aplicarAcessibilidade();
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('keydown', this.onKeydown);
    this.searchInput?.nativeElement?.removeEventListener('input', this.onSearchNative);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private readonly onSearchNative = (e: Event): void => {
    const v = (e.target as HTMLInputElement)?.value ?? '';
    this.busca = v;
    const primeira = this.abasFiltradas()[0];
    if (v.trim() && primeira && primeira.id !== this.abaAtiva) this.abaAtiva = primeira.id;
  };

  // ---------- Abas ----------

  trocarAba(aba: Aba): void {
    this.abaAtiva = aba;
  }

  abasFiltradas(): Array<{ id: Aba; rotulo: string; icone: string }> {
    const todas: Array<{ id: Aba; rotulo: string; icone: string }> = [
      { id: 'minhaConta', rotulo: 'Minha Conta', icone: 'fa-solid fa-user' },
      { id: 'perfil', rotulo: 'Perfil', icone: 'fa-solid fa-id-card' },
      { id: 'idioma', rotulo: 'Idioma', icone: 'fa-solid fa-language' },
      { id: 'privacidade', rotulo: 'Privacidade e Segurança', icone: 'fa-solid fa-shield-alt' },
      { id: 'aparencia', rotulo: 'Aparência', icone: 'fa-solid fa-palette' },
      { id: 'acessibilidade', rotulo: 'Acessibilidade', icone: 'fa-solid fa-universal-access' },
      { id: 'notificacoes', rotulo: 'Notificações', icone: 'fa-solid fa-bell' },
      { id: 'acolheria', rotulo: 'AcolherIA', icone: 'fa-solid fa-robot' },
      { id: 'leitura', rotulo: 'Leitura', icone: 'fa-solid fa-book-open-reader' },
    ];
    const q = this.busca.trim().toLowerCase();
    if (!q) return todas;
    return todas.filter((t) => t.rotulo.toLowerCase().includes(q));
  }

  abaVisivel(id: Aba): boolean {
    return this.abasFiltradas().some((t) => t.id === id);
  }

  // ---------- Toast ----------

  mostrarToast(msg: string, erro = false): void {
    this.toastMsg = msg;
    this.toastErro = erro;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMsg = '';
    }, 3000);
  }

  private tratarErroHttp(origem: string, err: unknown): void {
    const status = (err as { status?: number; code?: string })?.status;
    const code = String((err as { code?: string })?.code ?? '');
    if (status === 401 || code === '401' || code === 'PGRST301') {
      this.mostrarToast('Sessão expirada. Entre novamente.', true);
      void this.router.navigate(['/login']);
      return;
    }
    if (status === 403 || code === '42501') {
      this.mostrarToast('Sem permissão para esta ação.', true);
      return;
    }
    const msg = err instanceof Error ? err.message : 'Erro inesperado.';
    console.warn(`[configuracoes] ${origem}:`, err);
    this.mostrarToast(`${origem}: ${msg}`, true);
  }

  // ---------- Preferências em localStorage (gs/ss do original) ----------

  private gs(k: string, fb: string): string {
    try {
      return localStorage.getItem('a11y_' + k) ?? localStorage.getItem(k) ?? fb;
    } catch {
      return fb;
    }
  }

  private ss(k: string, v: string): void {
    try {
      localStorage.setItem('a11y_' + k, v);
    } catch {
      // storage bloqueado: segue em memória
    }
  }

  private lerPreferencias(): void {
    this.darkMode = this.gs('darkMode', 'false') === 'true';
    this.reduceMotion = this.gs('reduceMotion', 'false') === 'true';
    this.dyslexiaFont = this.gs('dyslexiaFont', 'false') === 'true';
    this.highlightLinks = this.gs('highlightLinks', 'false') === 'true';
    const lang = this.gs('userLang', 'pt');
    this.idioma = lang === 'en' || lang === 'es' ? lang : 'pt';
    try {
      const nE = localStorage.getItem('notifications_eventNotificationsToggle');
      const nC = localStorage.getItem('notifications_communityNotificationsToggle');
      if (nE !== null) this.notifEventos = nE === 'true';
      if (nC !== null) this.notifComunidade = nC === 'true';
      const pub = localStorage.getItem('privacy_publicProfile');
      const atv = localStorage.getItem('privacy_showActivity');
      if (pub !== null) this.perfilPublico = pub === 'true';
      if (atv !== null) this.mostrarAtividade = atv === 'true';
      (Object.keys(this.leitura) as Array<keyof typeof this.leitura>).forEach((k) => {
        const v = localStorage.getItem(`reading_${k}`);
        if (v !== null) this.leitura[k] = v === 'true';
      });
    } catch {
      // storage bloqueado: mantém defaults
    }
    this.aplicarIdioma(this.idioma, false);
  }

  private lerLocais(): void {
    try {
      this.nome = localStorage.getItem('userName') || this.nome;
      this.email = localStorage.getItem('userEmail') || this.email;
      this.bio = localStorage.getItem('userBio') || '';
      this.avatarUrl = localStorage.getItem('userAvatar') || AVATAR_PADRAO;
      this.favoritos = JSON.parse(localStorage.getItem('favoriteContents') || '[]') as Favorito[];
      const atual = localStorage.getItem('currentReading');
      this.leituraAtual = atual ? (JSON.parse(atual) as LeituraAtual) : null;
    } catch {
      this.favoritos = [];
      this.leituraAtual = null;
    }
  }

  private persistirLocais(): void {
    try {
      localStorage.setItem('userName', this.nome);
      localStorage.setItem('userEmail', this.email);
      localStorage.setItem('userBio', this.bio);
      localStorage.setItem('userAvatar', this.avatarUrl);
      localStorage.setItem('userLang', this.idioma);
      const mapa = JSON.parse(localStorage.getItem('userAvatarsMap') || '{}') as Record<string, string>;
      mapa[this.email.toLowerCase()] = this.avatarUrl;
      localStorage.setItem('userAvatarsMap', JSON.stringify(mapa));
    } catch {
      // storage bloqueado: segue em memória
    }
  }

  // ---------- Perfil real (Supabase) com fallback MOCK ----------

  private async carregarPerfil(): Promise<void> {
    try {
      const { data } = await this.supabase.getClient().auth.getSession();
      const user = data.session?.user;
      if (!user) {
        this.carregando = false;
        this.mostrarToast('Você precisa estar logado.', true);
        void this.router.navigate(['/login']);
        return;
      }
      this.userId = user.id;
      this.email = user.email ?? this.email;

      try {
        // maybeSingle: não explode quando a linha ainda não existe (PGRST116).
        const { data: perfil, error } = await this.supabase
          .getClient()
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          const code = String((error as { code?: string })?.code ?? '');
          if (code === 'PGRST116') {
            // Usuário logado sem linha em profiles: cria automaticamente (best-effort).
            try {
              await this.supabase
                .getClient()
                .from('profiles')
                .insert({
                  id: user.id,
                  username: (user.user_metadata?.['first_name'] as string) || this.nome,
                  bio: '',
                  avatar_url: (user.user_metadata?.['avatar_url'] as string) || AVATAR_PADRAO,
                  updated_at: new Date().toISOString(),
                });
            } catch (insErr) {
              console.warn('[configuracoes] auto-criação de perfil falhou:', insErr);
            }
          } else {
            throw error;
          }
        }
        const p = perfil as {
          username?: string;
          full_name?: string;
          bio?: string;
          avatar_url?: string;
          banner_url?: string;
          phone?: string;
          public_profile?: boolean;
          show_activity?: boolean;
        } | null;
        if (p) {
          this.nome =
            p.username || p.full_name || (user.user_metadata?.['first_name'] as string) || this.nome;
          this.bio = p.bio ?? this.bio;
          this.avatarUrl = p.avatar_url || (user.user_metadata?.['avatar_url'] as string) || AVATAR_PADRAO;
          this.bannerUrl = p.banner_url || '';
          if (typeof p.phone === 'string' && p.phone) this.telefone = p.phone;
          if (typeof p.public_profile === 'boolean') this.perfilPublico = p.public_profile;
          if (typeof p.show_activity === 'boolean') this.mostrarAtividade = p.show_activity;
        }
      } catch (err) {
        // Tabela indisponível / RLS / offline: usa metadados + localStorage (MOCK)
        const meta = user.user_metadata ?? {};
        if (typeof meta['first_name'] === 'string' && meta['first_name']) this.nome = meta['first_name'];
        if (typeof meta['avatar_url'] === 'string' && meta['avatar_url']) this.avatarUrl = meta['avatar_url'];
        if ((err as { status?: number })?.status === 401) {
          this.tratarErroHttp('Carregar perfil', err);
          return;
        }
        console.warn('[configuracoes] perfil via fallback local:', err);
      }
      this.persistirLocais();
      void this.carregarPreviews();
    } catch (err) {
      this.tratarErroHttp('Carregar perfil', err);
    }
  }

  async salvarPerfil(): Promise<void> {
    const nomeLimpo = this.nome.trim() || this.nome;
    const bioLimpa = this.bio.trim();
    this.salvando = true;
    let salvouBanco = false;
    try {
      const { data } = await this.supabase.getClient().auth.getUser();
      const user = data.user;
      if (!user) {
        this.mostrarToast('Você precisa estar logado.', true);
        void this.router.navigate(['/login']);
        return;
      }
      try {
        const { error } = await this.supabase
          .getClient()
          .from('profiles')
          .update({
            username: nomeLimpo,
            bio: bioLimpa,
            phone: this.telefone,
            public_profile: this.perfilPublico,
            show_activity: this.mostrarAtividade,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        if (error) throw error;
        salvouBanco = true;
      } catch (err) {
        this.tratarErroHttp('Salvar perfil', err);
      }
      try {
        await this.supabase.getClient().auth.updateUser({
          data: { first_name: nomeLimpo, username: nomeLimpo, bio: bioLimpa },
        });
      } catch (err) {
        console.warn('[configuracoes] metadados não atualizados:', err);
      }
      this.nome = nomeLimpo;
      this.bio = bioLimpa;
      this.auth.atualizarUsuarioLocal({ nome: nomeLimpo, avatarUrl: this.avatarUrl });
      this.persistirLocais();
      this.mostrarToast(
        salvouBanco ? 'Perfil salvo com sucesso.' : 'Perfil atualizado localmente (offline).',
        !salvouBanco,
      );
    } catch (err) {
      this.tratarErroHttp('Salvar perfil', err);
    } finally {
      this.salvando = false;
    }
  }

  // ---------- Uploads (avatars + banners) ----------

  abrirSeletorAvatar(): void {
    if (!this.avatarInput?.nativeElement) {
      this.mostrarToast('Seletor de arquivo indisponível.', true);
      return;
    }
    this.avatarInput.nativeElement.click();
  }

  abrirSeletorBanner(): void {
    this.bannerInput?.nativeElement?.click();
  }

  async onAvatarSelecionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.enviandoAvatar = true;
    this.mostrarToast('Enviando imagem...');
    try {
      const { data } = await this.supabase.getClient().auth.getUser();
      const user = data.user;
      if (!user) {
        this.mostrarToast('Você precisa estar logado.', true);
        void this.router.navigate(['/login']);
        return;
      }
      const ext = file.name.split('.').pop() || 'png';
      const path = `profiles/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await this.supabase.getClient().storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: urlData } = this.supabase.getClient().storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      try {
        const { error } = await this.supabase
          .getClient()
          .from('profiles')
          .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (error) throw error;
      } catch (err) {
        this.tratarErroHttp('Salvar avatar', err);
      }
      try {
        await this.supabase.getClient().auth.updateUser({ data: { avatar_url: publicUrl } });
      } catch (err) {
        console.warn('[configuracoes] metadados de avatar não atualizados:', err);
      }
      this.avatarUrl = publicUrl;
      this.auth.atualizarUsuarioLocal({ avatarUrl: publicUrl });
      this.persistirLocais();
      this.mostrarToast('Foto de perfil salva com sucesso.');
    } catch (err) {
      this.tratarErroHttp('Enviar avatar', err);
    } finally {
      this.enviandoAvatar = false;
    }
  }

  async onBannerSelecionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.mostrarToast('Enviando banner...');
    try {
      const { data } = await this.supabase.getClient().auth.getUser();
      const user = data.user;
      if (!user) {
        this.mostrarToast('Você precisa estar logado.', true);
        void this.router.navigate(['/login']);
        return;
      }
      const ext = file.name.split('.').pop() || 'png';
      const path = `banners/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await this.supabase.getClient().storage.from('banners').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: urlData } = this.supabase.getClient().storage.from('banners').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      try {
        const { error } = await this.supabase
          .getClient()
          .from('profiles')
          .update({ banner_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (error) throw error;
      } catch (err) {
        this.tratarErroHttp('Salvar banner', err);
      }
      this.bannerUrl = publicUrl;
      this.mostrarToast('Banner atualizado.');
    } catch (err) {
      this.tratarErroHttp('Enviar banner', err);
    }
  }

  async removerAvatar(): Promise<void> {
    try {
      const { data } = await this.supabase.getClient().auth.getUser();
      if (data.user) {
        try {
          const { error } = await this.supabase
            .getClient()
            .from('profiles')
            .update({ avatar_url: AVATAR_PADRAO, updated_at: new Date().toISOString() })
            .eq('id', data.user.id);
          if (error) throw error;
        } catch (err) {
          this.tratarErroHttp('Remover avatar', err);
        }
        try {
          await this.supabase.getClient().auth.updateUser({ data: { avatar_url: AVATAR_PADRAO } });
        } catch (err) {
          console.warn('[configuracoes] metadados não atualizados:', err);
        }
      }
      this.avatarUrl = AVATAR_PADRAO;
      this.auth.atualizarUsuarioLocal({ avatarUrl: AVATAR_PADRAO });
      this.persistirLocais();
      this.mostrarToast('Avatar restaurado para o padrão.');
    } catch (err) {
      this.tratarErroHttp('Remover avatar', err);
    }
  }

  onAvatarErro(): void {
    if (this.avatarUrl !== AVATAR_PADRAO) this.avatarUrl = AVATAR_PADRAO;
  }

  // ---------- Idioma ----------

  aplicarIdioma(lang: 'pt' | 'en' | 'es', avisar = true): void {
    this.idioma = lang;
    try {
      localStorage.setItem('userLang', lang);
      localStorage.setItem('a11y_userLang', lang);
    } catch {
      // segue em memória
    }
    try {
      document.documentElement.lang = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt-BR';
    } catch {
      // SSR/DOM indisponível
    }
    this.tituloPagina =
      lang === 'en' ? 'Application Settings' : lang === 'es' ? 'Ajustes de la aplicación' : 'Configurações do Aplicativo';
    if (avisar) {
      this.mostrarToast(lang === 'en' ? 'Language: English' : lang === 'es' ? 'Idioma: Español' : 'Idioma: Português');
    }
  }

  // ---------- Acessibilidade / Aparência ----------

  alternarAcessibilidade(chave: 'darkMode' | 'reduceMotion' | 'dyslexiaFont' | 'highlightLinks'): void {
    if (chave === 'darkMode') this.darkMode = !this.darkMode;
    if (chave === 'reduceMotion') this.reduceMotion = !this.reduceMotion;
    if (chave === 'dyslexiaFont') this.dyslexiaFont = !this.dyslexiaFont;
    if (chave === 'highlightLinks') this.highlightLinks = !this.highlightLinks;
    this.ss('darkMode', String(this.darkMode));
    this.ss('reduceMotion', String(this.reduceMotion));
    this.ss('dyslexiaFont', String(this.dyslexiaFont));
    this.ss('highlightLinks', String(this.highlightLinks));
    this.aplicarAcessibilidade();
    this.mostrarToast('Preferência de acessibilidade atualizada.');
  }

  ajustarTexto(dir: 1 | -1): void {
    try {
      const atual = Number(localStorage.getItem('a11y_textScale') || '100');
      const proximo = Math.min(130, Math.max(85, atual + dir * 5));
      localStorage.setItem('a11y_textScale', String(proximo));
      document.documentElement.style.fontSize = `${(16 * proximo) / 100}px`;
      this.mostrarToast(`Tamanho do texto: ${proximo}%`);
    } catch {
      this.mostrarToast('Não foi possível ajustar o texto.', true);
    }
  }

  resetarAcessibilidade(): void {
    this.darkMode = false;
    this.reduceMotion = false;
    this.dyslexiaFont = false;
    this.highlightLinks = false;
    this.ss('darkMode', 'false');
    this.ss('reduceMotion', 'false');
    this.ss('dyslexiaFont', 'false');
    this.ss('highlightLinks', 'false');
    try {
      localStorage.removeItem('a11y_textScale');
      document.documentElement.style.fontSize = '';
    } catch {
      // ignora
    }
    this.aplicarAcessibilidade();
    this.mostrarToast('Acessibilidade restaurada.');
  }

  private aplicarAcessibilidade(): void {
    try {
      document.body.classList.toggle('a11y-dark-mode', this.darkMode);
      document.body.classList.toggle('a11y-reduce-motion', this.reduceMotion);
      document.body.classList.toggle('a11y-dyslexia', this.dyslexiaFont);
      document.body.classList.toggle('a11y-highlight-links', this.highlightLinks);
    } catch {
      // DOM indisponível
    }
  }

  statusA11y(ativo: boolean): string {
    return ativo ? 'Ativo' : 'Inativo';
  }

  // ---------- Toggles persistidos ----------

  salvarNotificacoes(): void {
    try {
      localStorage.setItem('notifications_eventNotificationsToggle', String(this.notifEventos));
      localStorage.setItem('notifications_communityNotificationsToggle', String(this.notifComunidade));
    } catch {
      // ignora
    }
    this.mostrarToast('Preferências de notificação salvas.');
  }

  salvarPrivacidade(): void {
    try {
      localStorage.setItem('privacy_publicProfile', String(this.perfilPublico));
      localStorage.setItem('privacy_showActivity', String(this.mostrarAtividade));
    } catch {
      // ignora
    }
    this.mostrarToast('Privacidade atualizada.');
  }

  salvarLeitura(chave: keyof typeof this.leitura): void {
    try {
      localStorage.setItem(`reading_${chave}`, String(this.leitura[chave]));
    } catch {
      // ignora
    }
  }

  // ---------- Modal senha ----------

  abrirModalSenha(): void {
    this.senhaAtual = '';
    this.novaSenha = '';
    this.modalSenhaAberto = true;
  }

  fecharModalSenha(): void {
    this.modalSenhaAberto = false;
    this.senhaAtual = '';
    this.novaSenha = '';
  }

  async trocarSenha(): Promise<void> {
    if (!this.senhaAtual || !this.novaSenha) {
      this.mostrarToast('Preencha a senha atual e a nova.', true);
      return;
    }
    if (this.novaSenha.length < 6) {
      this.mostrarToast('A nova senha deve ter pelo menos 6 caracteres.', true);
      return;
    }
    this.trocandoSenha = true;
    try {
      const { error } = await this.supabase.getClient().auth.updateUser({ password: this.novaSenha });
      if (error) throw error;
      this.fecharModalSenha();
      this.mostrarToast('Senha atualizada.');
    } catch (err) {
      this.tratarErroHttp('Trocar senha', err);
    } finally {
      this.trocandoSenha = false;
    }
  }

  // ---------- Conta: desativar / excluir ----------

  private pedirConfirmacao(opts: {
    titulo: string;
    mensagem: string;
    texto?: string;
    danger?: boolean;
    exigePalavra?: boolean;
  }): Promise<boolean> {
    this.confirmTitulo = opts.titulo;
    this.confirmMensagem = opts.mensagem;
    this.confirmTexto = opts.texto || 'Confirmar';
    this.confirmDanger = opts.danger || false;
    this.confirmExigePalavra = opts.exigePalavra || false;
    this.confirmPalavra = '';
    this.confirmAberto = true;
    return new Promise<boolean>((resolve) => {
      this.confirmResolve = resolve;
    });
  }

  resolverConfirm(valor: boolean): void {
    if (this.confirmExigePalavra && valor && this.confirmPalavra.trim().toUpperCase() !== 'EXCLUIR') {
      this.mostrarToast('Exclusão cancelada. A palavra digitada não confere.', true);
      valor = false;
    }
    this.confirmAberto = false;
    this.confirmResolve?.(valor);
    this.confirmResolve = null;
  }

  async desativarConta(): Promise<void> {
    const ok = await this.pedirConfirmacao({
      titulo: 'Desativar conta?',
      mensagem:
        'Sua conta ficará invisível para outros usuários e você não poderá fazer login. Você poderá reativá-la depois entrando em contato com o suporte. Deseja continuar?',
      texto: 'Desativar',
    });
    if (!ok) return;
    try {
      this.mostrarToast('Desativando conta...');
      const { data } = await this.supabase.getClient().auth.getUser();
      if (!data.user) {
        this.mostrarToast('Você precisa estar logado.', true);
        void this.router.navigate(['/login']);
        return;
      }
      try {
        const { error } = await this.supabase.getClient().rpc('deactivate_account', { p_reason: null });
        if (error) throw error;
      } catch (rpcErr) {
        const code = String((rpcErr as { code?: string })?.code ?? '');
        if (code === '42883' || code === 'PGRST202') {
          const { error: upErr } = await this.supabase
            .getClient()
            .from('profiles')
            .update({
              is_active: false,
              deactivated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', data.user.id);
          if (upErr) throw upErr;
        } else {
          throw rpcErr;
        }
      }
      this.mostrarToast('Conta desativada. Saindo...');
      setTimeout(() => {
        void this.auth.logout();
        void this.router.navigate(['/login']);
      }, 1200);
    } catch (err) {
      this.tratarErroHttp('Desativar conta', err);
    }
  }

  async excluirConta(): Promise<void> {
    const ok = await this.pedirConfirmacao({
      titulo: 'Excluir conta permanentemente?',
      mensagem:
        'Esta ação é irreversível. Para confirmar, digite EXCLUIR no campo abaixo e confirme. Todos os seus dados serão apagados.',
      texto: 'Sim, excluir',
      danger: true,
      exigePalavra: true,
    });
    if (!ok) return;
    this.mostrarToast('Exclusão solicitada. Entre em contato com o suporte para concluir.', true);
  }

  async sair(): Promise<void> {
    await this.auth.logout();
    void this.router.navigate(['/login']);
  }

  irParaPerfil(): void {
    this.trocarAba('perfil');
  }

  // ---------- Leitura / favoritos (best-effort) ----------

  private async carregarPreviews(): Promise<void> {
    try {
      const artigo = await this.buscarConteudo(['articles', 'artigos']);
      const blog = await this.buscarConteudo(['blog_posts', 'blog', 'posts']);
      const guia = await this.buscarConteudo(['guides', 'guias']);
      if (artigo) this.previews.artigo = this.tituloDe(artigo);
      if (blog) this.previews.blog = this.tituloDe(blog);
      if (guia) this.previews.guia = this.tituloDe(guia);
    } catch {
      // previews seguem com fallback local
    }
  }

  private async buscarConteudo(tabelas: string[]): Promise<Record<string, unknown> | null> {
    for (const t of tabelas) {
      try {
        const { data, error } = await this.supabase.getClient().from(t).select('*').limit(1);
        if (!error && Array.isArray(data) && data[0]) return data[0] as Record<string, unknown>;
      } catch {
        // tenta próxima tabela
      }
    }
    return null;
  }

  private tituloDe(c: Record<string, unknown>): string {
    for (const k of ['title', 'name', 'titulo']) {
      const v = c[k];
      if (typeof v === 'string' && v) return v;
    }
    return 'Conteúdo recente';
  }

  get progressoLeitura(): number {
    const p = Number(this.leituraAtual?.progress ?? 0);
    return Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));
  }
}
