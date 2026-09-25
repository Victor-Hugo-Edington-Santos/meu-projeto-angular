import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

// --- Chave do atendimento salvo (mesma do Explorar.js) ---
const LS_ATENDIMENTO = 'amn_atendimento_ativo';

@Component({
  selector: 'app-explorar',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './explorar.css',
  templateUrl: './explorar.html',
})
export class Explorar implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  /** Seção atualmente selecionada na barra de navegação. */
  secaoAtiva = 'destaques';

  // --- Carrossel destaques (.hl-*) com paginação ---
  @ViewChild('hlTrack') hlTrack!: ElementRef<HTMLElement>;
  @ViewChild('hlPrev') hlPrev!: ElementRef<HTMLButtonElement>;
  @ViewChild('hlNext') hlNext!: ElementRef<HTMLButtonElement>;

  // --- FAQ resolvido por query (itens estáticos no template) ---
  private faqItems: HTMLElement[] = [];
  private faqSearchInput: HTMLInputElement | null = null;

  // --- Atendimento (elementos resolvidos por query) ---
  private taCaso: HTMLTextAreaElement | null = null;
  private contadorChars: HTMLElement | null = null;
  private supportForm: HTMLFormElement | null = null;
  private mensagensLocais: Array<{ tipo: string; autor: string; texto: string }> = [];

  // --- Timers de debounce (limpos no OnDestroy) ---
  private hlScrollTimer: ReturnType<typeof setTimeout> | null = null;
  private hlResizeTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Handlers guardados para remover no OnDestroy ---
  private onHlPrevClick = () => this.hlRolar(-1);
  private onHlNextClick = () => this.hlRolar(1);
  private onHlTrackScroll = () => {
    if (this.hlScrollTimer) clearTimeout(this.hlScrollTimer);
    this.hlScrollTimer = setTimeout(() => this.hlAtualizarPaginacao(), 80);
  };
  private onHlResize = () => {
    if (this.hlResizeTimer) clearTimeout(this.hlResizeTimer);
    this.hlResizeTimer = setTimeout(() => this.hlAtualizarPaginacao(), 150);
  };
  private onFaqToggle = (e: Event) => {
    const atual = e.currentTarget as HTMLElement & { open: boolean };
    if (atual.open) {
      this.faqItems.forEach((outro) => {
        const o = outro as HTMLElement & { open: boolean };
        if (o !== atual && o.open) o.open = false;
      });
    }
  };
  private onFaqBusca = () => this.faqFiltrar();
  private onContadorInput = () => this.atualizarContador();
  private onSupportSubmit = (e: Event) => void this.enviarAtendimento(e);
  private onCopiarProtocolo = () => this.copiarProtocolo();
  private onVerificarAgora = () => void this.verificarAtendimento();
  private onNovoAtendimento = () => this.novoAtendimento();
  private onChatSubmit = (e: Event) => void this.enviarMensagemChat(e);

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly supabase: SupabaseService,
  ) {}

  // --- Rolagem suave até a seção e atualização do chip ativo ---
  // O clique é tratado no componente para não depender do scroll nativo do router.
  rolarPara(id: string): void {
    this.secaoAtiva = id;
    const el = this.host.nativeElement.querySelector('#' + CSS.escape(id));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  ngAfterViewInit(): void {
    this.initFaq();
    this.initHl();
    this.initAtendimento();
    this.rolarParaFragmento();
  }

  /**
   * Entra em /explorar#faq (link "FAQ" do menu Ajuda) rolando até a seção.
   *
   * O anchorScrolling do router mede a posição do #faq antes das imagens da
   * página terminarem de carregar, então erra a posição em ~1.4k px. Aqui
   * esperamos as imagens assentarem e reaplicamos a rolagem pelo mesmo
   * rolarPara() que os chips internos da página já usam.
   */
  private rolarParaFragmento(): void {
    const alvo = this.route.snapshot.fragment;
    if (!alvo) return;

    const rolar = () => this.rolarPara(alvo);
    const pendentes = Array.from(
      this.host.nativeElement.querySelectorAll('img'),
    ).filter((img) => !img.complete);

    if (pendentes.length === 0) {
      rolar();
      return;
    }

    let restantes = pendentes.length;
    const aoAssentar = () => {
      if (--restantes === 0) rolar();
    };
    for (const img of pendentes) {
      img.addEventListener('load', aoAssentar, { once: true });
      img.addEventListener('error', aoAssentar, { once: true });
    }
  }

  ngOnDestroy(): void {
    // FAQ
    this.faqItems.forEach((item) => item.removeEventListener('toggle', this.onFaqToggle));
    this.faqItems = [];
    this.faqSearchInput?.removeEventListener('input', this.onFaqBusca);
    this.faqSearchInput = null;
    // Destaques
    this.hlPrev?.nativeElement.removeEventListener('click', this.onHlPrevClick);
    this.hlNext?.nativeElement.removeEventListener('click', this.onHlNextClick);
    this.hlTrack?.nativeElement.removeEventListener('scroll', this.onHlTrackScroll);
    window.removeEventListener('resize', this.onHlResize);
    this.hlPageBtns.forEach((b) => b.removeEventListener('click', b._hlClick as EventListener));
    this.hlPageBtns = [];
    this.hlNavBtns.forEach((b) => b.removeEventListener('click', b._hlClick as EventListener));
    this.hlNavBtns = [];
    if (this.hlScrollTimer) clearTimeout(this.hlScrollTimer);
    if (this.hlResizeTimer) clearTimeout(this.hlResizeTimer);
    // Atendimento
    this.taCaso?.removeEventListener('input', this.onContadorInput);
    this.supportForm?.removeEventListener('submit', this.onSupportSubmit);
    this.host.nativeElement
      .querySelector('#btnCopiarProtocolo')
      ?.removeEventListener('click', this.onCopiarProtocolo);
    this.host.nativeElement
      .querySelector('#btnVerificarAgora')
      ?.removeEventListener('click', this.onVerificarAgora);
    this.host.nativeElement
      .querySelector('#btnNovoAtendimento')
      ?.removeEventListener('click', this.onNovoAtendimento);
    this.host.nativeElement
      .querySelector('#chatForm')
      ?.removeEventListener('submit', this.onChatSubmit);
    this.cancelarRealtimeAtendimento();
  }

  // =============================================
  // FAQ — acordeão + busca (Explorar.js:345-397)
  // =============================================

  // --- Liga toggle (um aberto fecha os outros) e filtro em tempo real ---
  private initFaq(): void {
    const root = this.host.nativeElement;
    this.faqItems = Array.from(root.querySelectorAll('.faq-item'));
    this.faqItems.forEach((item) => item.addEventListener('toggle', this.onFaqToggle));

    this.faqSearchInput = root.querySelector('#faqSearchInput');
    this.faqSearchInput?.addEventListener('input', this.onFaqBusca);
  }

  // --- Filtra por keywords + pergunta + resposta; mostra "sem resultados" ---
  private faqFiltrar(): void {
    const termo = (this.faqSearchInput?.value ?? '').toLowerCase().trim();
    let achou = false;

    this.faqItems.forEach((item) => {
      const keywords = (item.getAttribute('data-keywords') || '').toLowerCase();
      const pergunta = item.querySelector('summary span')?.textContent?.toLowerCase() || '';
      const resposta = item.querySelector('.faq-answer p')?.textContent?.toLowerCase() || '';
      const combina =
        termo === '' || keywords.includes(termo) || pergunta.includes(termo) || resposta.includes(termo);

      item.style.display = combina ? '' : 'none';
      if (combina) achou = true;
    });

    const semResultados = this.host.nativeElement.querySelector('#faqNoResults') as HTMLElement | null;
    const termoEl = this.host.nativeElement.querySelector('#faqSearchTerm');
    if (semResultados && termoEl) {
      if (termo !== '' && !achou) {
        semResultados.style.display = 'block';
        termoEl.textContent = termo;
      } else {
        semResultados.style.display = 'none';
      }
    }
  }

  // =============================================
  // DESTAQUES .hl-* com paginação (Explorar.js:421-515)
  // =============================================
  private hlPageBtns: Array<HTMLElement & { _hlClick?: (e: Event) => void }> = [];
  private hlNavBtns: Array<HTMLElement & { _hlClick?: (e: Event) => void }> = [];

  // --- Liga setas, paginação numérica, primeira/última e resize ---
  private initHl(): void {
    if (!this.hlTrack || !this.hlPrev || !this.hlNext) return;
    const root = this.host.nativeElement;

    this.hlPrev.nativeElement.addEventListener('click', this.onHlPrevClick);
    this.hlNext.nativeElement.addEventListener('click', this.onHlNextClick);

    // Scroll atualiza a página ativa (com debounce)
    this.hlTrack.nativeElement.addEventListener('scroll', this.onHlTrackScroll);
    window.addEventListener('resize', this.onHlResize);

    // Botões numéricos 1..N rolam até a página
    const paginacao = root.querySelector('#hlPagination');
    this.hlPageBtns = Array.from(paginacao?.querySelectorAll('.hl-page[data-page]') ?? []);
    this.hlPageBtns.forEach((btn) => {
      const ir = () => {
        const pagina = parseInt(btn.getAttribute('data-page') || '1', 10);
        const passo = this.hlPasso();
        if (passo === 0) return;
        this.hlTrack.nativeElement.scrollTo({
          left: (pagina - 1) * this.hlVisiveis() * passo,
          behavior: 'smooth',
        });
      };
      btn._hlClick = ir;
      btn.addEventListener('click', ir);
    });

    // Primeira / Última / Anterior / Próxima
    const nav: Array<[string, () => void]> = [
      ['.hl-page[aria-label="Primeira página"]', () =>
        this.hlTrack.nativeElement.scrollTo({ left: 0, behavior: 'smooth' })],
      ['.hl-page[aria-label="Última página"]', () =>
        this.hlTrack.nativeElement.scrollTo({
          left: this.hlTrack.nativeElement.scrollWidth,
          behavior: 'smooth',
        })],
      ['.hl-page[aria-label="Anterior"]', () =>
        this.hlTrack.nativeElement.scrollBy({
          left: -this.hlPasso() * this.hlVisiveis(),
          behavior: 'smooth',
        })],
      ['.hl-page[aria-label="Próxima"]', () =>
        this.hlTrack.nativeElement.scrollBy({
          left: this.hlPasso() * this.hlVisiveis(),
          behavior: 'smooth',
        })],
    ];
    this.hlNavBtns = [];
    nav.forEach(([sel, fn]) => {
      const btn = paginacao?.querySelector(sel) as (HTMLElement & { _hlClick?: (e: Event) => void }) | null;
      if (!btn) return;
      btn._hlClick = fn;
      btn.addEventListener('click', fn);
      this.hlNavBtns.push(btn);
    });

    this.hlAtualizarPaginacao();
  }

  // --- Passo de um card + gap (fallback 320, idêntico ao original) ---
  private hlPasso(): number {
    const card = this.hlTrack.nativeElement.querySelector('.hl-card') as HTMLElement | null;
    return card ? card.offsetWidth + 20 : 320;
  }

  // --- Quantos cards cabem na viewport do track ---
  private hlVisiveis(): number {
    const passo = this.hlPasso();
    return Math.max(1, Math.floor(this.hlTrack.nativeElement.clientWidth / passo));
  }

  // --- Rola um card para trás/frente ---
  private hlRolar(dir: number): void {
    this.hlTrack.nativeElement.scrollBy({ left: dir * this.hlPasso(), behavior: 'smooth' });
  }

  // --- Marca o botão da página atual conforme o scroll ---
  private hlAtualizarPaginacao(): void {
    const root = this.host.nativeElement;
    const paginacao = root.querySelector('#hlPagination');
    if (!paginacao) return;
    const track = this.hlTrack.nativeElement;
    const passo = this.hlPasso();
    if (passo === 0) return;

    const totalCards = track.querySelectorAll('.hl-card').length;
    const visiveis = this.hlVisiveis();
    const totalPaginas = Math.max(1, Math.ceil(totalCards / visiveis));
    const indice = Math.round(track.scrollLeft / passo);
    const atual = Math.min(totalPaginas, Math.floor(indice / visiveis) + 1);

    paginacao.querySelectorAll('.hl-page[data-page]').forEach((btn) => {
      const pagina = parseInt(btn.getAttribute('data-page') || '0', 10);
      btn.classList.toggle('is-active', pagina === atual);
    });
  }

  // =============================================
  // ATENDIMENTO 3 ESTADOS — MOCK (Explorar.js:517-862)
  // Sem Supabase: protocolo local + espera + eco no chat.
  // ATENDIMENTO real: criar/consultar/responder + realtime (fallback MOCK).
  // =============================================

  // --- Liga contador, submit, botões de espera e chat; restaura salvo ---
  private initAtendimento(): void {
    const root = this.host.nativeElement;
    this.taCaso = root.querySelector('#form-caso');
    this.contadorChars = root.querySelector('#current-chars');
    this.supportForm = root.querySelector('#support-form');
    if (!this.supportForm) return;

    // Contador de caracteres com faixas de alerta
    if (this.taCaso && this.contadorChars) {
      this.contadorChars.textContent = String(this.taCaso.value.length);
      this.taCaso.addEventListener('input', this.onContadorInput);
    }

    this.supportForm.addEventListener('submit', this.onSupportSubmit);
    root.querySelector('#btnCopiarProtocolo')?.addEventListener('click', this.onCopiarProtocolo);
    root.querySelector('#btnVerificarAgora')?.addEventListener('click', this.onVerificarAgora);
    root.querySelector('#btnNovoAtendimento')?.addEventListener('click', this.onNovoAtendimento);
    root.querySelector('#chatForm')?.addEventListener('submit', this.onChatSubmit);

    // Restaura atendimento salvo validando no backend (espelha o original)
    void this.restaurarAtendimento();
  }

  // --- Atendimento atual + canal realtime ---
  private atendimentoAtual: {
    id?: string | number;
    protocolo: string;
    email: string;
    assunto?: string;
    status?: string;
    aprovado?: boolean;
  } | null = null;
  private realtimeAtendimento: { unsubscribe: () => void } | null = null;

  // --- Consulta via rpc consultar_atendimento (espelha carregarAtendimento) ---
  private async consultarAtendimento(protocolo: string, email: string): Promise<{
    id?: string | number;
    protocolo: string;
    email: string;
    assunto?: string;
    status?: string;
    aprovado?: boolean;
    mensagens?: Array<{ tipo: string; autor: string; texto: string }>;
  } | null> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('consultar_atendimento', { p_protocolo: protocolo, p_email: email });
    if (error || !data?.length) return null;
    return data[0];
  }

  // --- Aplica o estado (form/espera/chat) conforme aprovação ---
  private aplicarAtendimento(at: {
    id?: string | number;
    protocolo: string;
    email: string;
    assunto?: string;
    status?: string;
    aprovado?: boolean;
    mensagens?: Array<{ tipo: string; autor: string; texto: string }>;
  }): void {
    this.atendimentoAtual = at;
    const root = this.host.nativeElement;
    const protoExib = root.querySelector('#protocoloExibido');
    if (protoExib) protoExib.textContent = at.protocolo;
    const chatProto = root.querySelector('#chatProtocolo');
    if (chatProto) chatProto.textContent = `Protocolo ${at.protocolo}`;
    const chatAssunto = root.querySelector('#chatAssunto');
    if (chatAssunto) chatAssunto.textContent = at.assunto ?? '—';

    if (!at.aprovado) {
      this.atualizarEstadoEspera(at.status ?? 'aguardando', false);
      this.mostrarEstadoAtendimento('espera');
      return;
    }
    this.mensagensLocais = (at.mensagens ?? []).map((m) => ({
      tipo: 'atendente',
      autor: 'Equipe',
      texto: m.texto,
    }));
    this.renderizarChat();
    this.mostrarEstadoAtendimento('chat');
  }

  // --- Texto/status da espera (espelha atualizarEstadoEspera) ---
  private atualizarEstadoEspera(status: string, aprovado: boolean): void {
    const root = this.host.nativeElement;
    const statusEl = root.querySelector('#statusEsperaTexto');
    const wrap = root.querySelector('.espera-status');
    if (!statusEl || !wrap) return;
    if (status === 'finalizado' && !aprovado) {
      statusEl.textContent = 'Este atendimento foi encerrado pela equipe.';
    } else if (aprovado) {
      statusEl.textContent = 'Atendimento aceito! Carregando conversa…';
    } else {
      statusEl.textContent = 'Aguardando a equipe aceitar seu atendimento…';
    }
  }

  // --- Realtime do atendimento (mensagens INSERT + atendimentos UPDATE) ---
  private assinarRealtimeAtendimento(id: string | number): void {
    this.cancelarRealtimeAtendimento();
    try {
      // Realtime direto (WebSocket não passa pelo proxy de dev).
      const canal = this.supabase
        .getRealtimeClient()
        .channel(`atendimento-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `atendimento_id=eq.${id}` }, () => {
          void this.recarregarAtendimentoAtual();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'atendimentos', filter: `id=eq.${id}` }, () => {
          void this.recarregarAtendimentoAtual();
        })
        .subscribe();
      this.realtimeAtendimento = canal;
    } catch {
      // Sem realtime: segue sem updates ao vivo
    }
  }

  private cancelarRealtimeAtendimento(): void {
    try {
      this.realtimeAtendimento?.unsubscribe();
    } catch {
      // Ignora
    }
    this.realtimeAtendimento = null;
  }

  private async recarregarAtendimentoAtual(): Promise<void> {
    if (!this.atendimentoAtual) return;
    const at = await this.consultarAtendimento(this.atendimentoAtual.protocolo, this.atendimentoAtual.email).catch(
      () => null,
    );
    if (at) this.aplicarAtendimento(at);
  }

  private async restaurarAtendimento(): Promise<void> {
    let salvo: { protocolo: string; email: string } | null = null;
    try {
      salvo = JSON.parse(localStorage.getItem(LS_ATENDIMENTO) || 'null');
    } catch {
      salvo = null;
    }
    if (!salvo) {
      this.mostrarEstadoAtendimento('form');
      return;
    }
    try {
      const at = await this.consultarAtendimento(salvo.protocolo, salvo.email);
      if (!at) throw new Error('não encontrado');
      this.aplicarAtendimento(at);
      if (at.id !== undefined) this.assinarRealtimeAtendimento(at.id);
    } catch {
      localStorage.removeItem(LS_ATENDIMENTO);
      this.mostrarEstadoAtendimento('form');
    }
  }

  // --- Contador 0/4000 com faixas is-warning (>3200) e is-danger (>3800) ---
  private atualizarContador(): void {
    if (!this.taCaso || !this.contadorChars) return;
    const len = this.taCaso.value.length;
    this.contadorChars.textContent = String(len);
    const wrap = this.contadorChars.parentElement;
    wrap?.classList.remove('is-warning', 'is-danger');
    if (len > 3800) wrap?.classList.add('is-danger');
    else if (len > 3200) wrap?.classList.add('is-warning');
  }

  // --- Alterna form / espera / chat ---
  private mostrarEstadoAtendimento(nome: 'form' | 'espera' | 'chat'): void {
    const root = this.host.nativeElement;
    const f = root.querySelector('#estado-formulario') as HTMLElement | null;
    const e = root.querySelector('#estado-espera') as HTMLElement | null;
    const c = root.querySelector('#estado-chat') as HTMLElement | null;
    if (f) f.hidden = nome !== 'form';
    if (e) e.hidden = nome !== 'espera';
    if (c) c.hidden = nome !== 'chat';
  }

  // --- Submit real via rpc criar_atendimento (fallback: MOCK local) ---
  private async enviarAtendimento(e: Event): Promise<void> {
    e.preventDefault();
    const root = this.host.nativeElement;
    const form = this.supportForm;
    if (!form) return;

    const val = (sel: string) =>
      (root.querySelector(sel) as HTMLInputElement | null)?.value.trim() ?? '';
    const nome = val('#form-nome');
    const email = val('#form-email');
    const telefone = val('#form-phone');
    const cidade = val('#form-cidade');
    const canal = (root.querySelector('#form-canal') as HTMLSelectElement | null)?.value ?? 'site';
    const departamento =
      (root.querySelector('#form-depto') as HTMLSelectElement | null)?.value ?? 'suporte';
    const assunto = val('#form-assunto');
    const mensagem = this.taCaso?.value.trim() ?? '';

    if (!nome || !email || !assunto || !mensagem) {
      alert('⚠️ Preencha todos os campos obrigatórios.');
      return;
    }

    const btn = form.querySelector('.submit-form-btn') as HTMLButtonElement | null;
    const original = btn?.textContent ?? '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando...';
    }

    try {
      const { data, error } = await this.supabase.getClient().rpc('criar_atendimento', {
        p_nome: nome,
        p_email: email,
        p_telefone: telefone || null,
        p_cidade: cidade || null,
        p_canal: canal,
        p_departamento: departamento,
        p_assunto: assunto,
        p_mensagem: mensagem,
        p_ip: null,
        p_user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
      const protocolo = (data as Array<{ protocolo?: string }>)?.[0]?.protocolo || '—';
      localStorage.setItem(LS_ATENDIMENTO, JSON.stringify({ protocolo, email }));

      form.reset();
      if (this.contadorChars) {
        this.contadorChars.textContent = '0';
        this.contadorChars.parentElement?.classList.remove('is-warning', 'is-danger');
      }

      const at = await this.consultarAtendimento(protocolo, email);
      if (at) {
        this.aplicarAtendimento(at);
        if (at.id !== undefined) this.assinarRealtimeAtendimento(at.id);
      } else {
        const protoExib = root.querySelector('#protocoloExibido');
        if (protoExib) protoExib.textContent = protocolo;
        this.mensagensLocais = [];
        this.mostrarEstadoAtendimento('espera');
      }
    } catch (err) {
      console.warn('Atendimento MOCK (criar_atendimento falhou):', err);
      const protocolo = `MOCK-${Date.now().toString(36).toUpperCase()}`;
      localStorage.setItem(LS_ATENDIMENTO, JSON.stringify({ protocolo, email }));
      form.reset();
      if (this.contadorChars) {
        this.contadorChars.textContent = '0';
        this.contadorChars.parentElement?.classList.remove('is-warning', 'is-danger');
      }
      const protoExib = root.querySelector('#protocoloExibido');
      if (protoExib) protoExib.textContent = protocolo;
      this.mensagensLocais = [];
      this.mostrarEstadoAtendimento('espera');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = original;
      }
    }
  }

  // --- Copia o protocolo e confirma trocando o ícone por 1.5s ---
  private copiarProtocolo(): void {
    const root = this.host.nativeElement;
    const p = root.querySelector('#protocoloExibido')?.textContent || '';
    void navigator.clipboard.writeText(p).then(() => {
      const btn = root.querySelector('#btnCopiarProtocolo');
      if (!btn) return;
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => { btn.innerHTML = original; }, 1500);
    });
  }

  // --- Verificar agora: consulta real, senão espera MOCK ---
  private async verificarAtendimento(): Promise<void> {
    let salvo: { protocolo: string; email: string } | null = null;
    try {
      salvo = JSON.parse(localStorage.getItem(LS_ATENDIMENTO) || 'null');
    } catch {
      salvo = null;
    }
    if (!salvo) {
      this.mostrarEstadoAtendimento('form');
      return;
    }
    try {
      const at = await this.consultarAtendimento(salvo.protocolo, salvo.email);
      if (!at) throw new Error('não encontrado');
      this.aplicarAtendimento(at);
      if (at.id !== undefined) this.assinarRealtimeAtendimento(at.id);
    } catch {
      const protoExib = this.host.nativeElement.querySelector('#protocoloExibido');
      if (protoExib) protoExib.textContent = salvo.protocolo;
      this.mostrarEstadoAtendimento('espera');
    }
  }

  // --- Novo atendimento: limpa tudo e volta ao form ---
  private novoAtendimento(): void {
    this.cancelarRealtimeAtendimento();
    this.atendimentoAtual = null;
    localStorage.removeItem(LS_ATENDIMENTO);
    this.mensagensLocais = [];
    this.supportForm?.reset();
    if (this.contadorChars) this.contadorChars.textContent = '0';
    this.mostrarEstadoAtendimento('form');
  }

  // --- Envio no chat via rpc responder_atendimento (fallback: eco local) ---
  private async enviarMensagemChat(e: Event): Promise<void> {
    e.preventDefault();
    const root = this.host.nativeElement;
    const ta = root.querySelector('#chatTexto') as HTMLTextAreaElement | null;
    const texto = ta?.value.trim() ?? '';
    if (!texto) return;

    const at = this.atendimentoAtual;
    if (at) {
      try {
        const { error } = await this.supabase
          .getClient()
          .rpc('responder_atendimento', { p_protocolo: at.protocolo, p_email: at.email, p_texto: texto });
        if (error) throw error;
        if (ta) ta.value = '';
        const atual = await this.consultarAtendimento(at.protocolo, at.email);
        if (atual) this.aplicarAtendimento(atual);
        return;
      } catch (err) {
        console.warn('Chat MOCK (responder_atendimento falhou):', err);
      }
    }
    this.mensagensLocais.push({ tipo: 'usuario', autor: 'Você', texto });
    if (ta) ta.value = '';
    this.renderizarChat();
  }

  // --- Desenha as mensagens locais no chat (mesma estrutura do original) ---
  private renderizarChat(): void {
    const el = this.host.nativeElement.querySelector('#chatMensagens');
    if (!el) return;
    el.innerHTML = this.mensagensLocais
      .map(
        (m) => `
            <div class="chat-msg chat-msg--${m.tipo}">
                <span class="chat-msg-autor">${m.autor}</span>
                <div class="chat-msg-balao">${(m.texto || '').replace(/\n/g, '<br>')}</div>
            </div>`,
      )
      .join('');
    el.scrollTop = el.scrollHeight;
  }
}
