import { getApps, initializeApp } from "firebase-admin/app";
import { Firestore, QueryDocumentSnapshot, getFirestore } from "firebase-admin/firestore";

type Args = {
  confirm: string;
  periodId: string | null;
  dryRun: boolean;
  projectId: string | null;
};

const SEED_TAG = "seed-demo";
const REQUIRED_CONFIRM = "DELETE_DEMO";
const BATCH_CHUNK_SIZE = 400;

function parseArgs(argv: string[]): Args {
  const value = (key: string): string | null => {
    const prefix = `${key}=`;
    const arg = argv.find((item) => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length).trim() : null;
  };

  return {
    confirm: value("--confirm") ?? "",
    periodId: value("--periodId"),
    dryRun: argv.includes("--dry-run"),
    projectId:
      (value("--projectId") ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "").trim() ||
      null,
  };
}

function getTargetCollections(periodId: string | null): string[] {
  if (periodId) {
    return ["attendances", "adjustments", "settlements", "periods"];
  }
  return ["attendances", "adjustments", "settlements", "periods", "workers", "sites", "users"];
}

function matchesPeriod(
  doc: QueryDocumentSnapshot,
  collection: string,
  periodId: string | null
): boolean {
  if (!periodId) {
    return true;
  }

  if (collection === "periods") {
    return doc.id === periodId;
  }

  const data = doc.data();
  return data.periodId === periodId;
}

async function deleteTaggedCollection(
  db: Firestore,
  collection: string,
  periodId: string | null,
  dryRun: boolean
): Promise<number> {
  let scanned = 0;
  let deleted = 0;
  let cursor: QueryDocumentSnapshot | null = null;

  while (true) {
    let query = db.collection(collection).where("seedTag", "==", SEED_TAG).limit(BATCH_CHUNK_SIZE);
    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    scanned += snap.size;
    cursor = snap.docs[snap.docs.length - 1];

    const candidates = snap.docs.filter((doc) => matchesPeriod(doc, collection, periodId));
    if (candidates.length === 0) {
      continue;
    }

    if (!dryRun) {
      const batch = db.batch();
      candidates.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    deleted += candidates.length;
  }

  console.log(`[seed:clean] ${collection}: scanned=${scanned}, deleted=${deleted}${dryRun ? " (dry-run)" : ""}`);
  return deleted;
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.confirm !== REQUIRED_CONFIRM) {
    console.error(
      `[seed:clean] confirmacion requerida. Usa --confirm=${REQUIRED_CONFIRM} para ejecutar la limpieza.`
    );
    process.exitCode = 1;
    return;
  }

  if (getApps().length === 0) {
    initializeApp(args.projectId ? { projectId: args.projectId } : undefined);
  }
  const db = getFirestore();

  const collections = getTargetCollections(args.periodId);
  console.log(
    `[seed:clean] inicio: seedTag=${SEED_TAG}, periodId=${args.periodId ?? "ALL"}, dryRun=${args.dryRun}`
  );

  let totalDeleted = 0;
  for (const collection of collections) {
    totalDeleted += await deleteTaggedCollection(db, collection, args.periodId, args.dryRun);
  }

  console.log(`[seed:clean] completado. totalDeleted=${totalDeleted}${args.dryRun ? " (dry-run)" : ""}`);
}

run().catch((error) => {
  console.error("[seed:clean] error:", error);
  process.exitCode = 1;
});
