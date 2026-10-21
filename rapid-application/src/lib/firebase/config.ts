const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "localhost",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? "demo-rapid-scholarship",
  appId: env.VITE_FIREBASE_APP_ID ?? "1:000000000000:web:0000000000000000000000",
};

export const useEmulators = env.VITE_USE_EMULATORS === "1" || env.MODE === "test" || env.DEV;

/** Preview deployments get a new URL each time, so without a fixed origin the current one is used. */
export const appOrigin = env.VITE_APP_ORIGIN ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173");
