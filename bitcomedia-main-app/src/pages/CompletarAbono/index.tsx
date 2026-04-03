import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopNavBar from '../../containers/TopNavBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import Loader from '../../components/Loader';
import { getCurrentUser } from '../../services';
import {
  getAbonoCheckoutPublicInfo,
  createBalanceInstallmentPreference,
} from '../../services/ticketService';
import { persistMercadoPagoReturnIntent } from '../../utils/mpCheckoutReturnIntent';
import './index.scss';

const CompletarAbonoScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getAbonoCheckoutPublicInfo>> | null>(
    null
  );
  const [paying, setPaying] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    setAuthed(!!u);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) {
        setError('Falta el enlace de pago. Revisa el correo de confirmación de abono.');
        setLoading(false);
        return;
      }
      try {
        const data = await getAbonoCheckoutPublicInfo(token);
        if (!cancelled) {
          setInfo(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar la información.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const handlePay = async () => {
    if (!info?.ticketId) return;
    if (!getCurrentUser()) {
      navigate('/iniciar-sesion');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const result = await createBalanceInstallmentPreference(info.ticketId);
      const returnAbs = `${window.location.origin}/compra-finalizada?abono_balance=1&ticket=${encodeURIComponent(info.ticketId)}`;
      persistMercadoPagoReturnIntent(returnAbs);
      const url = result?.initPoint || (result as { sandboxInitPoint?: string })?.sandboxInitPoint;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No se pudo abrir el checkout');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar el pago');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="completar-abono">
        <TopNavBar logoOnly />
        <div className="completar-abono__center">
          <Loader size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="completar-abono">
      <TopNavBar logoOnly />
      <main className="completar-abono__main">
        <h1>Completar pago</h1>
        {error && <p className="completar-abono__error">{error}</p>}
        {info && !error && (
          <>
            <p className="completar-abono__lead">
              <strong>{info.eventName}</strong>
            </p>
            <ul className="completar-abono__list">
              <li>
                Abono ya pagado: <strong>{formatCOP(info.depositCOP)}</strong>
              </li>
              <li>
                Saldo pendiente: <strong>{formatCOP(info.balanceCOP)}</strong>
              </li>
              {info.balanceDueAtMs != null && (
                <li>
                  Fecha límite:{' '}
                  <strong>
                    {new Date(info.balanceDueAtMs).toLocaleString('es-CO', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}
                  </strong>
                </li>
              )}
            </ul>
            <p className="completar-abono__hint">
              Al completar el pago verás tus entradas con código QR en «Mis entradas».
            </p>
            <div className="completar-abono__actions">
              <PrimaryButton type="button" onClick={() => void handlePay()} disabled={paying} loading={paying}>
                {authed ? 'Pagar saldo con Mercado Pago' : 'Iniciar sesión y pagar'}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => navigate('/')}>
                Volver al inicio
              </SecondaryButton>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default CompletarAbonoScreen;
