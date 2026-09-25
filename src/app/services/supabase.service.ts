import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// --- Supabase direto na URL absoluta (createClient exige http(s)).
// CORS é responsabilidade do servidor; em caso de falha, cada chamada
// tem fallback MOCK e o site continua funcionando.
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly realtimeClient: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
    this.realtimeClient = this.client; // mesmo cliente, mesma URL
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getRealtimeClient(): SupabaseClient {
    return this.realtimeClient;
  }

  disponivel(): boolean {
    return true;
  }
}
