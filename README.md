# Amor NeuroDivergente

Comunidade neuroinclusiva — projeto para o desafio final do Ford Enter (Trilha Front-End).

## Stack
- Angular 20 (standalone components)
- TypeScript
- Supabase (auth + banco + storage + realtime)
- HTML5, CSS3
- FontAwesome 6.4.0

## Como rodar
npm install
ng serve
Acesse http://localhost:4200

## Como buildar
ng build --configuration production --base-href "/amor-neurodivergente/"

## Estrutura
- src/app/layouts/main-layout — shell compartilhado
- src/app/pages/* — páginas
- src/app/services/* — AuthService, SupabaseService
- src/environments/* — config Supabase
- public/img/* — assets

## Funcionalidades
- Autenticação real (login, cadastro, logout, redefinir senha)
- Feed da comunidade (posts, curtidas, comentários, realtime)
- Grupos, Eventos, Conversa (chat)
- Perfil editável com upload
- Loja com wishlist
- AcolherIA (chat com IA)
- Atendimento
- Acessibilidade (userway, VLibras, dark mode)
- LGPD (Política + Termos + consentimento)

## Responsividade
Testado em 375px, 390px, 768px, 1024px, 1440px.

## Autor
Victor Hugo de Araújo Nascimento
Desafio Final — Ford Enter
