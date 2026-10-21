import type { CatalogValue } from "@/types/application";
import type { CatalogItem } from "./search";

export function catalogFromSelection(item: CatalogItem, typed: string): CatalogValue {
  return {
    id: item.id,
    labelSnapshot: item.label,
    rawText: typed.trim() || item.label,
    source: "catalog",
    reviewStatus: "verified",
  };
}

export function catalogFromOther(rawText: string): CatalogValue {
  return {
    id: null,
    labelSnapshot: null,
    rawText,
    source: "other",
    reviewStatus: "pending",
  };
}

export function emptyCatalogValue(): CatalogValue {
  return {
    id: null,
    labelSnapshot: null,
    rawText: "",
    source: "other",
    reviewStatus: "pending",
  };
}
