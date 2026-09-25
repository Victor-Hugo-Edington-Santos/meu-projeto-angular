import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// TODO SUPABASE: migrar lógica de configurações/moderacao do original (moderação.html/moderação.js) para Supabase.
@Component({
  selector: 'app-moderacao',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './moderacao.css',
  templateUrl: './moderacao.html',
})
export class Moderacao {}
