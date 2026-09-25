import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

type Estado = 'pedido' | 'enviado' | 'validando' | 'redefinir' | 'erro';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-redefinir-senha',
  styleUrl: './redefinir-senha.css',
  templateUrl: './redefinir-senha.html',
})
export class RedefinirSenha implements OnInit, OnDestroy {
  estado: Estado = 'pedido';
  email = '';
  novaSenha = '';
  confirmarSenha = '';
  mostrarNova = false;
  mostrarConf = false;
  carregando = false;
  private sub: { unsubscribe: () => void } | undefined;

  // Base do <base href> (ex: /amor-neurodivergente no GitHub Pages) p/ URLs absolutas
  private basePath(): string {
    try {
      const href = document.querySelector('base')?.getAttribute('href') ?? '/';
      return href === '/' ? '' : href.replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    // Se chegou com token de recovery no hash, o SDK abre sessão PASSWORD_RECOVERY
    this.sub = this.supabase
      .getClient()
      .auth.onAuthStateChange((evento) => {
        if (evento === 'PASSWORD_RECOVERY') this.estado = 'redefinir';
      }).data.subscription;
    // Fallback: há sessão válida? então permite redefinir; senão fica no pedido
    void this.supabase
      .getClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session && this.estado === 'pedido' && window.location.hash.includes('type=recovery')) {
          this.estado = 'redefinir';
        }
      })
      .catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async enviarLink(): Promise<void> {
    const email = this.email.trim();
    if (!email) {
      this.toast('Digite seu e-mail.', 'error');
      return;
    }
    this.carregando = true;
    try {
      const { error } = await this.supabase
        .getClient()
        .auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${this.basePath()}/redefinir-senha`,
        });
      if (error) throw error;
      this.estado = 'enviado';
    } catch (e) {
      console.warn('resetPasswordForEmail falhou:', e);
      this.toast('Não foi possível enviar. Tente novamente.', 'error');
    } finally {
      this.carregando = false;
    }
  }

  async salvarNovaSenha(): Promise<void> {
    if (this.novaSenha !== this.confirmarSenha) {
      this.toast('As senhas não coincidem.', 'error');
      return;
    }
    if (this.novaSenha.length < 6) {
      this.toast('A senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }
    this.carregando = true;
    try {
      const { error } = await this.supabase
        .getClient()
        .auth.updateUser({ password: this.novaSenha });
      if (error) throw error;
      this.toast('Senha alterada com sucesso!', 'success');
      await this.supabase.getClient().auth.signOut();
      setTimeout(() => void this.router.navigate(['/login']), 1500);
    } catch (e) {
      console.warn('updateUser(password) falhou:', e);
      this.toast('Erro ao salvar. O link pode ter expirado.', 'error');
    } finally {
      this.carregando = false;
    }
  }

  private toast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    document.querySelector('.toast-message')?.remove();
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.textContent = message;
    toast.style.cssText = [
      'position: fixed', 'bottom: 24px', 'left: 50%', 'transform: translateX(-50%)',
      `background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2d2a28'}`,
      'color: #ffffff', 'padding: 12px 24px', 'border-radius: 12px',
      'font-size: 14px', 'font-weight: 500', 'z-index: 10000',
      'box-shadow: 0 4px 20px rgba(0,0,0,0.15)',
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
