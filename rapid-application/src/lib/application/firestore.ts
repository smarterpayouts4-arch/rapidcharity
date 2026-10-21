import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { DocumentRecord, ScholarshipApplication, ScholarshipCycle } from "@/types/application";

const APPLICATIONS = "scholarshipApplications";
const CYCLES = "scholarshipCycles";

export function applicationDocRef(applicationId: string) {
  return doc(getFirebaseDb(), APPLICATIONS, applicationId);
}

export async function loadApplication(applicationId: string): Promise<ScholarshipApplication | null> {
  const snap = await getDoc(applicationDocRef(applicationId));
  return snap.exists() ? (snap.data() as ScholarshipApplication) : null;
}

export async function createDraft(app: ScholarshipApplication): Promise<void> {
  await setDoc(applicationDocRef(app.applicationId), app);
}

/** Owners may change only their answers while the application is a draft (enforced by rules). */
export async function saveDraftSections(app: ScholarshipApplication): Promise<number> {
  const updatedAt = Date.now();
  await updateDoc(applicationDocRef(app.applicationId), { sections: app.sections, updatedAt });
  return updatedAt;
}

/** All applications created by this sign-in. One email may own several (for example siblings). */
export async function listOwnerApplications(ownerUid: string, cycleId: string): Promise<ScholarshipApplication[]> {
  const q = query(
    collection(getFirebaseDb(), APPLICATIONS),
    where("ownerUid", "==", ownerUid),
    where("cycleId", "==", cycleId),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as ScholarshipApplication).sort((a, b) => a.createdAt - b.createdAt);
}

export async function listDocuments(applicationId: string): Promise<DocumentRecord[]> {
  const snaps = await getDocs(collection(getFirebaseDb(), APPLICATIONS, applicationId, "documents"));
  return snaps.docs.map((d) => d.data() as DocumentRecord);
}

export async function loadCycle(cycleId: string): Promise<ScholarshipCycle | null> {
  const snap = await getDoc(doc(getFirebaseDb(), CYCLES, cycleId));
  return snap.exists() ? (snap.data() as ScholarshipCycle) : null;
}

export async function saveCycle(cycle: ScholarshipCycle): Promise<void> {
  await setDoc(doc(getFirebaseDb(), CYCLES, cycle.cycleId), cycle);
}

export async function listSubmittedApplications(cycleId: string): Promise<ScholarshipApplication[]> {
  const q = query(
    collection(getFirebaseDb(), APPLICATIONS),
    where("cycleId", "==", cycleId),
    where("status", "==", "submitted"),
    orderBy("submittedAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as ScholarshipApplication);
}
