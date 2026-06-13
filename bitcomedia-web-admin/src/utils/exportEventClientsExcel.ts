import * as XLSX from 'xlsx';
import type { Timestamp } from 'firebase/firestore';
import type { Ticket } from '@services/types';
import { isTicketReservedHold, ticketCreatedAtMs } from '@services/ticketService';
import {
  isAdminTicketRowVisible,
  isTicketCourtesyRow,
  ticketDocUnits,
  ticketListBuyerIdNumber,
  ticketListBuyerName,
  ticketListBuyerPhone,
  ticketLineAmountCOP,
} from '@utils/ticketListDisplay';

export interface EventClientRecord {
  nombre: string;
  email: string;
  telefono: string;
  cedula: string;
  userId: string;
  boletosTotales: number;
  totalGastadoCOP: number;
  localidades: string;
  metodosPago: string;
  cortesias: number;
  cantidadCompras: number;
  primeraCompra: string;
  ultimaCompra: string;
}

type ClientAccumulator = EventClientRecord & {
  _firstMs: number;
  _lastMs: number;
  _sections: Set<string>;
  _methods: Set<string>;
};

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function clientDedupKey(t: Ticket): string | null {
  const email = normalizeEmail(t.buyerEmail || '');
  if (email) return `email:${email}`;
  const uid = (t.userId || '').trim();
  if (uid) return `uid:${uid}`;
  const cedula = ticketListBuyerIdNumber(t).replace(/\s/g, '');
  if (cedula) return `cedula:${cedula}`;
  const name = ticketListBuyerName(t).trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

/** Boletos elegibles para armar la base de clientes (sin duplicar padres de bundle ni reservas sin pago). */
export function ticketsForClientExport(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => {
    if (!isAdminTicketRowVisible(t as { ticketKind?: string })) return false;
    if (isTicketReservedHold(t)) return false;
    const status = t.ticketStatus || '';
    if (status === 'cancelled' || status === 'disabled') return false;
    if ((t as { transferredTo?: string | null }).transferredTo) return false;
    return clientDedupKey(t) !== null;
  });
}

function mergeNonEmpty(current: string, next: string): string {
  return current.trim() ? current : next;
}

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

/** Agrupa compradores únicos del evento a partir de los documentos de boletos. */
export function extractUniqueEventClients(tickets: Ticket[]): EventClientRecord[] {
  const eligible = ticketsForClientExport(tickets);
  const map = new Map<string, ClientAccumulator>();

  for (const t of eligible) {
    const key = clientDedupKey(t)!;
    const ms = ticketCreatedAtMs(t);
    const units = ticketDocUnits(t);
    const amount = isTicketCourtesyRow(t) ? 0 : ticketLineAmountCOP(t);
    const section = (t.sectionName || '').trim();
    const method = (t.paymentMethod || '').trim();
    const courtesyUnits = isTicketCourtesyRow(t) ? units : 0;
    const createdIso = tsToIso(t.createdAt);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        nombre: ticketListBuyerName(t),
        email: (t.buyerEmail || '').trim(),
        telefono: ticketListBuyerPhone(t),
        cedula: ticketListBuyerIdNumber(t),
        userId: (t.userId || '').trim(),
        boletosTotales: units,
        totalGastadoCOP: amount,
        localidades: '',
        metodosPago: '',
        cortesias: courtesyUnits,
        cantidadCompras: 1,
        primeraCompra: createdIso,
        ultimaCompra: createdIso,
        _firstMs: ms,
        _lastMs: ms,
        _sections: new Set(section ? [section] : []),
        _methods: new Set(method ? [method] : []),
      });
      continue;
    }

    existing.boletosTotales += units;
    existing.totalGastadoCOP += amount;
    existing.cortesias += courtesyUnits;
    existing.cantidadCompras += 1;
    existing.nombre = mergeNonEmpty(existing.nombre, ticketListBuyerName(t));
    existing.email = mergeNonEmpty(existing.email, (t.buyerEmail || '').trim());
    existing.telefono = mergeNonEmpty(existing.telefono, ticketListBuyerPhone(t));
    existing.cedula = mergeNonEmpty(existing.cedula, ticketListBuyerIdNumber(t));
    existing.userId = mergeNonEmpty(existing.userId, (t.userId || '').trim());
    if (section) existing._sections.add(section);
    if (method) existing._methods.add(method);
    if (ms < existing._firstMs) {
      existing._firstMs = ms;
      existing.primeraCompra = createdIso;
    }
    if (ms > existing._lastMs) {
      existing._lastMs = ms;
      existing.ultimaCompra = createdIso;
    }
  }

  return [...map.values()]
    .map(({ _firstMs, _lastMs, _sections, _methods, ...row }) => ({
      ...row,
      localidades: [..._sections].sort((a, b) => a.localeCompare(b, 'es')).join(', '),
      metodosPago: [..._methods].sort((a, b) => a.localeCompare(b, 'es')).join(', '),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.email.localeCompare(b.email, 'es'));
}

export function exportEventClientsToExcel(
  tickets: Ticket[],
  eventName: string,
  filename?: string
): number {
  const clients = extractUniqueEventClients(tickets);
  const rows = clients.map((c) => ({
    nombre: c.nombre,
    email: c.email,
    telefono: c.telefono,
    cedula: c.cedula,
    userId: c.userId,
    boletosTotales: c.boletosTotales,
    totalGastadoCOP: c.totalGastadoCOP,
    localidades: c.localidades,
    metodosPago: c.metodosPago,
    cortesias: c.cortesias,
    cantidadCompras: c.cantidadCompras,
    primeraCompra: c.primeraCompra,
    ultimaCompra: c.ultimaCompra,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = eventFilenameSlug(eventName);
  XLSX.writeFile(wb, `${filename ?? `clientes-${slug}-${stamp}`}.xlsx`);
  return clients.length;
}
