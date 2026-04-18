import React, { useEffect, useState, useCallback } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import SecondaryButton from "../SecondaryButton";
import { createMercadoPagoCardPayment } from "../../services/ticketService";
import "./index.scss";

export type MercadoPagoPaymentSession = {
  ticketId: string;
  publicKey: string;
  amountCOP: number;
  payerEmail: string;
};

type Props = {
  session: MercadoPagoPaymentSession;
  /** Compra sin cuenta: se envía guestEmail al callable para validar. */
  useGuest: boolean;
  guestEmail: string;
  onBack: () => void;
  onPaid: () => void;
};

const MercadoPagoCardPaymentStep: React.FC<Props> = ({
  session,
  useGuest,
  guestEmail,
  onBack,
  onPaid,
}) => {
  const [sdkReady, setSdkReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const pk = session.publicKey?.trim();
    if (!pk) return;
    try {
      initMercadoPago(pk, { locale: "es-CO" });
      setSdkReady(true);
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "No se pudo iniciar Mercado Pago."
      );
    }
  }, [session.publicKey]);

  const handleSubmit = useCallback(
    async (param: {
      token: string;
      payment_method_id: string;
      issuer_id: string;
      installments: number;
    }) => {
      setSubmitting(true);
      setLocalError(null);
      try {
        const res = await createMercadoPagoCardPayment({
          ticketId: session.ticketId,
          token: param.token,
          paymentMethodId: param.payment_method_id,
          issuerId: param.issuer_id || undefined,
          installments: param.installments,
          ...(useGuest ? { guestEmail: guestEmail.trim() } : {}),
        });
        const st = String(res.status || "").toLowerCase();
        if (st === "approved") {
          onPaid();
          return;
        }
        if (st === "pending" || st === "in_process") {
          onPaid();
          return;
        }
        setLocalError(
          res.statusDetail ||
            `El pago no fue aprobado (estado: ${res.status || "desconocido"}).`
        );
      } catch (e) {
        setLocalError(
          e instanceof Error ? e.message : "Error al procesar el pago."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [session.ticketId, useGuest, guestEmail, onPaid]
  );

  return (
    <div className="mp-card-payment-step">
      <p className="mp-card-payment-step__intro">
        Total a pagar:{" "}
        <strong>
          {new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
          }).format(session.amountCOP)}
        </strong>
      </p>
      {localError ? (
        <p className="mp-card-payment-step__error" role="alert">
          {localError}
        </p>
      ) : null}

      {sdkReady ? (
        <div className="mp-card-payment-step__brick">
          <CardPayment
            locale="es-CO"
            initialization={{
              amount: session.amountCOP,
              payer: {
                email: session.payerEmail,
              },
            }}
            customization={{
              paymentMethods: {
                maxInstallments: 12,
              },
            }}
            onSubmit={async (param) => {
              await handleSubmit(param);
            }}
            onError={(err) => {
              setLocalError(
                err?.message ||
                  "Error en el formulario de tarjeta. Revisa los datos."
              );
            }}
          />
        </div>
      ) : (
        <p className="mp-card-payment-step__loading">Cargando pasarela…</p>
      )}

      <div className="mp-card-payment-step__actions">
        <SecondaryButton
          type="button"
          disabled={submitting}
          onClick={onBack}
        >
          Volver
        </SecondaryButton>
      </div>
    </div>
  );
};

export default MercadoPagoCardPaymentStep;
