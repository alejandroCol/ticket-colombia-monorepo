const admin = require('firebase-admin');
const serviceAccount = require('./ticket-colombia-e6267-firebase-adminsdk-fbsvc-dc603ba774.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listEvents() {
  console.log('\n📋 LISTADO DE EVENTOS EN FIRESTORE\n');
  console.log('═'.repeat(80));
  
  const eventsSnapshot = await db.collection('events').get();
  
  if (eventsSnapshot.empty) {
    console.log('⚠️  No hay eventos en la base de datos\n');
  } else {
    console.log(`\n✅ Encontrados ${eventsSnapshot.size} eventos:\n`);
    
    eventsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. 📅 ${data.name || 'Sin nombre'}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${data.status || 'N/A'}`);
      console.log(`   Fecha (event_date): ${data.event_date ? data.event_date.toDate().toLocaleString('es-CO') : 'NO TIENE ❌'}`);
      console.log(`   Fecha (date): ${data.date || 'N/A'}`);
      console.log(`   Hora (time): ${data.time || 'N/A'}`);
      console.log(`   Ciudad: ${data.city || 'N/A'}`);
      console.log(`   Tipo: ${data.event_type || 'N/A'}`);
      console.log(`   Precio: $${data.ticket_price || 0}`);
      console.log('   ' + '-'.repeat(76));
    });
  }
  
  console.log('\n' + '═'.repeat(80) + '\n');
  process.exit(0);
}

listEvents().catch(console.error);
