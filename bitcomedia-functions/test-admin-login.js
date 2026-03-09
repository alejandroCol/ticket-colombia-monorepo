/**
 * Test de Login - Verificar flujo completo de autenticación y rol de admin
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp({
  projectId: 'ticket-colombia-e6267'
});

const db = admin.firestore();
const auth = admin.auth();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAdminLogin() {
  const email = 'ale.mar.guz@gmail.com';
  
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║  🔐 TEST DE LOGIN - VERIFICACIÓN DE ROL ADMIN         ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝', 'blue');
  
  log(`\n📧 Email a verificar: ${email}`, 'cyan');
  log('═'.repeat(60), 'blue');
  
  try {
    // PASO 1: Verificar que el usuario existe en Authentication
    log('\n[PASO 1/4] 🔍 Verificando en Firebase Authentication...', 'blue');
    let userAuth;
    try {
      userAuth = await auth.getUserByEmail(email);
      log('✅ Usuario encontrado en Authentication', 'green');
      log(`   UID: ${userAuth.uid}`, 'cyan');
      log(`   Email: ${userAuth.email}`, 'cyan');
      log(`   Email Verificado: ${userAuth.emailVerified}`, 'cyan');
      log(`   Creado: ${new Date(userAuth.metadata.creationTime).toLocaleString('es-CO')}`, 'cyan');
    } catch (error) {
      log('❌ ERROR: Usuario no encontrado en Authentication', 'red');
      log(`   Mensaje: ${error.message}`, 'red');
      log('\n🔧 SOLUCIÓN:', 'yellow');
      log('   1. Ve a Firebase Console → Authentication', 'yellow');
      log('   2. Verifica que el usuario existe', 'yellow');
      log('   3. Si no existe, créalo con email y password', 'yellow');
      process.exit(1);
    }
    
    // PASO 2: Verificar que el usuario existe en Firestore
    log('\n[PASO 2/4] 📄 Verificando en Firestore Database...', 'blue');
    const userDocRef = db.collection('users').doc(userAuth.uid);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      log('❌ ERROR: Usuario NO encontrado en Firestore', 'red');
      log(`   Buscando documento con ID: ${userAuth.uid}`, 'yellow');
      log('\n🔧 SOLUCIÓN:', 'yellow');
      log('   El documento en Firestore debe tener el mismo UID que Authentication', 'yellow');
      log(`   Crea un documento en: /users/${userAuth.uid}`, 'yellow');
      log('   Con los campos: email, name, role: "ADMIN", active: true', 'yellow');
      process.exit(1);
    }
    
    log('✅ Usuario encontrado en Firestore', 'green');
    const userData = userDoc.data();
    log('   Datos del documento:', 'cyan');
    log(`   ${JSON.stringify(userData, null, 6)}`, 'cyan');
    
    // PASO 3: Verificar el rol específicamente
    log('\n[PASO 3/4] 👤 Verificando rol de administrador...', 'blue');
    log(`   Rol encontrado: "${userData.role}"`, 'cyan');
    log(`   Tipo del valor: ${typeof userData.role}`, 'cyan');
    
    // Verificaciones detalladas
    const checks = {
      'Rol existe': userData.role !== undefined && userData.role !== null,
      'Rol es string': typeof userData.role === 'string',
      'Rol es "ADMIN"': userData.role === 'ADMIN',
      'Rol es "admin"': userData.role === 'admin',
      'Usuario activo': userData.active === true
    };
    
    log('\n   Verificaciones:', 'cyan');
    Object.entries(checks).forEach(([check, result]) => {
      const icon = result ? '✅' : '❌';
      const color = result ? 'green' : 'red';
      log(`   ${icon} ${check}`, color);
    });
    
    // PASO 4: Simular lo que hace el frontend
    log('\n[PASO 4/4] 🔄 Simulando flujo del frontend...', 'blue');
    log('   El frontend después del login hace:', 'cyan');
    log('   1. signInWithEmailAndPassword() → Authentication ✅', 'cyan');
    log('   2. getUserData(uid) → Obtiene datos de Firestore', 'cyan');
    log('   3. Verifica: userData.role === "ADMIN"', 'cyan');
    
    // Resultado final
    log('\n═'.repeat(60), 'blue');
    if (userData.role === 'ADMIN') {
      log('✅ ¡ÉXITO! El usuario ES ADMIN correctamente', 'green');
      log('\n📋 Resumen:', 'blue');
      log(`   • Usuario: ${email}`, 'green');
      log(`   • UID: ${userAuth.uid}`, 'green');
      log(`   • Rol: ${userData.role} ✅`, 'green');
      log(`   • Activo: ${userData.active}`, 'green');
      
      log('\n✨ El backend está funcionando correctamente', 'green');
      log('   El usuario debería ver las opciones de admin en la app', 'green');
      
      log('\n🎯 Si aún no ve las opciones de admin:', 'yellow');
      log('   1. Limpia el localStorage: localStorage.clear()', 'yellow');
      log('   2. Limpia el sessionStorage: sessionStorage.clear()', 'yellow');
      log('   3. Refresca la página (Cmd+Shift+R)', 'yellow');
      log('   4. O usa modo incógnito', 'yellow');
      
    } else if (userData.role === 'admin') {
      log('❌ PROBLEMA ENCONTRADO: Rol en minúsculas', 'red');
      log(`\n   El rol es: "${userData.role}" (minúsculas)`, 'red');
      log(`   Debe ser: "ADMIN" (MAYÚSCULAS)`, 'red');
      
      log('\n🔧 SOLUCIÓN:', 'yellow');
      log('   1. Ve a Firebase Console → Firestore', 'yellow');
      log(`   2. Abre: /users/${userAuth.uid}`, 'yellow');
      log('   3. Edita el campo "role"', 'yellow');
      log('   4. Cambia "admin" → "ADMIN"', 'yellow');
      log('   5. Guarda', 'yellow');
      
      log('\n🔗 Link directo:', 'cyan');
      log(`   https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Fusers~2F${userAuth.uid}`, 'cyan');
      
    } else {
      log('❌ PROBLEMA ENCONTRADO: Rol incorrecto o no existe', 'red');
      log(`\n   Rol actual: "${userData.role}"`, 'red');
      log(`   Rol esperado: "ADMIN"`, 'red');
      
      log('\n🔧 SOLUCIÓN:', 'yellow');
      log('   1. Ve a Firebase Console → Firestore', 'yellow');
      log(`   2. Abre: /users/${userAuth.uid}`, 'yellow');
      log('   3. Asegúrate que el campo "role" tenga el valor "ADMIN"', 'yellow');
      log('   4. Todo en MAYÚSCULAS', 'yellow');
    }
    
    log('\n═'.repeat(60), 'blue');
    process.exit(userData.role === 'ADMIN' ? 0 : 1);
    
  } catch (error) {
    log('\n❌ ERROR INESPERADO:', 'red');
    log(`   ${error.message}`, 'red');
    if (error.stack) {
      log('\n📚 Stack trace:', 'yellow');
      log(error.stack, 'yellow');
    }
    process.exit(1);
  }
}

// Ejecutar test
testAdminLogin();





