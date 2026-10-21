import { describe, expect, it } from "vitest";
import { searchCatalog, type CatalogItem } from "@/lib/catalog/search";

const sample: CatalogItem[] = [
  {
    id: "inst_forman_christian_college_university",
    label: "Forman Christian College University (FCCU)",
    city: "Lahore",
    province: "Punjab",
    searchKeys: ["forman christian college university fccu"],
    aliases: ["FCCU", "Forman"],
  },
  {
    id: "inst_other_uni",
    label: "Superior College Lahore",
    city: "Lahore",
    province: "Punjab",
    searchKeys: ["superior college lahore"],
  },
];

describe("catalog search", () => {
  it("finds FCCU by alias prefix", () => {
    const hits = searchCatalog("forman", sample, "institutions");
    expect(hits[0]?.item.id).toContain("forman");
  });
  it("does not auto-select on empty query", () => {
    expect(searchCatalog("", sample, "institutions")).toHaveLength(0);
  });
  it("returns ambiguous options for vague queries without merging", () => {
    const hits = searchCatalog("superior", sample, "institutions");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.item.label).toContain("Superior");
  });
});
