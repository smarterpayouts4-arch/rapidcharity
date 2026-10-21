import { useEffect, useState } from "react";
import { DEFAULT_CATALOG_VERSION } from "@/lib/validation/constants";
import type { CatalogItem } from "@/lib/catalog/search";

export type ListItem = { id: string; label: string; isOther?: boolean } & Record<string, unknown>;

const cache = new Map<string, Promise<ListItem[]>>();

function loadList(name: string): Promise<ListItem[]> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/catalog/${DEFAULT_CATALOG_VERSION}/${name}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`catalog ${name} ${res.status}`);
        return res.json() as Promise<{ items?: ListItem[] }>;
      })
      .then((data) => data.items ?? []);
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p;
}

export function useList<T extends ListItem = ListItem>(name: string): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let cancelled = false;
    void loadList(name).then((list) => !cancelled && setItems(list as T[]));
    return () => {
      cancelled = true;
    };
  }, [name]);
  return items;
}

export type InstitutionItem = CatalogItem & { campuses: { id: string; label: string; city: string }[] };
export type ProgramItem = CatalogItem & { durationYears: number | null };
export type CityItem = CatalogItem & { provinceId: string };

export function useCatalogList<T extends CatalogItem = CatalogItem>(name: "institutions" | "programs" | "cities"): T[] {
  return useList(name) as unknown as T[];
}
