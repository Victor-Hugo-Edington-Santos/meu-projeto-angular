/**
 * Verificacoes de setup, usadas pelo setup.bat na raiz.
 *
 *   node scripts/setup-check.mjs node-version  -> confere o Node instalado
 *                                                 contra engines.node
 *   node scripts/setup-check.mjs env-files     -> confere .env + src/environments
 *
 * Saida: 0 = tudo certo, 1 = falha (com explicacao no console).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const comando = args[0];

/** Le engines de um package.json. Tolera BOM (comum em arquivos salvos no Windows). */
function enginesDo(caminho) {
  let bruto = readFileSync(caminho, 'utf8');
  if (bruto.charCodeAt(0) === 0xfeff) bruto = bruto.slice(1); // remove BOM
  try {
    return JSON.parse(bruto).engines ?? {};
  } catch (e) {
    console.error(`      [ERRO] Nao consegui ler o package.json: ${e.message}`);
    process.exit(1);
  }
}

// --- Semver ---------------------------------------------------------------

function parse(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Testa uma clausula do range. Devolve true/false, ou null quando a sintaxe
 * nao e reconhecida -- nesse caso o setup NAO bloqueia, so avisa.
 */
function testarClausula(versao, clausula) {
  const c = clausula.trim();
  if (c === '' || c === '*' || /^[xX*]$/.test(c)) return true;

  // ^1.2.3 | ~1.2.3 | >=1.2.3 | >1.2.3 | <=1.2.3 | <1.2.3 | 1.2.3
  const m = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?$/.exec(c);
  if (!m) return null;

  const op = m[1] ?? '=';
  const part = (x) => (x === undefined || /^[xX*]$/.test(x) ? null : Number(x));
  const major = part(m[2]);
  const minor = part(m[3]);
  const patch = part(m[4]);
  if (major === null && op !== '^' && op !== '~') return true; // tipo ">=1.x": qualquer 1.x
  if (major === null) return true;
  const alvo = [major, minor ?? 0, patch ?? 0];
  const d = cmp(versao, alvo);

  switch (op) {
    case '^': {
      if (d < 0) return false;
      // ^1.2.3 e ^1.2 nunca atravessam o major 1
      return versao[0] === major;
    }
    case '~': {
      if (d < 0) return false;
      if (minor === null) return versao[0] === major;
      return versao[0] === major && versao[1] === minor;
    }
    case '>=':
      return d >= 0;
    case '>':
      return d > 0;
    case '<=':
      return d <= 0;
    case '<':
      return d < 0;
    default:
      if (minor === null) return versao[0] === major;
      if (patch === null) return versao[0] === major && versao[1] === minor;
      return d === 0;
  }
}

function satisfaz(versaoTxt, range) {
  const versao = parse(versaoTxt);
  if (!versao) return { ok: false, motivo: `nao consegui ler a versao "${versaoTxt}"` };

  const clausulas = String(range).split('||');
  let desconhecida = null;
  for (const cl of clausulas) {
    const r = testarClausula(versao, cl);
    if (r === null) desconhecida ??= cl.trim();
    else if (r) return { ok: true };
  }
  if (desconhecida) {
    return { ok: true, aviso: `clausula nao reconhecida no range: "${desconhecida}"` };
  }
  return { ok: false };
}

// --- Checagens ------------------------------------------------------------

function checarNode() {
  const range = enginesDo(join(raiz, 'package.json')).node;
  const atual = process.version;
  console.log(`      Node instalado: ${atual}`);

  if (!range) {
    console.log('      package.json nao declara engines.node (verificacao ignorada).');
    return 0;
  }
  console.log(`      Exigido (engines.node): ${range}`);

  const r = satisfaz(atual, range);
  if (r.aviso) console.log(`      [aviso] ${r.aviso}`);
  if (r.ok) {
    console.log('      [OK] Versao do Node compativel.');
    return 0;
  }

  console.log('');
  console.log('      [ERRO] Versao do Node incompativel com o projeto.');
  console.log('      Instale uma versao que caiba em: ' + range);
  console.log('      Download: https://nodejs.org/en/download');
  console.log('      (no Windows o nvm-windows tambem resolve: https://github.com/coreybutler/nvm-windows)');
  return 1;
}

function checarEnv() {
  let falhas = 0;
  const envPath = join(raiz, '.env');

  if (!existsSync(envPath)) {
    console.log('      [ERRO] .env nao encontrado na raiz do projeto.');
    console.log('      Ele precisa ser versionado no Git (ver .gitignore).');
    return 1;
  }
  console.log('      [OK] .env presente.');

  // Confere as chaves sem imprimir segredo nenhum.
  const env = {};
  for (const linha of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const l = linha.trim();
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i === -1) continue;
    env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }

  const url = env['SUPABASE_URL'];
  if (!url) {
    console.log('      [ERRO] .env sem SUPABASE_URL (ou vazio).');
    falhas++;
  } else if (/^https?:\/\/\S+$/.test(url)) {
    console.log('      [OK] SUPABASE_URL preenchido e com formato valido.');
  } else {
    console.log(`      [ERRO] SUPABASE_URL nao parece uma URL valida: "${url}".`);
    falhas++;
  }

  const key = env['SUPABASE_KEY'];
  if (!key) {
    console.log('      [ERRO] .env sem SUPABASE_KEY (ou vazio).');
    falhas++;
  } else if (/^sb_secret_/i.test(key) || /service[_-]?role/i.test(key)) {
    // Chave de servidor nunca deve estar num .env versionado.
    console.log('      [ERRO] SUPABASE_KEY parece uma service_role/secret key.');
    console.log('             Isso e um segredo de servidor e nao pode ficar no .env.');
    console.log('             Use a publishable key (sb_publishable_...).');
    falhas++;
  } else {
    console.log('      [OK] SUPABASE_KEY preenchido.');
  }

  for (const arq of ['environment.ts', 'environment.prod.ts']) {
    const p = join(raiz, 'src', 'environments', arq);
    if (!existsSync(p)) {
      console.log(`      [ERRO] src/environments/${arq} nao existe.`);
      falhas++;
      continue;
    }
    const c = readFileSync(p, 'utf8');
    const temUrl = /supabaseUrl:\s*'https?:\/\/[^']+'/.test(c);
    const temKey = /supabaseKey:\s*'[^']+'/.test(c);
    if (temUrl && temKey) {
      console.log(`      [OK] src/environments/${arq} com as chaves preenchidas.`);
    } else {
      console.log(`      [ERRO] src/environments/${arq} sem URL ou chave valida.`);
      falhas++;
    }
  }

  return falhas === 0 ? 0 : 1;
}

// --- Entry point ----------------------------------------------------------

const saidas = { 'node-version': checarNode, 'env-files': checarEnv };
const fn = saidas[comando];
if (!fn) {
  console.error(`Uso: node scripts/setup-check.mjs <${Object.keys(saidas).join('|')}>`);
  process.exit(1);
}
process.exit(fn());
