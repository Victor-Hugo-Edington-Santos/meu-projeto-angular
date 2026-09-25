import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

// --- Guard de admin: exige login + profiles.is_admin/is_moderator ---
// Não logado → /login. Logado sem flag → / (sem expor motivo).
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (!auth.estaLogado()) return router.createUrlTree(['/login']);

  try {
    const usuario = auth.getUsuarioAtual();
    if (!usuario) return router.createUrlTree(['/login']);
    const { data, error } = await supabase
      .getClient()
      .from('profiles')
      .select('is_admin, is_moderator')
      .eq('id', usuario.id)
      .maybeSingle();
    // 401 (sessão inválida) → /login; demais erros/ausência de flag → /
    if (error && /jwt|auth|401|unauthorized/i.test(error.message)) {
      return router.createUrlTree(['/login']);
    }
    const p = data as { is_admin?: boolean; is_moderator?: boolean } | null;
    if (p?.is_admin === true || p?.is_moderator === true) return true;
    return router.createUrlTree(['/']);
  } catch {
    return router.createUrlTree(['/']);
  }
};
