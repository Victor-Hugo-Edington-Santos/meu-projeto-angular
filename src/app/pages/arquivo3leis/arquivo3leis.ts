import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// --- Documento estático (100% visual; único comportamento é o download) ---
@Component({
  imports: [RouterLink],
  selector: 'app-arquivo3leis',
  standalone: true,
  styleUrl: './arquivo3leis.css',
  templateUrl: './arquivo3leis.html',
})
export class Arquivo3leis {
  // --- Baixa o HTML renderizado como arquivo (baixarHTML do original) ---
  baixarDocumento(): void {
    const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Amor_Neuro_Divergente_Estrutura_Juridica.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
