/**
 * Gera `src/environments/environment.ts` e `environment.prod.ts` a partir
 * do `.env` da raiz (fonte unica de verdade).
 *
 * Roda automaticamente pelos hooks `prebuild` / `prestart` / `prewatch` /
 * `pretest` do package.json. Sem dependencias externas: le o arquivo de
 * texto e aplica um parser de dotenv minimo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(raiz, '.env');
const destinoDir = join(raiz, 'src', 'environments');

/** Parser de dotenv minimo: KEY=VALUE, `#` comenta, aspas opcionais, CRLF. */
function lerDotEnv(conteudo) {
  const valores = {};
  for (const linhaCrua of conteudo.split(/\r?\n/)) {
    const linha = linhaCrua.trim();
    if (!linha || linha.startsWith('#')) continue;
    const separador = linha.indexOf('=');
    if (separador === -1) continue;
    const chave = linha.slice(0, separador).trim();
    let valor = linha.slice(separador + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (chave) valores[chave] = valor;
  }
  return valores;
}

if (!existsSync(envPath)) {
  console.error(`\n[env] Arquivo .env nao encontrado em ${envPath}`);
  console.error('[env] Crie-o com SUPABASE_URL= e SUPABASE_KEY= e rode de novo.\n');
  process.exit(1);
}

const env = lerDotEnv(readFileSync(envPath, 'utf8'));
const url = env['SUPABASE_URL'] ?? '';
const key = env['SUPABASE_KEY'] ?? '';

const faltando = [
  ...(url ? [] : ['SUPABASE_URL']),
  ...(key ? [] : ['SUPABASE_KEY']),
];
if (faltando.length > 0) {
  console.error(`\n[env] Variavel(is) ausente(s) no .env: ${faltando.join(', ')}\n`);
  process.exit(1);
}

if (!/^https?:\/\/.+/.test(url)) {
  console.error(`\n[env] SUPABASE_URL invalida: "${url}" (esperado http(s)://...)\n`);
  process.exit(1);
}

if (!/^sb_(publishable|anon)_|^eyJ/.test(key)) {
  console.warn(
    '[env] Aviso: SUPABASE_KEY nao tem formato de publishable/anon key. Confira o valor no .env.',
  );
}

if (key.startsWith('sb_secret_') || key.toLowerCase().includes('service_role')) {
  console.error(
    '\n[env] Esta parece ser uma service_role key (segredo de servidor). ' +
      'Nao a commite: use a publishable key.\n',
  );
  process.exit(1);
}

const corpo = (production) =>
  `// Gerado por scripts/generate-environments.mjs a partir do .env. Nao editar a mao.
// Altere o .env e rode: npm run build (ou npm start).
export const environment = {
  production: ${production},
  supabaseUrl: '${url}',
  supabaseKey: '${key}',
};
`;

mkdirSync(destinoDir, { recursive: true });

const arquivos = [
  ['environment.ts', corpo(false)],
  ['environment.prod.ts', corpo(true)],
];

for (const [nome, conteudo] of arquivos) {
  const caminho = join(destinoDir, nome);
  // .gitattributes usa `* text=auto`: o git guarda LF no repositório mas entrega
  // CRLF no checkout do Windows. Normaliza antes de comparar para nao reescrever
  // o arquivo a toa em toda build.
  const atual = existsSync(caminho)
    ? readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n')
    : null;
  if (atual !== conteudo) {
    writeFileSync(caminho, conteudo, 'utf8');
    console.log(`[env] ${nome} atualizado.`);
  }
}
