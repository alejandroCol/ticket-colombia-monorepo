/** Color acento por defecto en textos destacados del PDF del boleto (localidad, precio, etc.). */
export const TICKET_FLYER_ACCENT_DEFAULT = "#00d4ff";

/** Opción 2 — nombre del comprador en el recuadro. */
export const TICKET_FLYER_MINIMAL_NAME_DEFAULT = "#ffffff";

/** Opción 2 — correo e indicaciones (“Presenta este QR…”, “Entrada X de Y”). */
export const TICKET_FLYER_MINIMAL_EMAIL_DEFAULT = "#e0e0e0";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexFromField(raw: unknown, fallback: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  const h = s.startsWith("#") ? s : `#${s}`;
  const match = HEX_RE.exec(h);
  if (!match) return fallback;
  const body = match[1];
  if (body.length === 3) {
    const [a, b, c] = body.split("");
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return h.toLowerCase();
}

/**
 * Color hexadecimal configurable en el evento (`ticket_flyer_accent_color`).
 * Acepta #RGB o #RRGGBB; valores inválidos vuelven al azul por defecto.
 */
export function ticketFlyerAccentColorFromEvent(eventData: any): string {
  return hexFromField(eventData?.ticket_flyer_accent_color, TICKET_FLYER_ACCENT_DEFAULT);
}

export function ticketFlyerMinimalNameColorFromEvent(eventData: any): string {
  return hexFromField(
    eventData?.ticket_flyer_minimal_name_color,
    TICKET_FLYER_MINIMAL_NAME_DEFAULT
  );
}

export function ticketFlyerMinimalEmailColorFromEvent(eventData: any): string {
  return hexFromField(
    eventData?.ticket_flyer_minimal_email_color,
    TICKET_FLYER_MINIMAL_EMAIL_DEFAULT
  );
}
