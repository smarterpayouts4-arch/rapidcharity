import { CatalogField } from "@/components/CatalogField";
import { NumberField, SelectField, TextAreaField, TextField } from "@/components/fields";
import { useCatalogList, useList, type CityItem } from "@/hooks/useCatalog";
import { formatCnicDisplay } from "@/lib/validation/cnic";
import { visibility } from "@/lib/form/rules";
import type { FlatSectionProps } from "./types";

function selectProps(p: FlatSectionProps, key: string) {
  return {
    id: key,
    value: p.values[key],
    onChange: (v: string) => p.patch({ [key]: v }),
    otherValue: p.values[`${key}Other`],
    onOtherChange: (v: string) => p.patch({ [`${key}Other`]: v }),
    error: p.errors[key],
    otherError: p.errors[`${key}Other`],
    required: true,
  };
}

function textProps(p: FlatSectionProps, key: string) {
  return { id: key, value: p.values[key], onChange: (v: string) => p.patch({ [key]: v }), error: p.errors[key], required: true };
}

export function AboutSection(p: FlatSectionProps) {
  const gender = useList("gender");
  const religion = useList("religion");
  const yesNo = useList("yesNo");
  return (
    <>
      <TextField {...textProps(p, "firstName")} label="First name" maxLength={40} autoComplete="given-name" />
      <TextField {...textProps(p, "lastName")} label="Last name (family name)" maxLength={40} autoComplete="family-name" />
      <TextField
        {...textProps(p, "cnic")}
        onChange={(v) => p.patch({ cnic: formatCnicDisplay(v) })}
        label="CNIC / B-Form number"
        hint="13 digits, for example 35202-1234567-1. Only one application per CNIC is accepted each round."
        inputMode="numeric"
        maxLength={15}
      />
      <SelectField {...selectProps(p, "gender")} label="Gender" options={gender} />
      <SelectField {...selectProps(p, "religion")} label="Religion" options={religion} />
      <SelectField
        {...selectProps(p, "specialNeeds")}
        label="Are you applying in the special-needs (e.g. visually impaired) category?"
        options={yesNo}
      />
      <SelectField {...selectProps(p, "previousRapid")} label="Have you received a RAPID scholarship before?" options={yesNo} />
    </>
  );
}

export function ContactSection(p: FlatSectionProps) {
  const cities = useCatalogList<CityItem>("cities");
  const provinces = useList("provinces");
  const v = visibility(p.sections);
  return (
    <>
      <TextField {...textProps(p, "mobile")} label="Mobile number" hint="For example 0300-1234567" type="tel" inputMode="tel" maxLength={15} autoComplete="tel" />
      <TextField
        {...textProps(p, "email")}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        hint="A family email is fine. Each applicant still needs their own application."
      />
      <TextField {...textProps(p, "addressLine")} label="Home address (house, street, area)" maxLength={150} autoComplete="street-address" />
      <CatalogField
        id="homeCity"
        label="City"
        kind="cities"
        items={cities}
        value={p.values.homeCity}
        manualLabel="Can't find your city? Enter it manually."
        error={p.errors.homeCity}
        onChange={(value, item) => p.patch({ homeCity: value, homeProvince: item?.provinceId ?? "" })}
      />
      <SelectField
        {...selectProps(p, "homeProvince")}
        label="Province / region"
        options={provinces}
        disabled={!v.homeProvinceEditable && Boolean(p.values.homeProvince)}
        hint={!v.homeProvinceEditable && p.values.homeProvince ? "Filled in from the city." : undefined}
      />
    </>
  );
}

export function FamilySection(p: FlatSectionProps) {
  const occupations = useList("occupations");
  const employment = useList("employmentStatus");
  const v = visibility(p.sections);
  const number = (key: string, label: string, max: number, required = true) => (
    <NumberField id={key} label={label} min={0} max={max} required={required} value={p.values[key]} onChange={(n) => p.patch({ [key]: n })} error={p.errors[key]} />
  );
  return (
    <>
      <TextField {...textProps(p, "fatherName")} label="Father's name" maxLength={80} />
      <SelectField {...selectProps(p, "fatherOccupation")} label="Father's occupation" options={occupations} />
      {v.fatherIncome ? number("fatherIncome", "Father's monthly income (PKR)", 2_000_000) : null}
      <TextField {...textProps(p, "motherName")} label="Mother's name" maxLength={80} />
      <SelectField {...selectProps(p, "motherOccupation")} label="Mother's occupation" options={occupations} />
      {v.motherIncome ? number("motherIncome", "Mother's monthly income (PKR)", 2_000_000) : null}
      {number("siblingsCount", "Number of brothers and sisters", 20)}
      {number("siblingsStudying", "How many of them are studying?", 20, false)}
      <SelectField {...selectProps(p, "employment")} label="Are you employed?" options={employment} />
    </>
  );
}

export function ChurchSection(p: FlatSectionProps) {
  return (
    <>
      <TextField {...textProps(p, "churchName")} label="Church / worship place" maxLength={120} />
      <TextField {...textProps(p, "pastorName")} label="Pastor / priest name" maxLength={80} />
    </>
  );
}

export function FeesSection(p: FlatSectionProps) {
  const terms = useList("terms");
  const ynp = useList("yesNoPending");
  const v = visibility(p.sections);
  return (
    <>
      <NumberField
        id="feeAmount"
        label="Fee for the term you are applying for (PKR)"
        required
        min={1000}
        max={3_000_000}
        value={p.values.feeAmount}
        onChange={(n) => p.patch({ feeAmount: n })}
        error={p.errors.feeAmount}
      />
      <SelectField {...selectProps(p, "feeTerm")} label="Fee is for" options={terms.filter((t) => !t.isOther)} />
      <SelectField {...selectProps(p, "otherScholarship")} label="Do you receive any other scholarship?" options={ynp} />
      {v.otherScholarshipDetail ? <TextField {...textProps(p, "otherScholarshipDetail")} label="Which scholarship and how much?" maxLength={120} /> : null}
    </>
  );
}

export function EssaySection(p: FlatSectionProps) {
  return (
    <>
      <TextAreaField {...textProps(p, "goal")} label="What is your goal / dream in life?" minLength={30} maxLength={800} />
      <TextAreaField {...textProps(p, "communitySupport")} label="How can you support our community?" minLength={30} maxLength={800} />
    </>
  );
}

export function ReferencesSection(p: FlatSectionProps) {
  const relationships = useList("relationships");
  const howHeard = useList("howHeard");
  return (
    <>
      <TextField {...textProps(p, "facultyRefName")} label="Faculty reference - name" maxLength={80} />
      <TextField {...textProps(p, "familyRefName")} label="Family reference - name" maxLength={80} />
      <SelectField {...selectProps(p, "familyRefRelation")} label="Family reference - relationship" options={relationships} />
      <SelectField {...selectProps(p, "howHeard")} label="How did you hear about RAPID?" options={howHeard} />
    </>
  );
}
