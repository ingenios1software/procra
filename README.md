# Procra

Proyecto base con Next.js + Firebase App Hosting, Firestore y Cloud Functions para el MVP de jornaleros.

## Estructura Firebase agregada

- `firestore.rules`: seguridad por roles (`capataz`, `supervisor`, `admin`).
- `firestore.indexes.json`: indices iniciales para asistencias y ajustes.
- `functions/`: backend de liquidacion (`liquidatePeriod`) en TypeScript.

## Requisitos

- Node.js 20
- Firebase CLI (`npm i -g firebase-tools`)
- Acceso al proyecto Firebase

## Arranque local

```bash
npm install
cd functions
npm install
cd ..
firebase login
firebase use --add
```

## Emuladores (recomendado)

Requiere Java 11+ instalado y disponible en `PATH`.

```bash
cd functions
npm run build
cd ..
firebase emulators:start --only firestore,functions
```

### Seed demo (5 minutos)

Carga datos demo y ejecuta liquidacion del periodo con IDs de prueba.

```bash
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:demo -- --reset"
```

Opciones utiles:

```bash
# solo sembrar, sin liquidar
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:demo -- --reset --no-liquidate"

# periodo personalizado
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:demo -- --reset --periodId=2026-W11"
```

Si no usas emulador, puedes correr el seed contra Firestore real con credenciales de servicio:

```bash
set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\service-account.json
set GOOGLE_CLOUD_PROJECT=studio-7905412770-89bf5
npm --prefix functions run seed:demo -- --periodId=2026-W11 --projectId=studio-7905412770-89bf5
```

### Limpiar solo datos demo (`seed:clean`)

La limpieza borra solo documentos con `seedTag=seed-demo` y exige confirmacion.

```bash
# eliminar TODO lo demo (users/workers/sites/periods/attendances/adjustments/settlements)
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO

# eliminar solo un periodo demo
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO --periodId=2026-W11

# vista previa sin borrar
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO --dry-run

# limpiar en emulador (recomendado)
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO"
```

## Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

## Funcion principal

- `liquidatePeriod` (callable):
  - Entrada: `{ periodId: string }`
  - Valida que el usuario sea `admin`
  - Lee `attendances` aprobadas + `adjustments` del periodo
  - Calcula bruto, descuentos y neto por trabajador
  - Escribe `settlements/{periodId_workerId}`
  - Marca `periods/{periodId}` como `liquidated`
