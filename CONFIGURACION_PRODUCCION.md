# 🚀 Guía de Configuración para Producción - Ticket Colombia

Esta guía te ayudará a configurar todos los servicios y credenciales necesarios para desplegar **Ticket Colombia** a producción.

---

## 📋 Índice

1. [Firebase](#1-firebase)
2. [MercadoPago](#2-mercadopago)
3. [Meta Pixel (Facebook)](#3-meta-pixel-facebook)
4. [Variables de Entorno y Secretos](#4-variables-de-entorno-y-secretos)
5. [Dominios y URLs](#5-dominios-y-urls)
6. [Checklist de Despliegue](#6-checklist-de-despliegue)

---

## 1. Firebase

### 📘 Guía Detallada Paso a Paso

Para una guía completa con capturas y detalles de cada paso, consulta:
**[GUIA_FIRESTORE_PASO_A_PASO.md](./GUIA_FIRESTORE_PASO_A_PASO.md)**

### 1.1 Crear Proyecto Firebase de Producción

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto (ej: `ticket-colombia-prod`)
3. Activa Google Analytics (opcional pero recomendado)

### 1.2 Configurar Firebase Authentication

1. En Firebase Console → **Authentication**
2. Habilita los métodos de autenticación:
   - ✅ **Email/Password**
   - ✅ Cualquier otro método que uses (Google, Facebook, etc.)

### 1.3 Configurar Firestore Database

1. En Firebase Console → **Firestore Database**
2. Crea la base de datos en modo **Producción**
3. Elige la ubicación más cercana a Colombia (ej: `us-east1` o `southamerica-east1`)
4. Configura las reglas de seguridad (ver archivo `firestore.rules`)

### 1.4 Configurar Firebase Storage

1. En Firebase Console → **Storage**
2. Activa Firebase Storage
3. Configura las reglas de seguridad para imágenes de eventos

### 1.5 Configurar Firebase Hosting

#### Para la App Principal:
```bash
cd bitcomedia-main-app
firebase use --add
# Selecciona tu proyecto de producción
firebase target:apply hosting main ticket-colombia-main
```

#### Para el Panel Admin:
```bash
cd bitcomedia-web-admin
firebase use --add
firebase target:apply hosting admin ticket-colombia-admin
```

### 1.6 Obtener Credenciales de Firebase

1. En Firebase Console → **Configuración del Proyecto** (⚙️)
2. Ve a **Tus aplicaciones** → Agrega una **Aplicación Web** (si no existe)
3. Copia las credenciales y actualiza:

**Archivo a actualizar: `bitcomedia-main-app/src/services/firebase-confi.ts`**
```typescript
export const firebaseConfig = {
    apiKey: "TU_API_KEY_DE_PRODUCCION",
    authDomain: "ticket-colombia-prod.firebaseapp.com",
    projectId: "ticket-colombia-prod",
    storageBucket: "ticket-colombia-prod.appspot.com",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID",
    measurementId: "TU_MEASUREMENT_ID"
};
```

**⚠️ IMPORTANTE:** Haz lo mismo en `bitcomedia-web-admin/src/services/firebase-confi.ts`

### 1.7 Configurar Firebase Functions

```bash
cd bitcomedia-functions
firebase use ticket-colombia-prod
firebase deploy --only functions
```

---

## 2. MercadoPago

### 📘 Guía Detallada Paso a Paso

Para una guía completa con todos los detalles de configuración, consulta:
**[GUIA_MERCADOPAGO_PASO_A_PASO.md](./GUIA_MERCADOPAGO_PASO_A_PASO.md)**

### 2.1 Crear Cuenta de Desarrollador

1. Ve a [MercadoPago Developers Colombia](https://www.mercadopago.com.co/developers)
2. Crea una cuenta o inicia sesión
3. Crea una nueva **Aplicación**

### 2.2 Obtener Credenciales de Producción

1. En el panel de MercadoPago → **Credenciales**
2. Ve a la pestaña **Credenciales de Producción**
3. Copia:
   - ✅ **Access Token** (Privado - NO compartir)
   - ✅ **Public Key** (Puede ser pública)

⚠️ **NUNCA uses las credenciales de SANDBOX en producción**

### 2.3 Configurar Secretos en Firebase Functions

```bash
cd bitcomedia-functions

# Configurar Access Token de MercadoPago
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
# Cuando te lo pida, pega tu Access Token de PRODUCCIÓN

# Configurar Webhook Secret (genera un string aleatorio seguro)
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
# Ejemplo: puedes usar: openssl rand -hex 32

# Configurar URL de tu app
firebase functions:secrets:set APP_URL
# Ejemplo: https://ticketcolombia.com o https://ticket-colombia-main.web.app
```

### 2.4 Configurar Webhook en MercadoPago

1. En el panel de MercadoPago → **Webhooks**
2. Agrega una nueva URL de webhook:
   ```
   https://REGION-ticket-colombia-prod.cloudfunctions.net/mercadopagoWebhook
   ```
   Ejemplo: `https://us-central1-ticket-colombia-prod.cloudfunctions.net/mercadopagoWebhook`

3. Selecciona los siguientes eventos:
   - ✅ **Pagos** (payments)
   - ✅ **Órdenes comerciales** (merchant_orders)

4. En **Configuración avanzada**, pega tu `MERCADOPAGO_WEBHOOK_SECRET`

### 2.5 URLs de Redirección

Las URLs están configuradas automáticamente en el código. Asegúrate de que tu `APP_URL` en los secretos sea correcta.

Las URLs de retorno serán:
- ✅ Éxito: `{APP_URL}/purchase-finished`
- ❌ Error: `{APP_URL}/purchase-finished?status=failure`
- ⏳ Pendiente: `{APP_URL}/purchase-finished?status=pending`

### 2.6 Tarifa de Servicio (Service Fee)

**Archivo actual:** `bitcomedia-main-app/src/pages/Checkout/index.tsx` (línea ~40)

```typescript
const SERVICE_FEE_PERCENTAGE = 0.05; // 5% de tarifa de servicio
```

Puedes ajustar este porcentaje según tu modelo de negocio.

---

## 3. Meta Pixel (Facebook)

### 3.1 Crear Meta Pixel

1. Ve a [Meta Business Suite](https://business.facebook.com/)
2. Ve a **Configuración de Eventos** → **Píxeles**
3. Crea un nuevo Píxel o usa uno existente
4. Copia el **ID del Píxel** (es un número como `1261401835610511`)

### 3.2 Actualizar el Píxel en la App

**Archivo: `bitcomedia-main-app/index.html`** (líneas 29 y 39)

```html
<!-- Actualiza el ID del píxel en dos lugares -->
<script>
  // ...
  fbq('init', 'TU_PIXEL_ID_DE_PRODUCCION'); // <- Línea 29
  fbq('track', 'PageView');
</script>

<!-- Y en el noscript -->
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=TU_PIXEL_ID_DE_PRODUCCION&ev=PageView&noscript=1"
/></noscript>
```

### 3.3 Verificar Instalación

1. Instala la extensión [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper) en Chrome
2. Visita tu sitio
3. Verifica que el píxel se esté disparando correctamente

### 3.4 Configurar Eventos de Conversión

Los eventos ya están implementados en el código:
- ✅ `PageView` - Automático
- ✅ `ViewContent` - Ver detalles de evento
- ✅ `InitiateCheckout` - Iniciar compra
- ✅ `Purchase` - Compra completada
- ✅ `CompleteRegistration` - Registro
- ✅ `Lead` - Interés en evento

---

## 4. Variables de Entorno y Secretos

### 4.1 Firebase Functions - Secretos

Ya configurados en el paso de MercadoPago, pero aquí está la lista completa:

```bash
# En bitcomedia-functions/
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
firebase functions:secrets:set APP_URL
```

### 4.2 Variables de Entorno para Build

Si usas CI/CD, asegúrate de configurar estas variables en tu sistema:

**GitHub Actions / GitLab CI / etc:**
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### 4.3 Modo Producción vs Desarrollo

El código detecta automáticamente el modo:

**Archivo: `bitcomedia-functions/functions/src/index.ts`** (línea 19)
```typescript
const isDevelopment = process.env.NODE_ENV !== "production";
```

---

## 5. Dominios y URLs

### 5.1 Configurar Dominio Personalizado (Opcional)

Si quieres usar un dominio como `ticketcolombia.com`:

#### Para la App Principal:
1. Firebase Console → **Hosting** → **Agregar dominio personalizado**
2. Sigue las instrucciones para configurar DNS
3. Firebase te dará registros DNS para agregar

#### Para el Admin:
1. Puedes usar un subdominio como `admin.ticketcolombia.com`
2. Configura el DNS de la misma manera

### 5.2 URLs a Configurar

Necesitas actualizar estas URLs en varios lugares:

#### En Firebase Functions (ya configurado con secreto `APP_URL`)
```bash
firebase functions:secrets:set APP_URL
# Ingresa: https://ticketcolombia.com
# O: https://ticket-colombia-main.web.app
```

#### En el código de Functions
**Archivo: `bitcomedia-functions/functions/src/features/payments/services/payment.service.ts`**
- Línea 214: URL del webhook (ya está correcta si tu proyecto está bien configurado)

### 5.3 URLs de Redes Sociales

Actualiza tus URLs de redes sociales en:

**Archivo: `bitcomedia-main-app/src/pages/profile/index.tsx`** (líneas 168 y 174)
```tsx
onClick={() => window.open('https://www.instagram.com/TUINSTAGRAMAQUI', '_blank')}
onClick={() => window.open('https://www.tiktok.com/@TUTIKTOKAQUI', '_blank')}
```

---

## 6. Checklist de Despliegue

### Pre-Despliegue

- [ ] **Firebase de Producción creado**
- [ ] **Credenciales de Firebase actualizadas** en `firebase-confi.ts` (main-app y web-admin)
- [ ] **MercadoPago Access Token de PRODUCCIÓN** configurado en Firebase Secrets
- [ ] **MercadoPago Webhook Secret** generado y configurado
- [ ] **APP_URL** configurada en Firebase Secrets
- [ ] **Meta Pixel ID** de producción actualizado en `index.html`
- [ ] **URLs de redes sociales** actualizadas
- [ ] **Dominio personalizado** configurado (si aplica)

### Despliegue

```bash
# 1. Desplegar Functions primero
cd bitcomedia-functions
firebase use ticket-colombia-prod
firebase deploy --only functions

# 2. Desplegar Main App
cd ../bitcomedia-main-app
firebase use ticket-colombia-prod
npm run build
firebase deploy --only hosting:main

# 3. Desplegar Admin Panel
cd ../bitcomedia-web-admin
firebase use ticket-colombia-prod
npm run build
firebase deploy --only hosting:admin
```

### Post-Despliegue

- [ ] **Verificar que el sitio carga** correctamente
- [ ] **Probar registro e inicio de sesión**
- [ ] **Probar creación de eventos** (desde admin)
- [ ] **Probar compra de tickets** con MercadoPago en producción
  - ⚠️ Usa una tarjeta real pero con un monto pequeño para probar
- [ ] **Verificar que el webhook de MercadoPago** funciona
  - Revisa los logs: `firebase functions:log --only mercadopagoWebhook`
- [ ] **Verificar Meta Pixel** con Meta Pixel Helper
- [ ] **Probar en móviles** (iOS y Android)
- [ ] **Configurar Firestore Rules** de producción

### Seguridad

- [ ] **Reglas de Firestore** configuradas correctamente
- [ ] **Reglas de Storage** configuradas
- [ ] **CORS** configurado si es necesario
- [ ] **Rate Limiting** en Functions (si es necesario)
- [ ] **Backup de Firestore** configurado

---

## 📞 Soporte Técnico

### MercadoPago
- Documentación: https://www.mercadopago.com.co/developers/es/docs
- Soporte: https://www.mercadopago.com.co/developers/es/support

### Firebase
- Documentación: https://firebase.google.com/docs
- Comunidad: https://firebase.google.com/community

### Meta for Developers
- Documentación: https://developers.facebook.com/docs/meta-pixel
- Soporte: https://business.facebook.com/business/help

---

## 🔒 Seguridad - ¡MUY IMPORTANTE!

1. **NUNCA** compartas tus credenciales de producción en:
   - Git/GitHub
   - Slack
   - Email
   - Screenshots

2. **USA** Firebase Secrets para todas las credenciales sensibles

3. **ROTA** tus secretos regularmente:
   - Access Token de MercadoPago cada 6 meses
   - Webhook Secret cada 3 meses

4. **MONITOREA** tus logs regularmente:
   ```bash
   firebase functions:log --only mercadopagoWebhook
   ```

5. **BACKUP** de tu base de datos:
   - Configura exportaciones automáticas en Firebase Console

---

## 🎨 Configuración de Colores

Los colores base de la aplicación se cambiaron a los colores de Colombia:

```scss
// Esquema de colores de Colombia
$color-primary: #FCD116;     // Amarillo Colombia
$color-secondary: #003893;   // Azul Colombia
$color-accent: #CE1126;      // Rojo Colombia
$color-text-primary: #1a1a1a;
$color-text-secondary: #666666;
$color-surface: #FFFFFF;
```

---

## 📝 Notas Adicionales

### Comisiones de MercadoPago

MercadoPago cobra comisiones por transacción. Revisa las tarifas actuales en:
https://www.mercadopago.com.co/costs-section/costs

Tu aplicación cobra un **5% adicional** de tarifa de servicio (configurable).

### Límites de Firebase

- **Firestore**: 50,000 lecturas/día en plan gratuito
- **Functions**: 2M invocaciones/mes en plan gratuito
- **Hosting**: 10 GB almacenamiento, 360 MB/día transferencia

Para producción, considera el **plan Blaze** (pago por uso).

---

**✅ ¡Listo! Tu aplicación Ticket Colombia está lista para producción.**

Si tienes dudas, revisa la documentación oficial de cada servicio o contacta a tu equipo de desarrollo.

