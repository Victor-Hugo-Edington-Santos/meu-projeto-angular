import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-apoiar',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './apoiar.css',
  templateUrl: './apoiar.html',
})
export class Apoiar {
  // --- Instituições para ajudar neurodivergentes (doação direto no site oficial) ---
  readonly instituicoes = [
    {
      nome: 'AMA — Associação de Amigos do Autista',
      tag: 'Autismo',
      icone: 'fa-solid fa-people-group',
      descricao: 'A associação de autismo mais antiga do país — e tem seção de doações no próprio site.',
      dominio: 'ama.org.br',
      url: 'https://ama.org.br/',
    },
    {
      nome: 'Instituto Autismo e Vida',
      tag: 'Rede por estado',
      icone: 'fa-solid fa-map-location-dot',
      descricao: 'Mantém uma lista de ONGs por estado. Várias atuam só localmente — confira a mais próxima da sua região.',
      dominio: 'autismoevida.org.br',
      url: 'https://www.autismoevida.org.br/',
    },
    {
      nome: 'Vozes Atípicas',
      tag: 'TDAH e mais',
      icone: 'fa-solid fa-comments',
      descricao: 'Atende também TDAH, TOD e outras condições — não só autismo.',
      dominio: 'vozesatipicas.org',
      url: 'https://vozesatipicas.org/',
    },
    {
      nome: 'Specialisterne Brasil',
      tag: 'Emprego',
      icone: 'fa-solid fa-briefcase',
      descricao: 'Foco em inclusão no mercado de trabalho para pessoas neurodivergentes.',
      dominio: 'specialisternebrasil.com',
      url: 'https://specialisternebrasil.com/en/',
    },
    {
      nome: 'Portal da Neurodiversidade',
      tag: 'Informação',
      icone: 'fa-solid fa-book-open-reader',
      descricao: 'Conteúdo e recursos sobre neurodiversidade para se informar e apoiar melhor.',
      dominio: 'portaldaneurodiversidade.com',
      url: 'https://portaldaneurodiversidade.com/',
    },
  ];
}
