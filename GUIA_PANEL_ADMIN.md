# 👨‍💼 Guía Completa del Panel de Administración

**Fecha:** 28 de octubre de 2025  
**Versión:** 1.0

---

## 🌐 Acceso al Panel Admin

| Concepto | Detalle |
|----------|---------|
| **URL Producción** | https://admin-ticket-colombia.web.app |
| **URL Futura** | https://admin.ticketcolombia.co |
| **Usuario Admin** | ale.mar.guz@gmail.com |
| **Rol Requerido** | `ADMIN` (mayúsculas) en Firestore |

---

## 📊 Funcionalidades Disponibles

### 1️⃣ **Dashboard Principal** (`/dashboard`)

**¿Qué ves aquí?**

- 📋 **Lista de todos los eventos futuros** (desde hoy en adelante)
- 🔄 **Sección de eventos recurrentes** (colapsable/expandible)
- 🎨 **Vista en tarjetas** con información clave de cada evento:
  - Nombre del evento
  - Fecha y hora
  - Ciudad
  - Precio
  - Imagen de portada
  - Estado (activo/inactivo)

**Acciones disponibles:**

- ➕ **Crear Evento Nuevo** (botón "+ Evento")
- ➕ **Crear Evento Recurrente** (botón "+ Recurrente")
- ✏️ **Editar evento existente** (click en tarjeta del evento)
- 🚪 **Cerrar sesión** (botón en barra superior)

**Ordenamiento:**
- Eventos normales: Por fecha (más cercano primero)
- Eventos recurrentes: Por nombre (alfabético)

---

### 2️⃣ **Crear/Editar Evento** (`/events/new` o `/events/:eventId`)

**¿Qué puedes hacer?**

#### Información Básica
- ✏️ Nombre del evento
- 📝 Descripción
- 🏙️ Ciudad
- 📍 Lugar/Venue (con autocompletado)
- 📅 Fecha del evento
- ⏰ Hora del evento
- 🖼️ Imagen de portada (subir desde tu computadora)

#### Configuración de Venta
- 💰 **Precio del ticket**
- 🎫 **Tipo de evento:**
  - `bitcomedia_direct`: Venta directa en la plataforma
  - `external`: Evento externo (redirección)
  - `free`: Evento gratuito

#### Campos Adicionales
- 🏷️ Categorías (tags del evento)
- 🔗 URL externa (si aplica)
- 📊 Estado: Activo/Inactivo

**Acciones:**
- 💾 **Guardar** (crear o actualizar evento)
- ❌ **Cancelar** (volver al dashboard sin guardar)

---

### 3️⃣ **Crear/Editar Evento Recurrente** (`/recurring-events/new` o `/recurring-events/:eventId`)

**¿Qué es un evento recurrente?**

Un evento que se repite periódicamente (ej: "Comedia todos los viernes").

**¿Qué puedes configurar?**

Todos los campos de un evento normal, más:
- 🔄 **Patrón de recurrencia:**
  - Diario
  - Semanal
  - Mensual
  - Personalizado

**Ventaja:**
- Creas el evento una sola vez
- El sistema genera automáticamente las ocurrencias futuras

---

### 4️⃣ **Validar Tickets** (`/validate-ticket/:ticketId`)

**¿Para qué sirve?**

Verificar y validar tickets cuando los usuarios llegan al evento.

**¿Cómo funciona?**

1. **Escanear QR del ticket** (desde el QR del usuario)
2. **Ver información del ticket:**
   - Nombre del comprador
   - Correo electrónico
   - Teléfono
   - Nombre del evento
   - Fecha y hora
   - Ubicación
   - Precio pagado
   - Estado actual del ticket

3. **Validar el ticket:**
   - ✅ Marcar como "usado" (no puede usarse de nuevo)
   - ❌ Ver si ya fue usado previamente
   - 🔍 Detectar intentos de fraude

**Estados del ticket:**
- 🟢 `valid` - Ticket válido y sin usar
- ✅ `used` - Ticket ya usado/validado
- ❌ `cancelled` - Ticket cancelado

**Acciones:**
- ✅ **Validar ticket** (cambiar estado a "usado")
- 🔙 **Volver al dashboard**

---

## ❌ Funcionalidades NO Disponibles Actualmente

### 📊 **Módulo de Estadísticas/Ventas**

**Lo que NO puedes ver (aún):**
- ❌ Total de ventas por evento
- ❌ Ingresos totales
- ❌ Cantidad de tickets vendidos
- ❌ Gráficos de ventas
- ❌ Exportar reportes

**¿Cómo ver las ventas actualmente?**

Debes ir directamente a **Firebase Console**:

1. **Ver tickets vendidos:**
   ```
   https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Ftickets
   ```

2. **Filtrar por evento:**
   - Buscar tickets con `eventId` específico
   - Ver el campo `purchaseAmount` (precio pagado)
   - Contar manualmente los documentos

3. **Ver usuarios registrados:**
   ```
   https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Fusers
   ```

---

## 🔧 Otras Funcionalidades Faltantes

| Funcionalidad | Estado | Prioridad |
|---------------|--------|-----------|
| **Dashboard de ventas** | ❌ No disponible | 🔴 Alta |
| **Reporte de ingresos** | ❌ No disponible | 🔴 Alta |
| **Gestión de usuarios** | ❌ No disponible | 🟡 Media |
| **Envío de notificaciones** | ❌ No disponible | 🟡 Media |
| **Gestión de reembolsos** | ❌ No disponible | 🟡 Media |
| **Historial de ventas** | ❌ No disponible | 🔴 Alta |
| **Exportar a Excel/CSV** | ❌ No disponible | 🟢 Baja |
| **Estadísticas en tiempo real** | ❌ No disponible | 🟢 Baja |
| **Gestión de descuentos/cupones** | ❌ No disponible | 🟢 Baja |

---

## 🚀 Cómo Ver Estadísticas Manualmente (Firestore)

### Opción 1: Firestore Console (Web)

1. **Ir a Firestore:**
   ```
   https://console.firebase.google.com/project/ticket-colombia-e6267/firestore
   ```

2. **Ver colección `tickets`:**
   - Cada documento = 1 ticket vendido
   - Campos importantes:
     - `eventId`: ID del evento
     - `eventName`: Nombre del evento
     - `purchaseAmount`: Precio pagado
     - `userId`: Usuario que compró
     - `status`: Estado del ticket
     - `createdAt`: Fecha de compra

3. **Contar tickets por evento:**
   - Buscar manualmente por `eventName`
   - O usar filtros en Firestore console

### Opción 2: Script para Calcular Ventas

Puedo crear un script Node.js para que ejecutes en tu terminal y veas las ventas:

```bash
# Ejecutar en terminal
node get-sales-stats.js
```

**Salida del script:**
```
📊 Estadísticas de Ventas - Ticket Colombia

Total de tickets vendidos: 45
Ingresos totales: $2,250,000 COP

Por evento:
• Stand Up Comedy Night: 15 tickets - $750,000
• Noche de Risas: 20 tickets - $1,000,000
• Show Especial: 10 tickets - $500,000
```

¿Quieres que te cree este script?

---

## 🎯 Flujo de Trabajo Típico

### 1. **Crear un Evento**

```
Dashboard → Click "+ Evento" → Completar formulario → Guardar
```

### 2. **Validar Tickets el Día del Evento**

```
Escanear QR del usuario → Ver información → Click "Validar Ticket" → ✅ Ticket marcado como usado
```

### 3. **Editar un Evento Existente**

```
Dashboard → Click en tarjeta del evento → Editar campos → Guardar cambios
```

### 4. **Ver Ventas (Manualmente)**

```
Firestore Console → Colección "tickets" → Filtrar por evento → Contar documentos
```

---

## 🔐 Permisos y Seguridad

### Usuarios Autorizados

Solo usuarios con `role: "ADMIN"` en Firestore pueden:
- ✅ Acceder al panel admin
- ✅ Crear/editar eventos
- ✅ Validar tickets
- ✅ Ver información de usuarios

### Usuarios NO Autorizados

Si un usuario sin permisos intenta acceder:
- ❌ Es redirigido automáticamente al login
- ❌ Su sesión es cerrada
- ❌ No puede ver ninguna información

---

## 📱 Dispositivos Compatibles

El panel admin funciona en:
- 💻 **Desktop** (recomendado para crear eventos)
- 📱 **Tablet** (funcional)
- 📱 **Móvil** (limitado, mejor para validar tickets)

**Recomendación:** Usar desktop para crear/editar eventos, móvil para validar tickets en el evento.

---

## 🆘 Problemas Comunes

### 1. No puedo ver eventos en el dashboard

**Causas posibles:**
- No hay eventos futuros creados
- Los eventos están marcados como inactivos
- Error de conexión a Firebase

**Solución:**
- Crear un evento nuevo
- Verificar estado del evento en Firestore
- Refrescar la página

### 2. No puedo subir imagen al crear evento

**Causas posibles:**
- Archivo muy grande (> 5MB)
- Formato no compatible
- Storage no habilitado

**Solución:**
- Reducir tamaño de imagen
- Usar formatos: JPG, PNG, WebP
- Verificar que Storage esté habilitado en Firebase

### 3. El botón "Validar Ticket" no funciona

**Causas posibles:**
- Ticket ya validado
- Error de conexión a Firebase
- Permisos insuficientes

**Solución:**
- Verificar estado del ticket
- Refrescar la página
- Verificar rol de administrador

---

## 📞 Contacto y Soporte

Si necesitas ayuda o tienes dudas:

1. **Consultar esta guía**
2. **Revisar Firebase Console** para datos crudos
3. **Contactar al desarrollador** si el problema persiste

---

## 🔮 Próximas Mejoras Sugeridas

### Alta Prioridad
1. **Dashboard de ventas** con gráficos
2. **Reporte de ingresos** por evento y total
3. **Filtros avanzados** para eventos

### Media Prioridad
4. **Gestión de usuarios** desde el panel
5. **Envío de notificaciones** a usuarios
6. **Búsqueda de tickets** por usuario/evento

### Baja Prioridad
7. **Exportar reportes** a Excel/CSV
8. **Sistema de cupones** y descuentos
9. **Analytics en tiempo real**

---

## 📋 Resumen de URLs

| Funcionalidad | URL |
|---------------|-----|
| **Panel Admin** | https://admin-ticket-colombia.web.app |
| **Firestore Console** | https://console.firebase.google.com/project/ticket-colombia-e6267/firestore |
| **Authentication** | https://console.firebase.google.com/project/ticket-colombia-e6267/authentication |
| **Storage** | https://console.firebase.google.com/project/ticket-colombia-e6267/storage |
| **Functions** | https://console.firebase.google.com/project/ticket-colombia-e6267/functions |

---

**Última actualización:** 28 de octubre de 2025





