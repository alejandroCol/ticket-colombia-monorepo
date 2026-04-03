import {Resend} from "resend";

export async function sendAbonoDepositConfirmedEmail(params: {
  to: string;
  buyerName: string;
  eventName: string;
  depositCOP: number;
  balanceCOP: number;
  balanceDueLabel: string;
  completePaymentUrl: string;
  resendApiKey: string;
  senderEmail: string;
  senderName: string;
}): Promise<void> {
  const resend = new Resend(params.resendApiKey);
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n);

  const html = `
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f4f4f4;padding:24px;">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
    <tr><td>
      <h1 style="margin:0 0 12px;color:#0d1b2a;">Abono registrado</h1>
      <p>Hola ${escapeHtml(params.buyerName)},</p>
      <p>Recibimos tu abono para <strong>${escapeHtml(params.eventName)}</strong>.</p>
      <ul>
        <li>Abono pagado: <strong>${fmt(params.depositCOP)}</strong></li>
        <li>Saldo pendiente: <strong>${fmt(params.balanceCOP)}</strong></li>
        <li>Fecha límite para pagar el saldo: <strong>${escapeHtml(params.balanceDueLabel)}</strong></li>
      </ul>
      <p><strong>Aún no enviamos los códigos QR.</strong> Cuando completes el pago del saldo, recibirás tus entradas en la app y podrás ver los QR.</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${params.completePaymentUrl}" style="background:#00a650;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;display:inline-block;font-weight:600;">
          Completar pago
        </a>
      </p>
      <p style="color:#666;font-size:14px;">Si el botón no funciona, copia este enlace en tu navegador:<br/>
      <span style="word-break:break-all;">${params.completePaymentUrl}</span></p>
    </td></tr>
  </table>
</body></html>`;

  const {error} = await resend.emails.send({
    from: `${params.senderName} <${params.senderEmail}>`,
    to: [params.to],
    subject: `Abono confirmado · ${params.eventName}`,
    html,
  });
  if (error) {
    throw new Error(error.message);
  }
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
