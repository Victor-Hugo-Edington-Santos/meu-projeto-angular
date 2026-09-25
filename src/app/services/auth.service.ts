import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';

// --- Modelo público usado pelo resto do app (inalterado) ---
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string;
}

// --- Chaves idênticas às do original (auth-global.js + login.js) ---
const KEY_LOGGED_IN = 'userLoggedIn';
const KEY_NAME = 'userName';
const KEY_EMAIL = 'userEmail';
const KEY_AVATAR = 'userAvatar';
const KEY_ROLE = 'userRole';
const KEY_AVATAR_HISTORY = 'userAvatarsMap';
const AVATAR_PADRAO = 'img/foto-padrão.jpg';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // mesma regex do "esqueci senha" (login.js)

@Injectable({ providedIn: 'root' })
export class AuthService {
  // --- Estado reativo da sessão ---
  private readonly usuarioSubject = new BehaviorSubject<Usuario | null>(null);
  readonly usuario$: Observable<Usuario | null> = this.usuarioSubject.asObservable();

  constructor(private readonly supabase: SupabaseService) {
    // --- Restaura a sessão real e escuta mudanças (login/logout/outras abas) ---
    void this.restaurarSessao();
    this.supabase
      .getClient()
      .auth.onAuthStateChange((_evento, sessao) => {
        void this.aplicarSessao(sessao?.user ?? null);
      });
  }

  // --- Leitura síncrona atual ---
  getUsuarioAtual(): Usuario | null {
    return this.usuarioSubject.value;
  }

  /**
   * Atualiza o espelho local após o perfil salvar avatar/nome.
   * Mantém sidebar, avatar da comunidade e demais telas em sincronia.
   */
  atualizarUsuarioLocal(updates: Partial<Usuario>): void {
    const atual = this.usuarioSubject.value;
    if (!atual) return;
    this.persistirSessao({ ...atual, ...updates });
  }

  // --- Equivale ao isLoggedIn() do auth-global.js ---
  estaLogado(): boolean {
    return this.usuarioSubject.value !== null;
  }

  // --- Login real via Supabase (mesmas validações/mensagens do login.js) ---
  async login(email: string, senha: string): Promise<{ sucesso: boolean; erro?: string }> {
    const e = email.trim();

    if (!e || !senha) return { sucesso: false, erro: 'Preencha todos os campos.' };
    if (!EMAIL_REGEX.test(e)) return { sucesso: false, erro: 'Digite um e-mail válido.' };

    try {
      const { data, error } = await this.supabase
        .getClient()
        .auth.signInWithPassword({ email: e, password: senha });
      if (error) return { sucesso: false, erro: this.traduzirErroAuth(error.message) };
      if (!data.user) return { sucesso: false, erro: 'Erro ao entrar: resposta vazia.' };

      await this.aplicarSessao(data.user);
      return { sucesso: true };
    } catch (err) {
      // Sem rede/CORS: fallback MOCK local para teste (qualquer email + 6+ chars)
      console.warn('[AUTH] Modo MOCK ativo — Supabase indisponível:', err);
      if (senha.length < 6) return { sucesso: false, erro: 'A senha deve ter pelo menos 6 caracteres.' };
      const usuario: Usuario = {
        id: `mock-${Date.now()}`,
        nome: e.split('@')[0],
        email: e,
        avatarUrl: this.buscarFotoNoHistorico(e) ?? AVATAR_PADRAO,
      };
      localStorage.setItem('authMock', 'true');
      this.persistirSessao(usuario);
      return { sucesso: true };
    }
  }

  // --- Mensagens claras para os erros conhecidos do Supabase Auth ---
  private traduzirErroAuth(mensagem: string): string {
    if (/failed to fetch|networkerror|load failed/i.test(mensagem)) {
      return 'Não foi possível conectar. Verifique sua internet ou aguarde a liberação do servidor.';
    }
    if (/invalid login credentials/i.test(mensagem)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(mensagem)) return 'Confirme seu e-mail antes de fazer login.';
    return mensagem;
  }

  // --- Cadastro real via Supabase ---
  // (a checagem "senhas coincidem" fica na página de login, que tem o campo confirmar)
  async cadastro(nome: string, email: string, senha: string): Promise<{ sucesso: boolean; erro?: string }> {
    const n = nome.trim();
    const e = email.trim();

    if (!n || !e || !senha) return { sucesso: false, erro: 'Preencha todos os campos obrigatórios.' };
    if (!EMAIL_REGEX.test(e)) return { sucesso: false, erro: 'Digite um e-mail válido.' };
    if (senha.length < 6) return { sucesso: false, erro: 'A senha deve ter pelo menos 6 caracteres.' };

    const { data, error } = await this.supabase.getClient().auth.signUp({
      email: e,
      password: senha,
      options: { data: { first_name: n, avatar_url: AVATAR_PADRAO } },
    });
    if (error) return { sucesso: false, erro: 'Erro ao cadastrar: ' + error.message };
    if (!data.user) return { sucesso: false, erro: 'Erro ao cadastrar: resposta vazia.' };

    await this.aplicarSessao(data.user);
    return { sucesso: true };
  }

  // --- Logout com a mesma confirmação do auth-global.js (cancela sem deslogar) ---
  async logout(): Promise<void> {
    if (!confirm('Tem certeza que deseja sair da sua conta?')) return;

    try {
      await this.supabase.getClient().auth.signOut();
    } catch (e) {
      console.warn('Falha no signOut (limpeza local mantida):', e);
    }
    this.limparSessaoLocal();
    this.usuarioSubject.next(null);
  }

  // --- Restaura sessão salva pelo Supabase (refresh token) ---
  private async restaurarSessao(): Promise<void> {
    try {
      const { data } = await this.supabase.getClient().auth.getSession();
      await this.aplicarSessao(data.session?.user ?? null);
    } catch (e) {
      console.warn('Falha ao restaurar sessão:', e);
      this.usuarioSubject.next(this.lerSessaoLocal());
    }
  }

  // --- Monta o Usuario a partir do user Supabase + perfil (tabela profiles) ---
  private async aplicarSessao(user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null): Promise<void> {
    if (!user?.email) {
      this.usuarioSubject.next(this.lerSessaoLocal());
      return;
    }

    const meta = user.user_metadata ?? {};
    let nome = (meta['first_name'] as string) || (meta['nome'] as string) || user.email.split('@')[0];
    let avatar: string | undefined =
      (meta['avatar_url'] as string) || this.buscarFotoNoHistorico(user.email) || undefined;

    // Perfil da tabela 'profiles' (espelha login.js + loja.js initAuth)
    try {
      const { data: perfil } = await this.supabase
        .getClient()
        .from('profiles')
        .select('username, full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (perfil) {
        const p = perfil as { username?: string; full_name?: string; avatar_url?: string };
        nome = p.username || p.full_name || nome;
        if (p.avatar_url) avatar = p.avatar_url;
      }
    } catch (e) {
      console.warn('Perfil não carregado (segue com metadados):', e);
    }

    const usuario: Usuario = { id: user.id, nome, email: user.email, avatarUrl: avatar ?? AVATAR_PADRAO };
    this.persistirSessao(usuario);
    if (avatar) this.salvarFotoNoHistorico(user.email, avatar);
  }

  // --- Reconstrói o Usuario das chaves locais (fallback offline) ---
  private lerSessaoLocal(): Usuario | null {
    if (localStorage.getItem(KEY_LOGGED_IN) !== 'true') return null;
    const email = localStorage.getItem(KEY_EMAIL);
    if (!email) return null;
    return {
      id: 'local',
      nome: localStorage.getItem(KEY_NAME) || email.split('@')[0],
      email,
      avatarUrl: localStorage.getItem(KEY_AVATAR) ?? AVATAR_PADRAO,
    };
  }

  // --- Grava as mesmas chaves do original para compat com a UI existente ---
  // LGPD: salvo no localStorage apenas id (implícito), nome, email e avatar.
  // NUNCA salvamos senha, token ou dados sensíveis aqui — a sessão real
  // fica com o Supabase (refresh token próprio); isto é só espelho de UI.
  private persistirSessao(u: Usuario): void {
    localStorage.setItem(KEY_LOGGED_IN, 'true');
    localStorage.setItem(KEY_NAME, u.nome);
    localStorage.setItem(KEY_EMAIL, u.email);
    localStorage.setItem(KEY_AVATAR, u.avatarUrl ?? AVATAR_PADRAO);
    localStorage.setItem(KEY_ROLE, 'user');
    this.usuarioSubject.next(u);
  }

  private limparSessaoLocal(): void {
    localStorage.removeItem(KEY_LOGGED_IN);
    localStorage.removeItem(KEY_NAME);
    localStorage.removeItem(KEY_EMAIL);
    localStorage.removeItem(KEY_AVATAR);
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem('authMock');
  }

  // --- Histórico local email→avatar (salvarFotoNoHistoricoLocal do login.js) ---
  private salvarFotoNoHistorico(email: string, avatarUrl: string): void {
    try {
      const mapa = JSON.parse(localStorage.getItem(KEY_AVATAR_HISTORY) || '{}');
      mapa[email.toLowerCase()] = avatarUrl;
      localStorage.setItem(KEY_AVATAR_HISTORY, JSON.stringify(mapa));
    } catch {
      // Espelha o original: falha no histórico não quebra o fluxo
    }
  }

  // --- Histórico local email→avatar (buscarFotoNoHistoricoLocal do login.js) ---
  private buscarFotoNoHistorico(email: string): string | null {
    try {
      const mapa = JSON.parse(localStorage.getItem(KEY_AVATAR_HISTORY) || '{}');
      return mapa[email.toLowerCase()] || null;
    } catch {
      return null;
    }
  }
}
