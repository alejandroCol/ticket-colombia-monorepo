# 🚀 Inicio Rápido - Ticket Colombia

Esta guía te llevará de cero a producción en el menor tiempo posible.

---

## ⏱️ Tiempo Estimado

- **Configuración básica**: 1-2 horas
- **Pruebas completas**: 1-2 horas
- **Despliegue a producción**: 30 minutos
- **TOTAL**: 3-5 horas

---

## 📋 Requisitos Previos

Antes de empezar, asegúrate de tener:

- [ ] Cuenta de Google
- [ ] Cédula/documento de identidad (para MercadoPago)
- [ ] Cuenta bancaria en Colombia (para recibir pagos)
- [ ] Node.js 18+ instalado
- [ ] Git instalado
- [ ] Editor de código (VSCode recomendado)

---

## 🎯 Pasos Rápidos

### 1️⃣ Clonar e Instalar (15 min)

```bash
# Clonar el repositorio
git clone [URL_DEL_REPO]
cd "Repos Tiquetera"

# Instalar dependencias
cd bitcomedia-main-app && npm install && cd ..
cd bitcomedia-web-admin && npm install && cd ..
cd bitcomedia-functions && npm install && cd ..

# Instalar Firebase CLI
npm install -g firebase-tools

# Iniciar sesión
firebase login
```

---

### 2️⃣ Configurar Firebase (30-45 min O 2 min con script)

**Opción A: Script Automático ⚡ (RECOMENDADO - 2 min)**
- Sigue: [COMO_INICIALIZAR_FIRESTORE.md](./COMO_INICIALIZAR_FIRESTORE.md)
- Ejecuta: `npm run init-db` y listo!

**Opción B: Manual (30-45 min)**
- Sigue: [GUIA_FIRESTORE_PASO_A_PASO.md](./GUIA_FIRESTORE_PASO_A_PASO.md)

**Pasos comunes (ambas opciones)**:
1. Crear proyecto en Firebase Console
2. Habilitar Firestore (ubicación: `southamerica-east1`)
3. Habilitar Authentication (Email/Password)
4. Habilitar Storage
5. Copiar credenciales y actualizar:
   - `bitcomedia-main-app/src/services/firebase-confi.ts`
   - `bitcomedia-web-admin/src/services/firebase-confi.ts`

```typescript
// Actualizar en ambos archivos:
export const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "ticket-colombia-prod.firebaseapp.com",
    projectId: "ticket-colombia-prod",
    storageBucket: "ticket-colombia-prod.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID",
    measurementId: "TU_MEASUREMENT_ID"
};
```

---

### 3️⃣ Configurar MercadoPago (45-60 min)

**Sigue la guía detallada**: [GUIA_MERCADOPAGO_PASO_A_PASO.md](./GUIA_MERCADOPAGO_PASO_A_PASO.md)

**Resumen rápido**:
1. Crear cuenta en MercadoPago Colombia
2. Verificar identidad (puede tardar 24-48h)
3. Crear aplicación "Ticket Colombia"
4. Obtener credenciales de TEST
5. Configurar secretos:

```bash
cd bitcomedia-functions

firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
# Pega tu Access Token de TEST

firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
# Genera con: openssl rand -hex 32

firebase functions:secrets:set APP_URL
# Pega: https://ticket-colombia-prod.web.app
```

6. Desplegar functions:
```bash
firebase deploy --only functions
```

7. Configurar webhook en MercadoPago con la URL generada

---

### 4️⃣ Configurar Meta Pixel (15 min) - OPCIONAL

1. Ir a [Meta Business Suite](https://business.facebook.com/)
2. Crear un Píxel
3. Copiar el ID del píxel
4. Actualizar en `bitcomedia-main-app/index.html`:

```html
<!-- Línea 29 -->
fbq('init', 'TU_PIXEL_ID');

<!-- Línea 39 -->
src="https://www.facebook.com/tr?id=TU_PIXEL_ID&ev=PageView&noscript=1"
```

Si no tienes Meta Pixel, puedes saltarte este paso y agregarlo después.

---

### 5️⃣ Probar en Local (30 min)

```bash
# Terminal 1 - App principal
cd bitcomedia-main-app
npm run dev

# Terminal 2 - Panel admin
cd bitcomedia-web-admin
npm run dev
```

**Pruebas**:
1. Abre `http://localhost:5173`
2. Registra una cuenta
3. Ve al panel admin (puerto 5174)
4. Crea un evento de prueba
5. Compra un ticket con tarjeta de prueba:
   ```
   Número: 5031 7557 3453 0604
   CVV: 123
   Fecha: 12/25
   Nombre: APRO
   ```
6. Verifica que el ticket se creó en Firebase

---

### 6️⃣ Desplegar a Producción (30 min)

```bash
# Seleccionar proyecto
firebase use ticket-colombia-prod

# Desplegar functions
cd bitcomedia-functions
firebase deploy --only functions

# Desplegar app principal
cd ../bitcomedia-main-app
npm run build
firebase deploy --only hosting

# Desplegar admin
cd ../bitcomedia-web-admin
npm run build
firebase deploy --only hosting
```

**URLs generadas**:
- App principal: `https://ticket-colombia-prod.web.app`
- Admin: `https://ticket-colombia-prod.web.app` (mismo dominio)

---

### 7️⃣ Configuración Final (15 min)

1. **Crear usuario admin**:
   - Ir a Firebase Console → Authentication
   - Agregar usuario: `admin@ticketcolombia.com`
   - Copiar el UID generado
   - Ir a Firestore → Colección `users`
   - Crear documento con ese UID:
     ```
     email: admin@ticketcolombia.com
     name: Admin
     role: admin
     createdAt: (timestamp actual)
     ```

2. **Actualizar URLs de redes sociales**:
   - Archivo: `bitcomedia-main-app/src/pages/profile/index.tsx`
   - Cambiar URLs de Instagram y TikTok a las tuyas

3. **Verificar todo funciona**:
   - Iniciar sesión en la app
   - Crear un evento desde admin
   - Hacer una compra de prueba
   - Verificar ticket creado

---

## 🎯 Checklist de Producción

Antes de ir a producción REAL (con dinero):

- [ ] Todas las pruebas funcionan en modo TEST
- [ ] Cuenta de MercadoPago verificada (identidad + banco)
- [ ] Credenciales de PRODUCCIÓN obtenidas de MercadoPago
- [ ] Actualizar `MERCADOPAGO_ACCESS_TOKEN` con credencial de producción
- [ ] Webhook actualizado a modo producción
- [ ] Probar con un pago real pequeño
- [ ] Monitorear logs por 24-48 horas

---

## 📊 Flujo Después del Lanzamiento

### Día a Día
1. **Monitorear ventas**: Firebase Console → Firestore → `tickets`
2. **Ver pagos**: https://www.mercadopago.com.co/balance
3. **Revisar logs**: `firebase functions:log`

### Crear Eventos
1. Ir a `https://ticket-colombia-prod.web.app/dashboard`
2. Iniciar sesión como admin
3. Crear nuevo evento
4. Los usuarios lo verán automáticamente

### Validar Tickets
1. Ir a `https://ticket-colombia-prod.web.app/validar`
2. Escanear código QR del ticket
3. Sistema valida automáticamente

---

## 🆘 ¿Algo no funciona?

### Errores Comunes

**Error: "Firebase config not found"**
- Verifica que actualizaste `firebase-confi.ts` con tus credenciales

**Error: "Payment configuration not set"**
- Verifica que configuraste los secretos de Firebase Functions
- Ejecuta: `firebase functions:secrets:access MERCADOPAGO_ACCESS_TOKEN`

**Los tickets no se crean**
- Revisa logs: `firebase functions:log --only mercadopagoWebhook`
- Verifica que el webhook esté configurado en MercadoPago

**No puedo iniciar sesión como admin**
- Verifica que creaste el documento en Firestore con `role: admin`

---

## 📞 Soporte

- **Firebase**: https://firebase.google.com/support
- **MercadoPago**: https://www.mercadopago.com.co/developers/es/support
- **Documentación completa**: Ver archivos en la raíz del proyecto

---

## 🎉 ¡Listo!

Tu plataforma **Ticket Colombia** está funcionando. 

**Próximos pasos recomendados**:
1. Personalizar el logo (reemplazar archivos en `assets/`)
2. Configurar dominio personalizado (ej: `ticketcolombia.com`)
3. Agregar más métodos de pago si es necesario
4. Configurar respaldos automáticos de Firestore
5. Monitorear y optimizar según el uso

---

**¡Éxito con tu plataforma! 🚀🎭**

