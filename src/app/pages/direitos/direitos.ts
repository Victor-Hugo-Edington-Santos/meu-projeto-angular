import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

// --- Item do banco de leis local (mesmos campos do direitos.js) ---
interface Lei {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  numero: string;
  icone: string;
  linkExterno: string;
}

// --- Banco de leis verbatim do direitos.js:258-271 ---
const BANCO_DE_LEIS: Lei[] = [
  { id: 1, titulo: 'Lei Berenice Piana', descricao: 'Estabelece direitos da pessoa com Transtorno do Espectro Autista, garantindo acesso à educação e serviços públicos.', categoria: 'saude', numero: '12.764/2012', icone: 'fa-solid fa-heart-pulse', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12764.htm' },
  { id: 2, titulo: 'Lei Brasileira de Inclusão (LBI)', descricao: 'Assegura e promove condições de igualdade e exercício dos direitos das pessoas com deficiência.', categoria: 'social', numero: '13.146/2015', icone: 'fa-solid fa-handshake', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm' },
  { id: 3, titulo: 'Lei Romeo Mion', descricao: 'Cria a Carteira de Identificação da Pessoa com TEA (CIPTEA), facilitando o acesso a direitos.', categoria: 'social', numero: '13.977/2020', icone: 'fa-solid fa-id-card', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/L13977.htm' },
  { id: 4, titulo: 'BPC - Benefício de Prestação Continuada', descricao: 'Garante um salário mínimo mensal à pessoa com deficiência de baixa renda.', categoria: 'social', numero: '8.742/1993', icone: 'fa-solid fa-money-bill-wave', linkExterno: 'http://www.planalto.gov.br/ccivil_03/leis/l8742.htm' },
  { id: 5, titulo: 'Lei de Cotas para PCD', descricao: 'Reserva de vagas para pessoas com deficiência em empresas com mais de 100 funcionários.', categoria: 'social', numero: '8.213/1991', icone: 'fa-solid fa-briefcase', linkExterno: 'http://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm' },
  { id: 6, titulo: 'Lei de Acessibilidade', descricao: 'Normas gerais e critérios básicos para promoção da acessibilidade das pessoas com deficiência.', categoria: 'acessibilidade', numero: '10.098/2004', icone: 'fa-solid fa-universal-access', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.098.htm' },
  { id: 7, titulo: 'Lei da Libras', descricao: 'Reconhece a Língua Brasileira de Sinais como meio legal de comunicação e expressão.', categoria: 'acessibilidade', numero: '10.436/2002', icone: 'fa-solid fa-hands', linkExterno: 'http://www.planalto.gov.br/ccivil_03/leis/2002/l10436.htm' },
  { id: 8, titulo: 'Decreto de Acessibilidade', descricao: 'Regulamenta a acessibilidade em edificações, mobiliário urbano e transporte.', categoria: 'acessibilidade', numero: '5.296/2004', icone: 'fa-solid fa-wheelchair', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5296.htm' },
  { id: 9, titulo: 'Direito à Saúde Mental', descricao: 'Redirecionamento do modelo assistencial em saúde mental, priorizando o tratamento em comunidade.', categoria: 'saude', numero: '10.216/2001', icone: 'fa-solid fa-brain', linkExterno: 'http://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10216.htm' },
  { id: 10, titulo: 'Lei do Acompanhante Terapêutico', descricao: 'Garante o direito ao acompanhante terapêutico em instituições de ensino para pessoas com deficiência.', categoria: 'educacional', numero: '13.146/2015', icone: 'fa-solid fa-chalkboard-user', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm' },
  { id: 11, titulo: 'Lei da Educação Especial', descricao: 'Diretrizes para a educação especial na perspectiva da educação inclusiva.', categoria: 'educacional', numero: '11.788/2008', icone: 'fa-solid fa-graduation-cap', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11788.htm' },
  { id: 12, titulo: 'Lei da Inclusão Profissional', descricao: 'Estabelece quotas para pessoas com deficiência no mercado de trabalho.', categoria: 'educacional', numero: '13.370/2016', icone: 'fa-solid fa-user-tie', linkExterno: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13370.htm' },
];

// --- Imagens por categoria (getLawImage do direitos.js:292-321) ---
const IMAGENS_POR_CATEGORIA: Record<string, string[]> = {
  educacional: [
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=80',
    'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=900&q=80',
  ],
  saude: [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=900&q=80',
    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=900&q=80',
    'https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=900&q=80',
  ],
  social: [
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=80',
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=900&q=80',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=900&q=80',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=80',
  ],
  acessibilidade: [
    'https://images.unsplash.com/photo-1584467735815-f778f274e296?w=900&q=80',
    'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=900&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=80',
  ],
};

// --- Categorias do filtro da biblioteca de leis ---
const CATEGORIAS_VALIDAS: readonly string[] = [
  'educacional',
  'saude',
  'social',
  'acessibilidade',
];

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-direitos',
  standalone: true,
  styleUrl: './direitos.css',
  templateUrl: './direitos.html',
})
export class Direitos {
  private readonly route = inject(ActivatedRoute);

  // --- Estado de filtro (currentFilter/currentSearch do original) ---
  filtroCategoria = 'todas';
  busca = '';

  casoForm: FormGroup;

  constructor(private readonly fb: FormBuilder) {
    // --- Mesmos campos obrigatórios do caseForm original ---
    this.casoForm = this.fb.group({
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      descricao: ['', Validators.required],
    });

    // --- Deep-link: /direitos?categoria=social abre a biblioteca já filtrada.
    // Usado pelos chips "Seus Direitos" da home, que apontavam para um
    // /direitos/direitos.html inexistente. Valores fora da lista são ignorados.
    const categoriaInicial = this.route.snapshot.queryParamMap.get('categoria');
    if (categoriaInicial && CATEGORIAS_VALIDAS.includes(categoriaInicial)) {
      this.filtroCategoria = categoriaInicial;
    }
  }

  // --- Leis após filtro de categoria + busca (renderLaws do original) ---
  get leisFiltradas(): Lei[] {
    let lista = [...BANCO_DE_LEIS];
    if (this.filtroCategoria !== 'todas') {
      lista = lista.filter((l) => l.categoria === this.filtroCategoria);
    }
    const termo = this.busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter(
        (l) =>
          l.titulo.toLowerCase().includes(termo) ||
          l.descricao.toLowerCase().includes(termo) ||
          l.numero.includes(termo),
      );
    }
    return lista;
  }

  // --- Clique nos tiles: filtra e limpa a busca (idêntico ao original) ---
  filtrarPor(categoria: string): void {
    this.filtroCategoria = categoria;
    this.busca = '';
  }

  // --- Rótulo da categoria (categoryMap do original) ---
  nomeCategoria(categoria: string): string {
    const mapa: Record<string, string> = {
      educacional: 'Educacional',
      social: 'Assistência Social',
      acessibilidade: 'Acessibilidade',
      saude: 'Saúde',
    };
    return mapa[categoria] ?? categoria;
  }

  // --- Imagem rotativa por categoria com fallback social ---
  imagemDaLei(lei: Lei, indice: number): string {
    const arr = IMAGENS_POR_CATEGORIA[lei.categoria] ?? IMAGENS_POR_CATEGORIA['social'];
    return arr[indice % arr.length];
  }

  // --- Envio do caso: valida, confirma via toast e limpa (idêntico ao original) ---
  enviarCaso(): void {
    if (this.casoForm.invalid) {
      this.showToast('Preencha todos os campos para enviar seu caso.', 'error');
      return;
    }
    this.showToast('Caso enviado! Nossa equipe vai analisar em breve. 💜', 'success');
    this.casoForm.reset();
  }

  // --- Toast idêntico ao showToast do direitos.js (estilo inline) ---
  private showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    document.querySelector('.toast-msg-dynamic')?.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-msg-dynamic';
    toast.textContent = message;
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2d2a28'};color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.15);`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
