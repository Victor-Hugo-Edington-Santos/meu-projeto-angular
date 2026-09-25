# Amor NeuroDivergente

Comunidade neuroinclusiva — projeto para o desafio final do Ford Enter (Trilha Front-End).

## Stack
- Angular 20 (standalone components)
- TypeScript
- Supabase (auth + banco + storage + realtime)
- HTML5, CSS3
- FontAwesome 6.4.0

## Requisitos
- Node `^22.22.3 || ^24.15.0 || >=26` (exigido pelo Angular 22)
- npm 11+

## Como rodar
git clone https://github.com/Victor-Hugo-Edington-Santos/meu-projeto-angular.git
cd meu-projeto-angular
npm install
npm start
Acesse http://localhost:4200

Não é preciso criar `.env` nem `src/environments/` na mão: ambos vêm no clone.

Use `npm start` (ou `npx ng serve`). **`npx start` não funciona** — o npx
procura executáveis em `node_modules/.bin` e não lê os scripts do
package.json, então dá `could not determine executable to run`.

## Configuração (Supabase)
A configuração fica no `.env` da raiz, versionado de propósito:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_KEY=sb_publishable_...
```

A chave `sb_publishable_` é pública por design (a Supabase a cria para ir no
bundle do navegador). **Nunca** coloque a `service_role` aqui: se precisar de
dado privado, use edge functions.

O `.env` é a fonte única: os hooks `prebuild`/`prestart`/`prewatch`/`pretest`
rodam `scripts/generate-environments.mjs`, que gera `src/environments/`
(`environment.ts` e `environment.prod.ts`) antes de cada build. Esses dois
arquivos também são versionados, para que um clone novo já compile.

## Como buildar
npm run build -- --base-href "/amor-neurodivergente/"

## Estrutura
- src/app/layouts/main-layout — shell compartilhado
- src/app/pages/* — páginas
- src/app/services/* — AuthService, SupabaseService
- src/environments/* — config Supabase (gerada do .env)
- scripts/generate-environments.mjs — gera src/environments a partir do .env
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
