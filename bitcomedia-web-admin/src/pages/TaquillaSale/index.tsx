import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@services/firebase';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import CustomSelector from '@components/CustomSelector';
import {
  getCurrentUser,
  getUserData,
  isSuperAdmin,
  listPartnerGrantsForUser,
  logoutUser,
  functions,
  getEventAvailability,
} from '@services';
import type { EventSection, VenueMapZone, VenueMapConfig } from '@services/types';
import './index.scss';

type TaquillaEventOption = {
  id: string;
  name: string;
  isRecurring: boolean;
  ticket_price: number;
  sections: EventSection[];
  venue_map?: VenueMapConfig | null;
};

function zonesForSectionOption(option: TaquillaEventOption | null, sectId: string): VenueMapZone[] {
  if (!option || !sectId.trim()) return [];
  return (option.venue_map?.zones ?? []).filter(
    (z) => String(z.sectionId ?? '').trim() === String(sectId).trim()
  );
}

function optionKey(o: TaquillaEventOption): string {
  return `${o.isRecurring ? '1' : '0'}:${o.id}`;
}

const TaquillaSaleScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlEventId = searchParams.get('eventId');
  const urlRecurring = searchParams.get('recurring') === '1';
  const [loadingList, setLoadingList] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [events, setEvents] = useState<TaquillaEventOption[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [mapZoneId, setMapZoneId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerIdNumber, setBuyerIdNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navOpts, setNavOpts] = useState({
    showScan: true,
    showConfig: true,
    showTaquilla: true,
  });

  const selected = useMemo(
    () => events.find((e) => optionKey(e) === selectedKey) || null,
    [events, selectedKey]
  );

  const sectionZonesSorted = useMemo(() => {
    if (!selected || !sectionId) return [];
    return zonesForSectionOption(selected, sectionId).sort(
      (a, b) => (Number(a.palco_index) || 0) - (Number(b.palco_index) || 0)
    );
  }, [selected, sectionId]);

  const needsMapZonePick = sectionZonesSorted.length > 1;
  const selSectionMeta = selected?.sections?.find((s) => s.id === sectionId);
  const seatsPerUnitTaquilla = Math.max(1, Number(selSectionMeta?.seats_per_unit) || 1);

  const [mapAvailLoading, setMapAvailLoading] = useState(false);
  const [mapZoneOccupancy, setMapZoneOccupancy] = useState<Record<string, number> | null>(null);
  const [availLoadFailed, setAvailLoadFailed] = useState(false);

  useEffect(() => {
    if (!needsMapZonePick || !selected?.id?.trim() || !sectionId) {
      setMapZoneOccupancy(null);
      setMapAvailLoading(false);
      setAvailLoadFailed(false);
      return;
    }
    let cancelled = false;
    setMapAvailLoading(true);
    setMapZoneOccupancy(null);
    setAvailLoadFailed(false);
    void getEventAvailability(selected.id)
      .then((a) => {
        if (!cancelled) setMapZoneOccupancy(a.byMapZone || {});
      })
      .catch(() => {
        if (!cancelled) {
          setMapZoneOccupancy(null);
          setAvailLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMapAvailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsMapZonePick, selected?.id, sectionId]);

  const availableTaquillaZones = useMemo(() => {
    if (!needsMapZonePick || mapAvailLoading || availLoadFailed || mapZoneOccupancy === null) return [];
    return sectionZonesSorted.filter((z) => (mapZoneOccupancy[z.id] ?? 0) < 1);
  }, [needsMapZonePick, sectionZonesSorted, mapZoneOccupancy, mapAvailLoading, availLoadFailed]);

  useEffect(() => {
    if (!mapZoneId || mapAvailLoading || mapZoneOccupancy === null) return;
    if (!availableTaquillaZones.some((z) => z.id === mapZoneId)) {
      setMapZoneId('');
    }
  }, [mapZoneId, availableTaquillaZones, mapAvailLoading, mapZoneOccupancy]);

  const unitPrice = useMemo(() => {
    if (!selected) return 0;
    if (sectionId && selected.sections.length > 0) {
      const sec = selected.sections.find((s) => s.id === sectionId);
      if (sec) return Number(sec.price) || 0;
    }
    return Number(selected.ticket_price) || 0;
  }, [selected, sectionId]);

  const sectionName = useMemo(() => {
    if (!sectionId || !selected?.sections.length) return undefined;
    const sec = selected.sections.find((s) => s.id === sectionId);
    return sec?.name;
  }, [selected, sectionId]);

  const purchaseGroups = needsMapZonePick ? 1 : quantity;

  const lineTotal = unitPrice * purchaseGroups;

  useEffect(() => {
    setMapZoneId('');
  }, [sectionId]);

  useEffect(() => {
    if (!selected || !sectionId) return;
    const z = zonesForSectionOption(selected, sectionId);
    if (z.length > 1) {
      const spu = Math.max(
        1,
        Number(selected.sections.find((s) => s.id === sectionId)?.seats_per_unit) || 1
      );
      setQuantity(spu);
    }
  }, [selected, sectionId]);

  const formatCop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) return;
    void getUserData(u.uid).then((ud) => {
      const partner = ud?.role === 'PARTNER';
      setNavOpts({ showScan: true, showConfig: !partner, showTaquilla: true });
    });
  }, []);

  const loadEvents = useCallback(async () => {
    setLoadingList(true);
    setForbidden(false);
    setError(null);
    try {
      const user = getCurrentUser();
      if (!user) {
        navigate('/login');
        return;
      }
      const [superA, ud] = await Promise.all([isSuperAdmin(user.uid), getUserData(user.uid)]);
      if (!ud) {
        navigate('/login');
        return;
      }

      const byKey = new Map<string, TaquillaEventOption>();

      if (superA || ud.role !== 'PARTNER') {
        const eventsQ = superA
          ? query(collection(db, 'events'))
          : query(collection(db, 'events'), where('organizer_id', '==', user.uid));
        const evSnap = await getDocs(eventsQ);
        evSnap.forEach((d) => {
          const data = d.data();
          const o: TaquillaEventOption = {
            id: d.id,
            name: (data.name as string) || d.id,
            isRecurring: false,
            ticket_price: Number(data.ticket_price) || 0,
            sections: (data.sections as EventSection[]) || [],
            venue_map: (data as { venue_map?: VenueMapConfig }).venue_map ?? null,
          };
          byKey.set(optionKey(o), o);
        });

        const recQ = superA
          ? query(collection(db, 'recurring_events'))
          : query(collection(db, 'recurring_events'), where('organizer_id', '==', user.uid));
        const recSnap = await getDocs(recQ);
        recSnap.forEach((d) => {
          const data = d.data();
          const o: TaquillaEventOption = {
            id: d.id,
            name: (data.name as string) || d.id,
            isRecurring: true,
            ticket_price: Number(data.ticket_price) || 0,
            sections: (data.sections as EventSection[]) || [],
            venue_map: (data as { venue_map?: VenueMapConfig }).venue_map ?? null,
          };
          byKey.set(optionKey(o), o);
        });
      } else {
        const grants = await listPartnerGrantsForUser(user.uid);
        let any = false;
        for (const g of grants) {
          if (!g.permissions.taquilla_sale && !g.permissions.create_tickets) continue;
          any = true;
          const col = g.event_path === 'recurring_events' ? 'recurring_events' : 'events';
          const snap = await getDoc(doc(db, col, g.event_id));
          if (!snap.exists()) continue;
          const data = snap.data();
          const o: TaquillaEventOption = {
            id: snap.id,
            name: (data.name as string) || snap.id,
            isRecurring: col === 'recurring_events',
            ticket_price: Number(data.ticket_price) || 0,
            sections: (data.sections as EventSection[]) || [],
            venue_map: (data as { venue_map?: VenueMapConfig }).venue_map ?? null,
          };
          byKey.set(optionKey(o), o);
        }
        if (!any) {
          setForbidden(true);
          setEvents([]);
          return;
        }
      }

      const list = Array.from(byKey.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      );
      setEvents(list);

      if (urlEventId) {
        const wantKey = `${urlRecurring ? '1' : '0'}:${urlEventId}`;
        if (byKey.has(wantKey)) {
          setSelectedKey(wantKey);
        } else {
          const hit = list.find((e) => e.id === urlEventId);
          if (hit) setSelectedKey(optionKey(hit));
        }
      }
    } catch (e) {
      console.error(e);
      setError('No se pudieron cargar los eventos.');
    } finally {
      setLoadingList(false);
    }
  }, [navigate, urlEventId, urlRecurring]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setSectionId('');
    setMapZoneId('');
  }, [selectedKey]);

  const createManualTicket = httpsCallable(functions, 'createManualTicket');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError('Elige un evento.');
      return;
    }
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setError('Nombre y correo son obligatorios.');
      return;
    }
    if (selected.sections.length > 0 && !sectionId) {
      setError('Selecciona una localidad.');
      return;
    }
    if (needsMapZonePick) {
      if (mapAvailLoading) {
        setError('Espera a que cargue la lista de mesas disponibles.');
        return;
      }
      if (availLoadFailed) {
        setError('No se pudo consultar disponibilidad de mesas. Reintenta.');
        return;
      }
      if (!availableTaquillaZones.length) {
        setError('No quedan celdas libres en esta localidad.');
        return;
      }
      if (!mapZoneId.trim()) {
        setError('Selecciona la mesa o palco disponible en el mapa.');
        return;
      }
      if (!availableTaquillaZones.some((z) => z.id === mapZoneId)) {
        setError('Esa celda ya no está disponible.');
        return;
      }
      if (quantity !== seatsPerUnitTaquilla) {
        setError(`Para localidad con mapa dividido la cantidad debe ser ${seatsPerUnitTaquilla}.`);
        return;
      }
    } else if (quantity < 1 || quantity > 50) {
      setError('Cantidad entre 1 y 50.');
      return;
    }
    setSaving(true);
    try {
      await createManualTicket({
        eventId: selected.id,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        buyerPhone: buyerPhone.trim() || undefined,
        buyerIdNumber: buyerIdNumber.trim() || undefined,
        quantity,
        sectionId: sectionId || undefined,
        sectionName: sectionName || undefined,
        mapZoneId: mapZoneId.trim() || undefined,
        isCourtesy: false,
        isGeneralCourtesy: false,
      });
      alert(
        `✅ Venta registrada: ${purchaseGroups} venta(s) · Total aprox. ${formatCop(lineTotal)}\n\nSe envió el correo con los boletos a ${buyerEmail.trim()}.`
      );
      setBuyerName('');
      setBuyerEmail('');
      setBuyerPhone('');
      setBuyerIdNumber('');
      setQuantity(1);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'No se pudo completar la venta.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingList) {
    return (
      <div className="taquilla-sale-screen">
        <TopNavBar
          logoOnly
          showLogout
          onLogout={() => logoutUser()}
          adminNavOptions={navOpts}
        />
        <p className="taquilla-sale-muted">Cargando eventos…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="taquilla-sale-screen">
        <TopNavBar
          logoOnly
          showLogout
          onLogout={() => logoutUser()}
          adminNavOptions={navOpts}
        />
        <div className="taquilla-sale-panel">
          <p>No tienes permiso de venta en taquilla. Pide a tu organizador el acceso «Venta en taquilla» o «Crear boletos».</p>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Ir al inicio</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="taquilla-sale-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} adminNavOptions={navOpts} />

      <div className="taquilla-sale-content">
        <header className="taquilla-sale-hero">
          <h1>Venta en taquilla</h1>
          <p>
            Precio completo del evento o localidad. El comprador recibe el boleto por correo.{' '}
            <strong>No cortesías</strong> (usa el panel de evento si tienes ese permiso).
          </p>
        </header>

        <form className="taquilla-sale-panel" onSubmit={handleSubmit}>
          {error && (
            <div className="taquilla-sale-error" role="alert">
              {error}
            </div>
          )}

          <CustomSelector
            name="taquilla_event"
            label="Evento"
            value={selectedKey}
            onChange={(ev) => setSelectedKey(String(ev.target.value))}
            options={[
              { value: '', label: '— Selecciona —' },
              ...events.map((ev) => ({
                value: optionKey(ev),
                label: `${ev.name}${ev.isRecurring ? ' (recurrente)' : ''}`,
              })),
            ]}
          />

          {selected && selected.sections.length > 0 && (
            <CustomSelector
              name="taquilla_section"
              label="Localidad"
              value={sectionId}
              onChange={(ev) => setSectionId(String(ev.target.value))}
              options={[
                { value: '', label: '— Elige localidad —' },
                ...selected.sections.map((s) => ({
                  value: s.id,
                  label: `${s.name} · ${formatCop(Number(s.price) || 0)}`,
                })),
              ]}
            />
          )}

          {selected && selected.sections.length > 0 && sectionId && needsMapZonePick && availLoadFailed && (
            <p className="taquilla-sale-muted" role="alert">
              No se pudo consultar ocupación del mapa.
            </p>
          )}
          {selected && selected.sections.length > 0 && sectionId && needsMapZonePick && mapAvailLoading && (
            <p className="taquilla-sale-muted">Consultando celdas disponibles…</p>
          )}
          {selected &&
            selected.sections.length > 0 &&
            sectionId &&
            needsMapZonePick &&
            !mapAvailLoading &&
            !availLoadFailed &&
            mapZoneOccupancy !== null &&
            !availableTaquillaZones.length && (
              <p className="taquilla-sale-error" role="alert">
                No hay mesas/palcos libres en esta localidad.
              </p>
            )}

          {selected &&
            selected.sections.length > 0 &&
            sectionId &&
            needsMapZonePick &&
            !mapAvailLoading &&
            !availLoadFailed &&
            !!availableTaquillaZones.length && (
              <CustomSelector
                name="taquilla_map_zone"
                label="Mesa / palco (mapa disponible)"
                value={mapZoneId}
                onChange={(ev) => setMapZoneId(String(ev.target.value))}
                options={[
                  { value: '', label: 'Elige una celda disponible' },
                  ...availableTaquillaZones.map((z) => ({
                    value: z.id,
                    label:
                      (z.label && z.label.trim()) ||
                      (z.palco_index !== undefined ? `Número ${z.palco_index}` : z.id.slice(0, 10)),
                  })),
                ]}
              />
            )}

          {selected && (
            <div className="taquilla-sale-price-banner" aria-live="polite">
              <span className="taquilla-sale-price-label">Precio unitario</span>
              <span className="taquilla-sale-price-value">{formatCop(unitPrice)}</span>
              <span className="taquilla-sale-price-total">
                Total ({purchaseGroups}{' '}
                {purchaseGroups === 1 ? 'venta' : 'ventas'}): {formatCop(lineTotal)}
              </span>
            </div>
          )}

          <div className="taquilla-sale-grid">
            <CustomInput
              name="qty"
              label={needsMapZonePick ? `Cantidad (fija: ${seatsPerUnitTaquilla} por celda)` : 'Cantidad'}
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(ev) => {
                if (needsMapZonePick) return;
                setQuantity(Math.max(1, Math.min(50, Number(ev.target.value) || 1)));
              }}
              disabled={needsMapZonePick}
            />
            <CustomInput
              name="buyerName"
              label="Nombre del comprador"
              value={buyerName}
              onChange={(ev) => setBuyerName(ev.target.value)}
              autoComplete="name"
            />
            <CustomInput
              name="buyerEmail"
              label="Correo (recibe los boletos)"
              type="email"
              value={buyerEmail}
              onChange={(ev) => setBuyerEmail(ev.target.value)}
              autoComplete="email"
            />
            <CustomInput
              name="buyerPhone"
              label="Teléfono (opcional)"
              type="tel"
              value={buyerPhone}
              onChange={(ev) => setBuyerPhone(ev.target.value)}
              autoComplete="tel"
            />
            <CustomInput
              name="buyerIdNumber"
              label="Documento (opcional)"
              value={buyerIdNumber}
              onChange={(ev) => setBuyerIdNumber(ev.target.value)}
            />
          </div>

          <div className="taquilla-sale-actions">
            <PrimaryButton
              type="submit"
              fullWidth
              loading={saving}
              disabled={
                saving ||
                !selected ||
                (needsMapZonePick &&
                  (availLoadFailed ||
                    mapAvailLoading ||
                    mapZoneOccupancy === null ||
                    !availableTaquillaZones.length))
              }
            >
              Registrar venta y enviar boletos
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => navigate('/dashboard')} disabled={saving}>
              Cancelar
            </SecondaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaquillaSaleScreen;
