# Inicializa la base de datos local de TopGreen
# Levanta Docker, espera healthcheck, corre migraciones y seed.
#
# Uso (desde la raíz del proyecto):
#   .\scripts\init_local_db.ps1

$ErrorActionPreference = "Stop"

Write-Host "===> Verificando .env" -ForegroundColor Cyan
if (-not (Test-Path .env)) {
  if (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Host "  .env creado desde .env.example. Revisar/editar antes de continuar." -ForegroundColor Yellow
  } else {
    throw "No existe .env ni .env.example"
  }
}

if (-not (Test-Path backend\.env)) {
  if (Test-Path backend\.env.example) {
    Copy-Item backend\.env.example backend\.env
    Write-Host "  backend\.env creado desde backend\.env.example. Revisar/editar antes de continuar." -ForegroundColor Yellow
  } else {
    throw "No existe backend\.env ni backend\.env.example"
  }
}

Write-Host "===> Levantando contenedores (db + api)" -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up -d falló" }

Write-Host "===> Esperando healthcheck de la DB (puede tardar ~30s)" -ForegroundColor Cyan
$retries = 30
$ok = $false
for ($i = 1; $i -le $retries; $i++) {
  $status = docker inspect -f '{{.State.Health.Status}}' topgreen-db 2>$null
  if ($status -eq "healthy") { $ok = $true; break }
  Start-Sleep -Seconds 2
  Write-Host "    intento $i/$retries - estado: $status"
}
if (-not $ok) { throw "topgreen-db no llegó a healthy en $($retries*2)s" }

Write-Host "===> Aplicando migraciones (alembic upgrade head)" -ForegroundColor Cyan
docker exec topgreen-api alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw "alembic upgrade falló" }

Write-Host "===> Cargando datos demo (seed)" -ForegroundColor Cyan
docker exec topgreen-api python -m app.seed
if ($LASTEXITCODE -ne 0) { throw "seed falló" }

Write-Host ""
Write-Host "===> OK. Cuentas demo:" -ForegroundColor Green
Write-Host "       admin@topgreen.com / admin123"
Write-Host "       vendedor@ejemplo.com / vendedor123"
Write-Host "       cliente@ejemplo.com / cliente123"
Write-Host ""
Write-Host "Backend  : http://localhost:8000/api/docs"
Write-Host "Frontend : npm install ; npm run dev    (luego http://localhost:5173)"
