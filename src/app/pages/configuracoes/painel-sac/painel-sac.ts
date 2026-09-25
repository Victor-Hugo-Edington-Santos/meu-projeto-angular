import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// TODO SUPABASE: migrar lógica de configurações/painelsac do original (sac.html/sac.js) para Supabase.
@Component({
  selector: 'app-painel-sac',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './painel-sac.css',
  templateUrl: './painel-sac.html',
})
export class PainelSac {}
