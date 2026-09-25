import { Component } from '@angular/core';
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
export class Recursos {}
