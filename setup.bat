@echo off
REM ===========================================================================
REM  Amor NeuroDivergente - Setup automatico para Windows
REM
REM  Uso:  git clone <repo>  ->  duplo clique no setup.bat  ->  npm start
REM
REM  O que ele faz:
REM    1. checa se o Node instalado atende ao engines.node do package.json
REM    2. roda "npm ci" (instalacao limpa e deterministica)
REM    3. gera/confere o .env e os arquivos de src/environments
REM
REM  Codigo de saida: 0 = tudo certo, 1 = falhou.
REM ===========================================================================

setlocal
cd /d "%~dp0"

echo.
echo ==============================================
echo   Amor NeuroDivergente - Setup automatico
echo ==============================================
echo.

REM ---------------------------------------------------------------------------
REM  1. Node.js instalado?
REM ---------------------------------------------------------------------------
echo [1/4] Verificando o Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [ERRO] Node.js nao encontrado neste computador.
    echo.
    echo   Instale o Node.js LTS em:  https://nodejs.org/en/download
    echo   Depois feche e abra esta janela e rode o setup.bat de novo.
    echo.
    exit /b 1
)
node scripts\setup-check.mjs node-version
if errorlevel 1 (
    echo.
    echo   [FALHOU] Corrija a versao do Node e rode o setup.bat novamente.
    echo.
    exit /b 1
)
echo.

REM ---------------------------------------------------------------------------
REM  2. npm disponivel?
REM ---------------------------------------------------------------------------
echo [2/4] Verificando o npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [ERRO] npm nao encontrado. Ele vem junto com o Node.js.
    echo   Reinstale o Node.js da fonte oficial:  https://nodejs.org/en/download
    echo.
    exit /b 1
)
for /f "tokens=*" %%v in ('npm -v') do echo       npm: %%v
echo.

REM ---------------------------------------------------------------------------
REM  3. Dependencias
REM ---------------------------------------------------------------------------
echo [3/4] Instalando dependencias (npm ci). Pode levar alguns minutos...
call npm ci
if errorlevel 1 (
    echo.
    echo   [ERRO] "npm ci" falhou. See as mensagens acima.
    echo   Dica: se der erro de rede, rode novamente com:  setup.bat
    echo.
    exit /b 1
)
echo       [OK] Dependencias instaladas.
echo.

REM ---------------------------------------------------------------------------
REM  4. .env e src/environments
REM ---------------------------------------------------------------------------
echo [4/4] Verificando a configuracao do Supabase...
node scripts\generate-environments.mjs
if errorlevel 1 (
    echo.
    echo   [ERRO] Falha ao gerar src/environments a partir do .env.
    echo   Veja a mensagem acima e confira o arquivo .env na raiz.
    echo.
    exit /b 1
)
node scripts\setup-check.mjs env-files
if errorlevel 1 (
    echo.
    echo   [ERRO] Configuracao do Supabase invalida ou incompleta.
    echo   Confira o .env na raiz do projeto e rode o setup.bat de novo.
    echo.
    exit /b 1
)

echo.
echo ==============================================
echo   Setup completo!
echo ==============================================
echo.
echo   Para iniciar o projeto, rode:
echo.
echo       npm start
echo.
echo   E abra:  http://localhost:4200
echo.
echo   (npm start, e nao "npx start" - o npx nao
echo    le os scripts do package.json.)
echo.
pause
exit /b 0
