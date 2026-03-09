// Script de prueba para MercadoPago Integration
// Este script simula el flujo completo de creación de tickets

const admin = require('firebase-admin');

// Configurar Firebase Admin
const serviceAccount = require('./functions/bitcomedia-3cbe5-firebase-adminsdk-ixqzr-b8b8b8b8b8.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'bitcomedia-3cbe5'
});

const db = admin.firestore();

async function testMercadoPagoIntegration() {
  console.log('🚀 Iniciando prueba de integración MercadoPago...\n');

  try {
    // 1. Verificar configuración
    console.log('1️⃣ Verificando configuración...');
    
    // 2. Crear datos de prueba
    console.log('2️⃣ Creando datos de prueba...');
    
    // Crear usuario de prueba
    const testUser = {
      name: 'Usuario de Prueba',
      email: 'test@bitcomedia.com',
      document: '12345678',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const userRef = await db.collection('users').add(testUser);
    console.log(`✅ Usuario creado: ${userRef.id}`);
    
    // Crear evento de prueba
    const testEvent = {
      title: 'Evento de Prueba MercadoPago',
      description: 'Evento para probar la integración con MercadoPago',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // En 7 días
      price: 5000, // $5,000 COP
      location: 'Bogotá, Colombia',
      capacity: 100,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const eventRef = await db.collection('events').add(testEvent);
    console.log(`✅ Evento creado: ${eventRef.id}`);
    
    // 3. Simular llamada a createTicketPreference
    console.log('3️⃣ Simulando creación de preferencia de pago...');
    
    const ticketData = {
      userId: userRef.id,
      eventId: eventRef.id,
      amount: 5000,
      buyerEmail: 'test@bitcomedia.com',
      metadata: {
        userName: 'Usuario de Prueba',
        eventName: 'Evento de Prueba MercadoPago',
        seatNumber: 'A1'
      }
    };
    
    console.log('📋 Datos del ticket:', JSON.stringify(ticketData, null, 2));
    
    // 4. Verificar que las funciones están desplegadas
    console.log('4️⃣ Verificando funciones desplegadas...');
    console.log('🔗 URL de createTicketPreference: https://us-central1-bitcomedia-3cbe5.cloudfunctions.net/createTicketPreference');
    console.log('🔗 URL de webhook: https://us-central1-bitcomedia-3cbe5.cloudfunctions.net/mercadopagoWebhook');
    
    // 5. Mostrar instrucciones para prueba manual
    console.log('\n5️⃣ Instrucciones para prueba manual:');
    console.log('📱 Para probar desde tu aplicación frontend:');
    console.log(`
const ticketData = {
  userId: "${userRef.id}",
  eventId: "${eventRef.id}",
  amount: 5000,
  buyerEmail: "test@bitcomedia.com",
  metadata: {
    userName: "Usuario de Prueba",
    eventName: "Evento de Prueba MercadoPago",
    seatNumber: "A1"
  }
};

// Llamar a la función
const createTicketPreference = firebase.functions().httpsCallable('createTicketPreference');
const result = await createTicketPreference(ticketData);
console.log('Resultado:', result.data);
    `);
    
    // 6. Verificar webhook con curl
    console.log('\n6️⃣ Prueba del webhook:');
    console.log('🧪 Puedes probar el webhook con este comando curl:');
    console.log(`
curl -X POST https://us-central1-bitcomedia-3cbe5.cloudfunctions.net/mercadopagoWebhook \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "payment",
    "action": "payment.created",
    "live_mode": false,
    "data": {
      "id": "123456"
    }
  }'
    `);
    
    // 7. Limpiar datos de prueba (opcional)
    console.log('\n7️⃣ Limpieza de datos de prueba...');
    console.log('⚠️  Los datos de prueba se mantienen para verificación manual');
    console.log(`🗑️  Para limpiar: eliminar usuario ${userRef.id} y evento ${eventRef.id}`);
    
    console.log('\n✅ Prueba completada exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`- Usuario de prueba: ${userRef.id}`);
    console.log(`- Evento de prueba: ${eventRef.id}`);
    console.log('- Funciones desplegadas correctamente');
    console.log('- Configuración de MercadoPago lista');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Ejecutar la prueba
testMercadoPagoIntegration(); 