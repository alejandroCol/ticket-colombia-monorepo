import * as functions from "firebase-functions/v1";
import type {OrganizerInquiryPayload, ValidatedOrganizerInquiry} from "./types";

const ALLOWED_DIALS = new Set([
  "+57", "+52", "+593", "+51", "+56", "+54", "+1", "+34",
]);

export const EVENT_AREA_CODES: ReadonlyArray<{value: string; label: string}> = [
  {value: "601", label: "601 · Bogotá y Cundinamarca"},
  {value: "602", label: "602 · Valle del Cauca (Cali)"},
  {value: "604", label: "604 · Antioquia (Medellín)"},
  {value: "605", label: "605 · Atlántico (Barranquilla)"},
  {value: "606", label: "606 · Risaralda (Pereira)"},
  {value: "607", label: "607 · Santander (Bucaramanga)"},
  {value: "608", label: "608 · Quindío (Armenia)"},
  {value: "609", label: "609 · Norte de Santander (Cúcuta)"},
  {value: "other", label: "Otra ciudad / por definir"},
];

const EVENT_AREA_BY_VALUE = new Map(EVENT_AREA_CODES.map((o) => [o.value, o.label]));

export const ATTENDANCE_RANGES: ReadonlyArray<{value: string; label: string}> = [
  {value: "lt_100", label: "Menos de 100 personas"},
  {value: "100_500", label: "100 – 500 personas"},
  {value: "500_1000", label: "500 – 1.000 personas"},
  {value: "1000_5000", label: "1.000 – 5.000 personas"},
  {value: "gt_5000", label: "Más de 5.000 personas"},
];

const ATTENDANCE_BY_VALUE = new Map(ATTENDANCE_RANGES.map((o) => [o.value, o.label]));

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isValidPhone(dial: string, localRaw: string): boolean {
  const d = digitsOnly(localRaw);
  if (d.length < 7) return false;
  if (dial === "+57") return d.length === 10;
  return d.length <= 15;
}

function buildE164(dial: string, localRaw: string): string {
  return `${dial}${digitsOnly(localRaw)}`;
}

/**
 * Valida y normaliza el payload del formulario público.
 */
export function validateOrganizerInquiry(
  data: OrganizerInquiryPayload | undefined
): ValidatedOrganizerInquiry {
  const name = String(data?.name || "").trim();
  const email = String(data?.email || "").trim().toLowerCase();
  const whatsappDial = String(data?.whatsappDial || "").trim();
  const whatsappLocal = String(data?.whatsappLocal || "").trim();
  const eventAreaCode = String(data?.eventAreaCode || "").trim();
  const approximateAttendees = String(data?.approximateAttendees || "").trim();

  if (name.length < 2 || name.length > 120) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Ingresa tu nombre completo (mínimo 2 caracteres)."
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Ingresa un correo electrónico válido."
    );
  }

  if (!ALLOWED_DIALS.has(whatsappDial)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Selecciona un indicativo válido para WhatsApp."
    );
  }

  if (!isValidPhone(whatsappDial, whatsappLocal)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      whatsappDial === "+57" ?
        "El WhatsApp en Colombia debe tener 10 dígitos (sin el +57)." :
        "Ingresa un número de WhatsApp válido."
    );
  }

  const eventAreaLabel = EVENT_AREA_BY_VALUE.get(eventAreaCode);
  if (!eventAreaLabel) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Selecciona el código de área o ciudad del evento."
    );
  }

  const approximateAttendeesLabel = ATTENDANCE_BY_VALUE.get(approximateAttendees);
  if (!approximateAttendeesLabel) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Selecciona un rango aproximado de asistentes."
    );
  }

  return {
    name,
    email,
    whatsappE164: buildE164(whatsappDial, whatsappLocal),
    eventAreaCode,
    eventAreaLabel,
    approximateAttendees,
    approximateAttendeesLabel,
  };
}
