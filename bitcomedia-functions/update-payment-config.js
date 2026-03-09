#!/usr/bin/env node

/**
 * Script para actualizar la configuración de pagos en Firestore
 * Cambia la tarifa de servicio de $5,000 fijos a 9% porcentual
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin con el service account
const serviceAccount = require('./ticket-colombia-e6267-firebase-adminsdk-fbsvc-dc603ba774.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updatePaymentConfig() {
  console.log('🔧 Actualizando configuración de pagos...\n');

  try {
    const configRef = db.collection('configurations').doc('payments_config');

    // Crear/actualizar el documento con la nueva configuración
    await configRef.set({
      fees: 9,      // 9% de comisión sobre el subtotal
      taxes: 19,    // 19% IVA (se mantiene igual)
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      notes: 'Tarifa de servicio calculada como porcentaje del subtotal'
    }, { merge: true });

    console.log('✅ Configuración actualizada exitosamente:');
    console.log('   • Tarifa de servicio: 9% del subtotal');
    console.log('   • Impuestos: 19% del subtotal\n');

    // Verificar la actualización
    const docSnapshot = await configRef.get();
    const data = docSnapshot.data();
    
    console.log('📋 Configuración actual en Firestore:');
    console.log('   ', JSON.stringify(data, null, 2));
    console.log('\n✨ ¡Listo! La comisión ahora es del 9% en lugar de $5,000 fijos.\n');

  } catch (error) {
    console.error('❌ Error al actualizar la configuración:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar script
updatePaymentConfig();





