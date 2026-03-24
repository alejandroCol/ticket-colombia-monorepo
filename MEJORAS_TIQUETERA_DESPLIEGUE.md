# Mejoras tiquetera — despliegue y pendientes

## Desplegar

1. **Cloud Functions** (incluye `getEventAvailability` y `createTicketPreference` con invitados):
   ```bash
   cd bitcomedia-functions && firebase deploy --only functions
   ```

2. **Apps** (main + admin): build y deploy hosting habituales.

## Implementado

- **Home**: sin precio en tarjetas; botón "Ver evento"; búsqueda por nombre o ciudad (sobre eventos ya cargados).
- **Evento**: selector de localidades si hay `sections`; disponibilidad con regla “ocultar 30%” hasta quedar ≤30% reales; mapa con imagen si `venue_map_url`; etiquetas desde `event_labels` del evento.
- **Checkout**: precio por localidad vía URL; compra **sin cuenta** (email + nombre); pasa `sectionId`/`sectionName` al backend.
- **Compra finalizada**: muestra nombre del evento, cantidad, localidad, total (params en URL desde MercadoPago).
- **Admin**: campos “Etiquetas (coma)” y “URL mapa de localidades”; se guardan en el documento del evento.
- **Callable** `getEventAvailability`: vendidos por sección (para la app pública).

## Pendiente (siguiente fase)

### Reserva 10 minutos
- Colección `seat_reservations` o similar: `eventId`, `sectionId`, `quantity`, `sessionId`/`email`, `expiresAt`.
- Callable `reserveSeats` / `releaseReservation`; al crear preferencia MP consumir reserva; TTL o Cloud Scheduler para limpiar.
- En checkout, llamar a `reserveSeats` al entrar y liberar al salir o al pagar.

### Mapa interactivo (sillas numeradas)
- Modelo: zonas rectangulares sobre imagen (% x,y,w,h) ligadas a `sectionId` o asientos puntuales.
- Editor simple en admin (arrastrar rectángulos) y componente de selección en la app.

### Validación server-side de cupo
- En `createTicketPreference`, comprobar `getEventAvailability` + reservas activas antes de crear el ticket.
