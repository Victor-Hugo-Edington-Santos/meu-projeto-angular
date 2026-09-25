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

## Como rodar em um PC novo (Windows)
1. `git clone https://github.com/Victor-Hugo-Edington-Santos/meu-projeto-angular.git`
2. **Dê duplo clique no `setup.bat`**
3. `npm start` → abra http://localhost:4200

O `setup.bat` faz tudo sozinho: confere se o Node instalado atende ao
`engines` do `package.json` (e diz qual versão instalar se não atender), roda
`npm ci`, e valida o `.env` e os arquivos de `src/environments`. Não precisa
criar nenhum arquivo na mão — o `.env` já vem no clone.

## Como rodar
git clone https://github.com/Victor-Hugo-Edington-Santos/meu-projeto-angular.git
cd meu-projeto-angular
setup.bat
npm start
Acesse http://localhost:4200

No macOS/Linux sem `setup.bat`, o equivalente é:

```
npm ci
npm start
```

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
npm run build -- --base-href "/meu-projeto-angular/"

O `--base-href` tem que ser `/meu-projeto-angular/` (o nome do repositório),
porque é onde o GitHub Pages publica. Site: https://victor-hugo-edington-santos.github.io/meu-projeto-angular/

## Estrutura
- src/app/layouts/main-layout — shell compartilhado
- src/app/pages/* — páginas
- src/app/services/* — AuthService, SupabaseService
- src/environments/* — config Supabase (gerada do .env)
- setup.bat — setup automático no Windows (checagem de Node + npm ci + validações)
- scripts/generate-environments.mjs — gera src/environments a partir do .env
- scripts/setup-check.mjs — checagens de setup (versão do Node, arquivos de env)
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
