/**
 * Script de Inicialización de Firestore para Ticket Colombia
 * 
 * Este script crea las colecciones necesarias y datos de ejemplo
 * 
 * USO:
 * 1. Asegúrate de tener el proyecto seleccionado: firebase use ticket-colombia-e6267
 * 2. Ejecuta: node init-firestore.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Inicializar Firebase Admin
admin.initializeApp({
  projectId: 'ticket-colombia-e6267'
});

const db = admin.firestore();

// Interfaz para input del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función auxiliar para preguntar
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Colores para la consola
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

/**
 * Crear usuario admin en Firestore
 */
async function createAdminUser(userId, email, name) {
  log('\n📝 Creando usuario admin...', 'blue');
  
  try {
    await db.collection('users').doc(userId).set({
      email: email,
      name: name,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true
    });
    
    log(`✅ Usuario admin creado: ${email}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error creando usuario admin: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Crear venue de ejemplo
 */
async function createExampleVenue() {
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

  try {
    const venueIds = [];
    for (const venue of venues) {
      const venueRef = await db.collection('venues').add(venue);
      venueIds.push(venueRef.id);
      log(`✅ Venue creado: ${venue.name} en ${venue.city}`, 'green');
    }
    return venueIds;
  } catch (error) {
    log(`❌ Error creando venues: ${error.message}`, 'red');
    return [];
  }
}

/**
 * Crear evento de ejemplo
 */
async function createExampleEvent(venueId) {
  log('\n🎭 Creando evento de ejemplo...', 'blue');
  
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + 30); // Evento en 30 días
  
  const dateString = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
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
    venue: venueId ? db.collection('venues').doc(venueId) : null,
    image_url: '',
    event_type: 'bitcomedia_direct',
    active: true,
    featured: true,
    categories: ['entretenimiento', 'show en vivo'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    const eventRef = await db.collection('events').add(event);
    log(`✅ Evento creado: ${event.name}`, 'green');
    log(`   📅 Fecha: ${event.date} ${event.time}`, 'yellow');
    log(`   💰 Precio: $${event.price.toLocaleString('es-CO')} COP`, 'yellow');
    return eventRef.id;
  } catch (error) {
    log(`❌ Error creando evento: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Crear colección vacía (con un documento temporal que luego se elimina)
 */
async function createEmptyCollection(collectionName) {
  try {
    const tempRef = await db.collection(collectionName).add({
      _temp: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Eliminar el documento temporal
    await tempRef.delete();
    
    log(`✅ Colección creada: ${collectionName}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error creando colección ${collectionName}: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Verificar si una colección existe y tiene documentos
 */
async function collectionExists(collectionName) {
  const snapshot = await db.collection(collectionName).limit(1).get();
  return !snapshot.empty;
}

/**
 * Función principal
 */
async function main() {
  log('\n╔══════════════════════════════════════════════════════╗', 'blue');
  log('║  🎭 TICKET COLOMBIA - INICIALIZACIÓN DE FIRESTORE  ║', 'blue');
  log('╚══════════════════════════════════════════════════════╝', 'blue');
  
  log('\nEste script inicializará tu base de datos con:', 'yellow');
  log('  ✅ Colecciones necesarias', 'yellow');
  log('  ✅ Usuario administrador', 'yellow');
  log('  ✅ Venues de ejemplo', 'yellow');
  log('  ✅ Evento de ejemplo', 'yellow');
  
  const proceed = await question('\n¿Deseas continuar? (si/no): ');
  
  if (proceed.toLowerCase() !== 'si' && proceed.toLowerCase() !== 's') {
    log('\n❌ Operación cancelada', 'red');
    rl.close();
    return;
  }

  // Verificar si ya existen datos
  log('\n🔍 Verificando estado actual de Firestore...', 'blue');
  
  const hasUsers = await collectionExists('users');
  const hasEvents = await collectionExists('events');
  const hasVenues = await collectionExists('venues');
  
  if (hasUsers || hasEvents || hasVenues) {
    log('\n⚠️  ADVERTENCIA: Ya existen algunas colecciones con datos:', 'yellow');
    if (hasUsers) log('   - users', 'yellow');
    if (hasEvents) log('   - events', 'yellow');
    if (hasVenues) log('   - venues', 'yellow');
    
    const overwrite = await question('\n¿Deseas continuar de todas formas? (si/no): ');
    if (overwrite.toLowerCase() !== 'si' && overwrite.toLowerCase() !== 's') {
      log('\n❌ Operación cancelada', 'red');
      rl.close();
      return;
    }
  }

  // Solicitar datos del admin
  log('\n👤 Datos del Usuario Administrador:', 'blue');
  log('⚠️  IMPORTANTE: Primero crea este usuario en Authentication', 'yellow');
  log('   Firebase Console → Authentication → Add user', 'yellow');
  
  const adminUid = await question('\nIngresa el UID del usuario admin (copiado de Authentication): ');
  
  if (!adminUid || adminUid.trim().length < 10) {
    log('\n❌ UID inválido. Debes crear el usuario primero en Authentication', 'red');
    rl.close();
    return;
  }
  
  const adminEmail = await question('Ingresa el email del admin (el mismo que usaste en Authentication): ');
  const adminName = await question('Ingresa el nombre del admin: ');

  log('\n🚀 Iniciando proceso de inicialización...', 'blue');

  // 1. Crear usuario admin
  await createAdminUser(adminUid.trim(), adminEmail.trim(), adminName.trim());

  // 2. Crear venues de ejemplo
  const venueIds = await createExampleVenue();
  
  // 3. Crear evento de ejemplo
  if (venueIds.length > 0) {
    await createExampleEvent(venueIds[0]);
  } else {
    await createExampleEvent(null);
  }

  // 4. Crear colecciones vacías (para que aparezcan en Firestore)
  log('\n📦 Creando colecciones adicionales...', 'blue');
  
  // La colección tickets se creará automáticamente con las compras
  // La colección recurring_events se creará automáticamente si se usan
  
  log('\n╔══════════════════════════════════════════════════════╗', 'green');
  log('║            ✅ INICIALIZACIÓN COMPLETADA             ║', 'green');
  log('╚══════════════════════════════════════════════════════╝', 'green');
  
  log('\n📋 Resumen:', 'blue');
  log('  ✅ Usuario admin configurado', 'green');
  log('  ✅ 3 Venues de ejemplo creados', 'green');
  log('  ✅ 1 Evento de ejemplo creado', 'green');
  
  log('\n🎯 Próximos pasos:', 'yellow');
  log('  1. Inicia sesión en tu app con el email del admin', 'yellow');
  log('  2. Ve al dashboard para gestionar eventos', 'yellow');
  log('  3. Configura MercadoPago para habilitar pagos', 'yellow');
  
  log('\n📚 Recursos:', 'blue');
  log('  - Ver datos: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore', 'blue');
  log('  - Guía MercadoPago: GUIA_MERCADOPAGO_PASO_A_PASO.md', 'blue');
  
  rl.close();
}

// Manejar errores y cerrar la app
process.on('unhandledRejection', (error) => {
  log(`\n❌ Error no controlado: ${error.message}`, 'red');
  console.error(error);
  rl.close();
  process.exit(1);
});

// Ejecutar
main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  console.error(error);
  rl.close();
  process.exit(1);
});

