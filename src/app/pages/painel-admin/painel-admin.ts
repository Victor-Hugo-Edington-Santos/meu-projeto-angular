import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-painel-admin',
  styleUrl: './painel-admin.css',
  templateUrl: './painel-admin.html',
})
export class PainelAdmin implements OnDestroy {
  // --- Estado da sidebar Dev Tools (espelha toggle/collapsed do painel.js) ---
  sidebarRecolhida = false;

  // --- Caixa do assistente ---
  textoAssistente = '';
  sugestaoAtiva: string | null = null;
  sugestoes = [
    'Quais arquivos compõem o site?',
    'Analise o código da AcolherIA',
    'Liste possíveis melhorias',
    'Como está a performance?',
    'Gere um novo componente',
    'Encontre bugs potenciais',
  ];

  // --- Menu de acessibilidade próprio da página (espelha painel.js + localStorage a11y_*) ---
  a11yAberto = false;
  private noDocumento = (e: Event) => this.fecharA11yFora(e);
  private noEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.a11yAberto) this.a11yAberto = false;
  };

  @ViewChild('areaTexto') areaTexto!: ElementRef<HTMLTextAreaElement>;

  constructor() {
    document.addEventListener('click', this.noDocumento);
    document.addEventListener('keydown', this.noEscape);
    this.aplicarA11y();
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.noDocumento);
    document.removeEventListener('keydown', this.noEscape);
  }

  alternarSidebar(): void {
    this.sidebarRecolhida = !this.sidebarRecolhida;
  }

  fecharSidebar(): void {
    this.sidebarRecolhida = true;
  }

  usarSugestao(s: string): void {
    this.textoAssistente = s;
    this.sugestaoAtiva = s;
    this.areaTexto?.nativeElement.focus();
  }

  // --- Envio do assistente dev: sem backend de IA nesta etapa (MOCK + TODO) ---
  enviarMensagem(): void {
    if (!this.textoAssistente.trim()) return;
    // TODO SUPABASE/IA: ligar à edge function do assistente dev quando existir.
    this.mostrarToast('Assistente dev em breve: backend de IA não conectado.');
  }

  alternarA11y(e: Event): void {
    e.stopPropagation();
    this.a11yAberto = !this.a11yAberto;
  }

  fecharA11y(): void {
    this.a11yAberto = false;
  }

  private fecharA11yFora(e: Event): void {
    const alvo = e.target as HTMLElement;
    if (this.a11yAberto && !alvo.closest('.accessibility-menu') && !alvo.closest('.accessibility-btn')) {
      this.a11yAberto = false;
    }
  }

  // --- Alternadores de acessibilidade (mesmas chaves a11y_* do painel.js) ---
  alternarA11yOpcao(opcao: string): void {
    if (opcao === 'reset') {
      ['darkMode', 'highContrast', 'textSize', 'spacing', 'highlightLinks', 'saturation', 'grayscale', 'dyslexia'].forEach(
        (k) => localStorage.removeItem(`a11y_${k}`),
      );
    } else if (opcao === 'darkMode' || opcao === 'highContrast' || opcao === 'spacing' || opcao === 'highlightLinks' || opcao === 'saturation' || opcao === 'grayscale' || opcao === 'dyslexia') {
      const atual = localStorage.getItem(`a11y_${opcao}`) === 'true';
      localStorage.setItem(`a11y_${opcao}`, String(!atual));
    } else if (opcao === 'large') {
      localStorage.setItem('a11y_textSize', localStorage.getItem('a11y_textSize') === 'large' ? 'normal' : 'large');
    } else if (opcao === 'small') {
      localStorage.setItem('a11y_textSize', localStorage.getItem('a11y_textSize') === 'small' ? 'normal' : 'small');
    }
    this.aplicarA11y();
  }

  a11yAtivo(opcao: string): boolean {
    if (opcao === 'large') return localStorage.getItem('a11y_textSize') === 'large';
    if (opcao === 'small') return localStorage.getItem('a11y_textSize') === 'small';
    return localStorage.getItem(`a11y_${opcao}`) === 'true';
  }

  private aplicarA11y(): void {
    const b = document.body;
    b.classList.remove(
      'a11y-dark-mode', 'a11y-high-contrast', 'a11y-large-text', 'a11y-small-text',
      'a11y-spacing', 'a11y-highlight-links', 'a11y-saturation', 'a11y-grayscale', 'a11y-dyslexia',
    );
    if (localStorage.getItem('a11y_darkMode') === 'true') b.classList.add('a11y-dark-mode');
    if (localStorage.getItem('a11y_highContrast') === 'true') b.classList.add('a11y-high-contrast');
    if (localStorage.getItem('a11y_textSize') === 'large') b.classList.add('a11y-large-text');
    if (localStorage.getItem('a11y_textSize') === 'small') b.classList.add('a11y-small-text');
    if (localStorage.getItem('a11y_spacing') === 'true') b.classList.add('a11y-spacing');
    if (localStorage.getItem('a11y_highlightLinks') === 'true') b.classList.add('a11y-highlight-links');
    if (localStorage.getItem('a11y_saturation') === 'true') b.classList.add('a11y-saturation');
    if (localStorage.getItem('a11y_grayscale') === 'true') b.classList.add('a11y-grayscale');
    if (localStorage.getItem('a11y_dyslexia') === 'true') b.classList.add('a11y-dyslexia');
  }

  private mostrarToast(message: string): void {
    document.querySelector('.toast-message')?.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-message info';
    toast.textContent = message;
    toast.style.cssText =
      'position: fixed;bottom: 24px;left: 50%;transform: translateX(-50%);' +
      'background: #2d2a28;color: #ffffff;padding: 12px 24px;border-radius: 12px;' +
      'font-size: 14px;font-weight: 500;z-index: 10000;box-shadow: 0 4px 20px rgba(0,0,0,0.15);';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
