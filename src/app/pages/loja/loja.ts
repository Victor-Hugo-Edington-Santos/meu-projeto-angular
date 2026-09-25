import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

// --- Produto da loja (mesmos campos do fallbackDB do loja.js) ---
interface Produto {
  id: string;
  titulo: string;
  vendedor: string;
  avaliacao: number;
  avaliacoes: number;
  preco: number;
  precoAntigo: number | null;
  marketplace: string;
  categoria: string;
  imagem: string;
  link: string;
  precoFmt: string;
  precoAntigoFmt: string | null;
}

// --- Fallback local verbatim do loja.js:463-474 (funciona sem Supabase) ---
// --- Fallback local (usado se o Supabase falhar/rpc ausente) ---
const PRODUTOS_FALLBACK: Produto[] = [
  { id: 'local-1', titulo: 'Manta de Peso Sensorial Terapêutica 5kg', vendedor: 'SensorPeso', avaliacao: 5, avaliacoes: 215, preco: 199.9, precoAntigo: 249.9, marketplace: 'amazon', categoria: 'sensorial', imagem: 'https://images.unsplash.com/photo-1616627561950-9f746e330187?w=400&h=300&fit=crop', link: '#', precoFmt: '', precoAntigoFmt: null },
  { id: 'local-2', titulo: 'Fidget Toy Cubo Infinito Anti Estresse', vendedor: 'FidgetBrasil', avaliacao: 4, avaliacoes: 327, preco: 24.9, precoAntigo: 39.9, marketplace: 'shopee', categoria: 'foco-tdah', imagem: 'https://images.unsplash.com/photo-1618842676088-c4d48a6a7c9d?w=400&h=300&fit=crop', link: '#', precoFmt: '', precoAntigoFmt: null },
  { id: 'local-3', titulo: 'Pulseira Mastigável Sensorial Antiestresse', vendedor: 'ChewyWear', avaliacao: 5, avaliacoes: 303, preco: 19.9, precoAntigo: 34.9, marketplace: 'shopee', categoria: 'sensorial', imagem: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop', link: '#', precoFmt: '', precoAntigoFmt: null },
  { id: 'local-4', titulo: 'Relógio Timer Visual 60min para TDAH', vendedor: 'TimeManager', avaliacao: 4, avaliacoes: 283, preco: 39.9, precoAntigo: 59.9, marketplace: 'aliexpress', categoria: 'foco-tdah', imagem: 'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=400&h=300&fit=crop', link: '#', precoFmt: '', precoAntigoFmt: null },
  { id: 'local-5', titulo: 'Fone Bluetooth Cancelamento de Ruído ANC', vendedor: 'AudioPro', avaliacao: 4, avaliacoes: 456, preco: 149.9, precoAntigo: 249.9, marketplace: 'shopee', categoria: 'audio', imagem: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop', link: '#', precoFmt: '', precoAntigoFmt: null },
  { id: 'local-6', titulo: 'Camiseta Orgulho Neurodivergente', vendedor: 'NeuroStore', avaliacao: 5, avaliacoes: 142, preco: 49.9, precoAntigo: 79.9, marketplace: 'aliexpress', categoria: 'vestuario', imagem: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=300&fit=crop', link: '#', precoFmt: '', precoAntigoFmt: null },
];

const NOMES_MARKETPLACE: Record<string, string> = {
  aliexpress: 'AliExpress',
  shopee: 'Shopee',
  'mercado-livre': 'Mercado Livre',
  amazon: 'Amazon',
};

const CHAVE_WISHLIST = 'lojaWishlist';

@Component({
  selector: 'app-loja',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './loja.css',
  templateUrl: './loja.html',
})
export class Loja implements AfterViewInit, OnDestroy {
  // --- Banner: track + contador regressivo ---
  @ViewChild('bannerScroll') bannerScroll!: ElementRef<HTMLElement>;
  @ViewChild('countdownBanner') countdownBanner!: ElementRef<HTMLElement>;

  // --- Estado (espelha o ESTADO GLOBAL do loja.js) ---
  produtosFiltrados: Produto[] = [];
  produtosVisiveis: Produto[] = [];
  textoContador = 'Carregando...';
  carregandoMais = false;
  bannerIndex = 0;
  favoritos = new Set<string>();

  private todosProdutos: Produto[] = [];
  private filtroMarketplace = 'todos';
  private filtroCategoria = 'todos';
  private buscaAtual = '';
  private buscaTimer: ReturnType<typeof setTimeout> | null = null;
  private bannerAuto: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private countdownSegundos = 10 * 3600 + 55 * 60 + 52;
  private readonly porPagina = 6;

  // --- Scroll infinito (removido no OnDestroy) ---
  private onWindowScroll = () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
      this.carregarMais();
    }
  };

  // --- Pausa o autoplay do banner no hover (idêntico ao original) ---
  private onBannerEnter = () => {
    if (this.bannerAuto) {
      clearInterval(this.bannerAuto);
      this.bannerAuto = null;
    }
  };
  private onBannerLeave = () => this.bannerIniciarAuto();
  private bannerContainer: HTMLElement | null = null;
  private bannerWrapper: HTMLElement | null = null;
  private bannerTouchX = 0;

  // --- Swipe no banner (idêntico ao original, limiar 40px) ---
  private onBannerTouchStart = (e: TouchEvent) => {
    this.bannerTouchX = e.changedTouches[0].screenX;
  };
  private onBannerTouchEnd = (e: TouchEvent) => {
    const diff = this.bannerTouchX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) this.bannerProximo();
      else this.bannerAnterior();
    }
  };

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly auth: AuthService,
    private readonly supabase: SupabaseService,
  ) {}

  ngAfterViewInit(): void {
    // --- Wishlist real (fallback: localStorage) ---
    void this.carregarWishlist();

    // --- Produtos reais via rpc get_products (fallback: local) ---
    void this.carregarProdutos();

    // --- Pills das duas fileiras (marketplace = fileira 0, categoria = 1) ---
    this.host.nativeElement.querySelectorAll('.filter-row').forEach((row, i) => {
      row.querySelectorAll('.pill-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          row.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const f = btn.getAttribute('data-filter') ?? 'todos';
          if (i === 0) this.filtroMarketplace = f;
          if (i === 1) this.filtroCategoria = f;
          this.aplicarFiltros();
        });
      });
    });

    // --- Scroll infinito + banner + countdown ---
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
    this.bannerContainer = this.host.nativeElement.querySelector('.banner-carousel-container');
    this.bannerContainer?.addEventListener('mouseenter', this.onBannerEnter);
    this.bannerContainer?.addEventListener('mouseleave', this.onBannerLeave);
    this.bannerWrapper = this.host.nativeElement.querySelector('.banner-carousel-wrapper');
    this.bannerWrapper?.addEventListener('touchstart', this.onBannerTouchStart, { passive: true });
    this.bannerWrapper?.addEventListener('touchend', this.onBannerTouchEnd, { passive: true });
    this.bannerIniciarAuto();
    this.atualizarCountdown();
    this.countdownTimer = setInterval(() => this.atualizarCountdown(), 1000);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onWindowScroll);
    this.bannerContainer?.removeEventListener('mouseenter', this.onBannerEnter);
    this.bannerContainer?.removeEventListener('mouseleave', this.onBannerLeave);
    this.bannerContainer = null;
    this.bannerWrapper?.removeEventListener('touchstart', this.onBannerTouchStart);
    this.bannerWrapper?.removeEventListener('touchend', this.onBannerTouchEnd);
    this.bannerWrapper = null;
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
    if (this.bannerAuto) clearInterval(this.bannerAuto);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  // --- Preço "R$ 0,00" (formatPrice do original) ---
  private formatarPreco(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'R$ 0,00';
    return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
  }

  // --- Nome de exibição do marketplace ---
  nomeMarketplace(sigla: string): string {
    return NOMES_MARKETPLACE[sigla] ?? sigla;
  }

  // --- Estrelas ★/☆ (createProductCard do original) ---
  estrelas(nota: number): string {
    return '★'.repeat(nota) + '☆'.repeat(5 - nota);
  }

  // --- Produtos via rpc get_products (espelha loadProducts; fallback local) ---
  private async carregarProdutos(): Promise<void> {
    try {
      const { data, error } = await this.supabase.getClient().rpc('get_products', {
        p_search: this.buscaAtual || null,
        p_marketplace: this.filtroMarketplace === 'todos' ? null : this.filtroMarketplace,
        p_category: this.filtroCategoria === 'todos' ? null : this.filtroCategoria,
        p_limit: 200,
        p_offset: 0,
      });
      if (error) throw error;
      const linhas = (data ?? []) as Array<Record<string, unknown>>;
      if (!linhas.length) throw new Error('vazio');
      this.todosProdutos = linhas.map((p) => this.mapearProduto(p));
    } catch (e) {
      console.warn('Produtos locais (get_products falhou):', e);
      this.todosProdutos = PRODUTOS_FALLBACK.map((p) => ({
        ...p,
        precoFmt: this.formatarPreco(p.preco),
        precoAntigoFmt: p.precoAntigo ? this.formatarPreco(p.precoAntigo) : null,
      }));
    }
    this.aplicarFiltros();
  }

  private mapearProduto(p: Record<string, unknown>): Produto {
    const str = (v: unknown, fb = '') => (typeof v === 'string' ? v : fb);
    const num = (v: unknown, fb = 0) => (typeof v === 'number' ? v : fb);
    const preco = num(p['price'], 0);
    const antigo = typeof p['old_price'] === 'number' ? (p['old_price'] as number) : null;
    return {
      id: String(p['id']),
      titulo: str(p['title'], 'Produto'),
      vendedor: str(p['vendor'], ''),
      avaliacao: Math.min(5, Math.max(0, Math.round(num(p['rating'], 5)))),
      avaliacoes: num(p['rating_count'], 0),
      preco,
      precoAntigo: antigo,
      marketplace: str(p['marketplace'], ''),
      categoria: str(p['category'], 'outros'),
      imagem: str(p['image'], ''),
      link: str(p['link'], '#'),
      precoFmt: this.formatarPreco(preco),
      precoAntigoFmt: antigo !== null ? this.formatarPreco(antigo) : null,
    };
  }

  // --- Wishlist via rpc get_my_wishlists (fallback: localStorage) ---
  private async carregarWishlist(): Promise<void> {
    try {
      const { data, error } = await this.supabase.getClient().rpc('get_my_wishlists');
      if (error) throw error;
      const linhas = (data ?? []) as Array<Record<string, unknown>>;
      this.favoritos = new Set(linhas.map((w) => String(w['product_id'])));
    } catch (e) {
      console.warn('Wishlist local (get_my_wishlists falhou):', e);
      try {
        this.favoritos = new Set(JSON.parse(localStorage.getItem(CHAVE_WISHLIST) || '[]'));
      } catch {
        this.favoritos = new Set();
      }
    }
  }

  // --- Filtra por marketplace + categoria e renderiza o 1º lote ---
  private aplicarFiltros(): void {
    const termo = this.buscaAtual.toLowerCase();
    this.produtosFiltrados = this.todosProdutos.filter((p) => {
      if (this.filtroMarketplace !== 'todos' && p.marketplace !== this.filtroMarketplace) return false;
      if (this.filtroCategoria !== 'todos' && p.categoria !== this.filtroCategoria) return false;
      if (termo && !(p.titulo + ' ' + p.vendedor).toLowerCase().includes(termo)) return false;
      return true;
    });
    this.produtosVisiveis = this.produtosFiltrados.slice(0, this.porPagina);
    this.atualizarContador();
  }

  // --- Texto "N produtos encontrados" ---
  private atualizarContador(): void {
    const n = this.produtosFiltrados.length;
    this.textoContador = n === 0 ? '0 produtos' : `${n} produto${n > 1 ? 's' : ''} encontrado${n > 1 ? 's' : ''}`;
  }

  // --- Busca com debounce: recarrega via RPC (espelha o original) ---
  aoDigitarBusca(e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
    this.buscaTimer = setTimeout(() => {
      this.buscaAtual = valor.trim();
      void this.carregarProdutos();
    }, 400);
  }

  // --- Lote seguinte com delay de 400ms (loadMore do original) ---
  private carregarMais(): void {
    if (this.carregandoMais) return;
    if (this.produtosVisiveis.length >= this.produtosFiltrados.length) return;
    this.carregandoMais = true;
    setTimeout(() => {
      this.produtosVisiveis = this.produtosFiltrados.slice(0, this.produtosVisiveis.length + this.porPagina);
      this.carregandoMais = false;
    }, 400);
  }

  // --- Favorito via rpc toggle_wishlist (otimista; reverte em erro) ---
  ehFavorito(id: string): boolean {
    return this.favoritos.has(id);
  }

  async alternarFavorito(id: string, e: Event): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    if (!this.auth.estaLogado()) {
      this.mostrarToast('Faça login para favoritar produtos', 'warning');
      return;
    }
    const adicionando = !this.favoritos.has(id);
    if (adicionando) this.favoritos.add(id);
    else this.favoritos.delete(id);
    try {
      const { data, error } = await this.supabase.getClient().rpc('toggle_wishlist', { p_product_id: id });
      if (error) throw error;
      const r = (data ?? {}) as { success?: boolean; action?: string; error?: string };
      if (r.success === false) throw new Error(r.error || 'toggle falhou');
      if (r.action === 'added') {
        this.favoritos.add(id);
        this.mostrarToast('❤️ Adicionado aos favoritos', 'success');
      } else if (r.action === 'removed') {
        this.favoritos.delete(id);
        this.mostrarToast('💔 Removido dos favoritos', 'info');
      } else {
        this.mostrarToast(
          adicionando ? '❤️ Adicionado aos favoritos' : '💔 Removido dos favoritos',
          adicionando ? 'success' : 'info',
        );
      }
    } catch (err) {
      console.warn('Wishlist MOCK (toggle_wishlist falhou):', err);
      if (adicionando) this.favoritos.delete(id);
      else this.favoritos.add(id);
      this.mostrarToast('Erro ao atualizar favorito', 'error');
      return;
    }
    try {
      localStorage.setItem(CHAVE_WISHLIST, JSON.stringify(Array.from(this.favoritos)));
    } catch {
      // Ignora
    }
  }

  // =============================================
  // BANNER (espelha loja.js §17)
  // =============================================
  private bannerTotalSlides(): number {
    return this.bannerScroll?.nativeElement.querySelectorAll('.banner-slide').length ?? 0;
  }

  bannerIrPara(index: number): void {
    const total = this.bannerTotalSlides();
    if (!total) return;
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    this.bannerIndex = index;
    this.bannerScroll.nativeElement.style.transform = `translateX(-${index * 100}%)`;
    this.bannerReiniciarAuto();
  }

  bannerProximo(): void {
    this.bannerIrPara(this.bannerIndex + 1);
  }

  bannerAnterior(): void {
    this.bannerIrPara(this.bannerIndex - 1);
  }

  private bannerIniciarAuto(): void {
    if (this.bannerAuto) clearInterval(this.bannerAuto);
    this.bannerAuto = setInterval(() => this.bannerIrPara(this.bannerIndex + 1), 4000);
  }

  private bannerReiniciarAuto(): void {
    this.bannerIniciarAuto();
  }

  // --- Regressivo a partir de 10:55:52 (idêntico ao original) ---
  private atualizarCountdown(): void {
    if (this.countdownSegundos <= 0) {
      if (this.countdownBanner) this.countdownBanner.nativeElement.textContent = '00:00:00';
      return;
    }
    this.countdownSegundos--;
    const h = String(Math.floor(this.countdownSegundos / 3600)).padStart(2, '0');
    const m = String(Math.floor((this.countdownSegundos % 3600) / 60)).padStart(2, '0');
    const s = String(this.countdownSegundos % 60).padStart(2, '0');
    if (this.countdownBanner) this.countdownBanner.nativeElement.textContent = `${h}:${m}:${s}`;
  }

  // --- Toast estilo shop-toast do original ---
  private mostrarToast(msg: string, tipo: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    document.querySelector('.shop-toast')?.remove();
    const cores = { success: '#10b981', error: '#ef4444', info: '#7c3aed', warning: '#f59e0b' };
    const toast = document.createElement('div');
    toast.className = 'shop-toast';
    toast.textContent = msg;
    toast.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(100px);background:${cores[tipo]};color:#fff;padding:14px 32px;border-radius:30px;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,0.2);transition:all 0.4s ease;opacity:0;pointer-events:none;max-width:90vw;text-align:center;`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }
}
