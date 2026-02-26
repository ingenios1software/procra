param(
  [string]$ProjectId = "studio-7905412770-89bf5",
  [int]$NumeroItem = 77,
  [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"

function Get-ConfigPath {
  return Join-Path $env:USERPROFILE ".config\configstore\firebase-tools.json"
}

function Get-AccessToken {
  $cfgPath = Get-ConfigPath
  if (-not (Test-Path $cfgPath)) {
    throw "No se encontro firebase-tools.json en $cfgPath"
  }

  $cfg = Get-Content -Raw -Path $cfgPath | ConvertFrom-Json
  if (-not $cfg.tokens.access_token) {
    throw "No se encontro access_token en la sesion de Firebase CLI."
  }

  return [string]$cfg.tokens.access_token
}

function Invoke-FirestoreApi {
  param(
    [ValidateSet("GET", "POST")]
    [string]$Method,
    [string]$Uri,
    [string]$Token,
    [object]$Body
  )

  $headers = @{
    Authorization = "Bearer $Token"
  }

  if ($Method -eq "GET") {
    return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 40 -Compress
  return Invoke-RestMethod -Method Post -Uri $Uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $json
}

function Get-FieldString {
  param([object]$Field)
  if ($null -eq $Field) { return $null }
  if ($null -ne $Field.stringValue) { return [string]$Field.stringValue }
  if ($null -ne $Field.timestampValue) { return [string]$Field.timestampValue }
  return $null
}

function Get-FieldNumber {
  param([object]$Field)
  if ($null -eq $Field) { return 0.0 }
  if ($null -ne $Field.integerValue) { return [double]$Field.integerValue }
  if ($null -ne $Field.doubleValue) { return [double]$Field.doubleValue }
  return 0.0
}

function To-FirestoreNumberField {
  param([double]$Value)
  $rounded = [Math]::Round($Value, 6)
  if ([Math]::Abs($rounded - [Math]::Round($rounded)) -lt 0.000001) {
    return @{ integerValue = ([Math]::Round($rounded)).ToString() }
  }
  return @{ doubleValue = $rounded }
}

$token = Get-AccessToken
$base = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)"

# 1) Buscar insumo por numeroItem
$insumoQueryBody = @{
  structuredQuery = @{
    from = @(@{ collectionId = "insumos" })
    where = @{
      fieldFilter = @{
        field = @{ fieldPath = "numeroItem" }
        op = "EQUAL"
        value = @{ integerValue = "$NumeroItem" }
      }
    }
    limit = 2
  }
}

$insumoQuery = Invoke-FirestoreApi -Method POST -Uri "$base/documents:runQuery" -Token $token -Body $insumoQueryBody
$insumoDocs = @($insumoQuery | Where-Object { $_.document })
if ($insumoDocs.Count -eq 0) {
  throw "No se encontro insumo con numeroItem=$NumeroItem."
}
if ($insumoDocs.Count -gt 1) {
  throw "Se encontro mas de un insumo con numeroItem=$NumeroItem. Abortando por seguridad."
}

$insumoDoc = $insumoDocs[0].document
$insumoPath = [string]$insumoDoc.name
$insumoId = $insumoPath.Split("/")[-1]
$insumoNombre = Get-FieldString $insumoDoc.fields.nombre
$insumoUnidad = Get-FieldString $insumoDoc.fields.unidad
$insumoStockActual = Get-FieldNumber $insumoDoc.fields.stockActual

Write-Host "Insumo encontrado: $insumoNombre (#$NumeroItem) id=$insumoId unidad=$insumoUnidad stockActual=$insumoStockActual"

# 2) Leer movimientos del insumo
$movQueryBody = @{
  structuredQuery = @{
    from = @(@{ collectionId = "MovimientosStock" })
    where = @{
      fieldFilter = @{
        field = @{ fieldPath = "insumoId" }
        op = "EQUAL"
        value = @{ stringValue = $insumoId }
      }
    }
    limit = 500
  }
}

$movQuery = Invoke-FirestoreApi -Method POST -Uri "$base/documents:runQuery" -Token $token -Body $movQueryBody
$movDocs = @($movQuery | Where-Object { $_.document })
if ($movDocs.Count -eq 0) {
  throw "No hay movimientos para el insumo $insumoId."
}

$movRows = @()
foreach ($entry in $movDocs) {
  $doc = $entry.document
  $f = $doc.fields
  $movRows += [PSCustomObject]@{
    path = [string]$doc.name
    id = ([string]$doc.name).Split("/")[-1]
    fecha = (Get-FieldString $f.fecha)
    tipo = (Get-FieldString $f.tipo)
    origen = (Get-FieldString $f.origen)
    cantidad = (Get-FieldNumber $f.cantidad)
  }
}

$keepRows = @($movRows | Where-Object { $_.tipo -eq "entrada" -and $_.origen -eq "compra" } | Sort-Object fecha)
$deleteRows = @($movRows | Where-Object { -not ($_.tipo -eq "entrada" -and $_.origen -eq "compra") })

if ($keepRows.Count -eq 0) {
  throw "No hay movimientos de compra para conservar. Abortando."
}

$running = 0.0
$updates = @()
foreach ($row in $keepRows) {
  $antes = $running
  $running += $row.cantidad
  $despues = $running
  $updates += [PSCustomObject]@{
    path = $row.path
    id = $row.id
    fecha = $row.fecha
    cantidad = $row.cantidad
    stockAntes = $antes
    stockDespues = $despues
  }
}

$targetStock = $running

Write-Host "Movimientos totales: $($movRows.Count)"
Write-Host "Conservar (entrada+compra): $($keepRows.Count)"
Write-Host "Eliminar (anteriores/no compra): $($deleteRows.Count)"
Write-Host "Nuevo stock objetivo: $targetStock $insumoUnidad"

if ($WhatIfOnly) {
  Write-Host "`n[WhatIf] IDs a eliminar:"
  $deleteRows | ForEach-Object { Write-Host " - $($_.id) | $($_.fecha) | $($_.tipo) | $($_.origen) | cant=$($_.cantidad)" }
  Write-Host "`n[WhatIf] Recalculo de movimientos conservados:"
  $updates | ForEach-Object { Write-Host " - $($_.id) | $($_.fecha) | cant=$($_.cantidad) | $($_.stockAntes)->$($_.stockDespues)" }
  exit 0
}

# 3) Commit de borrado + normalizacion de stock
$writes = @()

foreach ($row in $deleteRows) {
  $writes += @{
    delete = $row.path
  }
}

foreach ($up in $updates) {
  $writes += @{
    update = @{
      name = $up.path
      fields = @{
        stockAntes = (To-FirestoreNumberField $up.stockAntes)
        stockDespues = (To-FirestoreNumberField $up.stockDespues)
        unidad = @{ stringValue = $insumoUnidad }
        insumoId = @{ stringValue = $insumoId }
        insumoNombre = @{ stringValue = $insumoNombre }
      }
    }
    updateMask = @{
      fieldPaths = @("stockAntes", "stockDespues", "unidad", "insumoId", "insumoNombre")
    }
  }
}

$writes += @{
  update = @{
    name = $insumoPath
    fields = @{
      stockActual = (To-FirestoreNumberField $targetStock)
    }
  }
  updateMask = @{
    fieldPaths = @("stockActual")
  }
}

$commitBody = @{
  writes = $writes
}

[void](Invoke-FirestoreApi -Method POST -Uri "$base/documents:commit" -Token $token -Body $commitBody)

Write-Host "`nOK: reconciliacion aplicada."
Write-Host " - insumo.stockActual => $targetStock"
Write-Host " - movimientos eliminados => $($deleteRows.Count)"
Write-Host " - movimientos actualizados => $($updates.Count)"
