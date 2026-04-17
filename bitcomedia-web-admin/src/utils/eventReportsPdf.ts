import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@assets/brand/ticket-colombia-lockup.png';
import type { Event, Ticket } from '@services/types';
import type { Expense } from '@services/firestore';
import type { OrganizerBuyerFeeInput, GatewayCommissionConfig } from '@utils/revenueBreakdown';
import { ticketNetOrganizerCOP } from '@utils/revenueBreakdown';
import {
  ticketLineAmountCOP,
  ticketListBuyerIdNumber,
  ticketListBuyerName,
  ticketListBuyerPhone,
} from '@utils/ticketListDisplay';

/** Contexto para montos netos por fila (deducciones de tiquetera y pasarela de pagos). */
export type PdfVentasMoneyContext = {
  event: Event;
  globalFeesPercent: number;
  organizerFee: OrganizerBuyerFeeInput;
  gateway: GatewayCommissionConfig;
};
/** Azul institucional (tablas / acentos) */
const BRAND_BLUE: [number, number, number] = [0, 102, 204];
const MUTED: [number, number, number] = [90, 98, 110];

let logoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string> {
  if (logoDataUrl) return logoDataUrl;
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  logoDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return logoDataUrl;
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

function formatTicketDate(t: Ticket): string {
  try {
    const c = t.createdAt as { toDate?: () => Date } | undefined;
    if (c && typeof c.toDate === 'function') {
      return c.toDate().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    }
  } catch {
    /* ignore */
  }
  return '—';
}

/** Sección “Totales” al final del cuerpo (después de la tabla). */
function drawTotalesSection(doc: jsPDF, finalY: number, lines: string[]): void {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Totales', margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  for (const paragraph of lines) {
    const wrapped = doc.splitTextToSize(paragraph, maxW);
    wrapped.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 4.5;
    });
  }
}

function sanitizeFilename(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'reporte';
}

function addFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const gen = new Date().toLocaleString('es-CO');
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(110, 118, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${gen}`, 14, h - 6);
    doc.text(`Ticket Colombia · Página ${i} de ${total}`, w / 2, h - 6, { align: 'center' });
  }
}

type HeaderResult = { doc: jsPDF; startY: number };

async function docWithHeader(
  reportTitle: string,
  eventName: string,
  periodLine: string
): Promise<HeaderResult> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await getLogoDataUrl();
  const logoW = 72;
  const logoH = 20;
  doc.addImage(logo, 'PNG', pageW / 2 - logoW / 2, 10, logoW, logoH);

  let y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, pageW / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(eventName, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(periodLine, pageW / 2, y, { align: 'center' });
  y += 8;
  doc.setDrawColor(220, 226, 235);
  doc.setLineWidth(0.35);
  doc.line(14, y, pageW - 14, y);
  y += 7;
  return { doc, startY: y };
}

async function docWithHeaderLandscape(
  reportTitle: string,
  eventName: string,
  periodLine: string
): Promise<HeaderResult> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await getLogoDataUrl();
  const logoW = 72;
  const logoH = 20;
  doc.addImage(logo, 'PNG', pageW / 2 - logoW / 2, 10, logoW, logoH);

  let y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, pageW / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(eventName, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(periodLine, pageW / 2, y, { align: 'center' });
  y += 8;
  doc.setDrawColor(220, 226, 235);
  doc.setLineWidth(0.35);
  doc.line(14, y, pageW - 14, y);
  y += 7;
  return { doc, startY: y };
}

function paymentMethodLabel(t: Ticket): string {
  const raw = String(t.paymentMethod || '').toLowerCase();
  if (raw.includes('mercadopago')) return 'Mercado Pago';
  if (raw.includes('onepay')) return 'OnePay';
  if (raw === 'free' || raw === 'gratis') return 'Gratis';
  if (raw === 'manual' || (t as { createdByAdmin?: string }).createdByAdmin) return 'Manual / taquilla';
  return String(t.paymentMethod || '—').slice(0, 28);
}

function download(doc: jsPDF, basename: string): void {
  addFooters(doc);
  doc.save(`${sanitizeFilename(basename)}.pdf`);
}

export {
  validTicketsForReportSales,
  isCourtesyTicket,
  parseYmdLocal,
  dayStartMs,
  dayEndMs,
  todayRangeMs,
} from './eventReportFilters';

function montoCelda(t: Ticket, money: PdfVentasMoneyContext | undefined): number {
  if (!money) return t.amount ?? 0;
  return ticketNetOrganizerCOP(t, money.event, money.globalFeesPercent, money.organizerFee, money.gateway);
}

export async function pdfVentas(
  eventName: string,
  tickets: Ticket[],
  opts: {
    title: string;
    periodLabel: string;
    basename: string;
    emptyMessage?: string;
    /** Si viene, columna Monto y totales usan neto organizador (tras deducciones tiquetera y pasarela). */
    money?: PdfVentasMoneyContext;
  }
): Promise<void> {
  const { doc, startY } = await docWithHeader(opts.title, eventName, opts.periodLabel);
  const money = opts.money;
  const rows = tickets.map((t) => [
    formatTicketDate(t),
    (t.buyerEmail || '').slice(0, 42),
    (t.buyerName || t.metadata?.userName || '—').slice(0, 36),
    (t.sectionName || t.metadata?.seatNumber || '—').slice(0, 28),
    String(t.quantity ?? 1),
    formatCOP(montoCelda(t, money)),
    String(t.ticketStatus || ''),
  ]);
  const sumQty = tickets.reduce((s, t) => s + (t.quantity || 1), 0);
  const sumAmt = tickets.reduce((s, t) => s + montoCelda(t, money), 0);

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(80, 88, 100);
    doc.text(opts.emptyMessage || 'No hay ventas en el periodo seleccionado.', 14, startY);
    download(doc, opts.basename);
    return;
  }

  const montoHead = money ? 'Monto neto' : 'Monto';

  autoTable(doc, {
    startY,
    head: [['Fecha', 'Email', 'Nombre', 'Localidad', 'Cant.', montoHead, 'Estado']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 28 },
      5: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });
  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;
  const totalLines = money
    ? [
        `Total boletos: ${sumQty}`,
        `Total neto COP: ${formatCOP(sumAmt)}, después de deducciones de tiquetera y pasarela de pagos`,
      ]
    : [`Total boletos: ${sumQty}`, `Total COP: ${formatCOP(sumAmt)}`];
  drawTotalesSection(doc, finalY, totalLines);
  download(doc, opts.basename);
}

export async function pdfEgresos(
  eventName: string,
  expenses: Expense[],
  opts: { periodLabel: string; basename: string }
): Promise<void> {
  const { doc, startY } = await docWithHeader('Reporte de egresos', eventName, opts.periodLabel);
  const rows = expenses.map((e) => [
    e.date || '—',
    (e.description || '').slice(0, 52),
    (e.category || '—').slice(0, 22),
    formatCOP(e.amount || 0),
  ]);
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(80, 88, 100);
    doc.text('No hay egresos registrados para este evento.', 14, startY);
    download(doc, opts.basename);
    return;
  }

  autoTable(doc, {
    startY,
    head: [['Fecha', 'Descripción', 'Categoría', 'Monto']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });
  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;
  drawTotalesSection(doc, finalY, [`Total egresos: ${formatCOP(total)}`]);
  download(doc, opts.basename);
}

/**
 * Listado demográfico / de contacto: una fila por compra con ingreso (no cortesías).
 * Incluye email, teléfono y documento cuando existan en el boleto.
 */
export async function pdfCompradores(
  eventName: string,
  tickets: Ticket[],
  opts: { periodLabel: string; basename: string; emptyMessage?: string }
): Promise<void> {
  const { doc, startY } = await docWithHeaderLandscape(
    'Compradores y datos de contacto',
    eventName,
    opts.periodLabel
  );

  const rows = tickets.map((t) => {
    const meta = t.metadata as { seatNumber?: string } | undefined;
    const locality = (t.sectionName || meta?.seatNumber || '—').trim() || '—';
    return [
      formatTicketDate(t),
      ticketListBuyerName(t).slice(0, 36),
      (t.buyerEmail || '').slice(0, 40),
      ticketListBuyerPhone(t).slice(0, 22),
      ticketListBuyerIdNumber(t).slice(0, 14),
      locality.slice(0, 24),
      String(t.quantity ?? 1),
      paymentMethodLabel(t),
      formatCOP(ticketLineAmountCOP(t)),
    ];
  });
  const sumQty = tickets.reduce((s, t) => s + (t.quantity || 1), 0);

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(80, 88, 100);
    doc.text(
      opts.emptyMessage || 'No hay compras con ingreso para listar en este criterio.',
      14,
      startY
    );
    download(doc, opts.basename);
    return;
  }

  doc.setFontSize(8);
  doc.setTextColor(70, 78, 90);
  doc.text(
    'Uso interno del organizador. Monto por línea en COP (bruto del boleto). Sin cortesías.',
    14,
    startY
  );

  autoTable(doc, {
    startY: startY + 6,
    head: [
      [
        'Fecha',
        'Nombre',
        'Email',
        'Teléfono',
        'Documento',
        'Localidad',
        'Cant.',
        'Pago',
        'Monto',
      ],
    ],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: {
      8: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });
  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;
  drawTotalesSection(doc, finalY, [
    `Total registros: ${rows.length}`,
    `Total entradas (suma cantidades): ${sumQty}`,
  ]);
  download(doc, opts.basename);
}

export async function pdfCortesias(
  eventName: string,
  tickets: Ticket[],
  opts: { periodLabel: string; basename: string }
): Promise<void> {
  const { doc, startY } = await docWithHeader('Reporte de cortesías', eventName, opts.periodLabel);
  const rows = tickets.map((t) => [
    formatTicketDate(t),
    (t.buyerEmail || '').slice(0, 40),
    (t.buyerName || t.metadata?.userName || '—').slice(0, 34),
    (t.sectionName || '—').slice(0, 26),
    String(t.quantity ?? 1),
    (t as { giftedBy?: string }).giftedBy ? 'Sí' : '—',
  ]);
  const sumQty = tickets.reduce((s, t) => s + (t.quantity || 1), 0);

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(80, 88, 100);
    doc.text('No hay cortesías registradas para este evento.', 14, startY);
    download(doc, opts.basename);
    return;
  }

  autoTable(doc, {
    startY,
    head: [['Fecha', 'Email', 'Nombre', 'Localidad', 'Cant.', 'Regalo']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.2 },
    margin: { left: 14, right: 14 },
  });
  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;
  drawTotalesSection(doc, finalY, [`Total entradas (cortesía): ${sumQty}`]);
  download(doc, opts.basename);
}

export async function pdfEgresosEnPeriodo(
  eventName: string,
  expenses: Expense[],
  opts: { from: string; to: string; basename: string }
): Promise<void> {
  const from = opts.from.replace(/-/g, '');
  const to = opts.to.replace(/-/g, '');
  const filtered = expenses.filter((e) => {
    const d = (e.date || '').replace(/-/g, '');
    if (d.length < 8) return false;
    return d >= from && d <= to;
  });
  const periodLabel = `Egresos del ${opts.from} al ${opts.to}`;
  await pdfEgresos(eventName, filtered, { periodLabel, basename: opts.basename });
}

export async function pdfVentasFiltradas(
  eventName: string,
  tickets: Ticket[],
  opts: {
    periodLabel: string;
    basename: string;
    sectionLabel: string;
    money: PdfVentasMoneyContext;
  }
): Promise<void> {
  const title = `Entradas por localidad · ${opts.sectionLabel}`;
  await pdfVentas(eventName, tickets, {
    title,
    periodLabel: opts.periodLabel,
    basename: opts.basename,
    emptyMessage: 'No hay entradas con los filtros seleccionados.',
    money: opts.money,
  });
}

