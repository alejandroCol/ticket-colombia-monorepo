/** Indicativos comunes; Colombia por defecto. Solo bandera + código en UI. */
export const GUEST_PHONE_PREFIX_OPTIONS: ReadonlyArray<{ value: string; flag: string }> = [
  { value: "+57", flag: "🇨🇴" },
  { value: "+52", flag: "🇲🇽" },
  { value: "+593", flag: "🇪🇨" },
  { value: "+51", flag: "🇵🇪" },
  { value: "+56", flag: "🇨🇱" },
  { value: "+54", flag: "🇦🇷" },
  { value: "+1", flag: "🇺🇸" },
  { value: "+34", flag: "🇪🇸" },
];

export const DEFAULT_GUEST_PHONE_PREFIX = "+57";

export function guestPhoneDigitsLocal(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** E.164 sin espacios (ej. +573001234567). */
export function buildGuestPhoneE164(dial: string, localRaw: string): string {
  return `${dial}${guestPhoneDigitsLocal(localRaw)}`;
}

/** Cédula / documento: solo dígitos, longitud razonable. */
export function isValidGuestDocument(doc: string): boolean {
  const digits = doc.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 12;
}

/** Celular: Colombia 10 dígitos; otros países 7–15 dígitos. */
export function isValidGuestPhone(dial: string, localRaw: string): boolean {
  const d = guestPhoneDigitsLocal(localRaw);
  if (d.length < 7) return false;
  if (dial === "+57") return d.length === 10;
  return d.length <= 15;
}

/** Mensaje para mostrar al usuario si el celular no cumple la regla del país. */
export function guestPhoneValidationError(dial: string, localRaw: string): string {
  const d = guestPhoneDigitsLocal(localRaw);
  if (dial === "+57") {
    if (d.length === 0) {
      return "Ingresa tu número de celular: en Colombia debe tener exactamente 10 dígitos (sin el indicativo +57).";
    }
    return `El número de celular en Colombia debe tener exactamente 10 dígitos (sin el indicativo). Llevas ${d.length} dígito${d.length === 1 ? "" : "s"}.`;
  }
  if (d.length < 7) {
    return `Ingresa al menos 7 dígitos del número local (sin el indicativo). Llevas ${d.length}.`;
  }
  if (d.length > 15) {
    return "El número no puede tener más de 15 dígitos (sin el indicativo).";
  }
  return "Ingresa un número de celular válido (solo números).";
}
