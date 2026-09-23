import * as XLSX from 'xlsx';
import type { Timestamp } from 'firebase/firestore';
import type { Event, Ticket } from '@services/types';
import { ticketCreatedAtMs } from '@services/ticketService';
import {
  aggregateSalesChannelBreakdown,
  salesChannelLabel,
  ticketPaymentChannelLabel,
  ticketSalesChannel,
  type SalesChannelSlice,
} from '@utils/salesChannelBreakdown';
import type { GatewayCommissionConfig, OrganizerBuyerFeeInput } from '@utils/revenueBreakdown';
import { computeTicketTiqueteraFeeCOP, ticketNetOrganizerCOP } from '@utils/revenueBreakdown';
import {
  ticketDocUnits,
  ticketLineAmountCOP,
  ticketListBuyerName,
} from '@utils/ticketListDisplay';
import { resolveTicketLocality } from '@utils/ticketDisplay';

function eventFilenameSlug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'evento'
  );
}

function tsToLocalString(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '';
  try {
    const date =
      ts instanceof Date
        ? ts
        : typeof (ts as Timestamp).toDate === 'function'
          ? (ts as Timestamp).toDate()
          : null;
    if (!date) return '';
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

type SummaryRow = {
  canal: string;
  ordenes: number;
  boletas: number;
  recaudadoCOP: number;
  subtotalEntradasCOP: number;
  tarifaTiqueteraCOP: number;
  tarifaTiqueteraNota: string;
  comisionPasarelaCOP: number;
  netoOrganizadorCOP: number;
};

function sliceToSummaryRow(
  label: string,
  slice: SalesChannelSlice,
  breakdown: ReturnType<typeof aggregateSalesChannelBreakdown>,
  channel: 'gateway' | 'manual' | 'total'
): SummaryRow {
  const tarifaNota =
    channel === 'manual'
      ? 'Incluida en total pasarela'
      : channel === 'gateway'
        ? `${breakdown.combinedTiqueteraBoletas} boletas (pasarela + manual)`
        : 'Comisión tiquetera total del evento';
  const tarifaCOP =
    channel === 'gateway'
      ? breakdown.combinedTiqueteraFee
      : channel === 'manual'
        ? 0
        : breakdown.combined.tiqueteraFee;
  const netoCOP =
    channel === 'gateway'
      ? breakdown.pasarelaNetoOrganizador
      : channel === 'manual'
        ? slice.netoOrganizador
        : slice.netoOrganizador;

  return {
    canal: label,
    ordenes: slice.ticketDocs,
    boletas: slice.ticketUnits,
    recaudadoCOP: slice.totalCobrado,
    subtotalEntradasCOP: slice.subtotalEntradas,
    tarifaTiqueteraCOP: tarifaCOP,
    tarifaTiqueteraNota: tarifaNota,
    comisionPasarelaCOP: slice.pasarelaTotal,
    netoOrganizadorCOP: netoCOP,
  };
}

type DetailRow = {
  id: string;
  canal: string;
  metodoPago: string;
  fechaCreacion: string;
  comprador: string;
  localidad: string;
  boletas: number;
  recaudadoCOP: number;
  tarifaTiqueteraCOP: number;
  tarifaTiqueteraNota: string;
  netoOrganizadorCOP: number;
  estado: string;
};

function buildDetailRows(
  tickets: Ticket[],
  event: Event,
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput,
  gateway: GatewayCommissionConfig
): DetailRow[] {
  return [...tickets]
    .sort((a, b) => ticketCreatedAtMs(a) - ticketCreatedAtMs(b))
    .map((t) => {
      const channel = ticketSalesChannel(t);
      const qty = ticketDocUnits(t);
      const amount = ticketLineAmountCOP(t);
      const tiqueteraFee = computeTicketTiqueteraFeeCOP(
        t,
        event,
        globalFeesPercent,
        organizerFee
      );
      const channelLabel = salesChannelLabel(channel);
      return {
        id: t.id,
        canal: channelLabel,
        metodoPago: ticketPaymentChannelLabel(t),
        fechaCreacion: tsToLocalString(t.createdAt),
        comprador: ticketListBuyerName(t),
        localidad: resolveTicketLocality(t).displayLine,
        boletas: qty,
        recaudadoCOP: amount,
        tarifaTiqueteraCOP: tiqueteraFee,
        tarifaTiqueteraNota:
          tiqueteraFee > 0 ? 'Incluida en total pasarela' : 'Sin tarifa tiquetera',
        netoOrganizadorCOP: ticketNetOrganizerCOP(
          t,
          event,
          globalFeesPercent,
          organizerFee,
          gateway
        ),
        estado: String(t.ticketStatus || t.status || '—'),
      };
    });
}

export function exportEventSalesChannelToExcel(
  event: Event,
  validTickets: Ticket[],
  globalFeesPercent: number,
  organizerFee: OrganizerBuyerFeeInput,
  gateway: GatewayCommissionConfig,
  filename?: string
): { summaryRows: number; detailRows: number } {
  const breakdown = aggregateSalesChannelBreakdown(
    event,
    validTickets,
    globalFeesPercent,
    organizerFee,
    gateway
  );

  const summaryRows: SummaryRow[] = [
    sliceToSummaryRow('Pasarela (en línea)', breakdown.gateway, breakdown, 'gateway'),
    sliceToSummaryRow('Manual / taquilla', breakdown.manual, breakdown, 'manual'),
    sliceToSummaryRow(
      'Total evento',
      {
        ...breakdown.combined,
        ticketDocs: breakdown.gateway.ticketDocs + breakdown.manual.ticketDocs,
        ticketUnits: breakdown.gateway.ticketUnits + breakdown.manual.ticketUnits,
        netoOrganizador:
          breakdown.pasarelaNetoOrganizador + breakdown.manual.netoOrganizador,
      },
      breakdown,
      'total'
    ),
  ];

  const detailRows = buildDetailRows(
    validTickets,
    event,
    globalFeesPercent,
    organizerFee,
    gateway
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Resumen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Detalle ventas');

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = eventFilenameSlug(event.name || 'evento');
  XLSX.writeFile(wb, `${filename ?? `ventas-canal-${slug}-${stamp}`}.xlsx`);

  return { summaryRows: summaryRows.length, detailRows: detailRows.length };
}
