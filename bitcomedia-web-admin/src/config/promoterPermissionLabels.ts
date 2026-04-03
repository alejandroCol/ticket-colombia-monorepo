import type { PartnerEventPermissions } from '@services';

export const PROMOTER_PERM_LABELS: {
  key: keyof PartnerEventPermissions;
  label: string;
  hint: string;
}[] = [
  { key: 'read_tickets', label: 'Ver boletos', hint: 'Listado y detalle de ventas del evento.' },
  { key: 'create_tickets', label: 'Crear boletos / cortesías', hint: 'Boletos manuales y cortesías desde el panel (modal y Excel).' },
  {
    key: 'taquilla_sale',
    label: 'Venta en taquilla (precio público)',
    hint: 'Módulo sencillo para vender en puerta al precio del evento o localidad. No incluye cortesías.',
  },
  { key: 'edit_event', label: 'Editar evento', hint: 'Formulario del evento o serie recurrente.' },
  { key: 'view_stats', label: 'Ver estadísticas', hint: 'Pantalla de ingresos y gastos del evento.' },
  { key: 'scan_validate', label: 'Taquilla / validar', hint: 'Escanear y validar entradas en puerta.' },
];
