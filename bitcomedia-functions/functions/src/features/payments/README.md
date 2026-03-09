# 💳 Módulo de Pagos - MercadoPago Integration

## 📋 Descripción

Módulo completo para el manejo de pagos con MercadoPago en Ticket Colombia, implementado siguiendo la arquitectura limpia y las mejores prácticas de la documentación oficial de MercadoPago.

## 🏗️ Arquitectura

```
payments/
├── types.ts                    # Interfaces y tipos TypeScript
├── services/                   # Lógica de negocio
│   └── payment.service.ts
├── repositories/               # Acceso a datos
│   └── firestore-ticket.repository.ts
├── handlers/                   # Proveedores externos
│   ├── mercadopago.provider.ts
│   └── qr-generator.ts
├── factories/                  # Creación de instancias
│   └── payment-service.factory.ts
├── index.ts                   # Exportaciones públicas
└── README.md                  # Documentación
```

## ✨ Características Principales

### 🔄 Manejo Completo de Webhooks
- **Formato Webhook estándar**: `type` + `data.id`
- **Formato IPN alternativo**: `topic` + `resource` URL
- **Validación de firmas**: Seguridad con HMAC SHA256
- **Manejo de merchant_order**: Procesamiento completo de órdenes comerciales
- **Respuestas HTTP correctas**: Siempre 200 OK según documentación

### 🎫 Gestión de Tickets
- Creación de tickets con estado "reserved"
- **Manejo de cantidad**: Soporte para múltiples tickets en una sola compra
- Actualización automática según estado del pago
- Generación de códigos QR para tickets pagados
- Integración completa con Firestore
- **Validaciones**: Cantidad mínima 1 ticket por compra

### 🔐 Seguridad
- Validación de firmas de webhook en modo producción
- Manejo seguro de credenciales con Firebase Secrets
- Validación de usuarios autenticados

## 📡 Endpoints Disponibles

### 1. `createTicketPreference`
**Función**: Crear ticket y preferencia de pago
**Tipo**: Cloud Function (onCall)
**Autenticación**: Requerida

```typescript
interface CreateTicketRequest {
  userId: string;
  eventId: string;
  amount: number;
  quantity: number; // Cantidad de tickets/reservas
  buyerEmail: string;
  metadata?: {
    userName?: string;
    eventName?: string;
    seatNumber?: string;
  };
}
```

### 2. `mercadopagoWebhook`
**Función**: Recibir notificaciones de MercadoPago
**Tipo**: Cloud Function (onRequest)
**URL**: `https://REGION-YOUR_PROJECT_ID.cloudfunctions.net/mercadopagoWebhook`

**Formatos soportados**:

#### Webhook estándar:
```json
{
  "action": "payment.updated",
  "api_version": "v1",
  "data": {"id": "112900405622"},
  "date_created": "2025-05-26T19:43:27Z",
  "id": 121590705073,
  "live_mode": true,
  "type": "payment",
  "user_id": "160565084"
}
```

#### IPN alternativo:
```json
{
  "topic": "payment",
  "resource": "https://api.mercadopago.com/v1/payments/112900405622"
}
```

#### Merchant Order:
```json
{
  "topic": "merchant_order",
  "resource": "https://api.mercadopago.com/merchant_orders/31295389308"
}
```

### 3. `testTicketUpdate`
**Función**: Función de prueba para simular actualización de tickets
**Tipo**: Cloud Function (onCall)
**Autenticación**: Requerida

## 🔧 Configuración

### Secretos Requeridos
```bash
# Configurar secretos de Firebase
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
firebase functions:secrets:set APP_URL
```

### Variables de Entorno
- `MERCADOPAGO_ACCESS_TOKEN`: Token de acceso de MercadoPago
- `MERCADOPAGO_WEBHOOK_SECRET`: Secreto para validar webhooks
- `APP_URL`: URL de la aplicación frontend

## 📊 Estados de Ticket

| Estado | Descripción |
|--------|-------------|
| `reserved` | Ticket creado, pago pendiente |
| `paid` | Pago aprobado, ticket válido |
| `cancelled` | Pago rechazado o cancelado |
| `expired` | Ticket expirado |
| `used` | Ticket ya utilizado |

## 🔄 Flujo de Procesamiento

### 1. Creación de Ticket
1. Usuario solicita crear ticket con cantidad específica
2. Se valida autenticación y datos (incluyendo cantidad mínima 1)
3. Se calcula precio unitario: `unitPrice = amount / quantity`
4. Se crea ticket en Firestore con estado "reserved" y cantidad
5. Se crea preferencia en MercadoPago con cantidad y precio unitario
6. Se retorna URL de pago

### 2. Procesamiento de Webhook
1. MercadoPago envía notificación
2. Se valida formato (Webhook o IPN)
3. Se extrae tipo de recurso e ID
4. Se procesa según el tipo:
   - **Payment**: Se obtiene pago y actualiza ticket
   - **Merchant Order**: Se obtiene orden y procesa pagos asociados
5. Se actualiza ticket en Firestore
6. Se genera QR si el pago es aprobado

## 🧪 Testing

### Probar Webhook Localmente
```bash
# Notificación de pago
curl -X POST https://us-central1-bitcomedia-3cbe5.cloudfunctions.net/mercadopagoWebhook \
  -H "Content-Type: application/json" \
  -d '{"action": "payment.updated", "api_version": "v1", "data": {"id": "PAYMENT_ID"}, "date_created": "2025-05-26T19:43:27Z", "id": 121590705073, "live_mode": true, "type": "payment", "user_id": "160565084"}'

# Notificación IPN
curl -X POST https://us-central1-bitcomedia-3cbe5.cloudfunctions.net/mercadopagoWebhook \
  -H "Content-Type: application/json" \
  -d '{"topic": "payment", "resource": "https://api.mercadopago.com/v1/payments/PAYMENT_ID"}'

# Merchant Order
curl -X POST https://us-central1-bitcomedia-3cbe5.cloudfunctions.net/mercadopagoWebhook \
  -H "Content-Type: application/json" \
  -d '{"topic": "merchant_order", "resource": "https://api.mercadopago.com/merchant_orders/ORDER_ID"}'
```

## 📈 Mejoras Implementadas

### ✅ Conformidad con Documentación Oficial
- **Manejo de múltiples formatos**: Webhook estándar e IPN
- **Procesamiento de merchant_order**: Implementación completa
- **Respuestas HTTP correctas**: Siempre 200 OK
- **Consulta de recursos**: Obtención completa de datos desde MercadoPago
- **Validación de firmas**: Implementación según especificación

### ✅ Robustez y Confiabilidad
- **Manejo de errores**: Logging completo sin interrumpir el flujo
- **Reintentos automáticos**: MercadoPago reintenta automáticamente si no recibe 200
- **Validación de datos**: Verificación de formatos y campos requeridos
- **Logging detallado**: Trazabilidad completa del procesamiento

### ✅ Seguridad
- **Validación de firmas**: Solo en modo producción
- **Manejo seguro de secretos**: Firebase Secrets Manager
- **Autenticación**: Verificación de usuarios en funciones protegidas

## 🚀 Despliegue

```bash
# Instalar dependencias
npm install

# Ejecutar linting
npm run lint

# Compilar TypeScript
npm run build

# Desplegar funciones
npm run deploy
```

## 📝 Logs y Monitoreo

```bash
# Ver logs del webhook
firebase functions:log --only mercadopagoWebhook

# Ver logs específicos de un pago
firebase functions:log --only mercadopagoWebhook | grep "PAYMENT_ID"

# Ver logs en tiempo real
firebase functions:log --only mercadopagoWebhook --follow
```

## 🔗 Referencias

- [Documentación Oficial MercadoPago Webhooks](https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks)
- [Firebase Functions](https://firebase.google.com/docs/functions)
- [Firebase Secrets Manager](https://firebase.google.com/docs/functions/config-env#secret-manager) 