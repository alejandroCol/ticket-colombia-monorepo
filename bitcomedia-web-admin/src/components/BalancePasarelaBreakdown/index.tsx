import React from 'react';
import type { EventPasarelaBalances } from '@utils/pasarelaBalance';
import { ONEPAY_PASARELA_COMMISSION_DISCLAIMER } from '@utils/pasarelaBalance';
import './index.scss';

type Props = {
  balances: EventPasarelaBalances;
  formatCOP: (n: number) => string;
  compact?: boolean;
};

const BalancePasarelaBreakdown: React.FC<Props> = ({ balances, formatCOP, compact }) => {
  const { providers, manualFueraPasarelaCOP, tiqueteraEnManualCOP } = balances;
  if (providers.length === 0 && manualFueraPasarelaCOP <= 0) return null;

  return (
    <div
      className={`balance-pasarela-breakdown${compact ? ' balance-pasarela-breakdown--compact' : ''}`}
      aria-label="Saldo estimado por pasarela"
    >
      <h4 className="balance-pasarela-breakdown__title">Por pasarela</h4>
      {providers.map((p) => (
        <div
          key={p.provider}
          className={`balance-pasarela-breakdown__provider balance-pasarela-breakdown__provider--${p.provider}`}
        >
          <h5 className="balance-pasarela-breakdown__provider-name">{p.label}</h5>
          <div className="balance-pasarela-breakdown__row">
            <span>Recaudado en {p.label}</span>
            <span>{formatCOP(p.recaudadoCOP)}</span>
          </div>
          {p.tarifaTiqueteraCOP > 0 && (
            <div className="balance-pasarela-breakdown__row balance-pasarela-breakdown__row--deduct">
              <span>Tarifa tiquetera (descontada aquí)</span>
              <span>−{formatCOP(p.tarifaTiqueteraCOP)}</span>
            </div>
          )}
          {(p.comisionPasarelaCOP > 0 || p.commissionIsFinal) && (
            <div className="balance-pasarela-breakdown__row balance-pasarela-breakdown__row--deduct">
              <span>
                {p.commissionIsFinal ? 'Comisión pasarela (final)' : 'Comisión pasarela (est.)'}
              </span>
              <span>−{formatCOP(p.comisionPasarelaCOP)}</span>
            </div>
          )}
          {p.provider === 'onepay' && p.showPasarelaCommissionEstimate && !p.commissionIsFinal && (
            <p className="balance-pasarela-breakdown__disclaimer">{ONEPAY_PASARELA_COMMISSION_DISCLAIMER}</p>
          )}
          {p.provider === 'mercadopago' && !p.commissionIsFinal && p.comisionPasarelaCOP <= 0 && (
            <div className="balance-pasarela-breakdown__row balance-pasarela-breakdown__row--hint">
              <span>Comisión pasarela</span>
              <span>Según MP</span>
            </div>
          )}
          {p.retirosCOP > 0 && (
            <div className="balance-pasarela-breakdown__row balance-pasarela-breakdown__row--deduct">
              <span>Retiros registrados</span>
              <span>−{formatCOP(p.retirosCOP)}</span>
            </div>
          )}
          <div className="balance-pasarela-breakdown__row balance-pasarela-breakdown__row--saldo">
            <span>Debería haber en {p.label}</span>
            <strong>{formatCOP(p.saldoEstimadoCOP)}</strong>
          </div>
        </div>
      ))}
      {manualFueraPasarelaCOP > 0 && (
        <div className="balance-pasarela-breakdown__manual">
          <div className="balance-pasarela-breakdown__row">
            <span>Taquilla / manual (fuera de pasarela)</span>
            <span>{formatCOP(manualFueraPasarelaCOP)}</span>
          </div>
          {tiqueteraEnManualCOP > 0 && (
            <div className="balance-pasarela-breakdown__row balance-pasarela-breakdown__row--hint">
              <span>Tarifa tiquetera (incl. en neto manual)</span>
              <span>{formatCOP(tiqueteraEnManualCOP)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BalancePasarelaBreakdown;
