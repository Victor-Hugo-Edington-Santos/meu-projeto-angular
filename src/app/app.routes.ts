import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './home/home';
import { Login } from './login/login';
import { Direitos } from './pages/direitos/direitos';
import { Explorar } from './pages/explorar/explorar';
import { Blog } from './pages/blog/blog';
import { BlogPost } from './pages/blog-post/blog-post';
import { Recursos } from './pages/recursos/recursos';
import { Arquivo3leis } from './pages/arquivo3leis/arquivo3leis';
import { Apoiar } from './pages/apoiar/apoiar';
import { Loja } from './pages/loja/loja';
import { Comunidade } from './pages/comunidade/comunidade';
import { Perfil } from './pages/perfil/perfil';
import { Configuracoes } from './pages/configuracoes/configuracoes';
import { PainelAdmin } from './pages/painel-admin/painel-admin';
import { adminGuard } from './guards/admin.guard';
import { RedefinirSenha } from './pages/redefinir-senha/redefinir-senha';
import { PoliticaPrivacidade } from './pages/politica-privacidade/politica-privacidade';
import { TermosDeUso } from './pages/termos-de-uso/termos-de-uso';
import { authGuard } from './guards/auth.guard';
import { EventosGerenciar } from './pages/configuracoes/eventos-gerenciar/eventos-gerenciar';
import { GerenciarLoja } from './pages/configuracoes/gerenciar-loja/gerenciar-loja';
import { GruposGerenciar } from './pages/configuracoes/grupos-gerenciar/grupos-gerenciar';
import { Moderacao } from './pages/configuracoes/moderacao/moderacao';
import { PainelSac } from './pages/configuracoes/painel-sac/painel-sac';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', component: Home, pathMatch: 'full' },
      { path: 'direitos', component: Direitos },
      { path: 'explorar', component: Explorar },
      { path: 'blog', component: Blog },
      { path: 'blog/post-masking', component: BlogPost },
      { path: 'recursos', component: Recursos },
      { path: 'arquivo3leis', component: Arquivo3leis },
      { path: 'apoiar', component: Apoiar },
      { path: 'loja', component: Loja },
      { path: 'comunidade', component: Comunidade },
      { path: 'comunidade/perfil', component: Perfil },
      { path: 'comunidade/perfil/:id', component: Perfil },
      { path: 'configuracoes', component: Configuracoes, canActivate: [authGuard] },
      { path: 'configuracoes/eventos', component: EventosGerenciar, canActivate: [adminGuard] },
      { path: 'configuracoes/loja', component: GerenciarLoja, canActivate: [adminGuard] },
      { path: 'configuracoes/grupos', component: GruposGerenciar, canActivate: [adminGuard] },
      { path: 'configuracoes/moderacao', component: Moderacao, canActivate: [adminGuard] },
      { path: 'configuracoes/sac', component: PainelSac, canActivate: [adminGuard] },
      { path: 'politica-privacidade', component: PoliticaPrivacidade },
      { path: 'termos-de-uso', component: TermosDeUso },
    ],
  },
  { path: 'login', component: Login },
  { path: 'redefinir-senha', component: RedefinirSenha },
  { path: 'painel-admin', component: PainelAdmin, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' },
];
