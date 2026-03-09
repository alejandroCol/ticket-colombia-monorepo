#!/usr/bin/env node

/**
 * Script para crear datos de prueba en Firestore
 * Ejecutar desde: bitcomedia-functions/
 * Comando: node create-test-data.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./ticket-colombia-e6267-firebase-adminsdk-fbsvc-dc603ba774.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// UID del admin (del test que ejecutaste)
const ADMIN_UID = 'MWIEWM7bO8abf9GxUK0OJQo5IQN2';
const ADMIN_EMAIL = 'ale.mar.guz@gmail.com';

async function createTestData() {
  console.log('\n🎯 Creando datos de prueba en Firestore...\n');
  
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
      description: 'Una noche llena de entretenimiento con los mejores artistas. ¡No te lo pierdas!',
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
      single_time: '20:00',
      event_date: admin.firestore.Timestamp.fromDate(eventDate), // Campo usado por el marketplace
      date: eventDate.toISOString().split('T')[0], // Formato string para display
      time: '20:00' // Formato string para display
    });
    console.log(`   ✅ Evento creado: ${eventRef.id}`);
    
    // 3. Crear Evento Recurrente de prueba
    console.log('\n🔄 [3/4] Creando evento recurrente de prueba...');
    const recurringEventRef = await db.collection('recurring_events').add({
      name: 'Entretenimiento los Viernes',
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
      slug: `entretenimiento-viernes-${occurrenceDate.toISOString().split('T')[0]}`
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
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ ERROR creando datos:', error);
    console.error('\nDetalles:', error.message);
  } finally {
    process.exit(0);
  }
}

// Ejecutar
createTestData();

