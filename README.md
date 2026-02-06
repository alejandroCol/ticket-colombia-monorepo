# 🎭 Ticket Colombia - Plataforma de Venta de Tickets

Plataforma completa para la venta y gestión de tickets de eventos en Colombia. Sistema modular con aplicación web para clientes, panel administrativo y backend serverless.

## 📖 Documentación Disponible

| Documento | Descripción | Tiempo |
|-----------|-------------|--------|
| **[INICIO_RAPIDO.md](./INICIO_RAPIDO.md)** | Guía rápida de 0 a producción | 3-5 horas |
| **[COMO_INICIALIZAR_FIRESTORE.md](./COMO_INICIALIZAR_FIRESTORE.md)** | ⚡ Script automático para inicializar Firestore | 2 min |
| **[GUIA_FIRESTORE_PASO_A_PASO.md](./GUIA_FIRESTORE_PASO_A_PASO.md)** | Tutorial completo de Firestore (manual) | 30-45 min |
| **[GUIA_MERCADOPAGO_PASO_A_PASO.md](./GUIA_MERCADOPAGO_PASO_A_PASO.md)** | Tutorial completo de MercadoPago | 45-60 min |
| **[GUIA_CONFIGURACION_RESEND.md](./GUIA_CONFIGURACION_RESEND.md)** | 📧 **Tutorial completo de Resend (envío de emails)** | **5-10 min** |
| **[CAMBIO_MAILGUN_A_RESEND.md](./CAMBIO_MAILGUN_A_RESEND.md)** | 🔄 **Documentación del cambio de Mailgun a Resend** | **Consulta** |
| **[COMANDOS_INSTALAR_BACKEND.md](./COMANDOS_INSTALAR_BACKEND.md)** | 🎫 **Instalar función de tickets manuales** | **10-15 min** |
| **[CONFIGURACION_PRODUCCION.md](./CONFIGURACION_PRODUCCION.md)** | Referencia completa de configuración | Consulta |
| **[DESPLIEGUE_PRODUCCION.md](./DESPLIEGUE_PRODUCCION.md)** | 🚀 **Guía paso a paso para ir a producción** | **20-30 min** |
| **[CONFIGURACION_DOMINIO_GODADDY.md](./CONFIGURACION_DOMINIO_GODADDY.md)** | 🌐 **Configurar ticketcolombia.co en GoDaddy** | **15-20 min** |
| **[SOLUCION_ERROR_NPM.md](./SOLUCION_ERROR_NPM.md)** | 🔧 **Solución a errores de permisos NPM** | **5 min** |
| **[ESPECIFICACIONES_LOGO.md](./ESPECIFICACIONES_LOGO.md)** | 🎨 Especificaciones para crear el logo | Consulta |
| **[ESPECIFICACIONES_FAVICON.md](./ESPECIFICACIONES_FAVICON.md)** | 🎨 Especificaciones para crear el favicon | Consulta |

---

## 📦 Estructura del Proyecto

Este monorepo contiene 3 aplicaciones principales:

```
Repos Tiquetera/
├── bitcomedia-main-app/          # 🎫 Aplicación web principal (clientes)
├── bitcomedia-web-admin/         # 👨‍💼 Panel administrativo
├── bitcomedia-functions/         # ⚡ Firebase Cloud Functions
└── CONFIGURACION_PRODUCCION.md  # 📘 Guía de despliegue a producción
```

---

## 🎫 bitcomedia-main-app (Aplicación Principal)

Aplicación web pública donde los usuarios pueden:
- 🔍 Explorar eventos disponibles
- 🛒 Comprar tickets con MercadoPago
- 👤 Gestionar su perfil
- 📱 Ver sus tickets con código QR

**Tecnologías:**
- React 19
- TypeScript
- Vite
- Firebase (Auth, Firestore, Storage)
- SCSS

**Comandos:**
```bash
cd bitcomedia-main-app
npm install
npm run dev          # Desarrollo
npm run build        # Producción
firebase deploy      # Desplegar
```

---

## 👨‍💼 bitcomedia-web-admin (Panel Administrativo)

Panel de administración para organizadores de eventos:
- ✨ Crear y editar eventos
- 📊 Ver estadísticas de ventas
- ✅ Validar tickets con QR
- 🎟️ Gestionar inventario
- 🎫 **Crear tickets manuales (cortesía) con PDF y QR automático**

**Tecnologías:**
- React 19
- TypeScript
- Vite
- Firebase Admin
- SCSS

**Comandos:**
```bash
cd bitcomedia-web-admin
npm install
npm run dev          # Desarrollo
npm run build        # Producción
firebase deploy      # Desplegar
```

---

## ⚡ bitcomedia-functions (Backend)

Cloud Functions para operaciones del servidor:
- 💳 Integración con MercadoPago
- 🔔 Webhooks de pagos
- 📧 Notificaciones y envío de tickets por email (Mailgun)
- 🎟️ Generación de QR codes y PDFs de tickets
- 🔄 Procesamiento de eventos recurrentes
- 🎫 **Creación de tickets manuales (cortesía) sin cobro**

**Tecnologías:**
- Node.js
- TypeScript
- Firebase Functions
- MercadoPago SDK

**Comandos:**
```bash
cd bitcomedia-functions
npm install
firebase deploy --only functions
```

---

## 🚀 Configuración para Producción

### 🎯 ¿Por dónde empezar?

- **¿Primera vez?** → Lee el **[Inicio Rápido](./INICIO_RAPIDO.md)** (3-5 horas de zero a producción)
- **¿Necesitas configurar Firestore?** → **[Guía de Firestore Paso a Paso](./GUIA_FIRESTORE_PASO_A_PASO.md)**
- **¿Necesitas configurar MercadoPago?** → **[Guía de MercadoPago Paso a Paso](./GUIA_MERCADOPAGO_PASO_A_PASO.md)**
- **¿Referencia completa?** → **[Guía de Configuración de Producción](./CONFIGURACION_PRODUCCION.md)**

---

Antes de desplegar a producción, sigue la **[Guía Completa de Configuración](./CONFIGURACION_PRODUCCION.md)** que incluye:

### Servicios a Configurar:

1. **🔥 Firebase**
   - Crear proyecto de producción
   - Configurar Authentication
   - Configurar Firestore
   - Configurar Storage
   - Configurar Hosting

2. **💳 MercadoPago**
   - Obtener credenciales de producción
   - Configurar webhooks
   - Configurar secretos en Firebase

3. **📊 Meta Pixel (Facebook)**
   - Crear píxel de producción
   - Configurar eventos de conversión

4. **🌐 Dominios**
   - Configurar dominio personalizado (opcional)
   - Actualizar URLs en el código

### Checklist Rápido:

- [ ] Proyecto Firebase de producción creado
- [ ] Credenciales de Firebase actualizadas
- [ ] Access Token de MercadoPago configurado
- [ ] Webhook Secret configurado
- [ ] Meta Pixel configurado
- [ ] Dominio personalizado (si aplica)
- [ ] URLs de redes sociales actualizadas

Ver **[CONFIGURACION_PRODUCCION.md](./CONFIGURACION_PRODUCCION.md)** para instrucciones detalladas paso a paso.

---

## 🎨 Personalización

### Colores de la Aplicación

Los colores base de Ticket Colombia (basados en la bandera de Colombia):

```scss
$color-primary: #FCD116;     // Amarillo Colombia
$color-secondary: #003893;   // Azul Colombia
$color-accent: #CE1126;      // Rojo Colombia
```

Estos colores están definidos en:
- `bitcomedia-main-app/src/main.scss`
- `bitcomedia-web-admin/src/main.scss`

### Redes Sociales

Actualiza las URLs de redes sociales en:
- `bitcomedia-main-app/src/pages/profile/index.tsx`

### WhatsApp de Soporte

Actualiza el número de WhatsApp en todos los componentes `WhatsAppButton`:
```tsx
<WhatsAppButton 
  phoneNumber="+573102072254"  // Actualiza este número
  message="..."
/>
```

---

## 📚 Documentación Adicional

### Guías de Configuración
- **[Guía de Configuración de Producción](./CONFIGURACION_PRODUCCION.md)** - Resumen ejecutivo para ir a producción
- **[Guía de Firestore Paso a Paso](./GUIA_FIRESTORE_PASO_A_PASO.md)** - Tutorial completo de Firestore
- **[Guía de MercadoPago Paso a Paso](./GUIA_MERCADOPAGO_PASO_A_PASO.md)** - Tutorial completo de MercadoPago

### Documentación Técnica
- **[Setup de MercadoPago](./bitcomedia-main-app/MERCADOPAGO_SETUP.md)** - Referencia técnica de integración
- **[Mejoras de MercadoPago](./bitcomedia-functions/MEJORAS_MERCADOPAGO.md)** - Cambios y mejoras implementadas
- **[Módulo de Pagos](./bitcomedia-functions/functions/src/features/payments/README.md)** - Arquitectura del módulo de pagos
- **[Componentes UI](./bitcomedia-main-app/src/components/README.md)** - Sistema de diseño

### Documentación de Diseño
- **[Especificaciones del Logo](./ESPECIFICACIONES_LOGO.md)** - Guía completa para crear el logo de la plataforma
- **[Especificaciones del Favicon](./ESPECIFICACIONES_FAVICON.md)** - Guía completa para crear el favicon (ícono del navegador)

---

## 🔒 Seguridad

### Variables Sensibles

**NUNCA** incluyas en el código:
- ❌ Access Tokens de MercadoPago
- ❌ API Keys de Firebase
- ❌ Secretos de webhooks
- ❌ Credenciales de servicios

**USA** Firebase Secrets para todas las credenciales:
```bash
firebase functions:secrets:set NOMBRE_SECRETO
```

### Reglas de Firestore

Asegúrate de tener reglas de seguridad apropiadas en `firestore.rules`.

---

## 🛠️ Desarrollo

### Requisitos Previos

- Node.js 18+
- npm o yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Cuenta de Firebase
- Cuenta de MercadoPago Developer (Colombia)
- Cuenta de Resend (para envío de emails - 3,000 emails/mes GRATIS para siempre)

### Instalación Local

```bash
# Clonar el repositorio
git clone [URL_DEL_REPO]
cd "Repos Tiquetera"

# Instalar dependencias en cada proyecto
cd bitcomedia-main-app && npm install && cd ..
cd bitcomedia-web-admin && npm install && cd ..
cd bitcomedia-functions && npm install && cd ..

# Iniciar sesión en Firebase
firebase login

# Seleccionar proyecto
firebase use --add
```

### Desarrollo Local

```bash
# Terminal 1 - App principal
cd bitcomedia-main-app
npm run dev

# Terminal 2 - Admin panel
cd bitcomedia-web-admin
npm run dev

# Terminal 3 - Functions (emuladores)
cd bitcomedia-functions
firebase emulators:start
```

---

## 📞 Soporte

Para soporte técnico:
- **Email**: [tu-email@ticketcolombia.com]
- **WhatsApp**: +57 310 207 2254
- **Instagram**: @ticketcolombia
- **TikTok**: @ticketcolombia

---

## 📄 Licencia

Propiedad de Ticket Colombia. Todos los derechos reservados.

---

## 🎯 Stack Tecnológico Completo

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Firebase Functions, Node.js
- **Base de Datos**: Firestore
- **Autenticación**: Firebase Auth
- **Almacenamiento**: Firebase Storage
- **Hosting**: Firebase Hosting
- **Pagos**: MercadoPago (Colombia)
- **Emails**: Resend (API moderna y simple)
- **PDFs**: PDFKit
- **QR Codes**: qrcode
- **Analytics**: Meta Pixel
- **Estilos**: SCSS
- **Herramientas**: ESLint, Prettier

---

**Desarrollado con ❤️ en Colombia 🇨🇴**

