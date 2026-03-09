/**
 * Script para verificar si el usuario admin existe en Firestore
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'ticket-colombia-e6267'
});

const db = admin.firestore();

async function checkUser() {
  console.log('\n🔍 Verificando usuario admin...\n');
  
  const userId = 'QTKIYhzp04cZ9rVk1IsjL8regYL2';
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      console.log('✅ Usuario encontrado en Firestore:');
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log('❌ Usuario NO encontrado en Firestore');
      console.log('\n📝 Necesitas crear el usuario admin en Firestore:');
      console.log('1. Ve a: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data');
      console.log('2. Crea colección "users"');
      console.log('3. ID del documento: QTKIYhzp04cZ9rVk1IsjL8regYL2');
      console.log('4. Agrega los campos necesarios');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUser();





