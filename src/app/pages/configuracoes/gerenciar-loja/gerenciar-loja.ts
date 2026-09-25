import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// TODO SUPABASE: migrar lógica de configurações/gerenciarloja do original (loja.html) para Supabase.
@Component({
  selector: 'app-gerenciar-loja',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './gerenciar-loja.css',
  templateUrl: './gerenciar-loja.html',
})
export class GerenciarLoja {}
