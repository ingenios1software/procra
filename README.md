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

### Seed demo por tenant (recomendado)

Carga datos demo aislados dentro de `empresas/{empresaId}` para la empresa indicada.

```bash
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:demo -- --empresaId=empresa_demo --reset"
```

Opciones utiles:

```bash
# sembrar o resembrar una empresa especifica
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:demo -- --empresaId=empresa_demo --reset"

# contra Firestore real
npm --prefix functions run seed:demo -- --empresaId=empresa_demo --adminUid=demo_admin --projectId=studio-7905412770-89bf5
```

### Seed demo legacy de liquidacion

Mantiene el dataset global anterior (`users/workers/sites/periods/attendances/adjustments/settlements`) para pruebas aisladas de la function de liquidacion.

```bash
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:demo -- --reset --periodId=2026-W11 --no-liquidate"
```

### Limpiar solo datos demo (`seed:clean`)

La limpieza borra solo documentos con `seedTag=seed-demo` y exige confirmacion.

```bash
# eliminar TODO lo demo de un tenant
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO --empresaId=empresa_demo

# vista previa del tenant sin borrar
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO --empresaId=empresa_demo --dry-run

# eliminar TODO lo demo legacy global (users/workers/sites/periods/attendances/adjustments/settlements)
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO

# eliminar solo un periodo demo legacy
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO --periodId=2026-W11

# vista previa legacy sin borrar
npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO --dry-run

# limpiar tenant en emulador (recomendado)
firebase.cmd emulators:exec --only firestore "npm --prefix functions run seed:clean -- --confirm=DELETE_DEMO --empresaId=empresa_demo"
```

## Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

## Integracion DNIT

La consulta oficial a DNIT se hace desde Cloud Functions para no exponer la `apiKey` en el navegador.

Configure el secreto en Firebase antes de desplegar:

```bash
firebase functions:secrets:set DNIT_API_KEY
```

Para pruebas locales con emuladores, tambien puede definir la variable de entorno antes de iniciar:

```bash
set DNIT_API_KEY=tu_api_key_dnit
firebase emulators:start --only firestore,functions
```

Opcionalmente puede sobreescribir la URL del servicio si DNIT cambia el endpoint:

```bash
set DNIT_LOOKUP_URL=https://servicios.dnit.gov.py/eset-publico/consultaRucServiceREST/consultaRuc
```

## Funcion principal

- `liquidatePeriod` (callable):
  - Entrada: `{ periodId: string }`
  - Valida que el usuario sea `admin`
  - Lee `attendances` aprobadas + `adjustments` del periodo
  - Calcula bruto, descuentos y neto por trabajador
  - Escribe `settlements/{periodId_workerId}`
  - Marca `periods/{periodId}` como `liquidated`
