import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Timestamp, collection, addDoc, doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import CustomTextarea from '@components/CustomTextarea';
import CustomSelector from '@components/CustomSelector';
import CustomDateTimePicker from '@components/CustomDateTimePicker';
import VenueAutocomplete from '@components/VenueAutocomplete';
import VenueMapBuilder, { DEFAULT_VENUE_MAP_BACKGROUND } from '@components/VenueMapBuilder';
import TopNavBar from '@TopNavBar';
import EventSubNav from '@components/EventSubNav';
import {
  logoutUser,
  getUserSession,
  uploadFile,
  db,
  getVenues,
  getCurrentUser,
  isSuperAdmin,
  getAdminUsersList,
  getPartnerGrantForEvent,
  appendAuditLog,
  allocateUniqueEventSlug,
} from '@services';
import { compressImageForBoleto } from '../../utils/imageCompression';
import { isLegacyDateSuffixSlug, slugifyEventName } from '@utils/eventSlug';
import { buildEventPublicPageUrl } from '@utils/eventPublicUrl';
import { formatCopThousandsDisplay } from '@utils/formatCopInput';
import type {
  Venue,
  EventSection,
  VenueMapConfig,
  VenueMapVisualConfig,
  VenueMapZone,
  UserData,
} from '@services/types';
import './index.scss';

interface RecurrenceData {
  type: string;
  days_of_week: string[];
  time: string;
}

interface VenueData {
  name: string;
  address: string;
}

function buildVenueMapForSave(
  zones: VenueMapZone[],
  visual: VenueMapVisualConfig
): VenueMapConfig | null {
  const hasZones = zones.length > 0;
  const hasVisual =
    visual.decorations.length > 0 ||
    visual.background !== DEFAULT_VENUE_MAP_BACKGROUND ||
    Boolean(visual.backgroundImageUrl?.trim()) ||
    Boolean(visual.flatRenderUrl?.trim());
  if (!hasZones && !hasVisual) return null;
  return {
    ...(hasZones ? { zones } : {}),
    ...(hasVisual ? { visual } : {}),
  };
}

function abonoFieldsFromFormInputs(fd: {
  abono_min_percent: string;
  abono_min_amount_cop: string;
  abono_max_days_before_event: string;
}) {
  const pct = Math.min(100, Math.max(0, parseFloat(String(fd.abono_min_percent).replace(',', '.')) || 30));
  const minCop = Math.max(0, parseInt(String(fd.abono_min_amount_cop).replace(/\D/g, ''), 10) || 0);
  const days = Math.max(1, parseInt(String(fd.abono_max_days_before_event).replace(/\D/g, ''), 10) || 7);
  return {
    abono_min_percent: pct,
    abono_min_amount_cop: minCop,
    abono_max_days_before_event: days,
  };
}

const TICKET_FLYER_ACCENT_DEFAULT = '#00d4ff';
const TICKET_FLYER_MINIMAL_NAME_DEFAULT = '#ffffff';
const TICKET_FLYER_MINIMAL_EMAIL_DEFAULT = '#e0e0e0';

/** Normaliza #RGB / #RRGGBB para guardar y para el selector nativo. */
function parseTicketFlyerHex(input: unknown, fallback: string): string {
  const raw = String(input ?? '').trim();
  if (!raw) return fallback;
  const h = raw.startsWith('#') ? raw : `#${raw}`;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h);
  if (!m) return fallback;
  const body = m[1];
  if (body.length === 3) {
    const [a, b, c] = body.split('');
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return h.toLowerCase();
}

function parseTicketFlyerAccentHex(input: unknown): string {
  return parseTicketFlyerHex(input, TICKET_FLYER_ACCENT_DEFAULT);
}

/** Ajusta palco_multipersona y seats_per_unit según zonas del mapa por localidad. */
function normalizeSectionsForSave(sections: EventSection[], zones: VenueMapZone[]): EventSection[] {
  return sections.map((s) => {
    const palcoCells = zones.filter((z) => z.sectionId === s.id).length;
    if (palcoCells <= 1) {
      return {...s, palco_multipersona: false};
    }
    if (s.palco_multipersona === true) {
      return {
        ...s,
        seats_per_unit: Math.max(2, Number(s.seats_per_unit) || 2),
        palco_multipersona: true,
      };
    }
    return {...s, seats_per_unit: 1, palco_multipersona: false};
  });
}

interface FormDataType {
  name: string;
  description: string;
  city: string;
  venue: VenueData;
  event_type: string;
  external_url: string;
  recurrence: RecurrenceData;
  single_date: string;
  single_time: string;
  cover_image: File | null;
  cover_image_preview: string;
  ticket_boleto_image: File | null;
  ticket_boleto_image_preview: string;
  /** PDF del boleto por correo: clásico o QR centrado sin titular. */
  ticket_flyer_pdf_layout: 'standard' | 'minimal_center';
  /** Color hexadecimal (#RRGGBB) para textos destacados del PDF (localidad, precio, etc.). */
  ticket_flyer_accent_color: string;
  /** Opción 2: color del nombre del comprador en el recuadro. */
  ticket_flyer_minimal_name_color: string;
  /** Opción 2: color del correo e indicaciones (“Presenta…”, “Entrada X de Y”). */
  ticket_flyer_minimal_email_color: string;
  capacity_per_occurrence: number | string;
  ticket_price: number | string;
  sections: EventSection[];
  status: string;
  /** Etiquetas separadas por coma (ej: Teatro,Comedia) */
  event_labels_text: string;
  /** Zonas rectangulares clickeables (% sobre la imagen) */
  venue_map_zones: VenueMapZone[];
  /** Diseño vectorial del mapa (editor visual) */
  venue_map_visual: VenueMapVisualConfig;
  /** Comisión tiquetera — solo edita super admin */
  platform_commission_type: string;
  platform_commission_value: string;
  /** % mínimo del total (primer pago) */
  abono_min_percent: string;
  /** Piso opcional en COP */
  abono_min_amount_cop: string;
  /** Días antes del evento: límite para saldo */
  abono_max_days_before_event: string;
  /** WhatsApp soporte en ficha pública (solo dígitos, obligatorio). */
  support_whatsapp: string;
}

interface EventFormScreenProps {
  isRecurring?: boolean;
}

const EventFormScreen: React.FC<EventFormScreenProps> = ({ isRecurring: initialIsRecurring = false }) => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [isRecurring, setIsRecurring] = useState(initialIsRecurring);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isRefreshingSlug, setIsRefreshingSlug] = useState(false);
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  /** Dueño del evento (Firestore). En edición lo controla el super admin en el selector. */
  const [organizerIdDraft, setOrganizerIdDraft] = useState('');
  const [adminListForOrganizer, setAdminListForOrganizer] = useState<UserData[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoadingVenues, setIsLoadingVenues] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const boletoFileInputRef = useRef<HTMLInputElement>(null);
  /** Slug persistido en Firestore (edición). */
  const [documentSlug, setDocumentSlug] = useState('');

  // Update isRecurring if prop changes
  useEffect(() => {
    setIsRecurring(initialIsRecurring);
  }, [initialIsRecurring]);

  // Load venues on component mount
  const loadVenues = useCallback(async () => {
    setIsLoadingVenues(true);
    try {
      const venuesData = await getVenues();
      setVenues(venuesData);
    } catch (error) {
      console.error('Error loading venues:', error);
      alert('Error al cargar los venues');
    } finally {
      setIsLoadingVenues(false);
    }
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  useEffect(() => {
    const u = getCurrentUser();
    if (u) void isSuperAdmin(u.uid).then(setIsSuperAdminUser);
  }, []);

  useEffect(() => {
    if (!isSuperAdminUser || !isEditMode) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await getAdminUsersList();
        if (!cancelled) setAdminListForOrganizer(list);
      } catch {
        if (!cancelled) setAdminListForOrganizer([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdminUser, isEditMode]);

  const organizerSelectorOptions = useMemo(() => {
    const opts = adminListForOrganizer.map((a) => ({
      value: a.uid,
      label: `${a.name || a.email} (${a.email})${a.active === false ? ' — inactivo' : ''}`,
    }));
    const ids = new Set(opts.map((o) => o.value));
    if (organizerIdDraft && !ids.has(organizerIdDraft)) {
      opts.unshift({
        value: organizerIdDraft,
        label: `Organizador actual (${organizerIdDraft.slice(0, 12)}…)`,
      });
    }
    return opts;
  }, [adminListForOrganizer, organizerIdDraft]);

  useEffect(() => {
    if (!eventId || eventId === 'new') {
      setOrganizerIdDraft('');
      setDocumentSlug('');
    }
  }, [eventId]);

  // Handle venue selection from autocomplete
  const handleVenueSelect = (venue: Venue) => {
    setFormData({
      ...formData,
      venue: {
        name: venue.name,
        address: venue.address,
      },
      city: venue.city
    });
  };
  
  // Form state
  const [formData, setFormData] = useState<FormDataType>({
    name: '',
    description: '',
    city: '',
    venue: {
      name: '',
      address: '',
    },
    event_type: 'bitcomedia_direct',
    external_url: '',
    recurrence: {
      type: 'weekly',
      days_of_week: ['friday'],
      time: '20:00'
    },
    single_date: '',
    single_time: '20:00',
    cover_image: null,
    cover_image_preview: '',
    ticket_boleto_image: null,
    ticket_boleto_image_preview: '',
    ticket_flyer_pdf_layout: 'standard',
    ticket_flyer_accent_color: TICKET_FLYER_ACCENT_DEFAULT,
    ticket_flyer_minimal_name_color: TICKET_FLYER_MINIMAL_NAME_DEFAULT,
    ticket_flyer_minimal_email_color: TICKET_FLYER_MINIMAL_EMAIL_DEFAULT,
    capacity_per_occurrence: '',
    ticket_price: '',
    sections: [],
    status: 'active',
    event_labels_text: '',
    venue_map_zones: [],
    venue_map_visual: {
      background: DEFAULT_VENUE_MAP_BACKGROUND,
      decorations: [],
      backgroundImageUrl: '',
      flatRenderUrl: '',
      frame_aspect: 'landscape',
      hide_public_zone_labels: false,
    },
    platform_commission_type: '',
    platform_commission_value: '',
    abono_min_percent: '30',
    abono_min_amount_cop: '0',
    abono_max_days_before_event: '7',
    support_whatsapp: '',
  });

  // Fetch event data from Firestore
  const fetchEventData = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // Determine collection to fetch from based on isRecurring prop
      const collectionName = isRecurring ? 'recurring_events' : 'events';
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Ownership: only super admin or event owner can edit
        const user = getCurrentUser();
        if (user) {
          const superA = await isSuperAdmin(user.uid);
          if (!superA && data.organizer_id !== user.uid) {
            const partnerGrant = await getPartnerGrantForEvent(user.uid, id, isRecurring);
            if (!partnerGrant?.permissions.edit_event) {
              navigate('/dashboard', { replace: true });
              return;
            }
          }
        }
        
        // For recurring events, set isRecurring to true
        if (isRecurring || data.recurrence_pattern) {
          setIsRecurring(true);
        }
        
        // Populate form with data
        setFormData({
          name: data.name || '',
          description: data.description || '',
          city: data.city || '',
          venue: {
            name: data.venue?.name || '',
            address: data.venue?.address || '',
          },
          event_type: data.event_type || 'bitcomedia_direct',
          external_url: data.external_url || '',
          // For recurring events
          recurrence: isRecurring ? {
            type: data.recurrence?.type || 'weekly',
            days_of_week: data.recurrence?.days_of_week || ['friday'],
            time: data.recurrence?.time || '20:00'
          } : {
            type: 'weekly',
            days_of_week: ['friday'],
            time: '20:00'
          },
          // For standalone events
          single_date: !isRecurring ? data.date || '' : '',
          single_time: !isRecurring ? data.time || '20:00' : '20:00',
          cover_image: null,
          cover_image_preview: data.cover_image_url || '',
          ticket_boleto_image: null,
          ticket_boleto_image_preview: data.ticket_background_image_url || '',
          ticket_flyer_pdf_layout:
            String(data.ticket_flyer_pdf_layout || '').toLowerCase().trim() ===
            'minimal_center'
              ? 'minimal_center'
              : 'standard',
          ticket_flyer_accent_color: parseTicketFlyerAccentHex(
            (data as { ticket_flyer_accent_color?: string }).ticket_flyer_accent_color
          ),
          ticket_flyer_minimal_name_color: parseTicketFlyerHex(
            (data as { ticket_flyer_minimal_name_color?: string }).ticket_flyer_minimal_name_color,
            TICKET_FLYER_MINIMAL_NAME_DEFAULT
          ),
          ticket_flyer_minimal_email_color: parseTicketFlyerHex(
            (data as { ticket_flyer_minimal_email_color?: string }).ticket_flyer_minimal_email_color,
            TICKET_FLYER_MINIMAL_EMAIL_DEFAULT
          ),
          capacity_per_occurrence: data.capacity_per_occurrence || 0,
          ticket_price: data.ticket_price || 0,
          sections: data.sections || [],
          status: data.status || 'active',
          event_labels_text: Array.isArray(data.event_labels) ? data.event_labels.join(', ') : '',
          venue_map_zones: Array.isArray(data.venue_map?.zones)
            ? [...data.venue_map.zones]
            : [],
          venue_map_visual: (() => {
            const legacyMapUrl =
              typeof data.venue_map_url === 'string' ? data.venue_map_url.trim() : '';
            const rawVis = data.venue_map?.visual;
            let v: VenueMapVisualConfig = rawVis
              ? {
                  background: rawVis.background || DEFAULT_VENUE_MAP_BACKGROUND,
                  decorations: Array.isArray(rawVis.decorations) ? [...rawVis.decorations] : [],
                  backgroundImageUrl:
                    typeof rawVis.backgroundImageUrl === 'string' ? rawVis.backgroundImageUrl : '',
                  flatRenderUrl: typeof rawVis.flatRenderUrl === 'string' ? rawVis.flatRenderUrl : '',
                  frame_aspect:
                    rawVis.frame_aspect === 'portrait' ? 'portrait' : 'landscape',
                  hide_public_zone_labels: rawVis.hide_public_zone_labels === true,
                }
              : {
                  background: DEFAULT_VENUE_MAP_BACKGROUND,
                  decorations: [],
                  backgroundImageUrl: '',
                  flatRenderUrl: '',
                  frame_aspect: 'landscape',
                  hide_public_zone_labels: false,
                };
            if (
              legacyMapUrl &&
              !v.flatRenderUrl?.trim() &&
              v.decorations.length === 0 &&
              !v.backgroundImageUrl?.trim()
            ) {
              v = { ...v, flatRenderUrl: legacyMapUrl };
            }
            return v;
          })(),
          platform_commission_type: (data.platform_commission_type as string) || '',
          platform_commission_value:
            data.platform_commission_value != null ? String(data.platform_commission_value) : '',
          abono_min_percent:
            data.abono_min_percent != null && Number.isFinite(Number(data.abono_min_percent))
              ? String(data.abono_min_percent)
              : '30',
          abono_min_amount_cop:
            data.abono_min_amount_cop != null && Number.isFinite(Number(data.abono_min_amount_cop))
              ? String(Math.max(0, Math.round(Number(data.abono_min_amount_cop))))
              : '0',
          abono_max_days_before_event:
            data.abono_max_days_before_event != null &&
            Number.isFinite(Number(data.abono_max_days_before_event))
              ? String(Math.max(1, Math.round(Number(data.abono_max_days_before_event))))
              : '7',
          support_whatsapp: String(data.support_whatsapp ?? '').replace(/\D/g, ''),
        });
        setOrganizerIdDraft(String(data.organizer_id || ''));
        setDocumentSlug(String(data.slug || '').trim());
      } else {
        alert("No se encontró el evento que intentas editar");
        navigate('/dashboard');
      }
    } catch (error) {
      console.error("Error fetching event data:", error);
      alert(`Error al cargar el evento: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, isRecurring]);

  const previewShareSlug = useMemo(() => {
    const name = formData.name?.trim();
    if (!name) return '';
    const base = slugifyEventName(name);
    return base || '';
  }, [formData.name]);

  const slugForPublicLink = useMemo(() => {
    if (isEditMode && documentSlug.trim()) return documentSlug.trim();
    return previewShareSlug;
  }, [isEditMode, documentSlug, previewShareSlug]);

  const publicEventUrl = useMemo(
    () => (slugForPublicLink ? buildEventPublicPageUrl(slugForPublicLink) : ''),
    [slugForPublicLink]
  );

  const copyPublicEventUrl = async () => {
    if (!publicEventUrl) return;
    try {
      await navigator.clipboard.writeText(publicEventUrl);
      alert('Enlace copiado al portapapeles.');
    } catch {
      alert('No se pudo copiar automáticamente. Selecciona el texto y cópialo a mano.');
    }
  };

  const showLegacySlugRefresh =
    isEditMode &&
    Boolean(eventId && eventId !== 'new') &&
    isLegacyDateSuffixSlug(documentSlug) &&
    Boolean(formData.name?.trim());

  const handleRefreshSlugToNewFormat = async () => {
    if (!showLegacySlugRefresh || !eventId) return;
    const collectionName = isRecurring ? 'recurring_events' : 'events';
    const slugRoot = slugifyEventName(formData.name) || 'evento';
    setIsRefreshingSlug(true);
    try {
      const newSlug = await allocateUniqueEventSlug(collectionName, slugRoot, eventId);
      await updateDoc(doc(db, collectionName, eventId), { slug: newSlug });
      setDocumentSlug(newSlug);
      void appendAuditLog({
        kind: isRecurring ? 'recurring_event_update' : 'event_update',
        entityType: collectionName,
        entityId: eventId,
        summary: `Slug renovado (formato sin fecha) «${newSlug}» (${collectionName}/${eventId})`,
      }).catch(() => undefined);
      alert(
        `Enlace actualizado.\n\nAntes: ${documentSlug}\nAhora: ${newSlug}\n\nComparte el nuevo enlace; el anterior dejará de abrir este evento.`
      );
    } catch (e) {
      alert(`No se pudo actualizar el slug: ${(e as Error).message}`);
    } finally {
      setIsRefreshingSlug(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name == null || name === '') return;

    if (name.includes('.')) {
      // Handle nested objects like venue.name
      const [parent, child] = name.split('.');
      if (parent === 'venue') {
        setFormData({
          ...formData,
          venue: {
            ...formData.venue,
            [child]: value
          }
        });
      } else if (parent === 'recurrence') {
        const prev = formData.recurrence ?? { type: 'weekly', days_of_week: ['friday'], time: '20:00' };
        const days = Array.isArray(prev.days_of_week) ? prev.days_of_week : ['friday'];
        setFormData({
          ...formData,
          recurrence: {
            type: prev.type ?? 'weekly',
            days_of_week: days,
            time: prev.time ?? '20:00',
            [child]: value
          }
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleRecurrenceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({
      ...formData,
      recurrence: {
        ...formData.recurrence,
        type: e.target.value
      }
    });
  };

  const handleDayOfWeekChange = (day: string) => {
    const currentDays = Array.isArray(formData.recurrence?.days_of_week)
      ? formData.recurrence.days_of_week
      : [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    setFormData({
      ...formData,
      recurrence: {
        ...formData.recurrence,
        days_of_week: newDays
      }
    });
  };

  const handleRecurrenceTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      recurrence: {
        ...formData.recurrence,
        time: e.target.value
      }
    });
  };

  const handleSingleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      single_date: e.target.value
    });
  };

  const handleSingleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      single_time: e.target.value
    });
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handler for file input change
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      
      setFormData({
        ...formData,
        cover_image: file,
        cover_image_preview: previewUrl
      });
    }
  };

  // Trigger file input click
  const handleSelectImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setFormData({
      ...formData,
      cover_image: null,
      cover_image_preview: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle boleto (ticket background) image selection
  const handleBoletoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setFormData({
        ...formData,
        ticket_boleto_image: file,
        ticket_boleto_image_preview: previewUrl
      });
    }
  };

  const handleSelectBoletoImage = () => {
    boletoFileInputRef.current?.click();
  };

  const handleRemoveBoletoImage = () => {
    setFormData({
      ...formData,
      ticket_boleto_image: null,
      ticket_boleto_image_preview: ''
    });
    if (boletoFileInputRef.current) {
      boletoFileInputRef.current.value = '';
    }
  };

  // Load event data if in edit mode
  useEffect(() => {
    if (eventId && eventId !== 'new') {
      setIsEditMode(true);
      fetchEventData(eventId);
    }
  }, [eventId, fetchEventData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get current user from session
    const userSession = getUserSession();
    if (isEditMode && isSuperAdminUser && !organizerIdDraft.trim()) {
      alert('Selecciona el administrador organizador del evento.');
      return;
    }
    const supportWhatsappDigitsPre = formData.support_whatsapp.trim().replace(/\D/g, '');
    if (!supportWhatsappDigitsPre || supportWhatsappDigitsPre.length < 8) {
      alert(
        'Indica un número de WhatsApp de soporte válido (solo dígitos, con código de país, mínimo 8 dígitos).'
      );
      return;
    }
    setIsUploading(true);
    
    try {
      // Upload cover image if exists and is new
      let coverImageUrl = formData.cover_image_preview;
      if (formData.cover_image) {
        const timestamp = new Date().getTime();
        const eventNameSlug = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const path = `event-covers/${eventNameSlug}_${timestamp}_${formData.cover_image.name}`;
        coverImageUrl = await uploadFile(formData.cover_image, path);
      }

      // Upload ticket boleto (background) image if exists and is new
      let ticketBackgroundImageUrl = formData.ticket_boleto_image_preview && /^https?:\/\//i.test(formData.ticket_boleto_image_preview)
        ? formData.ticket_boleto_image_preview
        : '';
      if (formData.ticket_boleto_image) {
        const compressedFile = await compressImageForBoleto(formData.ticket_boleto_image);
        const timestamp = new Date().getTime();
        const eventNameSlug = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const path = `event-boleto/${eventNameSlug}_${timestamp}_${compressedFile.name}`;
        ticketBackgroundImageUrl = await uploadFile(compressedFile, path);
      }
      
      const collectionName = isRecurring ? 'recurring_events' : 'events';
      const slugRoot = slugifyEventName(formData.name) || 'evento';
      const excludeSlugId = isEditMode && eventId && eventId !== 'new' ? eventId : undefined;
      const eventSlug = await allocateUniqueEventSlug(collectionName, slugRoot, excludeSlugId);

      const eventLabels = formData.event_labels_text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const supportWhatsappDigits = supportWhatsappDigitsPre;
      const sectionsForSave = normalizeSectionsForSave(
        formData.sections,
        formData.venue_map_zones
      );

      // Prepare the data for submission
      const eventData = {
        name: formData.name,
        description: formData.description,
        city: formData.city,
        venue: formData.venue,
        event_type: formData.event_type,
        external_url: formData.event_type === 'external_url' ? formData.external_url : '',
        cover_image_url: coverImageUrl,
        ticket_background_image_url: ticketBackgroundImageUrl || null,
        ticket_flyer_pdf_layout: formData.ticket_flyer_pdf_layout,
        ticket_flyer_accent_color: parseTicketFlyerAccentHex(formData.ticket_flyer_accent_color),
        ticket_flyer_minimal_name_color: parseTicketFlyerHex(
          formData.ticket_flyer_minimal_name_color,
          TICKET_FLYER_MINIMAL_NAME_DEFAULT
        ),
        ticket_flyer_minimal_email_color: parseTicketFlyerHex(
          formData.ticket_flyer_minimal_email_color,
          TICKET_FLYER_MINIMAL_EMAIL_DEFAULT
        ),
        capacity_per_occurrence: Number(formData.capacity_per_occurrence) || 0,
        ticket_price:
          sectionsForSave.length > 0 ? 0 : Number(formData.ticket_price) || 0,
        sections: sectionsForSave.length > 0 ? sectionsForSave : undefined,
        status: formData.status,
        organizer_id: !isEditMode
          ? userSession?.uid || ''
          : isSuperAdminUser
            ? organizerIdDraft.trim() || userSession?.uid || ''
            : userSession?.uid || '',
        slug: eventSlug, // Add the generated slug
        event_labels: eventLabels.length > 0 ? eventLabels : [],
        venue_map: buildVenueMapForSave(
          formData.venue_map_zones,
          formData.venue_map_visual
        ),
        ...abonoFieldsFromFormInputs(formData),
        support_whatsapp: supportWhatsappDigits,
      };

      if (isSuperAdminUser) {
        Object.assign(eventData, {
          platform_commission_type:
            !formData.platform_commission_type || formData.platform_commission_type === 'none'
              ? ''
              : formData.platform_commission_type,
          platform_commission_value: Number(formData.platform_commission_value) || 0
        });
      }

      // If it's a new event, add creation_date
      if (!isEditMode) {
        Object.assign(eventData, {
          creation_date: Timestamp.now()
        });
      }

      // Add either recurrence or single date/time
      if (isRecurring) {
        Object.assign(eventData, {
          recurrence: {
            type: formData.recurrence.type,
            days_of_week: formData.recurrence.days_of_week,
            time: formData.recurrence.time
          },
          recurrence_pattern: `${formData.recurrence.type === 'daily' ? 'Diario' : 
                           formData.recurrence.type === 'weekly' ? 'Semanal' : 
                           'Mensual'} a las ${formData.recurrence.time}`
        });
      } else {
        // Convert date string to a JavaScript Date object first
        const [year, month, day] = formData.single_date.split('-').map(Number);
        const [hours, minutes] = formData.single_time.split(':').map(Number);
        
        // Create a proper Date object (month is 0-indexed in JS Date)
        const eventDateTime = new Date(year, month - 1, day, hours, minutes);
        
        // For standalone events, put date and time directly in the object
        // Use event_date as the key for the timestamp
        Object.assign(eventData, {
          date: formData.single_date,
          time: formData.single_time,
          event_date: Timestamp.fromDate(eventDateTime)
        });
      }

      // Save to Firebase Firestore in the appropriate collection
      if (isEditMode && eventId && eventId !== 'new') {
        // Update existing document
        const eventRef = doc(db, collectionName, eventId);
        await updateDoc(eventRef, {
          ...eventData,
          venue_map_url: deleteField(),
        });
        console.log(`${isRecurring ? 'Evento recurrente' : 'Evento'} actualizado correctamente`);
        void appendAuditLog({
          kind: isRecurring ? 'recurring_event_update' : 'event_update',
          entityType: collectionName,
          entityId: eventId,
          summary: `Editado «${formData.name}» (${collectionName}/${eventId})`,
        }).catch(() => undefined);
        // Show success alert and redirect
        alert(`${isRecurring ? 'Evento recurrente' : 'Evento'} actualizado correctamente`);
      } else {
        // Create new document
        const collectionRef = collection(db, collectionName);
        const newRef = await addDoc(collectionRef, eventData);
        console.log(`${isRecurring ? 'Evento recurrente' : 'Evento'} creado correctamente`);
        void appendAuditLog({
          kind: isRecurring ? 'recurring_event_create' : 'event_create',
          entityType: collectionName,
          entityId: newRef.id,
          summary: `Creado «${formData.name}» (${collectionName}/${newRef.id})`,
        }).catch(() => undefined);
        // Show success alert and redirect
        alert(`${isRecurring ? 'Evento recurrente' : 'Evento'} creado correctamente`);
      }
      
      // Redirect back to dashboard
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Error submitting form:', error);
      const err = error as { code?: string; message?: string };
      const isStorageError = err?.code?.startsWith?.('storage/') || (err?.message || '').toLowerCase().includes('storage');
      const message = isStorageError
        ? 'Error al subir la imagen. Comprueba que has iniciado sesión como administrador y que las reglas de Storage permiten subir a event-covers. Detalle: ' + (err?.message || 'Error desconocido.')
        : `Error al ${isEditMode ? 'actualizar' : 'crear'} el ${isRecurring ? 'evento recurrente' : 'evento'}: ${err?.message || String(error)}`;
      alert(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  // Funciones para gestionar secciones (localidades)
  const addSection = () => {
    const newSection: EventSection = {
      id: `section-${Date.now()}`,
      name: '',
      available: 0,
      price: 0,
      seats_per_unit: 1,
      abono_allowed: false,
      palco_multipersona: false,
    };
    setFormData({
      ...formData,
      sections: [...formData.sections, newSection]
    });
  };

  const updateSection = (index: number, field: keyof EventSection, value: string | number | boolean) => {
    const updatedSections = [...formData.sections];
    updatedSections[index] = {
      ...updatedSections[index],
      [field]: value
    };
    setFormData({
      ...formData,
      sections: updatedSections
    });
  };

  const removeSection = (index: number) => {
    const updatedSections = formData.sections.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      sections: updatedSections
    });
  };

  // Function to download the event image
  const downloadEventImage = async () => {
    if (!formData.cover_image_preview || !isEditMode || isDownloading) return;
    
    setIsDownloading(true);
    try {
      // Generate filename with event name
      const eventName = formData.name || 'evento';
      const fileName = `${eventName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_imagen.jpg`;
      
      // Create a canvas to convert the image to blob
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      // Set up cross-origin to handle Firebase Storage URLs
      img.crossOrigin = 'anonymous';
      
      return new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Set canvas dimensions to match image
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image on canvas
            ctx?.drawImage(img, 0, 0);
            
            // Convert canvas to blob
            canvas.toBlob((blob) => {
              if (blob) {
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                
                // Clean up
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                resolve();
              } else {
                reject(new Error('Failed to create blob'));
              }
            }, 'image/jpeg', 0.9);
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          // If canvas method fails, try direct download as fallback
          try {
            const link = document.createElement('a');
            link.href = formData.cover_image_preview;
            link.download = fileName;
            link.target = '_blank';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            resolve();
          } catch (directError) {
            reject(directError);
          }
        };
        
        // Start loading the image
        img.src = formData.cover_image_preview;
      });
      
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Error al descargar la imagen. Se abrirá en una nueva pestaña.');
      // Ultimate fallback: open image in new tab
      window.open(formData.cover_image_preview, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to download event description as .txt file
  const downloadEventDescription = () => {
    if (!formData.description || !isEditMode) return;
    
    try {
      // Create the text content
      const textContent = `Descripción del Evento: ${formData.name}\n\n${formData.description}`;
      
      // Create blob with text content
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element to trigger download
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with event name
      const eventName = formData.name || 'evento';
      const fileName = `${eventName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_descripcion.txt`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error downloading description:', error);
      alert('Error al descargar la descripción');
    }
  };

  // Function to download both image and description
  const downloadEventData = async () => {
    if (!isEditMode) return;
    
    try {
      // Download image if available
      if (formData.cover_image_preview) {
        await downloadEventImage();
      }
      
      // Download description if available
      if (formData.description) {
        // Add a small delay to avoid multiple downloads at once
        setTimeout(() => {
          downloadEventDescription();
        }, 500);
      }
    } catch (error) {
      console.error('Error downloading event data:', error);
    }
  };

  // Duplicate current event as a new one reusing the image URL
  const handleDuplicateEvent = async () => {
    if (!isEditMode) return;
    setIsDuplicating(true);
    try {
      const userSession = getUserSession();

      // Reuse the existing remote image URL. If preview is not a remote URL, block duplication.
      const isRemoteImage = /^https?:\/\//i.test(formData.cover_image_preview);
      if (!formData.cover_image_preview || !isRemoteImage) {
        alert('No se puede duplicar porque la imagen no está subida aún. Guarda el evento primero.');
        return;
      }

      const coverImageUrl = formData.cover_image_preview;

      const collectionName = isRecurring ? 'recurring_events' : 'events';
      const slugRoot = slugifyEventName(formData.name) || 'evento';
      const eventSlug = await allocateUniqueEventSlug(collectionName, slugRoot);
      const dupSupportWhatsapp = formData.support_whatsapp.trim().replace(/\D/g, '');
      if (!dupSupportWhatsapp || dupSupportWhatsapp.length < 8) {
        alert(
          'Completa el WhatsApp de soporte (mínimo 8 dígitos, con código de país) antes de duplicar.'
        );
        return;
      }

      const dupLabels = formData.event_labels_text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const dupZones = formData.venue_map_zones.map((z) => ({ ...z }));
      const duplicatedEventData = {
        name: formData.name,
        description: formData.description,
        city: formData.city,
        venue: formData.venue,
        event_type: formData.event_type,
        external_url: formData.event_type === 'external_url' ? formData.external_url : '',
        cover_image_url: coverImageUrl,
        ticket_background_image_url: formData.ticket_boleto_image_preview && /^https?:\/\//i.test(formData.ticket_boleto_image_preview)
          ? formData.ticket_boleto_image_preview
          : undefined,
        ticket_flyer_pdf_layout: formData.ticket_flyer_pdf_layout,
        ticket_flyer_accent_color: parseTicketFlyerAccentHex(formData.ticket_flyer_accent_color),
        ticket_flyer_minimal_name_color: parseTicketFlyerHex(
          formData.ticket_flyer_minimal_name_color,
          TICKET_FLYER_MINIMAL_NAME_DEFAULT
        ),
        ticket_flyer_minimal_email_color: parseTicketFlyerHex(
          formData.ticket_flyer_minimal_email_color,
          TICKET_FLYER_MINIMAL_EMAIL_DEFAULT
        ),
        capacity_per_occurrence: Number(formData.capacity_per_occurrence) || 0,
        ticket_price:
          formData.sections.length > 0 ? 0 : Number(formData.ticket_price) || 0,
        sections:
          formData.sections.length > 0
            ? normalizeSectionsForSave(formData.sections, dupZones)
            : undefined,
        event_labels: dupLabels.length > 0 ? dupLabels : [],
        venue_map: buildVenueMapForSave(dupZones, {
          ...formData.venue_map_visual,
          decorations: formData.venue_map_visual.decorations.map((d) => ({ ...d })),
        }),
        status: formData.status,
        organizer_id: userSession?.uid || '',
        slug: eventSlug,
        creation_date: Timestamp.now(),
        ...abonoFieldsFromFormInputs(formData),
        support_whatsapp: dupSupportWhatsapp,
      };

      if (isRecurring) {
        Object.assign(duplicatedEventData, {
          recurrence: {
            type: formData.recurrence.type,
            days_of_week: formData.recurrence.days_of_week,
            time: formData.recurrence.time,
          },
          recurrence_pattern: `${formData.recurrence.type === 'daily' ? 'Diario' : formData.recurrence.type === 'weekly' ? 'Semanal' : 'Mensual'} a las ${formData.recurrence.time}`,
        });
      } else {
        const [year, month, day] = formData.single_date.split('-').map(Number);
        const [hours, minutes] = formData.single_time.split(':').map(Number);
        const eventDateTime = new Date(year, month - 1, day, hours, minutes);
        Object.assign(duplicatedEventData, {
          date: formData.single_date,
          time: formData.single_time,
          event_date: Timestamp.fromDate(eventDateTime),
        });
      }

      const collectionRef = collection(db, collectionName);
      const newDocRef = await addDoc(collectionRef, duplicatedEventData);
      void appendAuditLog({
        kind: 'event_duplicate',
        entityType: collectionName,
        entityId: newDocRef.id,
        summary: `Duplicado «${formData.name}» → ${collectionName}/${newDocRef.id}`,
      }).catch(() => undefined);

      alert(`${isRecurring ? 'Evento recurrente' : 'Evento'} duplicado correctamente`);
      // Navigate to the newly created event for immediate edits
      navigate(isRecurring ? `/recurring-events/${newDocRef.id}` : `/events/${newDocRef.id}`);
    } catch (error) {
      console.error('Error duplicating event:', error);
      alert(`Error al duplicar el ${isRecurring ? 'evento recurrente' : 'evento'}: ${(error as Error).message}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  const showEventSubNav = Boolean(isEditMode && eventId && eventId !== 'new');
  const currentUid = getCurrentUser()?.uid ?? '';
  const showOrganizerExtras =
    isSuperAdminUser || (!!organizerIdDraft && organizerIdDraft === currentUid);

  return (
    <div className="event-form-screen">
      {/* Admin Navigation Bar */}
      <TopNavBar 
        logoOnly={true} 
        showLogout={true} 
        onLogout={handleLogout}
      />

      {showEventSubNav && (
        <EventSubNav
          eventId={eventId!}
          eventTitle={formData.name || 'Evento'}
          isRecurring={isRecurring}
          active="edit"
          showOrganizerExtras={showOrganizerExtras}
        />
      )}

      <div className="event-form-content">
        <div className="event-form-header">
          <h1>
            {isEditMode 
              ? `Editar Evento ${isRecurring ? 'Recurrente' : ''}` 
              : `Crear Nuevo Evento ${isRecurring ? 'Recurrente' : ''}`
            }
          </h1>
          
          {/* Download actions - only show in edit mode */}
          {isEditMode && (
            <div className="download-actions">
              <h3>Descargar información del evento</h3>
              <div className="download-buttons">
                {formData.cover_image_preview && (
                  <SecondaryButton 
                    onClick={downloadEventImage}
                    size="small"
                    disabled={isDownloading}
                    loading={isDownloading}
                  >
                    {isDownloading ? 'Descargando...' : 'Descargar Imagen'}
                  </SecondaryButton>
                )}
                
                {formData.description && (
                  <SecondaryButton 
                    onClick={downloadEventDescription}
                    size="small"
                    disabled={isDownloading}
                  >
                    Descargar Descripción (.txt)
                  </SecondaryButton>
                )}
                
                {(formData.cover_image_preview || formData.description) && (
                  <PrimaryButton 
                    onClick={downloadEventData}
                    size="small"
                    disabled={isDownloading}
                    loading={isDownloading}
                  >
                    {isDownloading ? 'Descargando...' : 'Descargar Todo'}
                  </PrimaryButton>
                )}
              </div>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="loading-container">
            <p>Cargando información del evento...</p>
          </div>
        ) : (
          <div className="event-form-container">
            {/* Duplicate action - only show in edit mode */}
            {isEditMode && (
              <div className="download-actions" style={{ marginBottom: '20px' }}>
                <h3>Acciones</h3>
                <div className="download-buttons">
                  <PrimaryButton 
                    onClick={handleDuplicateEvent}
                    size="small"
                    disabled={isDuplicating}
                    loading={isDuplicating}
                  >
                    {isDuplicating ? 'Duplicando...' : 'Duplicar Evento'}
                  </PrimaryButton>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <h2>Información Básica</h2>

                <div className="event-public-link-card">
                  <h3 className="event-public-link-card__title">Enlace para compartir</h3>
                  <p className="helper-text event-public-link-card__lede">
                    URL corta derivada del <strong>nombre del evento</strong>; abre la ficha en la tienda pública.
                    Ideal para WhatsApp, Instagram o correo.
                  </p>
                  {publicEventUrl ? (
                    <>
                      <div className="event-public-link-card__row">
                        <input
                          type="text"
                          readOnly
                          className="event-public-link-card__input"
                          value={publicEventUrl}
                          aria-label="URL pública del evento"
                          onFocus={(e) => e.target.select()}
                        />
                        <SecondaryButton type="button" size="small" onClick={() => void copyPublicEventUrl()}>
                          Copiar
                        </SecondaryButton>
                        <SecondaryButton
                          type="button"
                          size="small"
                          onClick={() => window.open(publicEventUrl, '_blank', 'noopener,noreferrer')}
                        >
                          Abrir
                        </SecondaryButton>
                      </div>
                      <p className="helper-text event-public-link-card__slug">
                        Slug: <code>{slugForPublicLink}</code>
                      </p>
                      {!isEditMode ? (
                        <p className="helper-text">
                          Vista previa: al guardar se asigna el slug; si otro evento ya usa el mismo nombre compacto,
                          se añade <code>_2</code>, <code>_3</code>, etc.
                        </p>
                      ) : null}
                      {isEditMode && !documentSlug.trim() && previewShareSlug ? (
                        <p className="helper-text">
                          Este documento aún no tenía slug en la base de datos; el enlace mostrado es el que se usará al
                          guardar con los datos actuales.
                        </p>
                      ) : null}
                      {showLegacySlugRefresh ? (
                        <div className="event-public-link-card__legacy-slug">
                          <p className="helper-text" style={{ marginBottom: '0.5rem' }}>
                            Este evento usa el <strong>formato antiguo</strong> del enlace (incluye la fecha). Puedes
                            generar el <strong>enlace corto</strong> ahora sin guardar el resto del formulario.
                          </p>
                          <SecondaryButton
                            type="button"
                            size="small"
                            disabled={isRefreshingSlug}
                            onClick={() => void handleRefreshSlugToNewFormat()}
                          >
                            {isRefreshingSlug ? 'Actualizando…' : 'Renovar enlace (quitar fecha del slug)'}
                          </SecondaryButton>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="helper-text">Escribe el nombre del evento para generar el enlace.</p>
                  )}
                </div>
                
                <div className="form-group">
                  <CustomInput
                    label="Nombre del Evento"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej: Comedy Fridays at Teatro 911"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <CustomTextarea
                    label="Descripción"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe el evento..."
                    rows={4}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <CustomInput
                    label="Ciudad"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Ej: Cali"
                    required
                  />
                </div>

                <div className="form-group">
                  <CustomInput
                    label="WhatsApp de soporte"
                    name="support_whatsapp"
                    value={formData.support_whatsapp}
                    onChange={handleInputChange}
                    placeholder="Ej: 573001234567"
                    required
                  />
                  <p className="helper-text" style={{ marginTop: '0.35rem' }}>
                    Obligatorio. Código de país sin + (Colombia suele ser 57…). En la ficha pública del evento aparece el
                    botón de soporte por WhatsApp.
                  </p>
                </div>
              </div>
              
              <div className="form-section">
                <h2>Lugar</h2>
                <div className="form-group">
                  <VenueAutocomplete
                    label="Nombre del Venue"
                    name="venue.name"
                    value={formData.venue.name}
                    onChange={handleInputChange}
                    onVenueSelect={handleVenueSelect}
                    placeholder="Buscar venue..."
                    required
                    venues={venues}
                    loading={isLoadingVenues}
                  />
                </div>
                
                <div className="form-group">
                  <CustomInput
                    label="Dirección"
                    name="venue.address"
                    value={formData.venue.address}
                    onChange={handleInputChange}
                    placeholder="Ej: Calle 9 #11-91"
                    required
                  />
                </div>
              </div>
              
              <div className="form-section">
                <h2>Tipo de Evento</h2>
                <div className="form-group">
                  <CustomSelector
                    label="Tipo de Evento"
                    name="event_type"
                    value={formData.event_type}
                    onChange={handleInputChange}
                    options={[
                      { value: 'bitcomedia_direct', label: 'Venta directa en la plataforma' },
                      { value: 'external_url', label: 'Enlace externo de compra' }
                    ]}
                    required
                  />
                </div>
                
                {formData.event_type === 'external_url' && (
                  <div className="form-group">
                    <CustomInput
                      label="URL Externa"
                      name="external_url"
                      value={formData.external_url}
                      onChange={handleInputChange}
                      placeholder="https://ejemplo.com/comprar-tickets"
                      required
                    />
                  </div>
                )}
              </div>
              
              <div className="form-section">
                <h2>Fecha y Hora</h2>
                
                <div className="form-group toggle-container">
                  <label className="toggle-label">¿Es un evento recurrente?</label>
                  <div className="toggle-switch">
                    <input 
                      type="checkbox" 
                      id="recurrence-toggle" 
                      checked={isRecurring}
                      onChange={() => setIsRecurring(!isRecurring)}
                      disabled={initialIsRecurring}
                    />
                    <label htmlFor="recurrence-toggle" className="toggle-slider"></label>
                  </div>
                  {initialIsRecurring && <small className="helper-text">Este evento es recurrente y no puede cambiarse</small>}
                </div>
                
                {isRecurring ? (
                  <>
                    <div className="form-group">
                      <CustomSelector
                        label="Tipo de Recurrencia"
                        name="recurrence.type"
                        value={formData.recurrence.type}
                        onChange={handleRecurrenceTypeChange}
                        options={[
                          { value: 'daily', label: 'Diario' },
                          { value: 'weekly', label: 'Semanal' },
                          { value: 'monthly', label: 'Mensual' }
                        ]}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Días de la semana</label>
                      <div className="days-of-week">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                          <div key={day} className="day-checkbox">
                            <input
                              type="checkbox"
                              id={`day-${day}`}
                              checked={Array.isArray(formData.recurrence?.days_of_week) && formData.recurrence.days_of_week.includes(day)}
                              onChange={() => handleDayOfWeekChange(day)}
                            />
                            <label htmlFor={`day-${day}`}>{day.charAt(0).toUpperCase() + day.slice(1)}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <CustomDateTimePicker
                        label="Hora"
                        name="recurrence.time"
                        value={formData.recurrence.time}
                        onChange={handleRecurrenceTimeChange}
                        timeOnly={true}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <CustomDateTimePicker
                        label="Fecha"
                        name="single_date"
                        value={formData.single_date}
                        onChange={handleSingleDateChange}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <CustomDateTimePicker
                        label="Hora"
                        name="single_time"
                        value={formData.single_time}
                        onChange={handleSingleTimeChange}
                        timeOnly={true}
                        required
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="form-section">
                <h2>Detalles adicionales</h2>
                
                <div className="form-group">
                  <label className="custom-input-label">
                    Imagen de portada<span className="required-mark">*</span>
                  </label>
                  <span className="input-helper-text">Recomendado: Imágenes con ratio 4:5 (vertical)</span>
                  
                  <div className="cover-image-upload">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="file-input"
                      style={{ display: 'none' }}
                    />
                    
                    {formData.cover_image_preview ? (
                      <div className="image-preview-container">
                        <img 
                          src={formData.cover_image_preview} 
                          alt="Vista previa" 
                          className="image-preview" 
                        />
                        <button 
                          type="button" 
                          className="remove-image-btn"
                          onClick={handleRemoveImage}
                          aria-label="Eliminar imagen"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="upload-placeholder"
                        onClick={handleSelectImage}
                      >
                        <p>Seleccionar imagen</p>
                      </div>
                    )}
                    
                    {formData.cover_image_preview && (
                      <PrimaryButton 
                        type="button" 
                        onClick={handleSelectImage}
                        size="small"
                        disabled={isUploading}
                      >
                        {isUploading ? 'Cargando...' : 'Cambiar imagen'}
                      </PrimaryButton>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="custom-input-label">
                    Imagen boleto (fondo del PDF del ticket)
                  </label>
                  <span className="input-helper-text">
                    Opcional. Imagen de fondo del ticket enviado por correo. Usa matices oscuros/negros para que el texto blanco resalte.
                  </span>
                  <div className="cover-image-upload">
                    <input
                      type="file"
                      ref={boletoFileInputRef}
                      onChange={handleBoletoFileChange}
                      accept="image/*"
                      className="file-input"
                      style={{ display: 'none' }}
                    />
                    {formData.ticket_boleto_image_preview ? (
                      <div className="image-preview-container">
                        <img
                          src={formData.ticket_boleto_image_preview}
                          alt="Vista previa imagen boleto"
                          className="image-preview"
                        />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={handleRemoveBoletoImage}
                          aria-label="Eliminar imagen boleto"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div
                        className="upload-placeholder"
                        onClick={handleSelectBoletoImage}
                      >
                        <p>Seleccionar imagen de fondo del ticket</p>
                      </div>
                    )}
                    {formData.ticket_boleto_image_preview && (
                      <PrimaryButton
                        type="button"
                        onClick={handleSelectBoletoImage}
                        size="small"
                        disabled={isUploading}
                      >
                        Cambiar imagen
                      </PrimaryButton>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <span className="custom-input-label">Diseño del flyer (PDF por correo)</span>
                  <span className="input-helper-text">
                    Afecta el PDF adjunto al correo (Resend) tras pagar con OnePay, Mercado Pago, etc. La
                    imagen de fondo del boleto (arriba) se usa en ambas opciones.
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        fontWeight: 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="ticket_flyer_pdf_layout"
                        checked={formData.ticket_flyer_pdf_layout === 'standard'}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            ticket_flyer_pdf_layout: 'standard',
                          }))
                        }
                      />
                      <span>
                        <strong>Opción 1 — Clásico (actual).</strong> Título Ticket Colombia, nombre del
                        evento, fecha, lugar, datos del comprador y QR.
                      </span>
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        fontWeight: 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="ticket_flyer_pdf_layout"
                        checked={formData.ticket_flyer_pdf_layout === 'minimal_center'}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            ticket_flyer_pdf_layout: 'minimal_center',
                          }))
                        }
                      />
                      <span>
                        <strong>Opción 2 — Boleto compacto.</strong> Sin titular ni datos del evento: un
                        recuadro a todo el ancho (con márgenes), centrado en la página, QR a la
                        izquierda y texto (localidad, comprador, indicaciones) a la derecha. Mismo PDF
                        tras pagar con OnePay, Mercado Pago u otra pasarela.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <span className="custom-input-label">Color de acento en el PDF del boleto</span>
                  <span className="input-helper-text">
                    Localidad en la opción 2 compacta; en el diseño clásico también precio y titulares del bloque QR.
                    Usa <code>#RRGGBB</code> o el selector.
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-end',
                      gap: '12px',
                      marginTop: '0.5rem',
                    }}
                  >
                    <input
                      type="color"
                      aria-label="Elegir color de acento del PDF"
                      value={parseTicketFlyerAccentHex(formData.ticket_flyer_accent_color)}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev) => ({
                          ...prev,
                          ticket_flyer_accent_color: e.target.value.toLowerCase(),
                        }))
                      }
                      style={{
                        width: 48,
                        height: 36,
                        padding: 0,
                        border: '1px solid rgba(255,255,255,0.25)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: 'transparent',
                      }}
                    />
                    <div style={{ flex: '1', minWidth: 140, maxWidth: 220 }}>
                      <CustomInput
                        label="Hexadecimal"
                        type="text"
                        name="ticket_flyer_accent_color"
                        value={formData.ticket_flyer_accent_color}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            ticket_flyer_accent_color: e.target.value,
                          }))
                        }
                        onBlur={() =>
                          setFormData((prev) => ({
                            ...prev,
                            ticket_flyer_accent_color: parseTicketFlyerAccentHex(
                              prev.ticket_flyer_accent_color
                            ),
                          }))
                        }
                        placeholder="#00d4ff"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <span className="custom-input-label">Opción 2 — colores del texto en el recuadro</span>
                  <span className="input-helper-text">
                    Tres tonos en el boleto compacto: la <strong>localidad</strong> usa el color de acento arriba; aquí
                    defines el <strong>nombre</strong> del comprador y el color del <strong>correo</strong> (mismo tono
                    para “Presenta este QR…” y “Entrada X de Y”).
                  </span>
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <span className="input-helper-text" style={{ display: 'block', marginBottom: 6 }}>
                        Nombre del comprador
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'flex-end',
                          gap: '12px',
                        }}
                      >
                        <input
                          type="color"
                          aria-label="Color nombre comprador (opción 2)"
                          value={parseTicketFlyerHex(
                            formData.ticket_flyer_minimal_name_color,
                            TICKET_FLYER_MINIMAL_NAME_DEFAULT
                          )}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormData((prev) => ({
                              ...prev,
                              ticket_flyer_minimal_name_color: e.target.value.toLowerCase(),
                            }))
                          }
                          style={{
                            width: 48,
                            height: 36,
                            padding: 0,
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: 'transparent',
                          }}
                        />
                        <div style={{ flex: '1', minWidth: 140, maxWidth: 220 }}>
                          <CustomInput
                            label="Hexadecimal"
                            type="text"
                            name="ticket_flyer_minimal_name_color"
                            value={formData.ticket_flyer_minimal_name_color}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                ticket_flyer_minimal_name_color: e.target.value,
                              }))
                            }
                            onBlur={() =>
                              setFormData((prev) => ({
                                ...prev,
                                ticket_flyer_minimal_name_color: parseTicketFlyerHex(
                                  prev.ticket_flyer_minimal_name_color,
                                  TICKET_FLYER_MINIMAL_NAME_DEFAULT
                                ),
                              }))
                            }
                            placeholder="#ffffff"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="input-helper-text" style={{ display: 'block', marginBottom: 6 }}>
                        Correo e indicaciones al pie del recuadro
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'flex-end',
                          gap: '12px',
                        }}
                      >
                        <input
                          type="color"
                          aria-label="Color correo e indicaciones (opción 2)"
                          value={parseTicketFlyerHex(
                            formData.ticket_flyer_minimal_email_color,
                            TICKET_FLYER_MINIMAL_EMAIL_DEFAULT
                          )}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormData((prev) => ({
                              ...prev,
                              ticket_flyer_minimal_email_color: e.target.value.toLowerCase(),
                            }))
                          }
                          style={{
                            width: 48,
                            height: 36,
                            padding: 0,
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: 'transparent',
                          }}
                        />
                        <div style={{ flex: '1', minWidth: 140, maxWidth: 220 }}>
                          <CustomInput
                            label="Hexadecimal"
                            type="text"
                            name="ticket_flyer_minimal_email_color"
                            value={formData.ticket_flyer_minimal_email_color}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                ticket_flyer_minimal_email_color: e.target.value,
                              }))
                            }
                            onBlur={() =>
                              setFormData((prev) => ({
                                ...prev,
                                ticket_flyer_minimal_email_color: parseTicketFlyerHex(
                                  prev.ticket_flyer_minimal_email_color,
                                  TICKET_FLYER_MINIMAL_EMAIL_DEFAULT
                                ),
                              }))
                            }
                            placeholder="#e0e0e0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="form-group">
                  <CustomInput
                    label="Capacidad por evento"
                    type="text"
                    name="capacity_per_occurrence"
                    value={formData.capacity_per_occurrence === '' || formData.capacity_per_occurrence === undefined ? '' : String(formData.capacity_per_occurrence)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData((prev) => ({ ...prev, capacity_per_occurrence: val }));
                    }}
                    placeholder="80"
                    pattern="[0-9]*"
                    required
                  />
                </div>
                
                {formData.sections.length === 0 && (
                  <div className="form-group">
                    <CustomInput
                      label="Precio de la boleta (sin localidades)"
                      type="text"
                      name="ticket_price"
                      value={
                        formData.ticket_price === '' || formData.ticket_price === undefined
                          ? ''
                          : formatCopThousandsDisplay(Number(formData.ticket_price))
                      }
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setFormData((prev) => ({ ...prev, ticket_price: val === '' ? '' : val }));
                      }}
                      placeholder="25.000"
                      pattern="[0-9]*"
                    />
                    <small className="helper-text">
                      Solo aplica si el evento no tiene localidades; con mapa y localidades el precio va en cada una.
                    </small>
                  </div>
                )}

                <div className="form-group">
                  <CustomInput
                    label="Etiquetas del evento (separadas por coma)"
                    type="text"
                    name="event_labels_text"
                    value={formData.event_labels_text}
                    onChange={(e) => setFormData((prev) => ({ ...prev, event_labels_text: e.target.value }))}
                    placeholder="Teatro, Comedia, Familiar"
                  />
                  <small className="helper-text">Se muestran en la página pública del evento</small>
                </div>

                <div className="form-section">
                  <h2>Editor visual del mapa</h2>
                  <p className="helper-text">
                    Arma el plano con piezas arrastrables (discoteca, teatro, bar, tarima…). Puedes subir una imagen de
                    fondo y definir las zonas azules en el lienzo; opcionalmente genera un PNG aplanado para la tienda.
                  </p>
                  <VenueMapBuilder
                    sections={formData.sections}
                    onSectionsChange={(next) =>
                      setFormData((prev) => ({ ...prev, sections: next }))
                    }
                    zones={formData.venue_map_zones}
                    onZonesChange={(next) =>
                      setFormData((prev) => ({ ...prev, venue_map_zones: next }))
                    }
                    visual={formData.venue_map_visual}
                    onVisualChange={(venue_map_visual) =>
                      setFormData((prev) => ({ ...prev, venue_map_visual }))
                    }
                    defaultNewSectionPrice={
                      formData.sections.length > 0
                        ? Number(formData.sections[formData.sections.length - 1]?.price) || 0
                        : Number(formData.ticket_price) || 0
                    }
                    defaultNewSectionAvailable={
                      Math.max(1, Number(formData.capacity_per_occurrence) || 0) || 100
                    }
                    uploadMapPng={async (file) => {
                      const slug = (formData.name || 'map')
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_|_$/g, '')
                        .slice(0, 48);
                      const path = `venue-maps/${slug || 'map'}_${Date.now()}.png`;
                      return uploadFile(file, path);
                    }}
                    uploadBackgroundImage={async (file) => {
                      const path = `venue-maps/bg_${Date.now()}.jpg`;
                      return uploadFile(file, path);
                    }}
                    onFlatRenderExported={(url) =>
                      setFormData((prev) => ({
                        ...prev,
                        venue_map_visual: { ...prev.venue_map_visual, flatRenderUrl: url },
                      }))
                    }
                    organizerId={
                      getUserSession()?.uid || getCurrentUser()?.uid || ''
                    }
                  />
                </div>

                <div className="form-section">
                  <h2>Reglas de abono (este evento)</h2>
                  <p className="helper-text">
                    Aplican al checkout cuando una localidad tiene activado «Permitir compra con abono». El primer pago debe
                    cumplir al menos el porcentaje del <strong>total</strong> (entradas + tarifa) y, si indicas un piso en
                    pesos, el mayor de ambos. El saldo debe pagarse antes del día del evento contando hacia atrás los días que
                    indiques.
                  </p>
                  <div className="form-group-inline" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                    <CustomInput
                      label="% mínimo del total (primer pago)"
                      type="text"
                      value={formData.abono_min_percent}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          abono_min_percent: e.target.value.replace(/[^\d.,]/g, ''),
                        }))
                      }
                      placeholder="30"
                    />
                    <CustomInput
                      label="Monto mínimo del abono (COP, opcional)"
                      type="text"
                      value={formData.abono_min_amount_cop}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          abono_min_amount_cop: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      placeholder="0"
                    />
                    <CustomInput
                      label="Días antes del evento: límite para pagar saldo"
                      type="text"
                      value={formData.abono_max_days_before_event}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          abono_max_days_before_event: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      placeholder="7"
                    />
                  </div>
                </div>

                <div className="form-section">
                  <h2>Localidades (Secciones)</h2>
                  <p className="helper-text">Define diferentes localidades con precios y disponibilidad. Si no defines localidades, se usará el precio por defecto.</p>
                  
                  {formData.sections.map((section, index) => {
                    const palcoZones = formData.venue_map_zones.filter((z) => z.sectionId === section.id);
                    const palcoCount = palcoZones.length;
                    const isDividedPalcoLocality = palcoCount > 1;
                    return (
                    <div key={section.id} className="section-item">
                      <div className="section-row">
                        <div className="form-group-inline">
                          <CustomInput
                            label="Nombre de la localidad"
                            type="text"
                            value={section.name}
                            onChange={(e) => updateSection(index, 'name', e.target.value)}
                            placeholder="Ej: General, VIP, Platea"
                            required
                          />
                        </div>
                        <div className="form-group-inline">
                          <CustomInput
                            label="Entradas disponibles"
                            type="text"
                            value={section.available.toString()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              updateSection(index, 'available', val === '' ? 0 : parseInt(val));
                            }}
                            placeholder="100"
                            pattern="[0-9]+"
                            required
                          />
                        </div>
                        <div className="form-group-inline">
                          <CustomInput
                            label="Precio (COP)"
                            type="text"
                            value={formatCopThousandsDisplay(Number(section.price))}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              updateSection(index, 'price', val === '' ? 0 : parseInt(val, 10) || 0);
                            }}
                            placeholder="100.000"
                            pattern="[0-9.]*"
                            required
                          />
                        </div>
                        {isDividedPalcoLocality ? (
                          <div className="form-group-inline section-palco-multi-block">
                            <div className="section-palco-multi-lede">
                              <span className="section-palco-multi-lede__title">Palco multipersona</span>
                              <p className="section-palco-multi-lede__text">
                                Usa el mismo <strong>precio en COP</strong> para el palco completo: incluye a todas las
                                personas de la celda. Cada venta genera tantos <strong>códigos QR</strong> como personas
                                fijas abajo.
                              </p>
                            </div>
                            <label className="section-abono-check__label" style={{ marginBottom: '0.35rem' }}>
                              <input
                                type="checkbox"
                                checked={section.palco_multipersona === true}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  const updated = [...formData.sections];
                                  updated[index] = {
                                    ...updated[index],
                                    palco_multipersona: on,
                                    seats_per_unit: on
                                      ? Math.max(2, Number(updated[index].seats_per_unit) || 2)
                                      : 1,
                                  };
                                  setFormData({ ...formData, sections: updated });
                                }}
                              />
                              <span>Activar multipersona (varias personas por palco)</span>
                            </label>
                            {section.palco_multipersona === true ? (
                              <>
                                <CustomInput
                                  label="¿Cuántas personas por palco?"
                                  type="text"
                                  value={String(section.seats_per_unit ?? 2)}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    updateSection(
                                      index,
                                      'seats_per_unit',
                                      val === '' ? 2 : Math.max(2, parseInt(val, 10) || 2)
                                    );
                                  }}
                                  placeholder="Ej: 10"
                                />
                                <small className="helper-text">
                                  Inventario: <strong>un palco = una venta</strong>. Al comprarlo se emiten los QR de todas
                                  las personas; el comprador paga el total de «Precio (COP)» una sola vez.
                                </small>
                              </>
                            ) : (
                              <small className="helper-text">
                                Sin multipersona: cada palco es 1 entrada y 1 QR. Activa la opción de arriba si el palco
                                admite varias personas con un solo cobro.
                              </small>
                            )}
                          </div>
                        ) : (
                          <div className="form-group-inline">
                            <CustomInput
                              label="Puestos por unidad (grupo)"
                              type="text"
                              value={String(section.seats_per_unit ?? 1)}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                updateSection(
                                  index,
                                  'seats_per_unit',
                                  val === '' ? 1 : Math.max(1, parseInt(val, 10) || 1)
                                );
                              }}
                              placeholder="1"
                            />
                            <small className="helper-text">
                              Cada compra de una unidad genera esta cantidad de QR (localidades sin mapa en palcos).
                            </small>
                          </div>
                        )}
                        <div className="form-group-inline section-abono-check">
                          <label className="section-abono-check__label">
                            <input
                              type="checkbox"
                              checked={section.abono_allowed === true}
                              onChange={(e) => updateSection(index, 'abono_allowed', e.target.checked)}
                            />
                            <span>
                              Permitir compra con abono (solo usuarios con sesión)
                              {isDividedPalcoLocality ? (
                                <>
                                  <br />
                                  <span className="section-abono-scope-note">
                                    Aplica a toda esta localidad: los <strong>{palcoCount} palcos</strong> del mapa usan
                                    esta misma regla de abono.
                                  </span>
                                </>
                              ) : null}
                            </span>
                          </label>
                        </div>
                        <div className="section-actions">
                          <SecondaryButton
                            type="button"
                            onClick={() => removeSection(index)}
                            size="small"
                          >
                            🗑️ Eliminar
                          </SecondaryButton>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                  
                  <div className="section-actions">
                    <SecondaryButton
                      type="button"
                      onClick={addSection}
                      size="small"
                    >
                      ➕ Agregar Localidad
                    </SecondaryButton>
                  </div>
                </div>

                {isSuperAdminUser && isEditMode && (
                  <div className="form-group super-admin-organizer-block">
                    <h2>Organizador del evento</h2>
                    <p className="helper-text">
                      Administrador dueño del evento en el panel (taquilla, edición, escaneo). El cambio se guarda al
                      pulsar «Actualizar Evento».
                    </p>
                    {organizerSelectorOptions.length === 0 ? (
                      <p className="helper-text">Cargando administradores…</p>
                    ) : (
                      <CustomSelector
                        label="Administrador"
                        name="event_organizer_id_select"
                        value={organizerIdDraft}
                        onChange={(e) => setOrganizerIdDraft(e.target.value)}
                        options={organizerSelectorOptions}
                      />
                    )}
                  </div>
                )}

                {isSuperAdminUser && (
                  <div className="form-group super-admin-commission-block">
                    <h2>Tarifa de servicio al comprador (este evento)</h2>
                    <p className="helper-text">
                      Solo super administrador. En el checkout el usuario verá siempre el concepto{' '}
                      <strong>Tarifa de servicio</strong>. Si eliges una regla aquí, tiene prioridad sobre la tarifa por
                      defecto del organizador (Configuración → administradores) y sobre el porcentaje global de la
                      plataforma.
                    </p>
                    <CustomSelector
                      label="Tipo de tarifa"
                      name="platform_commission_type"
                      value={formData.platform_commission_type || 'none'}
                      onChange={handleInputChange}
                      options={[
                        { value: 'none', label: 'Heredar (organizador o tarifa global)' },
                        { value: 'percent_payer', label: 'Porcentaje sobre subtotal de entradas' },
                        { value: 'fixed_per_ticket', label: 'Valor fijo COP por entrada' }
                      ]}
                    />
                    {(formData.platform_commission_type === 'percent_payer' ||
                      formData.platform_commission_type === 'fixed_per_ticket') && (
                      <CustomInput
                        label={
                          formData.platform_commission_type === 'percent_payer'
                            ? 'Porcentaje (%)'
                            : 'Valor fijo por boleto (COP)'
                        }
                        type="text"
                        name="platform_commission_value"
                        value={formData.platform_commission_value}
                        onChange={handleInputChange}
                        placeholder={formData.platform_commission_type === 'percent_payer' ? 'Ej: 8.5' : 'Ej: 5000'}
                      />
                    )}
                  </div>
                )}
                
                <div className="form-group">
                  <CustomSelector
                    label="Estado"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    options={[
                      { value: 'active', label: 'Activo' },
                      { value: 'inactive', label: 'Inactivo' },
                      { value: 'draft', label: 'Borrador' },
                      { value: 'cancelled', label: 'Cancelado' }
                    ]}
                    required
                  />
                </div>
              </div>
              
              <div className="form-actions desktop-only">
                <SecondaryButton type="button" onClick={handleCancel}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={isUploading}>
                  {isUploading ? 'Guardando...' : isEditMode ? 'Actualizar Evento' : 'Crear Evento'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventFormScreen; 