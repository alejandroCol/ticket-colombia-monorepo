/** Nombre del evento → fragmento URL (minúsculas, sin tildes, guiones bajos). */
export function slugifyEventName(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s;
}

/** Slugs antiguos terminaban en `_YYYY-MM-DD` (nombre + fecha). */
export function isLegacyDateSuffixSlug(slug: string): boolean {
  const s = String(slug || '').trim();
  return /_\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * @deprecated Usar `slugifyEventName`; la fecha ya no forma parte del slug.
 * Se mantiene la firma por compatibilidad con imports antiguos.
 */
export function generateEventSlug(name: string, _date?: string): string {
  return slugifyEventName(name);
}
