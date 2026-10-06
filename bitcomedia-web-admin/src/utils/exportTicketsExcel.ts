import * as XLSX from 'xlsx';
import type { Event, Ticket } from '@services/types';
import type { Timestamp } from 'firebase/firestore';
import { filterSoldEntradasTicketsForAdminStats, ticketCreatedAtMs } from '@services/ticketService';
import {
  aggregateSalesChannelBreakdown,
  ticketCierreCajaSheetChannel,
  ticketPaymentChannelLabel,
  type TicketCierreCajaSheet,
} from '@utils/salesChannelBreakdown';
import type { GatewayCommissionConfig, OrganizerBuyerFeeInput } from '@utils/revenueBreakdown';
import { ticketDocUnits, ticketLineAmountCOP } from '@utils/ticketListDisplay';

function tsToIso(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '';
  try {
    if (ts instanceof Date) return ts.toISOString();
    if (typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate().toISOString();
  } catch {
    /* ignore */
  }
  return String(ts);
}

export type TicketExcelSheet = TicketCierreCajaSheet;

/** @deprecated Usar {@link ticketCierreCajaSheetChannel} */
export function ticketExcelSheetChannel(t: Ticket): TicketExcelSheet {
  return ticketCierreCajaSheetChannel(t);
}

type ExportRow = {
  id: string;
  eventId: string;
  evento: string;
  creado: string;
  email: string;
  nombre: string;
  cedula: string;
  localidad: string;
  cantidad: number;
  monto: number;
  moneda: string;
  estado: string;
  pago: string;
  canal: string;
};

const EXPORT_HEADERS: (keyof ExportRow)[] = [
  'id',
  'eventId',
  'evento',
  'creado',
  'email',
  'nombre',
  'cedula',
  'localidad',
  'cantidad',
  'monto',
  'moneda',
  'estado',
  'pago',
  'canal',
];

function ticketToExportRow(t: Ticket, eventNames: Record<string, string>): ExportRow {
  return {
    id: t.id,
    eventId: t.eventId,
    evento: eventNames[t.eventId] || t.eventId,
    creado: tsToIso(t.createdAt),
    email: t.buyerEmail || '',
    nombre: t.buyerName || t.metadata?.userName || '',
    cedula: t.buyerIdNumber || '',
    localidad: t.sectionName || '',
    cantidad: ticketDocUnits(t),
    monto: ticketLineAmountCOP(t),
    moneda: t.currency || 'COP',
    estado: t.ticketStatus || '',
    pago: t.paymentStatus || t.status || '',
    canal: ticketPaymentChannelLabel(t),
  };
}

const SHEET_CONFIG: { key: TicketExcelSheet; name: string }[] = [
  { key: 'onepay', name: 'OnePay' },
  { key: 'mercadopago', name: 'Mercado Pago' },
  { key: 'manual', name: 'Manual' },
];

function appendSheet(wb: XLSX.WorkBook, name: string, rows: ExportRow[]) {
  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([EXPORT_HEADERS as string[]]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export type ExportTicketsMoneyContext = {
  event: Event;
  globalFeesPercent: number;
  organizerFee: OrganizerBuyerFeeInput;
  gateway: GatewayCommissionConfig;
};

/**
 * Excel para cierre de caja: solo ventas válidas (pagadas/usadas, con cobro, sin cortesías),
 * alineado con el bloque «Ventas por canal» del admin. No incluye canceladas ni intentos fallidos.
 */
export function exportTicketsToExcel(
  tickets: Ticket[],
  eventNames: Record<string, string>,
  filename = 'boletos-export',
  money?: ExportTicketsMoneyContext | null
): void {
  const sold = filterSoldEntradasTicketsForAdminStats(tickets).sort(
    (a, b) => ticketCreatedAtMs(a) - ticketCreatedAtMs(b)
  );

  const bySheet: Record<TicketExcelSheet, ExportRow[]> = {
    onepay: [],
    mercadopago: [],
    manual: [],
  };
  for (const t of sold) {
    bySheet[ticketCierreCajaSheetChannel(t)].push(ticketToExportRow(t, eventNames));
  }

  const wb = XLSX.utils.book_new();

  if (money) {
    const breakdown = aggregateSalesChannelBreakdown(
      money.event,
      sold,
      money.globalFeesPercent,
      money.organizerFee,
      money.gateway
    );
    const resumen = [
      {
        canal: 'OnePay',
        ordenes: breakdown.gatewayOnepay.ticketDocs,
        boletas: breakdown.gatewayOnepay.ticketUnits,
        recaudadoCOP: breakdown.gatewayOnepay.totalCobrado,
        comisionPasarelaCOP: breakdown.gatewayOnepay.pasarelaTotal,
        netoOrganizadorCOP: breakdown.gatewayOnepay.netoOrganizador,
      },
      {
        canal: 'Mercado Pago',
        ordenes: breakdown.gatewayMercadopago.ticketDocs,
        boletas: breakdown.gatewayMercadopago.ticketUnits,
        recaudadoCOP: breakdown.gatewayMercadopago.totalCobrado,
        comisionPasarelaCOP: breakdown.gatewayMercadopago.pasarelaTotal,
        netoOrganizadorCOP: breakdown.gatewayMercadopago.netoOrganizador,
      },
      {
        canal: 'Manual / taquilla',
        ordenes: breakdown.manual.ticketDocs,
        boletas: breakdown.manual.ticketUnits,
        recaudadoCOP: breakdown.manual.totalCobrado,
        comisionPasarelaCOP: breakdown.manual.pasarelaTotal,
        netoOrganizadorCOP: breakdown.manual.netoOrganizador,
      },
      {
        canal: 'Total pasarela (OnePay + MP)',
        ordenes: breakdown.gateway.ticketDocs,
        boletas: breakdown.gateway.ticketUnits,
        recaudadoCOP: breakdown.gateway.totalCobrado,
        comisionPasarelaCOP: breakdown.gateway.pasarelaTotal,
        netoOrganizadorCOP: breakdown.pasarelaNetoOrganizador,
      },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
  }

  for (const { key, name } of SHEET_CONFIG) {
    appendSheet(wb, name, bySheet[key]);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
