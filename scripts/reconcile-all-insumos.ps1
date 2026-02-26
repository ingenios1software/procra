param(
  [string]$ProjectId = "studio-7905412770-89bf5",
  [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"
$Tolerance = 0.0001

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

  $json = $Body | ConvertTo-Json -Depth 50 -Compress
  return Invoke-RestMethod -Method Post -Uri $Uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $json
}

function Get-FieldString {
  param([object]$Field)
  if ($null -eq $Field) { return $null }
  if ($null -ne $Field.stringValue) { return [string]$Field.stringValue }
  if ($null -ne $Field.timestampValue) { return [string]$Field.timestampValue }
  return $null
}

function Try-GetFieldNumber {
  param(
    [object]$Field,
    [ref]$Out
  )
  if ($null -eq $Field) { return $false }
  if ($null -ne $Field.integerValue) {
    $Out.Value = [double]$Field.integerValue
    return $true
  }
  if ($null -ne $Field.doubleValue) {
    $Out.Value = [double]$Field.doubleValue
    return $true
  }
  return $false
}

function To-FirestoreNumberField {
  param([double]$Value)
  $rounded = [Math]::Round($Value, 6)
  if ([Math]::Abs($rounded - [Math]::Round($rounded)) -lt 0.000001) {
    return @{ integerValue = ([Math]::Round($rounded)).ToString() }
  }
  return @{ doubleValue = $rounded }
}

function Write-Batches {
  param(
    [string]$CommitUri,
    [string]$Token,
    [System.Collections.Generic.List[object]]$Writes
  )

  if ($Writes.Count -eq 0) { return }

  $chunkSize = 400
  $index = 0
  while ($index -lt $Writes.Count) {
    $take = [Math]::Min($chunkSize, $Writes.Count - $index)
    $chunk = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -lt $take; $i++) {
      $chunk.Add($Writes[$index + $i])
    }

    $body = @{ writes = $chunk }
    [void](Invoke-FirestoreApi -Method POST -Uri $CommitUri -Token $Token -Body $body)
    $index += $take
  }
}

function Get-SortKey {
  param(
    [string]$Fecha,
    [string]$CreateTime
  )
  $dt = $null
  if ($Fecha) {
    try { $dt = [DateTime]::Parse($Fecha) } catch {}
  }
  if (-not $dt -and $CreateTime) {
    try { $dt = [DateTime]::Parse($CreateTime) } catch {}
  }
  if (-not $dt) { $dt = [DateTime]::MinValue }
  return $dt
}

$token = Get-AccessToken
$base = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)"
$commitUri = "$base/documents:commit"

# 1) Cargar todos los insumos (paginado)
$insumoDocs = New-Object 'System.Collections.Generic.List[object]'
$nextToken = $null

do {
  $uri = "$base/documents/insumos?pageSize=500"
  if ($nextToken) {
    $escaped = [System.Uri]::EscapeDataString($nextToken)
    $uri += "&pageToken=$escaped"
  }

  $resp = Invoke-FirestoreApi -Method GET -Uri $uri -Token $token -Body $null
  if ($resp.documents) {
    foreach ($doc in $resp.documents) { $insumoDocs.Add($doc) }
  }

  $nextToken = $resp.nextPageToken
} while ($nextToken)

Write-Host "Insumos encontrados: $($insumoDocs.Count)"

$summary = New-Object 'System.Collections.Generic.List[object]'
$globalWrites = New-Object 'System.Collections.Generic.List[object]'
$totalDeleted = 0
$totalStockUpdates = 0
$totalUnitFixes = 0

foreach ($insumoDoc in $insumoDocs) {
  $f = $insumoDoc.fields
  $insumoPath = [string]$insumoDoc.name
  $insumoId = $insumoPath.Split("/")[-1]
  $insumoNombre = Get-FieldString $f.nombre
  $insumoUnidad = Get-FieldString $f.unidad
  $numeroItemRef = 0.0
  [void](Try-GetFieldNumber -Field $f.numeroItem -Out ([ref]$numeroItemRef))
  $stockActualRef = 0.0
  [void](Try-GetFieldNumber -Field $f.stockActual -Out ([ref]$stockActualRef))

  # 2) Cargar movimientos del insumo
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
  $movDocs = @($movQuery | Where-Object { $_.document } | ForEach-Object { $_.document })
  if ($movDocs.Count -eq 0) { continue }

  $rows = New-Object 'System.Collections.Generic.List[object]'
  foreach ($movDoc in $movDocs) {
    $mf = $movDoc.fields
    $tipo = Get-FieldString $mf.tipo
    $origen = Get-FieldString $mf.origen
    $fecha = Get-FieldString $mf.fecha
    $createTime = [string]$movDoc.createTime
    $unidadMov = Get-FieldString $mf.unidad

    $cantidad = 0.0
    $hasCantidad = Try-GetFieldNumber -Field $mf.cantidad -Out ([ref]$cantidad)
    $stockAntes = 0.0
    $hasStockAntes = Try-GetFieldNumber -Field $mf.stockAntes -Out ([ref]$stockAntes)
    $stockDespues = 0.0
    $hasStockDespues = Try-GetFieldNumber -Field $mf.stockDespues -Out ([ref]$stockDespues)

    $isIncoherent = $false
    $reason = $null

    if ([string]::IsNullOrWhiteSpace($tipo)) {
      $isIncoherent = $true
      $reason = "tipo_vacio"
    } elseif ($tipo -notin @("entrada", "salida", "ajuste")) {
      $isIncoherent = $true
      $reason = "tipo_invalido"
    } elseif (($tipo -eq "entrada" -or $tipo -eq "salida") -and (-not $hasCantidad -or $cantidad -le 0)) {
      $isIncoherent = $true
      $reason = "cantidad_invalida"
    } elseif (($tipo -eq "entrada" -or $tipo -eq "salida") -and ((-not $hasStockAntes) -or (-not $hasStockDespues))) {
      $isIncoherent = $true
      $reason = "stock_faltante"
    } elseif ($tipo -eq "entrada" -or $tipo -eq "salida") {
      $actualDelta = $stockDespues - $stockAntes
      $expectedDelta = if ($tipo -eq "entrada") { $cantidad } else { -$cantidad }
      if ([Math]::Abs($actualDelta - $expectedDelta) -gt $Tolerance) {
        $isIncoherent = $true
        $reason = "aritmetica_invalida"
      }
    }

    $rows.Add([PSCustomObject]@{
      path = [string]$movDoc.name
      id = ([string]$movDoc.name).Split("/")[-1]
      tipo = $tipo
      origen = $origen
      fecha = $fecha
      createTime = $createTime
      sortKey = (Get-SortKey -Fecha $fecha -CreateTime $createTime)
      unidad = $unidadMov
      cantidad = $cantidad
      hasCantidad = $hasCantidad
      stockAntes = $stockAntes
      hasStockAntes = $hasStockAntes
      stockDespues = $stockDespues
      hasStockDespues = $hasStockDespues
      isIncoherent = $isIncoherent
      reason = $reason
    })
  }

  $toDelete = @($rows | Where-Object { $_.isIncoherent })
  $coherent = @($rows | Where-Object { -not $_.isIncoherent } | Sort-Object sortKey)
  $toFixUnit = @($coherent | Where-Object { -not [string]::IsNullOrWhiteSpace($insumoUnidad) -and $_.unidad -ne $insumoUnidad })

  $targetStock = $null
  if ($coherent.Count -gt 0) {
    $latest = $coherent[-1]
    if ($latest.hasStockDespues) {
      $targetStock = [double]$latest.stockDespues
    }
  }

  $stockUpdateNeeded = $false
  if ($null -ne $targetStock -and [Math]::Abs($targetStock - $stockActualRef) -gt $Tolerance) {
    $stockUpdateNeeded = $true
  }

  if ($toDelete.Count -gt 0 -or $toFixUnit.Count -gt 0 -or $stockUpdateNeeded) {
    $summary.Add([PSCustomObject]@{
      numeroItem = [int]$numeroItemRef
      insumoId = $insumoId
      nombre = $insumoNombre
      movimientos = $rows.Count
      deleteCount = $toDelete.Count
      unitFixCount = $toFixUnit.Count
      stockAntes = $stockActualRef
      stockDespues = if ($stockUpdateNeeded) { $targetStock } else { $stockActualRef }
    })
  }

  if ($WhatIfOnly) {
    continue
  }

  foreach ($bad in $toDelete) {
    $globalWrites.Add(@{ delete = $bad.path })
    $totalDeleted++
  }

  foreach ($unitFix in $toFixUnit) {
    $globalWrites.Add(@{
      update = @{
        name = $unitFix.path
        fields = @{
          unidad = @{ stringValue = $insumoUnidad }
        }
      }
      updateMask = @{
        fieldPaths = @("unidad")
      }
    })
    $totalUnitFixes++
  }

  if ($stockUpdateNeeded) {
    $globalWrites.Add(@{
      update = @{
        name = $insumoPath
        fields = @{
          stockActual = (To-FirestoreNumberField $targetStock)
        }
      }
      updateMask = @{
        fieldPaths = @("stockActual")
      }
    })
    $totalStockUpdates++
  }
}

Write-Host ""
Write-Host "Resumen de insumos con acciones: $($summary.Count)"
foreach ($s in $summary | Sort-Object numeroItem) {
  Write-Host (" - #{0} {1}: mov={2}, del={3}, fixUnidad={4}, stock {5} -> {6}" -f $s.numeroItem, $s.nombre, $s.movimientos, $s.deleteCount, $s.unitFixCount, $s.stockAntes, $s.stockDespues)
}

if ($WhatIfOnly) {
  Write-Host ""
  Write-Host "[WhatIf] No se realizaron cambios."
  exit 0
}

Write-Batches -CommitUri $commitUri -Token $token -Writes $globalWrites

Write-Host ""
Write-Host "OK: reconciliacion global aplicada."
Write-Host " - movimientos eliminados: $totalDeleted"
Write-Host " - movimientos con unidad corregida: $totalUnitFixes"
Write-Host " - insumos con stockActual corregido: $totalStockUpdates"
