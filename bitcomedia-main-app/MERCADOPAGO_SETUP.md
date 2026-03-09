# Configuración de MercadoPago con Firebase Functions

Este documento explica cómo configurar la integración de MercadoPago con Firebase Functions para el procesamiento de pagos en la aplicación Ticket Colombia.

## Requisitos Previos

1. Cuenta de MercadoPago Developer
2. Firebase Project configurado
3. Firebase CLI instalado
4. Node.js y npm

## Configuración de Firebase Functions

### 1. Inicializar Firebase Functions

```bash
# En el directorio raíz del proyecto
firebase init functions
```

### 2. Instalar dependencias necesarias

```bash
cd functions
npm install mercadopago cors
```

### 3. Configurar variables de entorno

```bash
# Configurar las credenciales de MercadoPago
firebase functions:config:set mercadopago.access_token="YOUR_ACCESS_TOKEN"
firebase functions:config:set mercadopago.public_key="YOUR_PUBLIC_KEY"
```

### 4. Crear la función createTicketPreference

Crear el archivo `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import * as cors from 'cors';

// Inicializar Firebase Admin
admin.initializeApp();

// Configurar CORS
const corsHandler = cors({ origin: true });

// Configurar MercadoPago
const client = new MercadoPagoConfig({
  accessToken: functions.config().mercadopago.access_token,
});

const preference = new Preference(client);

export const createTicketPreference = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario debe estar autenticado');
  }

  try {
    const { userId, eventId, amount, quantity, buyerEmail, metadata } = data;

    // Validar datos requeridos
    if (!userId || !eventId || !amount || !quantity || !buyerEmail) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos requeridos faltantes');
    }

    // Crear preferencia de MercadoPago
    const preferenceData = {
      items: [
        {
          id: eventId,
          title: metadata.eventName,
          description: `Entrada para ${metadata.eventName} - ${metadata.eventDate} ${metadata.eventTime}`,
          quantity: quantity,
          unit_price: amount / quantity,
          currency_id: 'COP'
        }
      ],
      payer: {
        email: buyerEmail,
        name: metadata.userName
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/payment/success`,
        failure: `${process.env.FRONTEND_URL}/payment/failure`,
        pending: `${process.env.FRONTEND_URL}/payment/pending`
      },
      auto_return: 'approved',
      notification_url: `${process.env.FUNCTIONS_URL}/paymentNotification`,
      metadata: {
        userId,
        eventId,
        eventName: metadata.eventName,
        eventDate: metadata.eventDate,
        eventTime: metadata.eventTime,
        venue: metadata.venue,
        city: metadata.city,
        quantity
      }
    };

    const response = await preference.create({ body: preferenceData });

    // Guardar información del ticket en Firestore
    await admin.firestore().collection('tickets').add({
      userId,
      eventId,
      amount,
      quantity,
      buyerEmail,
      metadata,
      preferenceId: response.id,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    };

  } catch (error) {
    console.error('Error creando preferencia:', error);
    throw new functions.https.HttpsError('internal', 'Error interno del servidor');
  }
});

// Función para manejar notificaciones de pago
export const paymentNotification = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { type, data } = req.body;

      if (type === 'payment') {
        const paymentId = data.id;
        
        // Aquí puedes procesar la notificación de pago
        // Actualizar el estado del ticket en Firestore
        // Enviar confirmación por email, etc.
        
        console.log('Payment notification received:', paymentId);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing payment notification:', error);
      res.status(500).send('Error');
    }
  });
});
```

### 5. Configurar variables de entorno adicionales

```bash
# URL del frontend para redirecciones
firebase functions:config:set app.frontend_url="https://your-app-domain.com"

# URL de las functions para notificaciones
firebase functions:config:set app.functions_url="https://your-region-your-project.cloudfunctions.net"
```

### 6. Desplegar las funciones

```bash
firebase deploy --only functions
```

## Configuración en el Frontend

### 1. Verificar que Firebase Functions esté configurado

El archivo `src/services/firebase.ts` ya debe tener la configuración de Firebase. Asegúrate de que incluya:

```typescript
import { getFunctions } from 'firebase/functions';

const functions = getFunctions(app);
```

### 2. Usar el servicio de tickets

El servicio ya está implementado en `src/services/ticketService.ts` y se puede usar así:

```typescript
import { createTicket } from '../services';

const ticketData = {
  userId: user.uid,
  eventId: event.id,
  amount: totalAmount,
  quantity: ticketQuantity,
  buyerEmail: user.email,
  metadata: {
    userName: user.name,
    eventName: event.name,
    eventDate: event.date,
    eventTime: event.time,
    venue: event.venue?.name,
    city: event.city
  }
};

const result = await createTicket(ticketData);
window.location.href = result.initPoint;
```

## Configuración de MercadoPago

### 1. Crear cuenta de desarrollador

1. Ve a [MercadoPago Developers](https://www.mercadopago.com/developers)
2. Crea una cuenta o inicia sesión
3. Crea una nueva aplicación

### 2. Obtener credenciales

1. En el panel de desarrollador, ve a "Credenciales"
2. Copia el Access Token y Public Key
3. Para pruebas, usa las credenciales de Sandbox

### 3. Configurar Webhook (opcional)

1. En el panel de MercadoPago, ve a "Webhooks"
2. Agrega la URL de tu función: `https://your-region-your-project.cloudfunctions.net/paymentNotification`
3. Selecciona los eventos de pago que quieres recibir

## Testing

### 1. Usar credenciales de Sandbox

Para pruebas, asegúrate de usar las credenciales de Sandbox de MercadoPago.

### 2. Tarjetas de prueba

MercadoPago proporciona tarjetas de prueba para diferentes escenarios:

- **Visa aprobada**: 4509 9535 6623 3704
- **Mastercard aprobada**: 5031 7557 3453 0604
- **Visa rechazada**: 4000 0000 0000 0002

## Seguridad

1. **Nunca** expongas las credenciales de MercadoPago en el frontend
2. Todas las operaciones críticas deben hacerse en Firebase Functions
3. Valida siempre los datos en el backend
4. Implementa rate limiting para prevenir abuso
5. Usa HTTPS en todas las comunicaciones

## Troubleshooting

### Error: "Usuario debe estar autenticado"
- Verifica que el usuario esté logueado antes de llamar la función
- Asegúrate de que el token de autenticación sea válido

### Error: "Datos requeridos faltantes"
- Verifica que todos los campos requeridos estén presentes en `ticketData`
- Revisa la estructura de datos en `TicketData` interface

### Error de CORS
- Asegúrate de que CORS esté configurado correctamente en las Functions
- Verifica que el dominio del frontend esté permitido

### Pagos no se procesan
- Verifica las credenciales de MercadoPago
- Revisa los logs de Firebase Functions
- Asegúrate de que el webhook esté configurado correctamente 