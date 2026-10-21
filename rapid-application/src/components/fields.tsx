import type { ReactNode } from "react";
import { OTHER } from "@/lib/form/options";
import type { ListItem } from "@/hooks/useCatalog";

type Base = { id: string; label: string; error?: string; required?: boolean; hint?: ReactNode };

function Shell({ id, label, error, required, hint, children }: Base & { children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {hint ? (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function TextField(
  props: Base & { value: unknown; onChange: (v: string) => void; maxLength?: number; type?: string; autoComplete?: string; inputMode?: "numeric" | "tel" | "email" | "text" },
) {
  const { id, value, onChange, maxLength = 150, type = "text", autoComplete, inputMode, error, hint, required } = props;
  return (
    <Shell {...props}>
      <input
        id={id}
        type={type}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy(id, error, hint)}
      />
    </Shell>
  );
}

export function TextAreaField(props: Base & { value: unknown; onChange: (v: string) => void; maxLength: number; minLength?: number }) {
  const { id, value, onChange, maxLength, minLength, error, hint, required } = props;
  const text = typeof value === "string" ? value : "";
  return (
    <Shell {...props}>
      <textarea
        id={id}
        rows={5}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy(id, error, hint)}
      />
      <p className="save-status" aria-live="polite">
        {text.trim().length} / {maxLength} characters{minLength ? ` (at least ${minLength})` : ""}
      </p>
    </Shell>
  );
}

export function NumberField(props: Base & { value: unknown; onChange: (v: number | null) => void; step?: number; min?: number; max?: number }) {
  const { id, value, onChange, step = 1, min, max, error, hint, required } = props;
  return (
    <Shell {...props}>
      <input
        id={id}
        type="number"
        inputMode={step === 1 ? "numeric" : "decimal"}
        step={step}
        min={min}
        max={max}
        value={typeof value === "number" && Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy(id, error, hint)}
      />
    </Shell>
  );
}

/** Native select. When the list has an "Other" item, choosing it reveals a text box saved as `{key}Other`. */
export function SelectField(
  props: Base & {
    value: unknown;
    options: ListItem[];
    onChange: (v: string) => void;
    otherValue?: unknown;
    onOtherChange?: (v: string) => void;
    otherError?: string;
    disabled?: boolean;
  },
) {
  const { id, value, options, onChange, otherValue, onOtherChange, otherError, error, hint, required, disabled } = props;
  const current = typeof value === "string" ? value : "";
  return (
    <Shell {...props}>
      <select
        id={id}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy(id, error, hint)}
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {current === OTHER && onOtherChange ? (
        <>
          <label htmlFor={`${id}-other`} className="sub-label">
            Please type it here
          </label>
          <input
            id={`${id}-other`}
            type="text"
            maxLength={120}
            value={typeof otherValue === "string" ? otherValue : ""}
            onChange={(e) => onOtherChange(e.target.value)}
            aria-invalid={Boolean(otherError)}
            aria-describedby={otherError ? `${id}-other-error` : undefined}
          />
          {otherError ? (
            <p className="error-text" id={`${id}-other-error`} role="alert">
              {otherError}
            </p>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}

export function CheckboxField(props: Base & { checked: boolean; onChange: (v: boolean) => void }) {
  const { id, label, checked, onChange, error, required } = props;
  return (
    <div className="field checkbox">
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : undefined}
        />{" "}
        {label}
      </label>
      {error ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
