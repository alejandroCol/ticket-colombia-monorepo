import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import TopNavBar from '@containers/TopNavBar';
import SecondaryButton from '@components/SecondaryButton';
import PrimaryButton from '@components/PrimaryButton';
import {
  logoutUser,
  getCurrentUser,
  isSuperAdmin,
  getAuditActorUsersList,
  fetchAuditLogsPage,
  AUDIT_KIND_LABELS,
} from '@services';
import type { AuditLogRow } from '@services';
import './index.scss';

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function endOfDayTimestamp(iso: string): Timestamp {
  const d = new Date(iso + 'T23:59:59.999');
  return Timestamp.fromDate(d);
}

function startOfDayTimestamp(iso: string): Timestamp {
  const d = new Date(iso + 'T00:00:00.000');
  return Timestamp.fromDate(d);
}

const PAGE_SIZE = 35;

const SuperAdminAuditLogScreen: React.FC = () => {
  const navigate = useNavigate();
  const [gate, setGate] = useState<'pending' | 'yes' | 'no'>('pending');
  const [fromIso, setFromIso] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return isoDateLocal(d);
  });
  const [toIso, setToIso] = useState(() => isoDateLocal(new Date()));
  const [actorUid, setActorUid] = useState('');
  const [actorOptions, setActorOptions] = useState<{ uid: string; label: string }[]>([]);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const run = async () => {
      const user = getCurrentUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      const ok = await isSuperAdmin(user.uid);
      if (!ok) {
        setGate('no');
        navigate('/dashboard', { replace: true });
        return;
      }
      setGate('yes');
    };
    void run();
  }, [navigate]);

  useEffect(() => {
    if (gate !== 'yes') return;
    const loadAdmins = async () => {
      try {
        const list = await getAuditActorUsersList();
        setActorOptions(
          list.map((u) => {
            const role = u.role || '—';
            return {
              uid: u.uid,
              label: `${u.name?.trim() || u.email || u.uid} (${role}) · ${u.email || ''}`,
            };
          })
        );
      } catch {
        setActorOptions([]);
      }
    };
    void loadAdmins();
  }, [gate]);

  const loadFirstPage = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const start = startOfDayTimestamp(fromIso);
      const end = endOfDayTimestamp(toIso);
      if (start.toMillis() > end.toMillis()) {
        setError('La fecha "desde" no puede ser posterior a "hasta".');
        return;
      }
      const { rows: nextRows, nextCursor, hasMore: more } = await fetchAuditLogsPage({
        start,
        end,
        actorUid: actorUid.trim() || undefined,
        pageSize: PAGE_SIZE,
        cursor: undefined,
      });
      setRows(nextRows);
      setCursor(nextCursor);
      setHasMore(more);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes('permission') || msg.includes('indexes')
          ? 'Sin permiso o índice faltante. Despliega reglas e índices de Firestore.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso, actorUid]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setError(null);
    setLoading(true);
    try {
      const start = startOfDayTimestamp(fromIso);
      const end = endOfDayTimestamp(toIso);
      const { rows: nextRows, nextCursor, hasMore: more } = await fetchAuditLogsPage({
        start,
        end,
        actorUid: actorUid.trim() || undefined,
        pageSize: PAGE_SIZE,
        cursor,
      });
      setRows((prev) => [...prev, ...nextRows]);
      setCursor(nextCursor);
      setHasMore(more);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes('permission') || msg.includes('indexes')
          ? 'Sin permiso o índice faltante. Despliega reglas e índices de Firestore.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso, actorUid, cursor]);

  useEffect(() => {
    if (gate !== 'yes') return;
    void loadFirstPage();
  }, [gate, loadFirstPage]);

  const kindLabel = useCallback((k: string) => AUDIT_KIND_LABELS[k] || k, []);

  const fmtWhen = useCallback((t: Timestamp | null) => {
    if (!t?.toDate) return '—';
    return t.toDate().toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }, []);

  const filterHint = useMemo(
    () =>
      `Consultas paginadas (${PAGE_SIZE} filas por carga): solo lees audit_logs por rango de fechas y, si quieres, un usuario concreto (admin o partner).`,
    []
  );

  if (gate === 'pending') {
    return (
      <div className="super-audit-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="super-audit-content">
          <p>Verificando permisos…</p>
        </div>
      </div>
    );
  }

  if (gate === 'no') return null;

  return (
    <div className="super-audit-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <div className="super-audit-content">
        <div className="super-audit-hero">
          <h1>Registro de actividad</h1>
          <p>Cambios en eventos, boletos manuales y acciones críticas del panel. Solo super administrador.</p>
          <SecondaryButton onClick={() => navigate('/config')}>← Volver a configuración</SecondaryButton>
        </div>

        <p className="super-audit-hint">{filterHint}</p>

        <div className="super-audit-filters">
          <div className="super-audit-filter">
            <label htmlFor="audit-from">Desde</label>
            <input id="audit-from" type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)} />
          </div>
          <div className="super-audit-filter">
            <label htmlFor="audit-to">Hasta</label>
            <input id="audit-to" type="date" value={toIso} onChange={(e) => setToIso(e.target.value)} />
          </div>
          <div className="super-audit-filter" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="audit-user">Usuario · admin o partner (opcional)</label>
            <select id="audit-user" value={actorUid} onChange={(e) => setActorUid(e.target.value)}>
              <option value="">Todos</option>
              {actorOptions.map((o) => (
                <option key={o.uid} value={o.uid}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <PrimaryButton type="button" disabled={loading} loading={loading} onClick={() => void loadFirstPage()}>
            Actualizar
          </PrimaryButton>
        </div>

        {error && <p className="super-audit-error">{error}</p>}

        {rows.length === 0 && !loading ? (
          <p>No hay registros en este rango.</p>
        ) : (
          <>
            <div className="super-audit-table-wrap">
              <table className="super-audit-table">
                <thead>
                  <tr>
                    <th>Cuándo</th>
                    <th>Tipo</th>
                    <th>Usuario</th>
                    <th>Entidad</th>
                    <th>Resumen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtWhen(r.at)}</td>
                      <td>{kindLabel(r.kind)}</td>
                      <td>
                        <div className="super-audit-mono">{r.actorUid.slice(0, 12)}…</div>
                        {r.actorEmail && <div>{r.actorEmail}</div>}
                      </td>
                      <td>
                        <span className="super-audit-mono">{r.entityType}</span>
                        {r.entityId && (
                          <div className="super-audit-mono" title={r.entityId}>
                            {r.entityId.length > 28 ? r.entityId.slice(0, 28) + '…' : r.entityId}
                          </div>
                        )}
                      </td>
                      <td className="super-audit-summary">{r.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="super-audit-loadmore">
                <SecondaryButton type="button" disabled={loading} loading={loading} onClick={() => void loadMore()}>
                  Cargar más
                </SecondaryButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminAuditLogScreen;
