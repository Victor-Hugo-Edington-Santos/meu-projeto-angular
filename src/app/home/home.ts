import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

// --- Home: só as seções da página (carrosséis). Shell fica no MainLayout. ---
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home implements AfterViewInit, OnDestroy {
  // --- Referências aos elementos do carrossel principal ---
  @ViewChild('track') track!: ElementRef<HTMLElement>;
  @ViewChild('prevBtn') prevBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('nextBtn') nextBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('current') current!: ElementRef<HTMLElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLElement>;
  @ViewChild('carouselWrapper') carouselWrapper!: ElementRef<HTMLElement>;

  // --- Referências ao carrossel editorial (.ct-*) ---
  @ViewChild('ctCarousel') ctCarousel!: ElementRef<HTMLElement>;
  @ViewChild('ctTrack') ctTrack!: ElementRef<HTMLElement>;
  @ViewChild('ctPrev') ctPrev!: ElementRef<HTMLButtonElement>;
  @ViewChild('ctNext') ctNext!: ElementRef<HTMLButtonElement>;
  @ViewChild('ctProgressBar') ctProgressBar!: ElementRef<HTMLElement>;

  // --- Referências ao carrossel "Publicações em Destaque" (.hl-*) ---
  @ViewChild('hlTrack') hlTrack!: ElementRef<HTMLElement>;
  @ViewChild('hlPrev') hlPrev!: ElementRef<HTMLButtonElement>;
  @ViewChild('hlNext') hlNext!: ElementRef<HTMLButtonElement>;

  // --- Estado interno do carrossel (espelha o inicio.js original) ---
  private readonly totalSlides = 5;
  private currentIndex = 0;
  private readonly slideDuration = 3000;
  private autoPlayTimer: ReturnType<typeof setInterval> | null = null;
  private progressAnimation: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  // --- Handlers do carrossel (guardados para remover no OnDestroy) ---
  private onNext = () => this.nextSlide();
  private onPrev = () => this.prevSlide();
  private onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') this.nextSlide();
    if (e.key === 'ArrowLeft') this.prevSlide();
  };
  private onMouseEnter = () => this.pauseAutoPlay();
  private onMouseLeave = () => this.resetAutoPlay();

  // --- Handlers do carrossel editorial (guardados para remover no OnDestroy) ---
  private onCtPrevClick = () => this.ctScrollByCard(-1);
  private onCtNextClick = () => this.ctScrollByCard(1);
  private onCtTrackScroll = () => {
    this.ctUpdateProgress();
    this.ctUpdateArrows();
  };
  private onCtResize = () => {
    this.ctUpdateProgress();
    this.ctUpdateArrows();
  };

  // --- Handlers do carrossel .hl-* (guardados para remover no OnDestroy) ---
  private onHlPrevClick = () => this.hlScrollByCard(-1);
  private onHlNextClick = () => this.hlScrollByCard(1);

  // --- Inicializa os 3 carrosséis após a view existir ---
  ngAfterViewInit(): void {
    this.initCarousel();
    this.initEditorialCarousel();
    this.initHighlightsCarousel();
  }

  // --- Limpa timers e listeners dos carrosséis ---
  ngOnDestroy(): void {
    // Principal
    this.pauseAutoPlay();
    this.nextBtn?.nativeElement.removeEventListener('click', this.onNext);
    this.prevBtn?.nativeElement.removeEventListener('click', this.onPrev);
    document.removeEventListener('keydown', this.onKeydown);
    this.carouselWrapper?.nativeElement.removeEventListener('mouseenter', this.onMouseEnter);
    this.carouselWrapper?.nativeElement.removeEventListener('mouseleave', this.onMouseLeave);
    // Editorial
    this.ctTrack?.nativeElement.removeEventListener('scroll', this.onCtTrackScroll);
    window.removeEventListener('resize', this.onCtResize);
    this.ctPrev?.nativeElement.removeEventListener('click', this.onCtPrevClick);
    this.ctNext?.nativeElement.removeEventListener('click', this.onCtNextClick);
    // Destaques
    this.hlPrev?.nativeElement.removeEventListener('click', this.onHlPrevClick);
    this.hlNext?.nativeElement.removeEventListener('click', this.onHlNextClick);
  }

  // =============================================
  // CARROSSEL
  // =============================================

  // --- Liga botões, teclado, hover e inicia autoplay ---
  private initCarousel(): void {
    if (!this.track || !this.prevBtn || !this.nextBtn || !this.current || !this.progressBar || !this.carouselWrapper) {
      return;
    }

    // Navegação por botões
    this.nextBtn.nativeElement.addEventListener('click', this.onNext);
    this.prevBtn.nativeElement.addEventListener('click', this.onPrev);

    // Suporte a setas do teclado
    document.addEventListener('keydown', this.onKeydown);

    // Pausa ao passar o mouse, retoma ao sair
    this.carouselWrapper.nativeElement.addEventListener('mouseenter', this.onMouseEnter);
    this.carouselWrapper.nativeElement.addEventListener('mouseleave', this.onMouseLeave);

    // Inicia autoplay + barra de progresso
    this.resetAutoPlay();
  }

  // --- Aplica transform, atualiza contador "01" e reinicia autoplay ---
  private updateCarousel(): void {
    this.track.nativeElement.style.transform = `translateX(-${this.currentIndex * 100}vw)`;
    this.current.nativeElement.textContent = String(this.currentIndex + 1).padStart(2, '0');
    this.resetAutoPlay();
  }

  // --- Anima a barra de 0% a 100% dentro do slideDuration ---
  private startProgressBar(): void {
    this.progressBar.nativeElement.style.width = '0%';
    this.startTime = Date.now();

    if (this.progressAnimation) clearInterval(this.progressAnimation);
    this.progressAnimation = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      const percentage = Math.min((elapsed / this.slideDuration) * 100, 100);
      this.progressBar.nativeElement.style.width = percentage + '%';
      if (percentage >= 100 && this.progressAnimation) clearInterval(this.progressAnimation);
    }, 50);
  }

  // --- Avança com wrap-around (4 -> 0) ---
  private nextSlide(): void {
    this.currentIndex = (this.currentIndex + 1) % this.totalSlides;
    this.updateCarousel();
  }

  // --- Volta com wrap-around (0 -> 4) ---
  private prevSlide(): void {
    this.currentIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
    this.updateCarousel();
  }

  // --- Reinicia autoplay + barra (chamado a cada troca) ---
  private resetAutoPlay(): void {
    if (this.autoPlayTimer) clearInterval(this.autoPlayTimer);
    this.startProgressBar();
    this.autoPlayTimer = setInterval(() => this.nextSlide(), this.slideDuration);
  }

  // --- Pausa autoplay + barra (hover) sem trocar de slide ---
  private pauseAutoPlay(): void {
    if (this.autoPlayTimer) clearInterval(this.autoPlayTimer);
    if (this.progressAnimation) clearInterval(this.progressAnimation);
    this.autoPlayTimer = null;
    this.progressAnimation = null;
  }

  // =============================================
  // CARROSSEL EDITORIAL (espelha carrossel.js:1-59)
  // =============================================

  // --- Liga setas, scroll do track e resize ---
  private initEditorialCarousel(): void {
    if (!this.ctTrack || !this.ctProgressBar) return;

    // Setas avançam/retrocedem um card
    this.ctPrev?.nativeElement.addEventListener('click', this.onCtPrevClick);
    this.ctNext?.nativeElement.addEventListener('click', this.onCtNextClick);

    // Scroll/resize atualizam barra + estado das setas
    this.ctTrack.nativeElement.addEventListener('scroll', this.onCtTrackScroll, { passive: true });
    window.addEventListener('resize', this.onCtResize);

    // Estado inicial
    this.ctUpdateProgress();
    this.ctUpdateArrows();
  }

  // --- Recalcula largura/deslocamento da barra conforme o scroll ---
  private ctUpdateProgress(): void {
    const track = this.ctTrack.nativeElement;
    const progress = this.ctProgressBar.nativeElement;
    const cards = track.querySelectorAll('.ct-card');
    if (!cards.length) return;

    const max = track.scrollWidth - track.clientWidth;
    const pct = max > 0 ? track.scrollLeft / max : 0;

    // Quantos cards cabem por vez
    const cardW = (cards[0] as HTMLElement).offsetWidth + 20; // +gap
    const visible = Math.max(1, Math.round(track.clientWidth / cardW));
    const barW = 100 / (cards.length / visible);

    progress.style.width = barW + '%';
    progress.style.transform = `translateX(${(pct * (100 - barW) / barW) * 100}%)`;
  }

  // --- Rola exatamente um card (largura + gap) com smooth ---
  private ctScrollByCard(dir: number): void {
    const track = this.ctTrack.nativeElement;
    const card = track.querySelector('.ct-card') as HTMLElement | null;
    if (!card) return;
    track.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: 'smooth' });
  }

  // --- Esmaece/bloqueia setas nas extremidades ---
  private ctUpdateArrows(): void {
    const track = this.ctTrack.nativeElement;
    const max = track.scrollWidth - track.clientWidth;
    const atStart = track.scrollLeft <= 2;
    const atEnd = track.scrollLeft >= max - 2;

    if (this.ctPrev) {
      this.ctPrev.nativeElement.style.opacity = atStart ? '0.35' : '0.9';
      this.ctPrev.nativeElement.style.pointerEvents = atStart ? 'none' : 'auto';
    }
    if (this.ctNext) {
      this.ctNext.nativeElement.style.opacity = atEnd ? '0.35' : '0.9';
      this.ctNext.nativeElement.style.pointerEvents = atEnd ? 'none' : 'auto';
    }
  }

  // =============================================
  // DESTAQUES .hl-* (espelha inicio.html:869-890)
  // =============================================

  // --- Liga as setas prev/next do track ---
  private initHighlightsCarousel(): void {
    if (!this.hlTrack || !this.hlPrev || !this.hlNext) return;

    // Setas avançam/retrocedem um card
    this.hlPrev.nativeElement.addEventListener('click', this.onHlPrevClick);
    this.hlNext.nativeElement.addEventListener('click', this.onHlNextClick);
  }

  // --- Mede um passo: card.offsetWidth + gap (fallback 320) ---
  private hlGetStep(): number {
    const card = this.hlTrack.nativeElement.querySelector('.hl-card') as HTMLElement | null;
    return card ? card.offsetWidth + 20 : 320;
  }

  // --- Rola um card para trás/frente com smooth ---
  private hlScrollByCard(dir: number): void {
    this.hlTrack.nativeElement.scrollBy({ left: dir * this.hlGetStep(), behavior: 'smooth' });
  }
}
