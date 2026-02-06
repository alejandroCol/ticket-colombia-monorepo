# 🚀 Guía de Despliegue a Producción

Esta guía te llevará paso a paso para desplegar **Ticket Colombia** a producción en Firebase.

---

## ✅ Pre-requisitos

Antes de comenzar, asegúrate de tener:

- [ ] Node.js 18+ instalado
- [ ] Firebase CLI instalado y configurado
- [ ] Sesión iniciada en Firebase CLI
- [ ] Proyecto Firebase configurado (`ticket-colombia-e6267`)
- [ ] Todas las variables de entorno configuradas
- [ ] Secretos de MercadoPago configurados en Firebase Functions

---

## 📋 Checklist de Configuración

### 1. Verificar Firebase CLI

```bash
# Verificar que estés logueado
firebase login

# Verificar el proyecto actual
firebase use

# Debería mostrar: ticket-colombia-e6267
```

Si no está configurado:
```bash
firebase use ticket-colombia-e6267
```

---

### 2. Verificar Configuración de Firebase

**Archivos a verificar:**

✅ `bitcomedia-main-app/src/services/firebase-confi.ts`
```typescript
export const firebaseConfig = {
  apiKey: "AIzaSyBGPIYymGz1jivYSDUIgt4qEUdAcakV9Gc",
  authDomain: "ticket-colombia-e6267.firebaseapp.com",
  projectId: "ticket-colombia-e6267",
  storageBucket: "ticket-colombia-e6267.firebasestorage.app",
  messagingSenderId: "471822308411",
  appId: "1:471822308411:web:486cb6a36d07e2872af81e",
  measurementId: "G-7ZT81KFG4P"
};
```

✅ `bitcomedia-web-admin/src/services/firebase-confi.ts` (mismo config)

✅ `.firebaserc` en cada carpeta:
```json
{
  "projects": {
    "default": "ticket-colombia-e6267"
  }
}
```

---

### 3. Verificar Secretos de MercadoPago

**IMPORTANTE**: Las credenciales de MercadoPago deben estar en Firebase Secrets, NO en el código.

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions

# Verificar secretos existentes
firebase functions:secrets:access MERCADOPAGO_ACCESS_TOKEN

# Si no existen, crearlos:
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
# Pega tu Access Token cuando te lo pida

firebase functions:secrets:set MERCADOPAGO_PUBLIC_KEY
# Pega tu Public Key cuando te lo pida
```

**¿Dónde conseguir las credenciales de producción?**
1. Ir a [MercadoPago Developers](https://www.mercadopago.com.co/developers/panel)
2. Seleccionar tu aplicación "Ticket Colombia"
3. Ir a "Credenciales de producción" (NO sandbox)
4. Copiar:
   - `Access Token` → usar para MERCADOPAGO_ACCESS_TOKEN
   - `Public Key` → usar para MERCADOPAGO_PUBLIC_KEY

---

## 🔧 PASO 1: Preparar Firebase Functions

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions

# Instalar dependencias (si no lo has hecho)
npm install

# IMPORTANTE: Compilar TypeScript
cd functions
npm run build

# Volver a la raíz de functions
cd ..
```

**Verificar que se compiló correctamente:**
```bash
ls -la functions/lib/

# Deberías ver archivos .js compilados
```

---

## 🚀 PASO 2: Desplegar Firebase Functions

```bash
# Desde: /Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions

firebase deploy --only functions

# Esto desplegará:
# - createTicketPreference
# - mercadopagoWebhook
# - generateTicketQR (si existe)
```

**Espera a que termine** (puede tomar 3-5 minutos).

**URLs resultantes:**
```
✅ Function URL (createTicketPreference):
   https://us-central1-ticket-colombia-e6267.cloudfunctions.net/createTicketPreference

✅ Function URL (mercadopagoWebhook):
   https://us-central1-ticket-colombia-e6267.cloudfunctions.net/mercadopagoWebhook
```

**⚠️ GUARDA ESTAS URLs** - las necesitarás para configurar MercadoPago.

---

## 📱 PASO 3: Construir y Desplegar App Principal

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-main-app

# Instalar dependencias (si no lo has hecho)
npm install

# Construir para producción
npm run build

# Esto creará una carpeta 'dist' con los archivos optimizados
```

**Verificar que se construyó correctamente:**
```bash
ls -la dist/

# Deberías ver:
# - index.html
# - assets/
# - otros archivos estáticos
```

**Desplegar a Firebase Hosting:**
```bash
firebase deploy --only hosting

# Esto subirá tu app a:
# https://ticket-colombia-e6267.web.app
# o
# https://ticket-colombia-e6267.firebaseapp.com
```

---

## 👨‍💼 PASO 4: Construir y Desplegar Panel Admin

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-web-admin

# Instalar dependencias (si no lo has hecho)
npm install

# Construir para producción
npm run build
```

**Verificar que se construyó correctamente:**
```bash
ls -la dist/
```

**Desplegar a Firebase Hosting:**
```bash
firebase deploy --only hosting

# Esto subirá tu panel admin a:
# https://ticket-colombia-e6267.web.app (si es el único hosting)
```

**⚠️ NOTA IMPORTANTE**: Si tienes dos sitios de hosting configurados (app y admin), necesitas especificar cuál:

```bash
# Ver sitios de hosting configurados
firebase hosting:sites:list

# Desplegar a un sitio específico
firebase deploy --only hosting:NOMBRE_DEL_SITIO
```

---

## 🔐 PASO 5: Desplegar Reglas de Seguridad

### Firestore Rules

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-web-admin

firebase deploy --only firestore:rules
```

### Storage Rules

```bash
firebase deploy --only storage
```

### Indexes de Firestore

```bash
firebase deploy --only firestore:indexes
```

**O todo junto:**
```bash
firebase deploy --only firestore,storage
```

---

## 🌐 PASO 6: Configurar Webhook de MercadoPago

Ahora que tienes las URLs de producción, configura el webhook en MercadoPago:

1. Ir a [MercadoPago Developers](https://www.mercadopago.com.co/developers/panel)
2. Seleccionar "Ticket Colombia"
3. Ir a "Webhooks"
4. Agregar nuevo webhook:
   - **URL**: `https://us-central1-ticket-colombia-e6267.cloudfunctions.net/mercadopagoWebhook`
   - **Eventos**: Seleccionar "payment"
5. Guardar

---

## ✅ PASO 7: Verificar el Despliegue

### 7.1 Verificar Firebase Functions

```bash
# Ver logs de las functions
firebase functions:log

# Probar una función específica
curl https://us-central1-ticket-colombia-e6267.cloudfunctions.net/createTicketPreference
```

### 7.2 Verificar App Principal

1. Abrir en navegador: `https://ticket-colombia-e6267.web.app`
2. Verificar que:
   - ✅ La página carga correctamente
   - ✅ Los eventos se muestran
   - ✅ Puedes hacer login
   - ✅ Puedes navegar entre páginas

### 7.3 Verificar Panel Admin

1. Abrir en navegador: URL del admin
2. Verificar que:
   - ✅ Puedes hacer login con tu cuenta admin
   - ✅ Puedes ver los eventos
   - ✅ Puedes crear un nuevo evento
   - ✅ Las imágenes se suben correctamente

### 7.4 Verificar Compra de Tickets (IMPORTANTE)

1. En la app principal, seleccionar un evento
2. Hacer clic en "Comprar"
3. Completar el proceso de compra
4. Verificar que:
   - ✅ Se genera el enlace de MercadoPago
   - ✅ Puedes completar el pago (usa tarjetas de prueba)
   - ✅ Recibes el ticket por email (si está configurado)
   - ✅ El ticket aparece en "Mis Tickets"

---

## 🌍 PASO 8: Configurar Dominio Personalizado (ticketcolombia.co)

**📋 GUÍA COMPLETA:** Ver `CONFIGURACION_DOMINIO_GODADDY.md` para instrucciones detalladas.

Tu dominio: `ticketcolombia.co` en GoDaddy

### 8.1 Añadir Dominio en Firebase

```bash
firebase hosting:sites:create NOMBRE_DEL_SITIO

# O desde la consola de Firebase:
# https://console.firebase.google.com/project/ticket-colombia-e6267/hosting/sites
```

### 8.2 Configurar DNS en GoDaddy

**Ver guía completa:** `CONFIGURACION_DOMINIO_GODADDY.md`

**Resumen rápido:**
1. Ir a https://dcc.godaddy.com/
2. Seleccionar `ticketcolombia.co`
3. Click en "Administrar DNS"
4. Agregar registros que Firebase te indique:
   - Tipo A: `@` → IPs de Firebase
   - Tipo A: `admin` → IPs de Firebase  
   - CNAME: `www` → `ticketcolombia.co`
   - TXT: `@` → código de verificación Firebase
5. Guardar y esperar propagación (2-24 horas)

### 8.3 Subdominios Configurados

- `ticketcolombia.co` → App principal (usuarios)
- `admin.ticketcolombia.co` → Panel admin
- `www.ticketcolombia.co` → Redirige a ticketcolombia.co

---

## 📊 PASO 9: Monitoreo y Logs

### Ver Logs en Tiempo Real

```bash
# Logs de Functions
firebase functions:log --follow

# Logs de un período específico
firebase functions:log --limit 100
```

### Dashboard de Firebase

Monitorear desde la consola:
- **Autenticación**: https://console.firebase.google.com/project/ticket-colombia-e6267/authentication/users
- **Firestore**: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore
- **Functions**: https://console.firebase.google.com/project/ticket-colombia-e6267/functions
- **Hosting**: https://console.firebase.google.com/project/ticket-colombia-e6267/hosting

---

## 🔄 Actualizaciones Futuras

Cuando hagas cambios y quieras actualizarlos en producción:

### Solo cambios en el código (frontend)

```bash
cd bitcomedia-main-app  # o bitcomedia-web-admin
npm run build
firebase deploy --only hosting
```

### Solo cambios en Functions

```bash
cd bitcomedia-functions/functions
npm run build
cd ..
firebase deploy --only functions
```

### Cambios en reglas de Firestore/Storage

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### Todo junto

```bash
firebase deploy
```

---

## 🆘 Solución de Problemas

### Problema: "Error: HTTP Error: 403, Permission denied"

**Solución:**
```bash
# Verificar que estás logueado
firebase login --reauth

# Verificar permisos del proyecto
firebase projects:list
```

### Problema: "Functions deployment failed"

**Solución:**
```bash
# Verificar que compiló correctamente
cd bitcomedia-functions/functions
npm run build

# Ver errores específicos
firebase deploy --only functions --debug
```

### Problema: "CORS error en producción"

**Solución:**
Verificar que las URLs permitidas en Firebase Functions incluyen tu dominio de producción.

### Problema: "Webhook de MercadoPago no funciona"

**Solución:**
1. Verificar que la URL del webhook está correcta en MercadoPago
2. Ver logs: `firebase functions:log`
3. Verificar que el secret MERCADOPAGO_ACCESS_TOKEN está configurado

---

## 📝 Checklist Final

Antes de dar por terminado:

- [ ] Firebase Functions desplegadas y funcionando
- [ ] App principal accesible en producción
- [ ] Panel admin accesible en producción
- [ ] Reglas de Firestore desplegadas
- [ ] Reglas de Storage desplegadas
- [ ] Índices de Firestore desplegados
- [ ] Webhook de MercadoPago configurado
- [ ] Credenciales de producción configuradas (no sandbox)
- [ ] Compra de prueba completada exitosamente
- [ ] Email de bienvenida funcionando (si aplica)
- [ ] Favicon actualizado en ambas apps
- [ ] Logo actualizado
- [ ] Meta Pixel configurado (si aplica)
- [ ] Dominio personalizado configurado (si aplica)
- [ ] Monitoreo activo

---

## 🎉 ¡Felicidades!

Tu aplicación **Ticket Colombia** está en producción y lista para recibir usuarios y ventas reales.

### URLs de Producción

📱 **App Principal**: 
- Firebase: `https://ticket-colombia-e6267.web.app`
- **Dominio personalizado**: `https://ticketcolombia.co` ⭐

👨‍💼 **Panel Admin**: 
- Firebase: `https://ticket-colombia-e6267.web.app`
- **Dominio personalizado**: `https://admin.ticketcolombia.co` ⭐

⚡ **API Functions**: `https://us-central1-ticket-colombia-e6267.cloudfunctions.net/`

---

## 📞 Soporte

Si tienes problemas:
1. Revisar logs: `firebase functions:log`
2. Revisar consola de Firebase
3. Verificar la documentación oficial de Firebase
4. Consultar la documentación de MercadoPago

---

**Última actualización**: Octubre 2025  
**Versión**: 1.0.0 - Producción

