import type { Event } from '../services/types';

/** Reglas persistidas en el documento del evento (admin del evento). */
export type AbonoRules = {
  abono_min_percent: number;
  abono_min_amount_cop: number;
  abono_max_days_before_event: number;
};

export function getAbonoRulesFromEvent(ev: Event | null): AbonoRules {
  if (!ev) {
    return { abono_min_percent: 30, abono_min_amount_cop: 0, abono_max_days_before_event: 7 };
  }
  return {
    abono_min_percent: Math.min(100, Math.max(0, Number(ev.abono_min_percent ?? 30))),
    abono_min_amount_cop: Math.max(0, Number(ev.abono_min_amount_cop ?? 0)),
    abono_max_days_before_event: Math.max(1, Number(ev.abono_max_days_before_event ?? 7)),
  };
}

/** Debe coincidir con la lógica del backend (abono-compute). */
export function computeDepositSplit(
  totalCOP: number,
  cfg: Pick<AbonoRules, 'abono_min_percent' | 'abono_min_amount_cop'>
): { deposit: number; balance: number } {
  const total = Math.max(0, Math.round(totalCOP));
  let deposit = Math.ceil((total * cfg.abono_min_percent) / 100);
  deposit = Math.max(deposit, Math.round(cfg.abono_min_amount_cop));
  deposit = Math.min(deposit, Math.max(0, total - 1));
  if (deposit <= 0 && total > 0) {
    deposit = Math.min(1, total - 1);
  }
  return { deposit, balance: total - deposit };
}
