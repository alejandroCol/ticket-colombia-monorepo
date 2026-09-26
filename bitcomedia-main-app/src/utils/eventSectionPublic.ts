import type { EventSection } from '../services/types';

/** Localidad oculta en la landing / checkout público (taquilla admin sigue pudiendo vender). */
export function isSectionHiddenFromPublicStore(sec: EventSection): boolean {
  return sec.hidden_from_public_store === true;
}

export function filterPublicStoreSections(sections: EventSection[]): EventSection[] {
  return sections.filter((s) => !isSectionHiddenFromPublicStore(s));
}

/** Con cupo primero; agotadas al final (orden estable dentro de cada grupo). */
export function sortSectionsSoldOutLast<T extends EventSection>(
  sections: T[],
  getRemaining: (s: T) => number
): T[] {
  return sections
    .map((s, order) => ({ s, order, rem: getRemaining(s) }))
    .sort((a, b) => {
      const aSold = a.rem <= 0 ? 1 : 0;
      const bSold = b.rem <= 0 ? 1 : 0;
      if (aSold !== bSold) return aSold - bSold;
      return a.order - b.order;
    })
    .map((x) => x.s);
}

export function pickDefaultPublicSection<T extends EventSection>(
  sections: T[],
  getRemaining: (s: T) => number
): T | null {
  const visible = sections.filter((s) => !isSectionHiddenFromPublicStore(s));
  const sorted = sortSectionsSoldOutLast(visible, getRemaining);
  if (sorted.length === 0) return null;
  return sorted.find((s) => getRemaining(s) > 0) ?? sorted[0];
}
