const fs = require('fs');
const path = require('path');

console.log('=== DEPLOYMENT VERIFICATION ===\n');

// Check main bundle exists
const bundlePath = path.join(__dirname, '../../../aplicacion/dist/assets');
const files = fs.readdirSync(bundlePath);
const mainBundle = files.find(f => f.startsWith('index-') && f.endsWith('.js'));

if (!mainBundle) {
  console.error('❌ Main bundle not found');
  process.exit(1);
}

console.log(`✓ Main bundle found: ${mainBundle}`);

// Read the bundle
const bundleContent = fs.readFileSync(path.join(bundlePath, mainBundle), 'utf-8');

// Check for critical patterns
const checks = [
  { pattern: /createContext/, name: 'React.createContext available' },
  { pattern: /firebase\/functions/, name: 'Firebase functions import' },
  { pattern: /firebase\/firestore/, name: 'Firebase firestore import' },
  { pattern: /firebase\/auth/, name: 'Firebase auth import' },
];

console.log('\n=== BUNDLE CHECKS ===');
let allPassed = true;

checks.forEach(check => {
  if (check.pattern.test(bundleContent)) {
    console.log(`✓ ${check.name}`);
  } else {
    console.log(`❌ ${check.name} - MISSING`);
    allPassed = false;
  }
});

// Check for the previous fatal error pattern
if (bundleContent.includes('Cannot read properties of undefined')) {
  console.log('⚠ Warning: Found "Cannot read properties" pattern (may be in error handling)');
}

console.log('\n=== DEVICE API IMPORT FIX ===');
const deviceApiPath = path.join(__dirname, '../../../aplicacion/lib/api/deviceApi.ts');
const deviceApiContent = fs.readFileSync(deviceApiPath, 'utf-8');

if (deviceApiContent.includes("from '../firebase/index.js'")) {
  console.log('✓ deviceApi.ts import path fixed (using ../firebase/index.js)');
} else if (deviceApiContent.includes("from '../firebase'")) {
  console.log('⚠ deviceApi.ts still uses ../firebase (should resolve correctly but verify on device)');
} else {
  console.log('❌ deviceApi.ts import not found');
  allPassed = false;
}

console.log('\n=== RESULT ===');
if (allPassed) {
  console.log('✓ DEPLOYMENT VERIFIED - Ready for device testing');
  console.log('\nApp URL: https://gestion-de-estanterias.web.app');
  console.log('\nTEST ON DEVICES:');
  console.log('1. Desktop browser: Load app, check no red error banner');
  console.log('2. Test quick access (acceso rápido) with OPERARIO role');
  console.log('3. Tablet (kiosko config): Should load and show kiosk interface');
  console.log('4. Verify no blank screens or console errors');
} else {
  console.log('❌ DEPLOYMENT VERIFICATION FAILED');
  process.exit(1);
}
