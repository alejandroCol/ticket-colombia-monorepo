/**
 * Script de Inicialización Automática de Firestore
 * Con datos predefinidos para ejecución rápida
 */

const admin = require('firebase-admin');

// Configuración
const CONFIG = {
  adminUid: 'QTKIYhzp04cZ9rVk1IsjL8regYL2',
  adminEmail: 'admin@ticketcolombia.com',
  adminName: 'Admin',
  projectId: 'ticket-colombia-e6267'
};

// Colores
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Inicializar Firebase Admin
admin.initializeApp({
  projectId: CONFIG.projectId
});

const db = admin.firestore();

async function main() {
  log('\n╔══════════════════════════════════════════════════════╗', 'blue');
  log('║  🎭 TICKET COLOMBIA - INICIALIZACIÓN AUTOMÁTICA     ║', 'blue');
  log('╚══════════════════════════════════════════════════════╝', 'blue');
  
  log(`\n📝 Configuración:`, 'blue');
  log(`   Admin UID: ${CONFIG.adminUid}`, 'yellow');
  log(`   Admin Email: ${CONFIG.adminEmail}`, 'yellow');
  log(`   Proyecto: ${CONFIG.projectId}`, 'yellow');

  try {
    // 1. Crear usuario admin
    log('\n📝 Creando usuario admin...', 'blue');
    await db.collection('users').doc(CONFIG.adminUid).set({
      email: CONFIG.adminEmail,
      name: CONFIG.adminName,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true
    });
    log(`✅ Usuario admin creado: ${CONFIG.adminEmail}`, 'green');

    // 2. Crear venues
    log('\n📍 Creando venues de ejemplo...', 'blue');
    const venues = [
      {
        name: 'Teatro Nacional',
        address: 'Calle 71 # 10-25',
        city: 'Bogotá',
        capacity: 300,
        description: 'Teatro principal para eventos culturales',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Centro de Eventos Plaza Mayor',
        address: 'Carrera 48 # 10-30',
        city: 'Medellín',
        capacity: 500,
        description: 'Centro de convenciones y eventos',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Auditorio Principal',
        address: 'Calle 5 # 39-184',
        city: 'Cali',
        capacity: 250,
        description: 'Auditorio para eventos y conferencias',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    const venueIds = [];
    for (const venue of venues) {
      const venueRef = await db.collection('venues').add(venue);
      venueIds.push(venueRef.id);
      log(`✅ Venue creado: ${venue.name} en ${venue.city}`, 'green');
    }

    // 3. Crear evento de ejemplo
    log('\n🎭 Creando evento de ejemplo...', 'blue');
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 30);
    const dateString = futureDate.toISOString().split('T')[0];

    const event = {
      name: 'Noche de Entretenimiento - Evento de Prueba',
      slug: 'noche-entretenimiento-prueba',
      description: 'Este es un evento de prueba creado automáticamente. ¡Ven y disfruta de una noche llena de risas!',
      date: dateString,
      time: '20:00',
      city: 'Bogotá',
      price: 50000,
      capacity: 200,
      ticketsSold: 0,
      venue: db.collection('venues').doc(venueIds[0]),
      image_url: '',
      event_type: 'bitcomedia_direct',
      active: true,
      featured: true,
      categories: ['entretenimiento', 'show en vivo'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('events').add(event);
    log(`✅ Evento creado: ${event.name}`, 'green');
    log(`   📅 Fecha: ${event.date} ${event.time}`, 'yellow');
    log(`   💰 Precio: $${event.price.toLocaleString('es-CO')} COP`, 'yellow');

    log('\n╔══════════════════════════════════════════════════════╗', 'green');
    log('║            ✅ INICIALIZACIÓN COMPLETADA             ║', 'green');
    log('╚══════════════════════════════════════════════════════╝', 'green');
    
    log('\n📋 Resumen:', 'blue');
    log('  ✅ Usuario admin configurado', 'green');
    log('  ✅ 3 Venues creados', 'green');
    log('  ✅ 1 Evento creado', 'green');
    
    log('\n🎯 Próximos pasos:', 'yellow');
    log('  1. Inicia sesión con: admin@ticketcolombia.com', 'yellow');
    log('  2. Ve al dashboard para ver el evento', 'yellow');
    log('  3. Configura MercadoPago para habilitar pagos', 'yellow');
    
    log('\n🌐 Enlaces útiles:', 'blue');
    log(`  - Firestore: https://console.firebase.google.com/project/${CONFIG.projectId}/firestore`, 'blue');
    log(`  - Authentication: https://console.firebase.google.com/project/${CONFIG.projectId}/authentication/users`, 'blue');
    
    process.exit(0);

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();

