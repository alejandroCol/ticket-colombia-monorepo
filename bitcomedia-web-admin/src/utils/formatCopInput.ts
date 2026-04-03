/** Entero COP con separador de miles (.) para mostrar en inputs, p. ej. 10000 → "10.000". */
export function formatCopThousandsDisplay(n: number): string {
  if (!Number.isFinite(n)) return '';
  const t = Math.trunc(Math.max(0, n));
  if (t === 0) return '0';
  return String(t).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
