import { AfterViewInit, Component, ElementRef, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './blog.css',
  templateUrl: './blog.html',
})
export class Blog implements AfterViewInit, OnDestroy {
  // --- Filtros e lightbox resolvidos por query (cards estáticos no template) ---
  private chips: HTMLElement[] = [];
  private cards: HTMLElement[] = [];
  private blogEmpty: HTMLElement | null = null;
  private videoTriggers: HTMLElement[] = [];
  private videoModal: HTMLElement | null = null;
  private videoModalBg: HTMLElement | null = null;
  private videoModalClose: HTMLElement | null = null;
  private videoModalEmbed: HTMLElement | null = null;
  private paginationBtns: HTMLElement[] = [];

  // --- Handlers guardados para remover no OnDestroy ---
  private onChipClick = (e: Event) => this.filtrarPor(e.currentTarget as HTMLElement);
  private onVideoEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.videoModal && !this.videoModal.hidden) {
      this.fecharVideo();
    }
  };
  private onVideoModalClose = () => this.fecharVideo();
  private onVideoModalBg = () => this.fecharVideo();
  private onVideoTrigger = (e: Event) => {
    e.preventDefault();
    const id = (e.currentTarget as HTMLElement).getAttribute('data-video-id');
    if (id) this.abrirVideo(id);
  };
  // --- Paginação placeholder: marca ativa e rola ao grid ---
  private onPaginaClick = (e: Event) => {
    const btn = e.currentTarget as HTMLElement;
    this.paginationBtns.forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const alvo = this.host.nativeElement.querySelector('.blog-grid-section');
    if (alvo) {
      window.scrollTo({ top: alvo.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
    }
  };

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const root = this.host.nativeElement;

    // --- Chips de categoria: filtra cards por data-category ---
    this.chips = Array.from(root.querySelectorAll('.blog-nav__chip'));
    this.cards = Array.from(root.querySelectorAll('.editorial-card'));
    this.blogEmpty = root.querySelector('#blogEmpty');
    this.chips.forEach((chip) => chip.addEventListener('click', this.onChipClick));

    // --- Lightbox: [data-video-id] abre iframe do YouTube ---
    this.videoTriggers = Array.from(root.querySelectorAll('[data-video-id]'));
    this.videoTriggers.forEach((t) => t.addEventListener('click', this.onVideoTrigger));
    this.videoModal = root.querySelector('#videoModal');
    this.videoModalBg = root.querySelector('#videoModalBg');
    this.videoModalClose = root.querySelector('#videoModalClose');
    this.videoModalEmbed = root.querySelector('#videoModalEmbed');
    this.videoModalClose?.addEventListener('click', this.onVideoModalClose);
    this.videoModalBg?.addEventListener('click', this.onVideoModalBg);
    document.addEventListener('keydown', this.onVideoEsc);

    // --- Paginação placeholder: só marca ativa e rola ao grid ---
    this.paginationBtns = Array.from(root.querySelectorAll('.blog-pagination__page'));
    this.paginationBtns.forEach((btn) => btn.addEventListener('click', this.onPaginaClick));
  }

  ngOnDestroy(): void {
    // Chips (filtro por categoria)
    this.chips.forEach((chip) => chip.removeEventListener('click', this.onChipClick));
    this.chips = [];
    this.cards = [];
    // Lightbox
    this.videoTriggers.forEach((t) => t.removeEventListener('click', this.onVideoTrigger));
    this.videoTriggers = [];
    this.videoModalClose?.removeEventListener('click', this.onVideoModalClose);
    this.videoModalBg?.removeEventListener('click', this.onVideoModalBg);
    document.removeEventListener('keydown', this.onVideoEsc);
    // Paginação
    this.paginationBtns.forEach((btn) => btn.removeEventListener('click', this.onPaginaClick));
    this.paginationBtns = [];
  }

  // --- Filtra cards pelo data-filter do chip; mostra estado vazio ---
  private filtrarPor(chip: HTMLElement): void {
    this.chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    const filtro = chip.getAttribute('data-filter') ?? 'todos';
    let visiveis = 0;
    this.cards.forEach((card) => {
      const mostra = filtro === 'todos' || card.getAttribute('data-category') === filtro;
      card.hidden = !mostra;
      if (mostra) visiveis++;
    });
    if (this.blogEmpty) this.blogEmpty.hidden = visiveis > 0;
  }

  // --- Abre o lightbox injetando o iframe com autoplay ---
  private abrirVideo(videoId: string): void {
    if (!this.videoModal || !this.videoModalEmbed) return;
    this.videoModalEmbed.innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
        title="Vídeo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>`;
    this.videoModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  // --- Fecha e DESTROI o iframe (para o áudio, idêntico ao original) ---
  private fecharVideo(): void {
    if (!this.videoModal || !this.videoModalEmbed) return;
    this.videoModalEmbed.innerHTML = '';
    this.videoModal.hidden = true;
    document.body.style.overflow = '';
  }

  // --- Newsletter: replica o onsubmit inline do original (check + limpa) ---
  assinarNewsletter(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const btn = form.querySelector('button');
    const input = form.querySelector('input');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> Inscrito!';
    if (input) input.value = '';
  }
}
