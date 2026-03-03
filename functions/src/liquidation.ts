import { FieldValue, Firestore } from "firebase-admin/firestore";

type Totals = {
  normalMin: number;
  extraMin: number;
  nightMin: number;
  holidayMin: number;
  bonus: number;
  deduction: number;
  advance: number;
};

const EMPTY_TOTALS: Totals = {
  normalMin: 0,
  extraMin: 0,
  nightMin: 0,
  holidayMin: 0,
  bonus: 0,
  deduction: 0,
  advance: 0,
};

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function minutesToCents(minutes: number, hourlyRateCents: number, factor = 1): number {
  return Math.round((minutes / 60) * hourlyRateCents * factor);
}

export async function liquidatePeriodCore(
  db: Firestore,
  params: { periodId: string; generatedByUid: string; seedTag?: string }
): Promise<{ ok: true; periodId: string; workers: number }> {
  const { periodId, generatedByUid, seedTag } = params;
  const periodRef = db.doc(`periods/${periodId}`);
  const periodSnap = await periodRef.get();
  if (!periodSnap.exists) {
    throw new Error("El periodo no existe.");
  }
  if (periodSnap.get("status") !== "open") {
    throw new Error("El periodo debe estar en estado open.");
  }

  const [attendanceSnap, adjustmentSnap] = await Promise.all([
    db
      .collection("attendances")
      .where("periodId", "==", periodId)
      .where("status", "==", "approved")
      .get(),
    db.collection("adjustments").where("periodId", "==", periodId).get(),
  ]);

  const byWorker = new Map<string, Totals>();

  attendanceSnap.forEach((doc) => {
    const data = doc.data();
    const workerId = data.workerId as string | undefined;
    if (!workerId) {
      return;
    }

    const current = byWorker.get(workerId) ?? { ...EMPTY_TOTALS };
    current.normalMin += asNumber(data.normalMin);
    current.extraMin += asNumber(data.extraMin);
    current.nightMin += asNumber(data.nightMin);
    current.holidayMin += asNumber(data.holidayMin);
    byWorker.set(workerId, current);
  });

  adjustmentSnap.forEach((doc) => {
    const data = doc.data();
    const workerId = data.workerId as string | undefined;
    if (!workerId) {
      return;
    }

    const current = byWorker.get(workerId) ?? { ...EMPTY_TOTALS };
    const amountCents = asNumber(data.amountCents);
    const type = data.type as string | undefined;

    if (type === "bonus") {
      current.bonus += amountCents;
    } else if (type === "deduction") {
      current.deduction += amountCents;
    } else if (type === "advance") {
      current.advance += amountCents;
    }

    byWorker.set(workerId, current);
  });

  const workerIds = Array.from(byWorker.keys());
  const workerRefs = workerIds.map((id) => db.doc(`workers/${id}`));
  const workerSnaps = workerRefs.length > 0 ? await db.getAll(...workerRefs) : [];
  const workerRateById = new Map<string, number>();

  workerSnaps.forEach((snap) => {
    if (!snap.exists) {
      return;
    }
    workerRateById.set(snap.id, asNumber(snap.get("baseRateCents")));
  });

  type SettlementPayload = {
    settlementId: string;
    data: Record<string, unknown>;
  };

  const settlements: SettlementPayload[] = workerIds.map((workerId) => {
    const totals = byWorker.get(workerId) ?? { ...EMPTY_TOTALS };
    const rate = workerRateById.get(workerId) ?? 0;

    const normal = minutesToCents(totals.normalMin, rate, 1);
    const extra = minutesToCents(totals.extraMin, rate, 1.25);
    const night = minutesToCents(totals.nightMin, rate, 1.35);
    const holiday = minutesToCents(totals.holidayMin, rate, 1.75);

    const grossCents = normal + extra + night + holiday + totals.bonus;
    const deductionsCents = totals.deduction + totals.advance;
    const netCents = grossCents - deductionsCents;

    return {
      settlementId: `${periodId}_${workerId}`,
      data: {
        periodId,
        workerId,
        grossCents,
        deductionsCents,
        netCents,
        minutes: {
          normalMin: totals.normalMin,
          extraMin: totals.extraMin,
          nightMin: totals.nightMin,
          holidayMin: totals.holidayMin,
        },
        breakdown: {
          normal,
          extra,
          night,
          holiday,
          bonus: totals.bonus,
          deduction: totals.deduction,
          advance: totals.advance,
        },
        generatedBy: generatedByUid,
        generatedAt: FieldValue.serverTimestamp(),
        ...(seedTag ? { seedTag } : {}),
      },
    };
  });

  const writeChunkSize = 450;
  if (settlements.length === 0) {
    await periodRef.update({
      status: "liquidated",
      liquidatedBy: generatedByUid,
      liquidatedAt: FieldValue.serverTimestamp(),
      workersCount: 0,
    });
  } else {
    for (let i = 0; i < settlements.length; i += writeChunkSize) {
      const chunk = settlements.slice(i, i + writeChunkSize);
      const batch = db.batch();

      chunk.forEach((item) => {
        const ref = db.doc(`settlements/${item.settlementId}`);
        batch.set(ref, item.data, { merge: false });
      });

      const isLastChunk = i + writeChunkSize >= settlements.length;
      if (isLastChunk) {
        batch.update(periodRef, {
          status: "liquidated",
          liquidatedBy: generatedByUid,
          liquidatedAt: FieldValue.serverTimestamp(),
          workersCount: settlements.length,
        });
      }

      await batch.commit();
    }
  }

  return {
    ok: true,
    periodId,
    workers: settlements.length,
  };
}
