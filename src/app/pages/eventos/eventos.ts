import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

// --- Eventos é standalone (fora do MainLayout): sidebar/header próprios.
// NOTA: a "navbar que some ao descer" do eventos.js referencia #navbar e
// #a11yDropdown, que NÃO existem no HTML — aquele trecho quebrava no original
// (TypeError em navbar.classList). Migrada só a parte funcional: progresso.
// Abas Calendário + Calls são novas (não existiam no original):
// calls em localStorage (cx_calls) + TODO SUPABASE (sem tabela calls no backend).
interface EventoItem {
  id: string;
  titulo: string;
  descricao: string;
  dia: number;
  mes: number; // 0-11
  ano: number;
  hora: string;
  local: string;
  participantes: number;
  online: boolean;
  imagem: string;
}

interface CallItem {
  id: string;
  titulo: string;
  dataHora: string; // ISO local
  meetUrl: string;
}

interface ItemCalendario {
  titulo: string;
  hora: string;
  tipo: 'evento' | 'call';
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const LS_INSCRICOES = 'cx_inscricoes';
const LS_CALLS = 'cx_calls';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './eventos.css',
  templateUrl: './eventos.html',
})
export class Eventos implements AfterViewInit, OnDestroy {
  @ViewChild('sidebarToggleBtn') sidebarToggleBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('sidebar') sidebar!: ElementRef<HTMLElement>;
  @ViewChild('sidebarOverlay') sidebarOverlay!: ElementRef<HTMLElement>;
  @ViewChild('profileToggle') profileToggle!: ElementRef<HTMLButtonElement>;
  @ViewChild('profileDetail') profileDetail!: ElementRef<HTMLElement>;
  @ViewChild('readingProgress') readingProgress!: ElementRef<HTMLElement>;

  // --- Abas da página ---
  aba: 'eventos' | 'calendario' | 'calls' = 'eventos';

  // --- Eventos (mesmos 4 do HTML estático original) ---
  eventos: EventoItem[] = [
    {
      id: 'ev1', titulo: 'Grupo de Apoio: Pais de Crianças Autistas',
      descricao: 'Encontro quinzenal mediado por psicóloga neurodivergente. Espaço seguro para compartilhar experiências da parentalidade atípica.',
      dia: 22, mes: 5, ano: new Date().getFullYear(), hora: '19h - 20h30', local: 'Zoom',
      participantes: 23, online: true,
      imagem: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=300&fit=crop',
    },
    {
      id: 'ev2', titulo: 'Workshop: Estratégias Sensoriais para Casa',
      descricao: 'Aprenda a criar um ambiente acolhedor com recursos simples e baratos. Para famílias e pessoas neurodivergentes.',
      dia: 5, mes: 6, ano: new Date().getFullYear(), hora: '14h - 16h', local: 'São Paulo/SP',
      participantes: 45, online: false,
      imagem: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=300&fit=crop',
    },
    {
      id: 'ev3', titulo: 'Roda de Conversa: TDAH na Vida Adulta',
      descricao: 'Compartilhe estratégias, desafios e conquistas. Mediação de psicólogo especializado em TDAH adulto.',
      dia: 18, mes: 6, ano: new Date().getFullYear(), hora: '20h - 21h30', local: 'Google Meet',
      participantes: 67, online: true,
      imagem: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&h=300&fit=crop',
    },
    {
      id: 'ev4', titulo: 'Palestra: Direitos Neurodivergentes na Educação',
      descricao: 'Advogada especializada explica as principais leis e como garantir adaptações escolares para crianças e adultos.',
      dia: 10, mes: 7, ano: new Date().getFullYear(), hora: '10h - 12h', local: 'Rio de Janeiro + Online',
      participantes: 89, online: true,
      imagem: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=300&fit=crop',
    },
  ];

  inscricoes = new Set<string>();
  diasCalendario: Array<{ dia: number | null; itens: ItemCalendario[] }> = [];
  anoCal = new Date().getFullYear();
  mesCal = new Date().getMonth();
  diaSelecionado: number | null = null;

  calls: CallItem[] = [];

  constructor() {
    this.carregarInscricoes();
    this.carregarCalls();
    this.montarCalendario();
  }

  trocarAba(aba: 'eventos' | 'calendario' | 'calls'): void {
    this.aba = aba;
    if (aba === 'calendario') this.montarCalendario();
  }

  // --- Inscrição local (TODO SUPABASE: event_participants) ---
  estaInscrito(id: string): boolean {
    return this.inscricoes.has(id);
  }

  alternarInscricao(id: string): void {
    if (this.inscricoes.has(id)) this.inscricoes.delete(id);
    else this.inscricoes.add(id);
    try {
      localStorage.setItem(LS_INSCRICOES, JSON.stringify([...this.inscricoes]));
    } catch {
      // ignora
    }
  }

  private carregarInscricoes(): void {
    try {
      const raw = localStorage.getItem(LS_INSCRICOES);
      const lista = raw ? (JSON.parse(raw) as string[]) : [];
      this.inscricoes = new Set(Array.isArray(lista) ? lista : []);
    } catch {
      this.inscricoes = new Set();
    }
  }

  // --- Calendário mensal (eventos + calls com data válida) ---
  get nomeMesCal(): string {
    return MESES_PT[this.mesCal];
  }

  mesAnterior(): void {
    this.mesCal--;
    if (this.mesCal < 0) {
      this.mesCal = 11;
      this.anoCal--;
    }
    this.diaSelecionado = null;
    this.montarCalendario();
  }

  proximoMes(): void {
    this.mesCal++;
    if (this.mesCal > 11) {
      this.mesCal = 0;
      this.anoCal++;
    }
    this.diaSelecionado = null;
    this.montarCalendario();
  }

  private itensDoDia(dia: number): ItemCalendario[] {
    const itens: ItemCalendario[] = [];
    for (const e of this.eventos) {
      if (e.ano === this.anoCal && e.mes === this.mesCal && e.dia === dia) {
        itens.push({ titulo: e.titulo, hora: e.hora, tipo: 'evento' });
      }
    }
    for (const c of this.calls) {
      const d = new Date(c.dataHora);
      if (!isNaN(d.getTime()) && d.getFullYear() === this.anoCal && d.getMonth() === this.mesCal && d.getDate() === dia) {
        itens.push({
          titulo: c.titulo,
          hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          tipo: 'call',
        });
      }
    }
    return itens;
  }

  montarCalendario(): void {
    const primeiro = new Date(this.anoCal, this.mesCal, 1).getDay();
    const total = new Date(this.anoCal, this.mesCal + 1, 0).getDate();
    const dias: Array<{ dia: number | null; itens: ItemCalendario[] }> = [];
    for (let i = 0; i < primeiro; i++) dias.push({ dia: null, itens: [] });
    for (let d = 1; d <= total; d++) dias.push({ dia: d, itens: this.itensDoDia(d) });
    this.diasCalendario = dias;
  }

  selecionarDia(dia: number | null): void {
    if (dia === null) return;
    this.diaSelecionado = this.diaSelecionado === dia ? null : dia;
  }

  get itensDiaSelecionado(): ItemCalendario[] {
    if (this.diaSelecionado === null) return [];
    return this.itensDoDia(this.diaSelecionado);
  }

  get eventosSemData(): EventoItem[] {
    return this.eventos.filter(
      (e) => !(e.dia >= 1 && e.dia <= 31 && e.mes >= 0 && e.mes <= 11 && e.ano > 2000),
    );
  }

  siglaMes(mes: number): string {
    return ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][mes] ?? '';
  }

  // --- Calls (localStorage + TODO SUPABASE tabela calls) ---
  private carregarCalls(): void {
    try {
      const raw = localStorage.getItem(LS_CALLS);
      const lista = raw ? (JSON.parse(raw) as CallItem[]) : [];
      this.calls = Array.isArray(lista) ? lista : [];
    } catch {
      this.calls = [];
    }
  }

  private salvarCalls(): void {
    try {
      localStorage.setItem(LS_CALLS, JSON.stringify(this.calls));
    } catch {
      // ignora
    }
  }

  agendarCall(titulo: string, dataHora: string, meetUrl: string): void {
    const t = titulo.trim();
    const url = meetUrl.trim();
    if (!t || !dataHora || !url) return;
    this.calls.unshift({ id: `call-${Date.now()}`, titulo: t, dataHora, meetUrl: url });
    this.salvarCalls();
    this.montarCalendario();
  }

  entrarCall(call: CallItem): void {
    window.open(call.meetUrl, '_blank', 'noopener');
  }

  apagarCall(id: string): void {
    if (!confirm('Apagar esta call agendada?')) return;
    this.calls = this.calls.filter((c) => c.id !== id);
    this.salvarCalls();
    this.montarCalendario();
  }

  formatarDataHora(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // --- Liga/desliga .scrolled no header + preenche a barra de progresso ---
  private onWindowScroll = () => {
    if (this.readingProgress) {
      const doc = document.documentElement.scrollHeight - window.innerHeight;
      const pct = doc > 0 ? (window.scrollY / doc) * 100 : 0;
      this.readingProgress.nativeElement.style.width = Math.min(pct, 100) + '%';
    }
  };

  // --- Sidebar própria (mesmo padrão do sidebar.js) ---
  private onToggleClick = (e: Event) => {
    e.stopPropagation();
    this.sidebar?.nativeElement.classList.toggle('open');
    this.sidebarOverlay?.nativeElement.classList.toggle('active');
    document.body.style.overflow = this.sidebar?.nativeElement.classList.contains('open')
      ? 'hidden'
      : '';
  };
  private onOverlayClick = () => {
    this.sidebar?.nativeElement.classList.remove('open');
    this.sidebarOverlay?.nativeElement.classList.remove('active');
    document.body.style.overflow = '';
  };
  private onSidebarEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.onOverlayClick();
  };
  private onProfileClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (!this.profileToggle || !this.profileDetail) return;
    const detail = this.profileDetail.nativeElement;
    const toggle = this.profileToggle.nativeElement;
    if (detail.hasAttribute('hidden')) {
      detail.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      detail.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };

  ngAfterViewInit(): void {
    // --- Progresso de leitura ---
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
    this.onWindowScroll();

    // --- Sidebar própria ---
    this.sidebarToggleBtn?.nativeElement.addEventListener('click', this.onToggleClick);
    this.sidebarOverlay?.nativeElement.addEventListener('click', this.onOverlayClick);
    document.addEventListener('keydown', this.onSidebarEsc);
    this.profileToggle?.nativeElement.addEventListener('click', this.onProfileClick);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onWindowScroll);
    this.sidebarToggleBtn?.nativeElement.removeEventListener('click', this.onToggleClick);
    this.sidebarOverlay?.nativeElement.removeEventListener('click', this.onOverlayClick);
    document.removeEventListener('keydown', this.onSidebarEsc);
    this.profileToggle?.nativeElement.removeEventListener('click', this.onProfileClick);
  }
}
