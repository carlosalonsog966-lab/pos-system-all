export type NormalizedCategory = { id: string; name: string } | undefined;

export function normalizeCategory(raw: any): NormalizedCategory {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const v = raw.trim();
    return v ? { id: v, name: v } : undefined;
  }
  if (typeof raw === 'object') {
    const id = String((raw as any).id ?? (raw as any).name ?? '').trim();
    const name = String((raw as any).name ?? (raw as any).title ?? (raw as any).id ?? '').trim();
    if (!id && !name) return undefined;
    return { id: id || name, name: name || id };
  }
  return undefined;
}

export function normalizeProduct<T extends Record<string, any>>(p: T): T {
  const cat = normalizeCategory(p?.category);
  return {
    ...p,
    category: cat ?? p?.category,
  } as T;
}

export function normalizeProducts<T extends Record<string, any>>(arr: T[] | any): T[] {
  const list: T[] = Array.isArray(arr) ? arr : [];
  return list.map((p) => normalizeProduct(p));
}
