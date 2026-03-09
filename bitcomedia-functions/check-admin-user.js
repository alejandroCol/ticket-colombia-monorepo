/**
 * Script para verificar la configuración del usuario admin
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'ticket-colombia-e6267'
});

const db = admin.firestore();
const auth = admin.auth();

async function checkAdminUser() {
  console.log('\n🔍 VERIFICANDO USUARIO ADMIN\n');
  console.log('═'.repeat(50));
  
  const email = 'ale.mar.guz@gmail.com';
  
  try {
    // 1. Verificar en Authentication
    console.log('\n📧 Verificando en Authentication...');
    let userAuth;
    try {
      userAuth = await auth.getUserByEmail(email);
      console.log('✅ Usuario encontrado en Authentication');
      console.log('   UID:', userAuth.uid);
      console.log('   Email:', userAuth.email);
      console.log('   Email Verified:', userAuth.emailVerified);
    } catch (error) {
      console.log('❌ Usuario NO encontrado en Authentication');
      console.log('   Error:', error.message);
      process.exit(1);
    }
    
    // 2. Verificar en Firestore
    console.log('\n📄 Verificando en Firestore...');
    const userDoc = await db.collection('users').doc(userAuth.uid).get();
    
    if (!userDoc.exists) {
      console.log('❌ Usuario NO encontrado en Firestore');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   1. Ve a: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Fusers');
      console.log('   2. Crea un documento con ID:', userAuth.uid);
      console.log('   3. Agrega estos campos:');
      console.log('      - email: "ale.mar.guz@gmail.com" (string)');
      console.log('      - name: "Alejandro" (string)');
      console.log('      - role: "ADMIN" (string) ← EN MAYÚSCULAS');
      console.log('      - active: true (boolean)');
      console.log('      - createdAt: (timestamp)');
      process.exit(1);
    }
    
    const userData = userDoc.data();
    console.log('✅ Usuario encontrado en Firestore');
    console.log('   Datos:', JSON.stringify(userData, null, 2));
    
    // 3. Verificar el rol
    console.log('\n👤 Verificando rol de administrador...');
    if (userData.role === 'ADMIN') {
      console.log('✅ Rol correcto: "ADMIN" (mayúsculas)');
    } else if (userData.role === 'admin') {
      console.log('❌ Rol incorrecto: "admin" (minúsculas)');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   1. Ve a: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Fusers~2F' + userAuth.uid);
      console.log('   2. Edita el campo "role"');
      console.log('   3. Cambia de "admin" a "ADMIN" (todo en MAYÚSCULAS)');
      console.log('   4. Guarda');
      process.exit(1);
    } else {
      console.log('❌ Rol no encontrado o incorrecto:', userData.role);
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   El campo "role" debe ser "ADMIN" (todo en MAYÚSCULAS)');
      process.exit(1);
    }
    
    // 4. Verificar que esté activo
    console.log('\n🔓 Verificando estado activo...');
    if (userData.active === true) {
      console.log('✅ Usuario activo');
    } else {
      console.log('⚠️  Usuario no activo o campo "active" no configurado');
    }
    
    // 5. Resumen
    console.log('\n' + '═'.repeat(50));
    console.log('✅ CONFIGURACIÓN CORRECTA');
    console.log('═'.repeat(50));
    console.log('\n📋 El usuario está configurado correctamente como admin.');
    console.log('\n🎯 Próximos pasos:');
    console.log('   1. Abre el navegador en modo incógnito');
    console.log('   2. Ve a: http://localhost:5174/login');
    console.log('   3. Inicia sesión con:');
    console.log('      Email: ale.mar.guz@gmail.com');
    console.log('      Password: 12345678');
    console.log('   4. Deberías ver la opción de crear eventos');
    console.log('\n📱 Si aún no funciona:');
    console.log('   - Limpia el caché: localStorage.clear() + sessionStorage.clear()');
    console.log('   - Refresca la página');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkAdminUser();





