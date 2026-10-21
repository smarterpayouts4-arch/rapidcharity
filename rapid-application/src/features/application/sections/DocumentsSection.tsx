import { DocumentUpload } from "@/components/DocumentUpload";
import { useApplication } from "@/context/ApplicationContext";
import { DOCUMENT_SLOTS, SECTION_11_SLOTS, documentId } from "@/lib/form/documents";
import { MAX_OTHER_DOCUMENTS } from "@/lib/form/options";
import { requiredDocumentSlots, visibility } from "@/lib/form/rules";
import type { ApplicationSections } from "@/types/application";

export function DocumentsSection({ sections, errors }: { sections: ApplicationSections; errors: Record<string, string> }) {
  const { documents } = useApplication();
  const required = new Set(requiredDocumentSlots(sections));
  const v = visibility(sections);
  const find = (id: string) => documents.find((d) => d.documentId === id);
  return (
    <>
      <p>
        Files are saved privately for RAPID staff. Only staff who review applications can open them. Upload a clear photo or scan of each
        document.
      </p>
      {SECTION_11_SLOTS.filter((slot) => slot !== "docOther")
        .filter((slot) => (slot === "docDeathCert" ? v.docDeathCert : slot === "docDisabilityCert" ? v.docDisabilityCert : true))
        .map((slot) => (
          <DocumentUpload
            key={slot}
            slot={slot}
            label={DOCUMENT_SLOTS[slot].label}
            required={required.has(slot)}
            record={find(documentId(slot, 1))}
            error={errors[slot]}
          />
        ))}
      <h3>Anything else? (optional)</h3>
      {Array.from({ length: MAX_OTHER_DOCUMENTS }, (_, i) => i + 1).map((index) => (
        <DocumentUpload
          key={index}
          slot="docOther"
          index={index}
          label={`Extra document ${index}`}
          required={false}
          askForLabel
          record={find(documentId("docOther", index))}
          error={errors[`docOther_${index}`]}
        />
      ))}
    </>
  );
}
