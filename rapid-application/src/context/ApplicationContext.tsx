import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FunctionsError } from "firebase/functions";
import { useAuth } from "./AuthContext";
import { createDraftApplication } from "@/lib/application/emptyApplication";
import { createDraft, listDocuments, listOwnerApplications, loadApplication, saveDraftSections } from "@/lib/application/firestore";
import { checkFile, type DocumentSlotKey } from "@/lib/form/documents";
import type { Issue } from "@/lib/form/rules";
import { DEFAULT_CYCLE_ID } from "@/lib/validation/constants";
import type { ApplicationSections, DocumentRecord, ScholarshipApplication } from "@/types/application";
import { callServer } from "@/lib/firebase/server";

type SaveState = "idle" | "saving" | "saved" | "error";

export class SubmitError extends Error {
  constructor(
    message: string,
    public issues: Issue[] = [],
  ) {
    super(message);
  }
}

type ApplicationState = {
  applications: ScholarshipApplication[];
  application: ScholarshipApplication | null;
  documents: DocumentRecord[];
  loading: boolean;
  saveState: SaveState;
  refreshApplications: () => Promise<void>;
  openApplication: (applicationId: string) => Promise<ScholarshipApplication | null>;
  startApplication: () => Promise<ScholarshipApplication>;
  updateSection: <K extends keyof ApplicationSections>(key: K, value: ApplicationSections[K]) => void;
  flush: () => Promise<void>;
  uploadDocument: (input: { slot: DocumentSlotKey; index?: number; entryId?: string; label?: string; file: File }) => Promise<void>;
  submit: () => Promise<string>;
};

const ApplicationContext = createContext<ApplicationState | null>(null);

function readAsBase64(file: File): Promise<{ base64: string; bytes: Uint8Array }> {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(binary), bytes };
  });
}

function messageOf(err: unknown): string {
  const e = err as Partial<FunctionsError>;
  return typeof e?.message === "string" && e.code !== "functions/internal" ? e.message : "Something went wrong. Please try again.";
}

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
  const [application, setApplication] = useState<ScholarshipApplication | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const pending = useRef<ScholarshipApplication | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());

  const refreshApplications = useCallback(async () => {
    if (!user) return;
    setApplications(await listOwnerApplications(user.uid, DEFAULT_CYCLE_ID));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setApplications([]);
      setApplication(null);
      setDocuments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listOwnerApplications(user.uid, DEFAULT_CYCLE_ID)
      .then((apps) => !cancelled && setApplications(apps))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const writePending = useCallback(() => {
    const next = pending.current;
    pending.current = null;
    if (!next || next.status !== "draft") return saving.current;
    setSaveState("saving");
    saving.current = saving.current
      .then(() => saveDraftSections(next))
      .then((updatedAt) => {
        setApplication((cur) => (cur && cur.applicationId === next.applicationId ? { ...cur, updatedAt } : cur));
        setSaveState(pending.current ? "saving" : "saved");
      })
      .catch(() => setSaveState("error"));
    return saving.current;
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await writePending();
  }, [writePending]);

  const openApplication = useCallback(
    async (applicationId: string) => {
      if (application?.applicationId === applicationId) return application;
      await flush();
      const app = await loadApplication(applicationId);
      setApplication(app);
      setDocuments(app ? await listDocuments(applicationId) : []);
      return app;
    },
    [application, flush],
  );

  const startApplication = useCallback(async () => {
    if (!user) throw new Error("auth-required");
    await flush();
    const draft = createDraftApplication(crypto.randomUUID(), user.uid);
    await createDraft(draft);
    setApplication(draft);
    setDocuments([]);
    setApplications((list) => [...list, draft]);
    return draft;
  }, [flush, user]);

  const updateSection = useCallback(
    <K extends keyof ApplicationSections>(key: K, value: ApplicationSections[K]) => {
      setApplication((cur) => {
        if (!cur || cur.status !== "draft") return cur;
        const next = { ...cur, sections: { ...cur.sections, [key]: value } };
        pending.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void writePending(), 800);
        setSaveState("saving");
        return next;
      });
    },
    [writePending],
  );

  const uploadDocument = useCallback<ApplicationState["uploadDocument"]>(
    async ({ slot, index = 1, entryId, label, file }) => {
      if (!application) throw new Error("no-application");
      await flush();
      const { base64, bytes } = await readAsBase64(file);
      const check = checkFile(slot, bytes);
      if (!check.ok) throw new Error(check.message);
      try {
        await callServer(
          "uploadScholarshipDocument",
          { applicationId: application.applicationId, slot, index, entryId, label, dataBase64: base64 },
          150_000,
        );
      } catch (err) {
        throw new Error(messageOf(err));
      } finally {
        setDocuments(await listDocuments(application.applicationId));
      }
    },
    [application, flush],
  );

  const submit = useCallback(async () => {
    if (!application) throw new Error("no-application");
    await flush();
    try {
      const data = await callServer<{ receiptCode: string }>("submitScholarshipApplication", { applicationId: application.applicationId });
      const refreshed = await loadApplication(application.applicationId);
      setApplication(refreshed);
      await refreshApplications();
      return data.receiptCode;
    } catch (err) {
      const details = (err as Partial<FunctionsError>).details;
      throw new SubmitError(messageOf(err), Array.isArray(details) ? (details as Issue[]) : []);
    }
  }, [application, flush, refreshApplications]);

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  const value = useMemo(
    () => ({
      applications,
      application,
      documents,
      loading,
      saveState,
      refreshApplications,
      openApplication,
      startApplication,
      updateSection,
      flush,
      uploadDocument,
      submit,
    }),
    [applications, application, documents, loading, saveState, refreshApplications, openApplication, startApplication, updateSection, flush, uploadDocument, submit],
  );

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication() {
  const ctx = useContext(ApplicationContext);
  if (!ctx) throw new Error("ApplicationProvider required");
  return ctx;
}
