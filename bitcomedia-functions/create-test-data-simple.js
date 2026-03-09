#!/usr/bin/env node

/**
 * Script SIMPLIFICADO para crear datos de prueba en Firestore
 * NO requiere serviceAccountKey.json
 * Usa Firebase CLI que ya está autenticado
 * 
 * Ejecutar: node create-test-data-simple.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin SIN serviceAccount
// Esto usa la autenticación de Firebase CLI
try {
  admin.initializeApp({
    projectId: 'ticket-colombia-e6267'
  });
  console.log('✅ Firebase inicializado correctamente\n');
} catch (error) {
  console.error('❌ Error inicializando Firebase:', error.message);
  console.log('\n💡 Asegúrate de estar logueado en Firebase CLI:');
  console.log('   firebase login\n');
  process.exit(1);
}

const db = admin.firestore();

// UID del admin (del test que ejecutaste)
const ADMIN_UID = 'MWIEWM7bO8abf9GxUK0OJQo5IQN2';
const ADMIN_EMAIL = 'ale.mar.guz@gmail.com';

async function createTestData() {
  console.log('🎯 Creando datos de prueba en Firestore...\n');
  
  try {
    // 1. Crear Venue de prueba
    console.log('📍 [1/4] Creando venue de prueba...');
    const venueRef = await db.collection('venues').add({
      name: 'Teatro Colón',
      address: 'Calle 10 # 5-32, Bogotá',
      city: 'Bogotá',
      capacity: 500,
      description: 'Teatro histórico en el centro de Bogotá',
      creation_date: admin.firestore.Timestamp.now(),
      organizer_id: ADMIN_UID
    });
    console.log(`   ✅ Venue creado: ${venueRef.id}`);
    
    // 2. Crear Evento de prueba (standalone)
    console.log('\n🎭 [2/4] Creando evento de prueba...');
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 7); // Evento en 7 días
    
    const eventRef = await db.collection('events').add({
      name: 'Stand Up Comedy Night',
      description: 'Una noche llena de risas con los mejores comediantes de Colombia. ¡No te lo pierdas!',
      city: 'Bogotá',
      venue: {
        name: 'Teatro Colón',
        address: 'Calle 10 # 5-32, Bogotá'
      },
      event_type: 'bitcomedia_direct',
      external_url: '',
      cover_image_url: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800',
      capacity_per_occurrence: 200,
      ticket_price: 35000,
      status: 'active',
      organizer_id: ADMIN_UID,
      slug: `stand-up-comedy-night-${eventDate.toISOString().split('T')[0]}`,
      creation_date: admin.firestore.Timestamp.now(),
      single_date: admin.firestore.Timestamp.fromDate(eventDate),
      single_time: '20:00'
    });
    console.log(`   ✅ Evento creado: ${eventRef.id}`);
    
    // 3. Crear Evento Recurrente de prueba
    console.log('\n🔄 [3/4] Creando evento recurrente de prueba...');
    const recurringEventRef = await db.collection('recurring_events').add({
      name: 'Comedia los Viernes',
      description: 'Todos los viernes, las mejores risas de la ciudad. Un clásico que no te puedes perder.',
      city: 'Bogotá',
      venue: {
        name: 'Teatro Colón',
        address: 'Calle 10 # 5-32, Bogotá'
      },
      event_type: 'bitcomedia_direct',
      external_url: '',
      cover_image_url: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800',
      capacity_per_occurrence: 150,
      ticket_price: 30000,
      status: 'active',
      organizer_id: ADMIN_UID,
      creation_date: admin.firestore.Timestamp.now(),
      recurrence: {
        type: 'weekly',
        days_of_week: ['viernes'],
        time: '21:00'
      }
    });
    console.log(`   ✅ Evento recurrente creado: ${recurringEventRef.id}`);
    
    // 4. Crear una Occurrence de prueba para el evento recurrente
    console.log('\n📅 [4/4] Creando occurrence de prueba...');
    const occurrenceDate = new Date();
    // Buscar el próximo viernes
    const daysUntilFriday = (5 - occurrenceDate.getDay() + 7) % 7 || 7;
    occurrenceDate.setDate(occurrenceDate.getDate() + daysUntilFriday);
    
    const occurrenceRef = await db.collection('occurrences').add({
      recurring_event_id: recurringEventRef.id,
      date: admin.firestore.Timestamp.fromDate(occurrenceDate),
      time: '21:00',
      available_capacity: 150,
      status: 'active',
      slug: `comedia-los-viernes-${occurrenceDate.toISOString().split('T')[0]}`
    });
    console.log(`   ✅ Occurrence creada: ${occurrenceRef.id}`);
    
    // Resumen
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ DATOS DE PRUEBA CREADOS EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n📊 Resumen:`);
    console.log(`   - 1 Venue (${venueRef.id})`);
    console.log(`   - 1 Evento standalone (${eventRef.id})`);
    console.log(`   - 1 Evento recurrente (${recurringEventRef.id})`);
    console.log(`   - 1 Occurrence (${occurrenceRef.id})`);
    console.log(`\n🌐 URLs para acceder:`);
    console.log(`   - Admin Dashboard: http://localhost:5173/dashboard`);
    console.log(`   - App Principal: http://localhost:5174/`);
    console.log(`\n💡 Todos los eventos están asociados a tu usuario admin:`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   UID: ${ADMIN_UID}`);
    console.log('\n🎉 Ya puedes recargar la página y ver los eventos!\n');
    
  } catch (error) {
    console.error('\n❌ ERROR creando datos:', error);
    console.error('\nDetalles:', error.message);
    
    if (error.code === 'app/invalid-credential') {
      console.log('\n💡 Solución:');
      console.log('   1. Ve a: https://console.firebase.google.com/project/ticket-colombia-e6267/settings/serviceaccounts/adminsdk');
      console.log('   2. Descarga el Service Account Key');
      console.log('   3. Guárdalo como: serviceAccountKey.json');
      console.log('   4. Usa el otro script: node create-test-data.js\n');
    }
  } finally {
    process.exit(0);
  }
}

// Ejecutar
createTestData();





