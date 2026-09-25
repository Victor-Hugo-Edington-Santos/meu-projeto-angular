import { Component, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';

// --- Página estática: §§9-11 do recursos.js (busca/filtros/newsletter)
// referenciam elementos inexistentes no HTML (guards mortos), então
// não há lógica para migrar. Só template + CSS escopado.
@Component({
  imports: [RouterLink],
  selector: 'app-recursos',
  standalone: true,
  styleUrl: './recursos.css',
  templateUrl: './recursos.html',
})
export class Recursos {
  /** Seção atualmente selecionada na barra fixa de Recursos. */
  secaoAtiva = 'artigos-externos';

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  /** Rola para uma seção e mantém o chip correspondente ativo. */
  rolarPara(id: string): void {
    this.secaoAtiva = id;
    const el = this.host.nativeElement.querySelector('#' + CSS.escape(id));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
