import { useEffect, useState } from "react";
import { DEFAULT_CATALOG_VERSION } from "@/lib/validation/constants";

const LABEL_LISTS = [
  "gender",
  "religion",
  "yesNo",
  "yesNoPending",
  "occupations",
  "provinces",
  "degreeLevels",
  "studySystems",
  "terms",
  "yearOfStudy",
  "enrolmentStatus",
  "employmentStatus",
  "howHeard",
  "relationships",
  "resultFormats",
  "resultStatus",
  "gpaScales",
  "gradeSchemes",
  "letterGrades",
  "divisions",
  "passFail",
  "examBoards",
];

let labelsPromise: Promise<Map<string, string>> | null = null;

function loadLabels(): Promise<Map<string, string>> {
  labelsPromise ??= Promise.all(
    LABEL_LISTS.map((name) =>
      fetch(`/catalog/${DEFAULT_CATALOG_VERSION}/${name}.json`)
        .then((r) => r.json() as Promise<{ items?: { id: string; label: string; isOther?: boolean }[] }>)
        .then((d) => d.items ?? []),
    ),
  ).then((lists) => {
    const map = new Map<string, string>();
    for (const list of lists) for (const item of list) if (!item.isOther) map.set(item.id, item.label);
    return map;
  });
  return labelsPromise;
}

/** One id → label map for all small lists. List ids are prefixed, so they do not collide. */
export function useLabels(): Map<string, string> {
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    void loadLabels().then(setLabels);
  }, []);
  return labels;
}
