import { getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore, Query } from "firebase-admin/firestore";
import { liquidatePeriodCore } from "../liquidation";
import { seedTenantDemoDataCore } from "../tenant-demo";

type Args = {
  reset: boolean;
  liquidate: boolean;
  empresaId: string | null;
  periodId: string;
  siteId: string;
  adminUid: string;
  projectId: string | null;
};

const BATCH_CHUNK_SIZE = 400;
const SEED_TAG = "seed-demo";

function parseArgs(argv: string[]): Args {
  const has = (flag: string) => argv.includes(flag);
  const value = (key: string, fallback: string): string => {
    const prefix = `${key}=`;
    const arg = argv.find((item) => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : fallback;
  };

  return {
    reset: has("--reset"),
    liquidate: !has("--no-liquidate"),
    empresaId: value("--empresaId", process.env.SEED_EMPRESA_ID ?? "").trim() || null,
    periodId: value("--periodId", process.env.SEED_PERIOD_ID ?? "2026-W10"),
    siteId: value("--siteId", process.env.SEED_SITE_ID ?? "site_demo_1"),
    adminUid: value("--adminUid", process.env.SEED_ADMIN_UID ?? "demo_admin"),
    projectId:
      value("--projectId", process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "").trim() ||
      null,
  };
}

async function deleteQueryInBatches(query: Query): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await query.limit(BATCH_CHUNK_SIZE).get();
    if (snap.empty) {
      break;
    }

    const batch = snap.docs[0].ref.firestore.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

async function writeInChunks(
  db: Firestore,
  writes: Array<{ path: string; data: Record<string, unknown> }>
): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_CHUNK_SIZE) {
    const chunk = writes.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = db.batch();
    chunk.forEach((item) => {
      batch.set(db.doc(item.path), item.data, { merge: true });
    });
    await batch.commit();
  }
}

function getPeriodWindow(): { startDate: string; endDate: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toISO = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: toISO(monday), endDate: toISO(sunday) };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (getApps().length === 0) {
    initializeApp(args.projectId ? { projectId: args.projectId } : undefined);
  }
  const db = getFirestore();
  const { startDate, endDate } = getPeriodWindow();

  if (args.empresaId) {
    const result = await seedTenantDemoDataCore(db, {
      empresaId: args.empresaId,
      requestedByUid: args.adminUid,
      reset: args.reset,
    });
    console.log(
      `[seed] demo tenant cargado para ${result.empresaId}: collections=${result.collections.length}, documents=${result.documents}, reset=${result.resetApplied}`
    );
    return;
  }

  if (args.reset) {
    const [attDeleted, adjDeleted, setDeleted] = await Promise.all([
      deleteQueryInBatches(db.collection("attendances").where("periodId", "==", args.periodId)),
      deleteQueryInBatches(db.collection("adjustments").where("periodId", "==", args.periodId)),
      deleteQueryInBatches(db.collection("settlements").where("periodId", "==", args.periodId)),
    ]);
    await db.doc(`periods/${args.periodId}`).delete().catch(() => undefined);
    console.log(
      `[seed] reset aplicado para ${args.periodId}: attendances=${attDeleted}, adjustments=${adjDeleted}, settlements=${setDeleted}`
    );
  }

  const users = [
    {
      path: `users/${args.adminUid}`,
      data: {
        name: "Admin Demo",
        role: "admin",
        siteIds: [args.siteId],
        active: true,
        seedTag: SEED_TAG,
      },
    },
    {
      path: "users/demo_supervisor",
      data: {
        name: "Supervisor Demo",
        role: "supervisor",
        siteIds: [args.siteId],
        active: true,
        seedTag: SEED_TAG,
      },
    },
    {
      path: "users/demo_capataz",
      data: {
        name: "Capataz Demo",
        role: "capataz",
        siteIds: [args.siteId],
        active: true,
        seedTag: SEED_TAG,
      },
    },
  ];

  const workers = [
    {
      id: "worker_demo_1",
      docId: "10010001",
      fullName: "Juan Perez",
      category: "Oficial",
      baseRateCents: 1200,
    },
    {
      id: "worker_demo_2",
      docId: "10010002",
      fullName: "Pedro Ruiz",
      category: "Ayudante",
      baseRateCents: 1000,
    },
    {
      id: "worker_demo_3",
      docId: "10010003",
      fullName: "Luis Gomez",
      category: "Especialista",
      baseRateCents: 1500,
    },
  ];

  const workerWrites = workers.map((w) => ({
    path: `workers/${w.id}`,
    data: {
      docId: w.docId,
      fullName: w.fullName,
      category: w.category,
      active: true,
      baseRateCents: w.baseRateCents,
      seedTag: SEED_TAG,
    },
  }));

  const siteWrite = {
    path: `sites/${args.siteId}`,
    data: {
      name: "Obra Demo Centro",
      location: "Zona Centro",
      active: true,
      seedTag: SEED_TAG,
    },
  };

  const periodWrite = {
    path: `periods/${args.periodId}`,
    data: {
      startDate,
      endDate,
      status: "open",
      createdBy: args.adminUid,
      seededAt: new Date().toISOString(),
      seedTag: SEED_TAG,
    },
  };

  const attendanceDates = [0, 1, 2, 3, 4].map((d) => {
    const base = new Date(startDate);
    base.setDate(base.getDate() + d);
    return base.toISOString().slice(0, 10);
  });

  const attendanceWrites: Array<{ path: string; data: Record<string, unknown> }> = [];
  workers.forEach((w, workerIndex) => {
    attendanceDates.forEach((date, dateIndex) => {
      const normalMin = 480;
      const extraMin = workerIndex === 0 && dateIndex === 2 ? 120 : 0;
      const nightMin = workerIndex === 1 && dateIndex === 1 ? 60 : 0;
      const holidayMin = workerIndex === 2 && dateIndex === 4 ? 480 : 0;

      attendanceWrites.push({
        path: `attendances/${args.periodId}_${w.id}_${date}`,
        data: {
          workerId: w.id,
          siteId: args.siteId,
          date,
          periodId: args.periodId,
          normalMin,
          extraMin,
          nightMin,
          holidayMin,
          status: "approved",
          createdBy: "demo_capataz",
          approvedBy: "demo_supervisor",
          source: SEED_TAG,
          seedTag: SEED_TAG,
        },
      });
    });
  });

  const adjustmentWrites: Array<{ path: string; data: Record<string, unknown> }> = [
    {
      path: `adjustments/${args.periodId}_worker_demo_1_bonus`,
      data: {
        workerId: "worker_demo_1",
        periodId: args.periodId,
        type: "bonus",
        amountCents: 15000,
        note: "Bono rendimiento",
        seedTag: SEED_TAG,
      },
    },
    {
      path: `adjustments/${args.periodId}_worker_demo_2_advance`,
      data: {
        workerId: "worker_demo_2",
        periodId: args.periodId,
        type: "advance",
        amountCents: 8000,
        note: "Adelanto semanal",
        seedTag: SEED_TAG,
      },
    },
    {
      path: `adjustments/${args.periodId}_worker_demo_3_deduction`,
      data: {
        workerId: "worker_demo_3",
        periodId: args.periodId,
        type: "deduction",
        amountCents: 5000,
        note: "Descuento herramienta",
        seedTag: SEED_TAG,
      },
    },
  ];

  const writes = [
    ...users,
    siteWrite,
    periodWrite,
    ...workerWrites,
    ...attendanceWrites,
    ...adjustmentWrites,
  ];

  await writeInChunks(db, writes);
  console.log(
    `[seed] datos cargados para ${args.periodId}: users=${users.length}, workers=${workers.length}, attendances=${attendanceWrites.length}, adjustments=${adjustmentWrites.length}`
  );

  if (args.liquidate) {
    const result = await liquidatePeriodCore(db, {
      periodId: args.periodId,
      generatedByUid: args.adminUid,
      seedTag: SEED_TAG,
    });
    console.log(
      `[seed] liquidacion completada: periodId=${result.periodId}, workers=${result.workers}`
    );
  } else {
    console.log("[seed] liquidacion omitida (--no-liquidate).");
  }
}

run().catch((error) => {
  console.error("[seed] error:", error);
  process.exitCode = 1;
});
