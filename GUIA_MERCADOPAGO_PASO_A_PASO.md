# 💳 Guía Paso a Paso: Configurar MercadoPago

## 📋 Índice
1. [Crear Cuenta de Desarrollador](#1-crear-cuenta-de-desarrollador)
2. [Crear Aplicación](#2-crear-aplicación)
3. [Obtener Credenciales](#3-obtener-credenciales)
4. [Configurar en Firebase Functions](#4-configurar-en-firebase-functions)
5. [Configurar Webhooks](#5-configurar-webhooks)
6. [Probar Integración](#6-probar-integración)
7. [Activar Credenciales de Producción](#7-activar-credenciales-de-producción)

---

## 1. Crear Cuenta de Desarrollador

### Paso 1.1: Crear Cuenta de MercadoPago (si no tienes)

1. Ve a: **https://www.mercadopago.com.co/**
2. Haz clic en **"Crear cuenta"**
3. Llena el formulario:
   - Tipo de cuenta: **Particular** o **Empresa** (según tu caso)
   - Email
   - Contraseña
   - Teléfono
4. **Verifica tu email** (revisa tu bandeja de entrada)
5. **Completa la verificación** de identidad:
   - Sube tu cédula (ambos lados)
   - Selfie con tu cédula
   - Información bancaria (para recibir pagos)

⚠️ **IMPORTANTE**: La verificación puede tardar 24-48 horas

### Paso 1.2: Acceder al Portal de Desarrolladores

1. Una vez verificada tu cuenta, ve a: **https://www.mercadopago.com.co/developers**
2. Inicia sesión con tu cuenta de MercadoPago
3. Verás el Dashboard de Desarrolladores

---

## 2. Crear Aplicación

### Paso 2.1: Crear Nueva Aplicación

1. En el Dashboard de Desarrolladores, haz clic en **"Tus aplicaciones"** o **"Your applications"**
2. Haz clic en **"Crear aplicación"** o **"Create application"**

### Paso 2.2: Configurar la Aplicación

1. **Nombre de la aplicación**: `Ticket Colombia`
2. **¿Qué producto vas a integrar?**: 
   - Selecciona: **"Pagos online"** o **"Online payments"**
3. **Modelo de integración**:
   - Selecciona: **"Checkout Pro"** (el más fácil y recomendado)
4. Haz clic en **"Crear aplicación"**

### Paso 2.3: Información Adicional (si se solicita)

Pueden pedirte información adicional:

1. **URL del sitio web**: 
   - Si ya tienes dominio: `https://ticketcolombia.com`
   - Si no: `https://ticket-colombia-main.web.app`

2. **Descripción del negocio**:
   ```
   Plataforma de venta de tickets para eventos de entretenimiento en Colombia
   ```

3. **Volumen estimado de ventas**: 
   - Selecciona el rango apropiado (ej: $1.000.000 - $10.000.000 COP/mes)

4. **Rubro**: Selecciona **"Entretenimiento"** o **"Eventos"**

5. Haz clic en **"Guardar"**

---

## 3. Obtener Credenciales

### Paso 3.1: Credenciales de Prueba (TEST)

Cuando creas la aplicación, primero trabajarás con credenciales de PRUEBA:

1. En el Dashboard, selecciona tu aplicación **"Ticket Colombia"**
2. Ve a **"Credenciales de prueba"** o **"Test credentials"**
3. Verás dos credenciales:

   **Public Key (Clave Pública)**
   ```
   Ejemplo: TEST-xxxxxx-xxxxxx-xxxxxx-xxxxxx
   ```
   
   **Access Token (Token de Acceso)**
   ```
   Ejemplo: TEST-123456789-123456-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-123456789
   ```

4. **COPIA Y GUARDA** estas credenciales en un lugar seguro

⚠️ **IMPORTANTE**: Estas son credenciales de PRUEBA. No cobran dinero real.

### Paso 3.2: ¿Dónde Usar Cada Credencial?

- **Access Token**: Se usa en el BACKEND (Firebase Functions) ✅
- **Public Key**: Se usaría en el frontend (NO en tu caso, porque usas Checkout Pro desde el backend)

---

## 4. Configurar en Firebase Functions

### Paso 4.1: Preparar Firebase Functions

1. Abre tu terminal
2. Ve a la carpeta de functions:

```bash
cd bitcomedia-functions
```

### Paso 4.2: Configurar Firebase CLI (si no lo has hecho)

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Seleccionar proyecto
firebase use ticket-colombia-prod
```

### Paso 4.3: Configurar Secretos

**Secreto 1: Access Token de MercadoPago**

```bash
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
```

Cuando te lo pida, **pega tu Access Token** (el que comienza con TEST- por ahora):
```
TEST-123456789-123456-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-123456789
```

Presiona Enter.

**Secreto 2: Webhook Secret**

Este es un string aleatorio que tú generas para validar webhooks:

Opción A - Generar con OpenSSL (Mac/Linux):
```bash
openssl rand -hex 32
```

Opción B - Generar online:
- Ve a: https://generate-random.org/api-key-generator
- Copia la clave generada

```bash
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
```

Pega el string aleatorio generado:
```
Ejemplo: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Secreto 3: URL de tu App**

```bash
firebase functions:secrets:set APP_URL
```

Por ahora, usa la URL de Firebase Hosting:
```
https://ticket-colombia-prod.web.app
```

(Cuando tengas dominio personalizado, actualízalo a: `https://ticketcolombia.com`)

### Paso 4.4: Verificar Secretos Configurados

```bash
firebase functions:secrets:access MERCADOPAGO_ACCESS_TOKEN
firebase functions:secrets:access MERCADOPAGO_WEBHOOK_SECRET
firebase functions:secrets:access APP_URL
```

Deberías ver los valores que configuraste.

### Paso 4.5: Desplegar Functions

```bash
firebase deploy --only functions
```

⏳ Espera 2-5 minutos mientras se despliegan las funciones.

Al finalizar, verás las URLs de tus funciones:

```
✔ functions[createTicketPreference(us-central1)] deployed
✔ functions[mercadopagoWebhook(us-central1)] deployed

Functions URLs:
• createTicketPreference: https://us-central1-ticket-colombia-prod.cloudfunctions.net/createTicketPreference
• mercadopagoWebhook: https://us-central1-ticket-colombia-prod.cloudfunctions.net/mercadopagoWebhook
```

**COPIA Y GUARDA** la URL del webhook, la necesitarás en el siguiente paso.

---

## 5. Configurar Webhooks

Los webhooks permiten que MercadoPago notifique a tu app cuando se completa un pago.

### Paso 5.1: Acceder a Webhooks

1. En el Dashboard de Desarrolladores de MercadoPago
2. Ve a **"Tu aplicación"** → **"Ticket Colombia"**
3. En el menú lateral, busca **"Webhooks"** o **"Notificaciones"**
4. Haz clic en **"Configurar webhooks"** o **"Configure webhooks"**

### Paso 5.2: Configurar URL del Webhook

1. **URL de notificación**:
   ```
   https://us-central1-ticket-colombia-prod.cloudfunctions.net/mercadopagoWebhook
   ```
   
   ⚠️ Reemplaza `ticket-colombia-prod` con tu ID de proyecto de Firebase

2. **Eventos a recibir**:
   - ✅ **Pagos** (Payments)
   - ✅ **Órdenes comerciales** (Merchant Orders)
   - ❌ Desactiva los demás

3. **Modo**: Selecciona **"Producción"** o **"Sandbox"** según corresponda
   - Por ahora: **"Sandbox"** (para pruebas)

4. Haz clic en **"Guardar"**

### Paso 5.3: Configurar Firma del Webhook (Avanzado)

1. MercadoPago te mostrará un **"Secret"** para validar webhooks
2. **COPIA** ese secret
3. En tu terminal:

```bash
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
```

4. **Pega** el secret que MercadoPago te dio (reemplazará el que generaste antes)
5. **Redespliega** las functions:

```bash
firebase deploy --only functions
```

---

## 6. Probar Integración

### Paso 6.1: Probar desde tu App

1. **Despliega tu aplicación**:

```bash
cd ../bitcomedia-main-app
npm run build
firebase deploy --only hosting
```

2. **Abre tu app**: `https://ticket-colombia-prod.web.app`

3. **Registra un usuario** o inicia sesión

4. **Ve a un evento** y haz clic en **"Comprar"**

5. Deberías ver la página de checkout de MercadoPago

### Paso 6.2: Usar Tarjetas de Prueba

MercadoPago proporciona tarjetas de prueba para diferentes escenarios:

**Tarjeta APROBADA:**
```
Número: 5031 7557 3453 0604
CVV: 123
Fecha: Cualquier fecha futura (ej: 12/25)
Nombre: APRO
```

**Tarjeta RECHAZADA:**
```
Número: 5031 4332 1540 6351
CVV: 123
Fecha: Cualquier fecha futura
Nombre: OTHE
```

**Más tarjetas de prueba:**
https://www.mercadopago.com.co/developers/es/docs/checkout-pro/additional-content/test-cards

### Paso 6.3: Completar una Compra de Prueba

1. En el checkout de MercadoPago, ingresa los datos de la **tarjeta APROBADA**
2. Completa el pago
3. Deberías ser redirigido a la página de éxito
4. **Ve a Firebase Console** → **Firestore** → **Colección "tickets"**
5. Deberías ver un nuevo documento con tu ticket

### Paso 6.4: Verificar Webhook

1. Ve a **Firebase Console** → **Functions** → **Logs**
2. Busca logs de `mercadopagoWebhook`
3. Deberías ver:
   ```
   Webhook received: {...}
   Payment notification received: 123456
   Ticket updated successfully
   ```

Si ves estos logs, ¡el webhook funciona! ✅

---

## 7. Activar Credenciales de Producción

⚠️ **IMPORTANTE**: Solo haz esto cuando estés listo para recibir pagos reales.

### Paso 7.1: Verificar Requisitos

Antes de activar producción, MercadoPago requiere:

1. ✅ Cuenta verificada (identidad + datos bancarios)
2. ✅ Aplicación completamente configurada
3. ✅ Pruebas exitosas en sandbox
4. ✅ Sitio web funcionando

### Paso 7.2: Solicitar Homologación (si es necesario)

Algunos países requieren un proceso de homologación:

1. En el Dashboard, ve a **"Homologación"** o **"Certification"**
2. Sigue los pasos indicados
3. MercadoPago revisará tu integración (puede tardar 1-3 días hábiles)

### Paso 7.3: Obtener Credenciales de Producción

Una vez aprobado:

1. Ve a **"Credenciales de producción"** o **"Production credentials"**
2. Verás tus credenciales REALES:

   **Access Token de Producción**
   ```
   Ejemplo: APP-123456789-123456-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-123456789
   ```
   (Ya NO empieza con TEST-)

3. **COPIA** estas credenciales

### Paso 7.4: Actualizar Secretos en Firebase

```bash
cd bitcomedia-functions

# Actualizar Access Token con el de producción
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
# Pega tu Access Token de PRODUCCIÓN (sin TEST-)
```

### Paso 7.5: Actualizar Webhook

1. Ve a **Webhooks** en MercadoPago
2. Cambia el modo a **"Producción"**
3. Verifica que la URL sea la correcta
4. Guarda

### Paso 7.6: Redesplegar

```bash
firebase deploy --only functions
```

### Paso 7.7: Probar con Pago Real

⚠️ **ATENCIÓN**: Ahora usarás dinero real.

1. Haz una compra pequeña (ej: el mínimo posible)
2. Usa tu tarjeta real
3. Verifica que:
   - El pago se procese
   - El ticket se cree en Firestore
   - Recibas notificaciones
   - El webhook funcione

4. **Verifica en MercadoPago**:
   - Ve a: https://www.mercadopago.com.co/balance
   - Deberías ver el pago recibido (menos comisiones)

---

## 📊 Comisiones de MercadoPago

MercadoPago cobra comisiones por transacción en Colombia:

### Tarjetas de Crédito
- **Nacional**: 3.99% + $900 COP por transacción aprobada
- **Internacional**: 3.99% + $900 COP

### Tarjetas de Débito
- **Nacional**: 2.99% + $900 COP

### PSE (Pagos electrónicos)
- **PSE**: 3.5% + $900 COP

### Corresponsales bancarios
- **Efecty, Baloto, etc**: 3.5% + $900 COP

**Ver tarifas actualizadas**: https://www.mercadopago.com.co/costs-section/costs

### Tu Tarifa de Servicio

Tu app cobra un **5%** adicional (configurable en `Checkout/index.tsx`):

```typescript
const SERVICE_FEE_PERCENTAGE = 0.05; // 5%
```

**Ejemplo de transacción:**
- Precio del ticket: $50.000 COP
- Tarifa de servicio (5%): $2.500 COP
- **Total que paga el cliente**: $52.500 COP

Después MercadoPago cobra su comisión sobre $52.500:
- Comisión MP (3.99%): $2.095 COP
- Tarifa fija MP: $900 COP
- **Total que recibes**: $49.505 COP

---

## 🔒 Seguridad

### ✅ Buenas Prácticas

1. **NUNCA** compartas tu Access Token
2. **NUNCA** lo pongas en el código fuente
3. **USA** Firebase Secrets siempre
4. **ROTA** tus credenciales cada 3-6 meses
5. **MONITOREA** los logs de webhooks regularmente

### 🚨 Señales de Alerta

Si ves alguno de estos eventos, investiga:
- Pagos sin tickets creados
- Tickets sin pagos
- Webhooks fallando repetidamente
- Pagos rechazados en masa

### 📊 Monitorear Transacciones

```bash
# Ver logs de webhooks
firebase functions:log --only mercadopagoWebhook

# Ver logs en tiempo real
firebase functions:log --only mercadopagoWebhook --follow
```

---

## ✅ Verificación Final

### Checklist MercadoPago

- [ ] Cuenta de MercadoPago creada y verificada
- [ ] Aplicación "Ticket Colombia" creada
- [ ] Credenciales de prueba obtenidas
- [ ] Access Token configurado en Firebase Secrets
- [ ] Webhook Secret configurado
- [ ] APP_URL configurada
- [ ] Functions desplegadas
- [ ] Webhook configurado en MercadoPago
- [ ] Pruebas con tarjetas de prueba exitosas
- [ ] Webhook funcionando (verificado en logs)
- [ ] (Opcional) Credenciales de producción activadas

---

## 🆘 Solución de Problemas

### Error: "Payment configuration not properly set"

**Causa**: Los secretos no están configurados

**Solución**:
```bash
firebase functions:secrets:access MERCADOPAGO_ACCESS_TOKEN
firebase functions:secrets:access MERCADOPAGO_WEBHOOK_SECRET
firebase functions:secrets:access APP_URL
```

Si alguno falla, configúralo de nuevo.

### Error: "Webhook signature validation failed"

**Causa**: El webhook secret no coincide

**Solución**:
1. Ve a MercadoPago → Webhooks
2. Copia el secret que MercadoPago muestra
3. Actualiza el secret en Firebase:
   ```bash
   firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
   ```
4. Redespliega: `firebase deploy --only functions`

### Los tickets no se crean después del pago

**Causa**: El webhook no se está ejecutando

**Solución**:
1. Verifica los logs: `firebase functions:log --only mercadopagoWebhook`
2. Verifica que la URL del webhook sea correcta en MercadoPago
3. Prueba el webhook manualmente:
   ```bash
   curl -X POST https://tu-region-tu-proyecto.cloudfunctions.net/mercadopagoWebhook \
     -H "Content-Type: application/json" \
     -d '{"action":"payment.created","data":{"id":"test"}}'
   ```

### No puedo pasar a producción

**Causa**: Falta verificación o requisitos

**Solución**:
1. Asegúrate de que tu cuenta esté 100% verificada
2. Completa todos los datos de tu negocio
3. Realiza al menos 3-5 pruebas exitosas en sandbox
4. Contacta a soporte de MercadoPago si no avanza

---

## 📞 Soporte MercadoPago

### Canales de Soporte

- **Centro de ayuda**: https://www.mercadopago.com.co/developers/es/support
- **Foro de desarrolladores**: https://www.mercadopago.com.co/developers/es/community
- **Email**: developers@mercadopago.com
- **Teléfono Colombia**: 01 8000 417 400

### Documentación Oficial

- **Guía de integración**: https://www.mercadopago.com.co/developers/es/docs
- **Checkout Pro**: https://www.mercadopago.com.co/developers/es/docs/checkout-pro
- **Webhooks**: https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks
- **Tarjetas de prueba**: https://www.mercadopago.com.co/developers/es/docs/checkout-pro/additional-content/test-cards

---

## 🎯 Próximos Pasos

Una vez completado esto:

1. **Prueba todo el flujo de compra** varias veces
2. **Monitorea los logs** los primeros días
3. **Configura alertas** para errores críticos
4. **Documenta** cualquier problema que encuentres
5. **Capacita** a tu equipo en el uso del panel admin

---

✅ **¡MercadoPago configurado correctamente!**

Ahora tienes una plataforma completa de ventas con procesamiento de pagos funcionando.

**Recuerda**: Empieza en modo PRUEBA/SANDBOX y solo cambia a PRODUCCIÓN cuando estés 100% seguro de que todo funciona correctamente.





