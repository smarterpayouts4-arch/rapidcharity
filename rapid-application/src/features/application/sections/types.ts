import type { ApplicationSections, FlatSection } from "@/types/application";

export type FlatSectionProps = {
  sections: ApplicationSections;
  values: FlatSection;
  patch: (changes: FlatSection) => void;
  errors: Record<string, string>;
};
