import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// TODO SUPABASE: migrar lógica de configurações/grupos do original (grupo.html/grupo.js) para Supabase.
@Component({
  selector: 'app-grupos-gerenciar',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './grupos-gerenciar.css',
  templateUrl: './grupos-gerenciar.html',
})
export class GruposGerenciar {}
