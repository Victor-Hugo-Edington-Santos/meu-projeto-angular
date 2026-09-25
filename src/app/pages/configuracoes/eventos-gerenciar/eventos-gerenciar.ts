import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// TODO SUPABASE: migrar lógica de configurações/eventos do original (eventos.html/eventos.js) para Supabase.
@Component({
  selector: 'app-eventos-gerenciar',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './eventos-gerenciar.css',
  templateUrl: './eventos-gerenciar.html',
})
export class EventosGerenciar {}
