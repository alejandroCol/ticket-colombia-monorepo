# 💰 Cambio de Comisión: Tarifa Fija → 9% Porcentual

**Fecha:** 28 de octubre de 2025  
**Estado:** ✅ Completado y Desplegado

---

## 📊 Resumen del Cambio

### Antes
- **Modelo:** Tarifa **fija** por ticket
- **Valor:** $5,000 COP por cada ticket

### Ahora
- **Modelo:** **Porcentaje** sobre el subtotal
- **Valor:** 9% del subtotal (precio × cantidad)

---

## 🔧 Cambios Implementados

### 1. Código Actualizado

| Archivo | Cambio |
|---------|--------|
| `bitcomedia-main-app/src/pages/Checkout/index.tsx` | Lógica de cálculo cambiada a porcentaje |
| `bitcomedia-main-app/src/services/firestore.ts` | Valor por defecto: `9` |
| `bitcomedia-web-admin/src/services/firestore.ts` | Valor por defecto: `9` |

### 2. Base de Datos

**Firestore:** `configurations/payments_config`
```json
{
  "fees": 9,
  "taxes": 19,
  "notes": "Tarifa de servicio calculada como porcentaje del subtotal",
  "updated_at": "2025-10-28"
}
```

### 3. Interfaz de Usuario

- **Checkout:** Ahora muestra "Tarifa de servicio (9%)"
- **WhatsApp:** Desglose de costos incluye el porcentaje
- **Tooltip:** Explicación de la tarifa actualizada

---

## 💰 Fórmulas de Cálculo

```javascript
// 1. Subtotal
subtotal = precio_ticket × cantidad

// 2. Impuestos (19% del subtotal)
impuestos = Math.round(subtotal × 0.19)

// 3. Tarifa de Servicio (9% del subtotal)
tarifa = Math.round(subtotal × 0.09)

// 4. Total Final
total = subtotal + impuestos + tarifa
```

---

## 📈 Ejemplos Comparativos

### Ejemplo 1: Ticket de $30,000

| Concepto | Tarifa Fija (Antes) | 9% Porcentual (Ahora) | Diferencia |
|----------|---------------------|----------------------|------------|
| Subtotal | $30,000 | $30,000 | - |
| Impuestos (19%) | $5,700 | $5,700 | - |
| Tarifa servicio | $5,000 | $2,700 | -$2,300 👍 |
| **TOTAL** | **$40,700** | **$38,400** | **-$2,300** |

### Ejemplo 2: Ticket de $50,000

| Concepto | Tarifa Fija (Antes) | 9% Porcentual (Ahora) | Diferencia |
|----------|---------------------|----------------------|------------|
| Subtotal | $50,000 | $50,000 | - |
| Impuestos (19%) | $9,500 | $9,500 | - |
| Tarifa servicio | $5,000 | $4,500 | -$500 👍 |
| **TOTAL** | **$64,500** | **$64,000** | **-$500** |

### Ejemplo 3: Ticket de $80,000 × 2

| Concepto | Tarifa Fija (Antes) | 9% Porcentual (Ahora) | Diferencia |
|----------|---------------------|----------------------|------------|
| Subtotal | $160,000 | $160,000 | - |
| Impuestos (19%) | $30,400 | $30,400 | - |
| Tarifa servicio | $10,000 | $14,400 | +$4,400 |
| **TOTAL** | **$200,400** | **$204,800** | **+$4,400** |

### Ejemplo 4: Ticket de $100,000 × 3

| Concepto | Tarifa Fija (Antes) | 9% Porcentual (Ahora) | Diferencia |
|----------|---------------------|----------------------|------------|
| Subtotal | $300,000 | $300,000 | - |
| Impuestos (19%) | $57,000 | $57,000 | - |
| Tarifa servicio | $15,000 | $27,000 | +$12,000 |
| **TOTAL** | **$372,000** | **$384,000** | **+$12,000** |

---

## 💡 Análisis de Impacto

### ✅ Beneficio para Tickets Económicos (< $55,556)

Con el nuevo modelo porcentual:
- **Tickets baratos son más atractivos** para los compradores
- La comisión es **proporcional al precio** del evento

**Punto de equilibrio:** 
- $5,000 = subtotal × 9%
- subtotal = $5,000 / 0.09 = **$55,556**

| Rango de Precio | Impacto | ¿Quién se beneficia? |
|-----------------|---------|----------------------|
| Menos de $55,556 | Comisión **menor** | 👥 Compradores |
| Exactamente $55,556 | Comisión **igual** | - |
| Más de $55,556 | Comisión **mayor** | 💰 Plataforma |

---

## 🔄 Cómo Cambiar el Porcentaje

### Método 1: Firestore Console (Manual)

1. Ir a: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore
2. Navegar a: `configurations` → `payments_config`
3. Editar campo `fees`: cambiar `9` al porcentaje deseado
4. Guardar

**Cambio toma efecto:** Inmediatamente (sin necesidad de redesplegar)

### Método 2: Script Automatizado

```bash
# 1. Editar el script
nano /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions/update-payment-config.js

# 2. Cambiar la línea:
fees: 9,  // Cambiar a 10, 8, etc.

# 3. Ejecutar
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions
node update-payment-config.js
```

---

## 🚀 URLs de Producción

| App | URL |
|-----|-----|
| **App Principal** | https://ticket-colombia-e6267.web.app |
| **Panel Admin** | https://admin-ticket-colombia.web.app |
| **Firestore Console** | https://console.firebase.google.com/project/ticket-colombia-e6267/firestore |

---

## ✅ Verificación

Para confirmar que el cambio está activo:

1. **Abrir la app principal**
2. **Seleccionar cualquier evento con precio**
3. **Ir al checkout**
4. **Verificar:**
   - Label dice: "Tarifa de servicio (9%)"
   - Monto calculado es el 9% del subtotal

---

## 🔧 Mantenimiento

### Si Necesitas Volver a Tarifa Fija

1. **Editar código en:**
   - `bitcomedia-main-app/src/pages/Checkout/index.tsx`
   
2. **Cambiar la función `calculateFees()`:**

```typescript
// De porcentaje:
const calculateFees = () => {
  const subtotal = calculateSubtotal();
  return Math.round(subtotal * (paymentConfig.fees / 100));
};

// A tarifa fija:
const calculateFees = () => {
  return paymentConfig.fees * quantity;
};
```

3. **Actualizar Firestore:**
   - Cambiar `fees: 9` a `fees: 5000`

4. **Redesplegar:**
```bash
cd bitcomedia-main-app
npm run build
firebase deploy --only hosting
```

---

## 📞 Soporte

Si tienes dudas o necesitas ajustar el porcentaje:
1. Edita el documento en Firestore (cambio inmediato)
2. O ejecuta el script `update-payment-config.js`

**No se requiere redespliegue** para cambios en el porcentaje, solo para cambios en el código.

---

**Última actualización:** 28 de octubre de 2025





