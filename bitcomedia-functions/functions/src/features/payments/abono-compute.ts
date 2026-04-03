import type {DocumentData} from "firebase-admin/firestore";

export type AbonoGlobalConfig = {
  abono_min_percent: number;
  abono_min_amount_cop: number;
  abono_max_days_before_event: number;
};

export function defaultAbonoConfig(): AbonoGlobalConfig {
  return {
    abono_min_percent: 30,
    abono_min_amount_cop: 0,
    abono_max_days_before_event: 7,
  };
}

/** Reglas de abono definidas en el documento del evento (admin del evento). */
export function loadAbonoConfigFromEvent(eventData: DocumentData | undefined): AbonoGlobalConfig {
  const d = defaultAbonoConfig();
  if (!eventData) return d;
  const p = Number(eventData.abono_min_percent);
  const m = Number(eventData.abono_min_amount_cop);
  const days = Number(eventData.abono_max_days_before_event);
  return {
    abono_min_percent: Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : d.abono_min_percent,
    abono_min_amount_cop: Number.isFinite(m) ? Math.max(0, m) : d.abono_min_amount_cop,
    abono_max_days_before_event: Number.isFinite(days) ? Math.max(1, days) : d.abono_max_days_before_event,
  };
}

export function computeDepositAndBalance(
  totalCOP: number,
  cfg: AbonoGlobalConfig
): { depositCOP: number; balanceCOP: number } {
  const total = Math.max(0, Math.round(totalCOP));
  let deposit = Math.ceil((total * cfg.abono_min_percent) / 100);
  deposit = Math.max(deposit, Math.round(cfg.abono_min_amount_cop));
  deposit = Math.min(deposit, Math.max(0, total - 1));
  if (deposit <= 0 && total > 0) {
    deposit = Math.min(1, total - 1);
  }
  const balance = total - deposit;
  return {depositCOP: deposit, balanceCOP: balance};
}

/** Fecha límite para pagar saldo: N días antes del inicio del evento (00:00 ese día en local parse). */
export function computeBalanceDueAtMs(
  eventData: DocumentData,
  cfg: AbonoGlobalConfig
): number | null {
  const dateStr = String(eventData.date || "").trim();
  const timeStr = String(eventData.time || "23:59").trim();
  if (!dateStr) return null;
  const start = parseLooseLocalDateTime(dateStr, timeStr);
  if (!start || isNaN(start.getTime())) return null;
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() - cfg.abono_max_days_before_event);
  deadline.setHours(23, 59, 59, 999);
  return deadline.getTime();
}

function parseLooseLocalDateTime(dateStr: string, timeStr: string): Date | null {
  const dPart = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dPart) {
    const y = parseInt(dPart[1], 10);
    const mo = parseInt(dPart[2], 10) - 1;
    const da = parseInt(dPart[3], 10);
    const t = parseTime(timeStr);
    return new Date(y, mo, da, t.h, t.m, 0, 0);
  }
  const tryNat = new Date(`${dateStr}T${normalizeTime(timeStr)}`);
  return isNaN(tryNat.getTime()) ? null : tryNat;
}

function normalizeTime(timeStr: string): string {
  const t = timeStr.trim();
  if (/^\d{2}:\d{2}/.test(t)) return t.length === 5 ? `${t}:00` : t;
  return "23:59:00";
}

function parseTime(timeStr: string): { h: number; m: number } {
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    return {h: parseInt(m[1], 10), m: parseInt(m[2], 10)};
  }
  return {h: 23, m: 59};
}

export function canOfferAbonoNewPurchase(balanceDueAtMs: number | null, nowMs = Date.now()): boolean {
  if (balanceDueAtMs == null) return false;
  return nowMs < balanceDueAtMs;
}
