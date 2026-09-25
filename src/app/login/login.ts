import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  // --- Alterna os cards login/cadastro (espelha os .toggle-link do login.js) ---
  modo: 'login' | 'cadastro' = 'login';

  // --- Trava os botões enquanto a Promise do AuthService roda ---
  carregando = false;

  // --- Olhinhos de mostrar/esconder senha (espelha .toggle-password) ---
  mostrarSenhaLogin = false;
  mostrarSenhaCad = false;
  mostrarSenhaConf = false;

  loginForm: FormGroup;
  cadastroForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    // --- Mesmos campos obrigatórios do login.html original ---
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      senha: ['', Validators.required],
    });

    // --- Min 6 na senha espelha o login.js ('pelo menos 6 caracteres') ---
    this.cadastroForm = this.fb.group({
      nome: ['', Validators.required],
      sobrenome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      senha: ['', [Validators.required, Validators.minLength(6)]],
      confirmarSenha: ['', Validators.required],
    });
  }

  // --- Troca de card sem navegar (preventDefault como no original) ---
  alternarModo(e: Event, modo: 'login' | 'cadastro'): void {
    e.preventDefault();
    this.modo = modo;
  }

  // --- Submit do login: valida, chama o serviço e volta para a home ---
  async onLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.showToast('Preencha todos os campos.', 'error');
      return;
    }
    this.carregando = true;
    try {
      const { email, senha } = this.loginForm.value;
      const r = await this.auth.login(email, senha);
      if (!r.sucesso) {
        this.showToast(r.erro ?? 'Erro ao entrar.', 'error');
        return;
      }
      await this.router.navigate(['/']);
    } finally {
      this.carregando = false;
    }
  }

  // --- LGPD: aceite obrigatório dos termos no cadastro ---
  aceitouTermos = false;

  // --- Submit do cadastro: senhas iguais + serviço + volta para a home ---
  async onCadastro(): Promise<void> {
    const { nome, sobrenome, email, senha, confirmarSenha } = this.cadastroForm.value;

    if (!this.aceitouTermos) {
      this.showToast('Você precisa aceitar os termos para continuar.', 'error');
      return;
    }

    // --- Checagem "senhas coincidem" do login.js (mensagem idêntica) ---
    if (senha !== confirmarSenha) {
      this.showToast('As senhas não coincidem.', 'error');
      return;
    }
    if (this.cadastroForm.invalid) {
      this.cadastroForm.markAllAsTouched();
      this.showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
    this.carregando = true;
    try {
      const nomeCompleto = `${nome} ${sobrenome ?? ''}`.trim();
      const r = await this.auth.cadastro(nomeCompleto, email, senha);
      if (!r.sucesso) {
        this.showToast(r.erro ?? 'Erro ao cadastrar.', 'error');
        return;
      }
      await this.router.navigate(['/']);
    } finally {
      this.carregando = false;
    }
  }

  // --- Toast idêntico ao showToast do login.js (estilo inline, sem CSS novo) ---
  private showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    document.querySelector('.toast-message')?.remove();

    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2d2a28'};
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
