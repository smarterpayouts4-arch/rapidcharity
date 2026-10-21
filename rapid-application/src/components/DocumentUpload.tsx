import { useId, useState } from "react";
import { useApplication } from "@/context/ApplicationContext";
import { DOCUMENT_SLOTS, type DocumentSlotKey } from "@/lib/form/documents";
import type { DocumentRecord } from "@/types/application";

type Props = {
  slot: DocumentSlotKey;
  index?: number;
  entryId?: string;
  label: string;
  required: boolean;
  record: DocumentRecord | undefined;
  error?: string;
  askForLabel?: boolean;
};

export function DocumentUpload({ slot, index = 1, entryId, label, required, record, error, askForLabel }: Props) {
  const { uploadDocument } = useApplication();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [docLabel, setDocLabel] = useState(record?.slot === "docOther" ? record.label : "");
  const spec = DOCUMENT_SLOTS[slot];
  const accept = spec.types.join(",");
  const stored = record?.uploadStatus === "stored";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      await uploadDocument({ slot, index, entryId, label: askForLabel ? docLabel : undefined, file });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field upload" data-slot={slot}>
      <span className="upload-title" id={`${id}-title`}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <p className="hint">
        {spec.types.includes("application/pdf") ? "PDF, JPG or PNG" : "JPG or PNG"}, up to {Math.round(spec.maxBytes / (1024 * 1024))} MB.
      </p>
      {askForLabel ? (
        <>
          <label htmlFor={`${id}-label`} className="sub-label">
            What is this document?
          </label>
          <input id={`${id}-label`} type="text" maxLength={60} value={docLabel} onChange={(e) => setDocLabel(e.target.value)} />
        </>
      ) : null}
      <input
        id={`${id}-file`}
        type="file"
        accept={accept}
        aria-labelledby={`${id}-title`}
        disabled={busy || (askForLabel && docLabel.trim().length < 2)}
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className="save-status" role="status" aria-live="polite">
        {busy
          ? "Uploading…"
          : stored
            ? `Saved privately (${Math.max(1, Math.round(record!.sizeBytes / 1024))} KB). Choose another file to replace it.`
            : record?.uploadStatus === "uploading"
              ? "The last upload did not finish. Please choose the file again."
              : "Not uploaded yet."}
      </p>
      {failure ? (
        <p className="error-text" role="alert">
          {failure}
        </p>
      ) : error && !stored ? (
        <p className="error-text">{error}</p>
      ) : null}
    </div>
  );
}
