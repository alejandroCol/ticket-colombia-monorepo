#!/usr/bin/env node

/**
 * Script para crear 3 eventos por defecto de Colombia (para que el marketplace no se vea vacío).
 * Ejecutar desde: bitcomedia-functions/
 * Comando: node seed-default-events.js
 *
 * Requiere: Firebase Admin SDK y el archivo de cuenta de servicio.
 * Si no tienes organizer_id, deja ORGANIZER_ID como '' (algunos proyectos lo permiten).
 */

const admin = require('firebase-admin');

const path = require('path');

// Intentar cargar cuenta de servicio (mismo archivo que create-test-data.js)
const serviceAccountPath = path.join(__dirname, 'ticket-colombia-e6267-firebase-adminsdk-fbsvc-dc603ba774.json');
let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (e) {
  console.error('❌ No se encontró el archivo de cuenta de servicio.');
  console.error('   Coloca tu JSON de Firebase Admin en:', serviceAccountPath);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Mismo UID que en create-test-data.js para asociar eventos a un admin existente
const ORGANIZER_ID = process.env.ADMIN_UID || 'MWIEWM7bO8abf9GxUK0OJQo5IQN2';

function buildEvent({ name, description, city, venueName, venueAddress, coverImageUrl, ticketPrice, daysFromNow, time, slugSuffix }) {
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + daysFromNow);
  eventDate.setHours(parseInt(time, 10), parseInt((time.split(':')[1] || '0'), 10), 0, 0);

  const dateString = eventDate.toISOString().split('T')[0];

  return {
    name,
    description,
    city,
    venue: {
      name: venueName,
      address: venueAddress,
    },
    event_type: 'bitcomedia_direct',
    external_url: '',
    cover_image_url: coverImageUrl,
    capacity_per_occurrence: 200,
    ticket_price: ticketPrice,
    status: 'active',
    organizer_id: ORGANIZER_ID,
    slug: slugSuffix ? `${slugSuffix}-${dateString}` : `evento-${dateString}-${Date.now()}`,
    creation_date: admin.firestore.Timestamp.now(),
    event_date: admin.firestore.Timestamp.fromDate(eventDate),
    date: dateString,
    time,
  };
}

const DEFAULT_EVENTS = [
  buildEvent({
    name: 'Stand Up Comedy Night – Bogotá',
    description: 'Una noche de risas con los mejores comediantes en vivo. Teatro, humor y buena energía en el corazón de la capital.',
    city: 'Bogotá',
    venueName: 'Teatro Colón',
    venueAddress: 'Calle 10 # 5-32, La Candelaria',
    coverImageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800',
    ticketPrice: 35000,
    daysFromNow: 7,
    time: '20:00',
    slugSuffix: 'stand-up-comedy-bogota',
  }),
  buildEvent({
    name: 'Noche de Música en Vivo – Medellín',
    description: 'Concierto acústico y bandas locales. Un plan perfecto para disfrutar del ritmo de la ciudad.',
    city: 'Medellín',
    venueName: 'Casa del Teatro',
    venueAddress: 'Carrera 42 # 52-20, Poblado',
    coverImageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    ticketPrice: 45000,
    daysFromNow: 14,
    time: '19:30',
    slugSuffix: 'musica-vivo-medellin',
  }),
  buildEvent({
    name: 'Festival de Cultura y Sabor – Cali',
    description: 'Música, danza y gastronomía en un solo lugar. Celebra la diversidad de la capital mundial de la salsa.',
    city: 'Cali',
    venueName: 'Plaza de Toros Cañaveralejo',
    venueAddress: 'Carrera 36 # 5-100',
    coverImageUrl: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800',
    ticketPrice: 55000,
    daysFromNow: 21,
    time: '18:00',
    slugSuffix: 'festival-cultura-cali',
  }),
];

async function seedDefaultEvents() {
  console.log('\n🇨🇴 Creando 3 eventos por defecto de Colombia...\n');

  try {
    const batch = db.batch();
    const refs = [];

    for (const eventData of DEFAULT_EVENTS) {
      const ref = db.collection('events').doc();
      batch.set(ref, eventData);
      refs.push({ id: ref.id, name: eventData.name });
    }

    await batch.commit();

    console.log('✅ Eventos creados:\n');
    refs.forEach((r, i) => console.log(`   ${i + 1}. ${r.name} (${r.id})`));
    console.log('\n💡 Abre tu app principal para ver los eventos en el marketplace.\n');
  } catch (error) {
    console.error('\n❌ Error creando eventos:', error.message);
    throw error;
  } finally {
    process.exit(0);
  }
}

seedDefaultEvents();
