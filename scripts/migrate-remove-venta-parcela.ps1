param(
  [string]$ProjectId = "studio-7905412770-89bf5",
  [switch]$WhatIfOnly,
  [int]$Limit = 0,
  [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
$FirebaseCliClientId = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
$FirebaseCliClientSecret = "j9iVZfS8kkCEFUPaAeJV0sAi"

function Get-ConfigPath {
  return Join-Path $env:USERPROFILE ".config\configstore\firebase-tools.json"
}

function Get-FirebaseConfig {
  $cfgPath = Get-ConfigPath
  if (-not (Test-Path $cfgPath)) {
    throw "No se encontro firebase-tools.json en $cfgPath. Ejecute: firebase login"
  }

  $cfg = Get-Content -Raw -Path $cfgPath | ConvertFrom-Json
  if (-not $cfg.tokens) {
    throw "No se encontro bloque de tokens en firebase-tools.json. Ejecute: firebase login"
  }

  return @{
    Path = $cfgPath
    Data = $cfg
  }
}

function Convert-ToUnixMillis {
  param([datetime]$DateUtc)
  $epoch = [datetime]'1970-01-01T00:00:00Z'
  return [int64](($DateUtc.ToUniversalTime() - $epoch).TotalMilliseconds)
}

function Is-TokenLikelyValid {
  param([object]$Tokens)
  if (-not $Tokens.access_token) { return $false }
  if (-not $Tokens.expires_at) { return $false }

  $expiresAt = 0L
  try { $expiresAt = [int64]$Tokens.expires_at } catch { return $false }

  $now = Convert-ToUnixMillis -DateUtc (Get-Date).ToUniversalTime()
  # Renovar si faltan menos de 2 minutos
  return $expiresAt -gt ($now + 120000)
}

function Refresh-AccessTokenFromRefreshToken {
  param(
    [string]$RefreshToken
  )

  if (-not $RefreshToken) {
    throw "No se encontro refresh_token en la sesion de Firebase CLI. Ejecute: firebase login"
  }

  $body = @{
    refresh_token = $RefreshToken
    client_id = $FirebaseCliClientId
    client_secret = $FirebaseCliClientSecret
    grant_type = "refresh_token"
  }

  $resp = Invoke-RestMethod `
    -Method Post `
    -Uri "https://www.googleapis.com/oauth2/v3/token" `
    -Body $body `
    -ContentType "application/x-www-form-urlencoded"

  if (-not $resp.access_token) {
    throw "No se pudo refrescar el access_token. Revise la sesion con firebase login."
  }

  return $resp
}

function Get-AccessToken {
  $cfgObj = Get-FirebaseConfig
  $cfgPath = $cfgObj.Path
  $cfg = $cfgObj.Data
  $tokens = $cfg.tokens

  if (Is-TokenLikelyValid -Tokens $tokens) {
    return [string]$tokens.access_token
  }

  $refreshResp = Refresh-AccessTokenFromRefreshToken -RefreshToken ([string]$tokens.refresh_token)
  $now = Convert-ToUnixMillis -DateUtc (Get-Date).ToUniversalTime()
  $expiresInSec = [int]$refreshResp.expires_in
  $tokens.access_token = [string]$refreshResp.access_token
  $tokens.expires_in = $expiresInSec
  $tokens.expires_at = $now + ($expiresInSec * 1000)

  $cfg.tokens = $tokens
  $cfg | ConvertTo-Json -Depth 100 | Set-Content -Path $cfgPath -Encoding UTF8

  return [string]$tokens.access_token
}

function Invoke-FirestoreGet {
  param(
    [string]$Uri,
    [string]$Token
  )

  $headers = @{
    Authorization = "Bearer $Token"
  }

  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
}

function Invoke-FirestoreCommit {
  param(
    [string]$Uri,
    [string]$Token,
    [object]$Body
  )

  $headers = @{
    Authorization = "Bearer $Token"
    "Content-Type" = "application/json"
  }

  $json = $Body | ConvertTo-Json -Depth 50 -Compress
  return Invoke-RestMethod -Method Post -Uri $Uri -Headers $headers -Body $json
}

function Get-StringValue {
  param([object]$Field)
  if ($null -eq $Field) { return $null }
  if ($null -ne $Field.stringValue) { return [string]$Field.stringValue }
  return $null
}

function Get-DocIdFromName {
  param([string]$Name)
  return $Name.Split("/")[-1]
}

function Build-WriteDeleteParcelaId {
  param([string]$DocName)

  return @{
    update = @{
      name = $DocName
      fields = @{}
    }
    updateMask = @{
      fieldPaths = @("parcelaId")
    }
    currentDocument = @{
      exists = $true
    }
  }
}

function Commit-InChunks {
  param(
    [string]$CommitUri,
    [string]$Token,
    [System.Collections.Generic.List[object]]$Writes
  )

  if ($Writes.Count -eq 0) { return 0 }

  $chunkSize = 400
  $totalCommitted = 0
  $index = 0
  while ($index -lt $Writes.Count) {
    $take = [Math]::Min($chunkSize, $Writes.Count - $index)
    $chunk = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -lt $take; $i++) {
      $chunk.Add($Writes[$index + $i])
    }

    $body = @{ writes = $chunk }
    [void](Invoke-FirestoreCommit -Uri $CommitUri -Token $Token -Body $body)
    $totalCommitted += $take
    $index += $take
  }

  return $totalCommitted
}

$token = Get-AccessToken
$base = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)"
$ventasUriBase = "$base/documents/ventas?pageSize=500"
$commitUri = "$base/documents:commit"

$docsToUpdate = New-Object 'System.Collections.Generic.List[object]'
$nextPageToken = $null
$totalVentas = 0

do {
  $uri = $ventasUriBase
  if ($nextPageToken) {
    $escaped = [System.Uri]::EscapeDataString($nextPageToken)
    $uri += "&pageToken=$escaped"
  }

  $resp = Invoke-FirestoreGet -Uri $uri -Token $token
  $docs = @($resp.documents)
  if ($docs.Count -eq 0) {
    $nextPageToken = $null
    continue
  }

  foreach ($doc in $docs) {
    $totalVentas++
    $fields = $doc.fields
    if ($null -eq $fields.parcelaId) { continue }

    $docsToUpdate.Add([PSCustomObject]@{
      id = Get-DocIdFromName $doc.name
      name = [string]$doc.name
      numeroDocumento = Get-StringValue $fields.numeroDocumento
      zafraId = Get-StringValue $fields.zafraId
      cultivoId = Get-StringValue $fields.cultivoId
      parcelaId = Get-StringValue $fields.parcelaId
    })

    if ($Limit -gt 0 -and $docsToUpdate.Count -ge $Limit) {
      $nextPageToken = $null
      break
    }
  }

  if ($Limit -gt 0 -and $docsToUpdate.Count -ge $Limit) {
    break
  }

  $nextPageToken = $resp.nextPageToken
} while ($nextPageToken)

Write-Host "Total ventas leidas: $totalVentas"
Write-Host "Ventas con parcelaId: $($docsToUpdate.Count)"

if ($docsToUpdate.Count -eq 0) {
  Write-Host "No hay nada para migrar."
  exit 0
}

if (-not $ReportPath) {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $ReportPath = Join-Path (Join-Path $PSScriptRoot "reports") "migrate-remove-venta-parcela_$timestamp.csv"
}

$reportDir = Split-Path -Path $ReportPath -Parent
if ($reportDir -and -not (Test-Path $reportDir)) {
  New-Item -ItemType Directory -Path $reportDir | Out-Null
}

$docsToUpdate | Export-Csv -Path $ReportPath -NoTypeInformation -Encoding UTF8
Write-Host "Reporte generado: $ReportPath"

if ($WhatIfOnly) {
  Write-Host "Modo simulacion activo (-WhatIfOnly). No se aplicaron cambios."
  exit 0
}

$writes = New-Object 'System.Collections.Generic.List[object]'
foreach ($d in $docsToUpdate) {
  $writes.Add((Build-WriteDeleteParcelaId -DocName $d.name))
}

$committed = Commit-InChunks -CommitUri $commitUri -Token $token -Writes $writes
Write-Host "Migracion completada. Documentos actualizados: $committed"
