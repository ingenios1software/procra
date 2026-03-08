import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { liquidatePeriodCore } from "./liquidation";
export { createTenantCompany, createTenantUser, migrateLegacyDataToTenant } from "./tenants";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

export const liquidatePeriod = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const uid = request.auth.uid;
  const meSnap = await db.doc(`users/${uid}`).get();
  const role = meSnap.get("role");
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Solo admin puede liquidar.");
  }

  const periodIdRaw = request.data?.periodId;
  if (typeof periodIdRaw !== "string" || !periodIdRaw.trim()) {
    throw new HttpsError("invalid-argument", "Debes enviar periodId.");
  }
  const periodId = periodIdRaw.trim();
  return liquidatePeriodCore(db, { periodId, generatedByUid: uid });
});
