import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { appOrigin, firebaseConfig, useEmulators } from "./config";

export function getFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApps()[0]!;
}

export function getFirebaseAuth() {
  const auth = getAuth(getFirebaseApp());
  if (useEmulators && !(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

let firestoreConnected = false;
export function getFirebaseDb() {
  const db = getFirestore(getFirebaseApp());
  if (useEmulators && !firestoreConnected) {
    firestoreConnected = true;
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}

let functionsConnected = false;
export function getFirebaseFunctions() {
  const functions = getFunctions(getFirebaseApp(), "us-central1");
  if (useEmulators && !functionsConnected) {
    functionsConnected = true;
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  return functions;
}

/** The email is not put in the link; on another device the applicant types it again. */
export function emailLinkSettings() {
  return { url: `${appOrigin}/sign-in/finish`, handleCodeInApp: true };
}
