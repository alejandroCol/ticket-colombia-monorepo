const admin = require('firebase-admin');

// Usar la clave existente
const serviceAccount = require('./ticket-colombia-e6267-firebase-adminsdk-fbsvc-dc603ba774.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteOldEvents() {
  console.log('🗑️  Eliminando eventos de prueba antiguos...\n');
  
  try {
    // Eliminar eventos
    const eventsSnapshot = await db.collection('events').get();
    console.log(`Encontrados ${eventsSnapshot.size} eventos`);
    
    for (const doc of eventsSnapshot.docs) {
      await doc.ref.delete();
      console.log(`   ✅ Evento eliminado: ${doc.id}`);
    }
    
    // Eliminar eventos recurrentes
    const recurringSnapshot = await db.collection('recurring_events').get();
    console.log(`\nEncontrados ${recurringSnapshot.size} eventos recurrentes`);
    
    for (const doc of recurringSnapshot.docs) {
      await doc.ref.delete();
      console.log(`   ✅ Evento recurrente eliminado: ${doc.id}`);
    }
    
    // Eliminar occurrences
    const occurrencesSnapshot = await db.collection('occurrences').get();
    console.log(`\nEncontrados ${occurrencesSnapshot.size} occurrences`);
    
    for (const doc of occurrencesSnapshot.docs) {
      await doc.ref.delete();
      console.log(`   ✅ Occurrence eliminada: ${doc.id}`);
    }
    
    console.log('\n✅ Limpieza completada\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

deleteOldEvents();
