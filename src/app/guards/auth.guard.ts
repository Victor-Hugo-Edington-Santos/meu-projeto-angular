import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.estaLogado()) return true;
  // Fallback síncrono via localStorage (sessão restaurada de forma assíncrona no service)
  try {
    if (localStorage.getItem('userLoggedIn') === 'true') return true;
  } catch {
    // storage indisponível: segue para /login
  }
  return router.createUrlTree(['/login']);
};
