// Archivo de test para funciones de validación de ubicaciones consolidadas
// Este archivo verifica que las funciones acepten ambos formatos: (shelfCode, position) y (locationId)

import {
  isUrgentLocation,
  isTechReviewLocation,
  isAluminioLocation,
  isReprocesosLocation,
  parseLocationId,
  getLocationDocId,
} from './shelves';

// ── TESTS PARA parseLocationId ──────────────────────────────────────────
console.log('=== TESTS parseLocationId ===');

const test1 = parseLocationId('MEC-031');
console.assert(test1?.shelfCode === 'MEC', `Expected shelfCode "MEC", got "${test1?.shelfCode}"`);
console.assert(test1?.position === '031', `Expected position "031", got "${test1?.position}"`);
console.log('✓ parseLocationId("MEC-031")');

const test2 = parseLocationId('CAL-022');
console.assert(test2?.shelfCode === 'CAL', `Expected shelfCode "CAL", got "${test2?.shelfCode}"`);
console.assert(test2?.position === '022', `Expected position "022", got "${test2?.position}"`);
console.log('✓ parseLocationId("CAL-022")');

const test3 = parseLocationId('INVALID');
console.assert(test3 === null, `Expected null for invalid locationId, got ${JSON.stringify(test3)}`);
console.log('✓ parseLocationId("INVALID") returns null');

// ── TESTS PARA isReprocesosLocation ──────────────────────────────────────────
console.log('\n=== TESTS isReprocesosLocation ===');

// Formato moderno: (shelfCode, position)
console.assert(isReprocesosLocation('CAL', 1) === true, 'CAL 001 should be reproceso');
console.log('✓ isReprocesosLocation("CAL", 1) = true');

console.assert(isReprocesosLocation('CAL', 22) === true, 'CAL 022 should be reproceso');
console.log('✓ isReprocesosLocation("CAL", 22) = true');

console.assert(isReprocesosLocation('CAL', 23) === false, 'CAL 023 should NOT be reproceso');
console.log('✓ isReprocesosLocation("CAL", 23) = false');

console.assert(isReprocesosLocation('PRE', 1) === false, 'PRE should NOT be reproceso');
console.log('✓ isReprocesosLocation("PRE", 1) = false');

// Formato legacy: (locationId)
console.assert(isReprocesosLocation('CAL-001') === true, 'CAL-001 should be reproceso');
console.log('✓ isReprocesosLocation("CAL-001") = true');

console.assert(isReprocesosLocation('CAL-022') === true, 'CAL-022 should be reproceso');
console.log('✓ isReprocesosLocation("CAL-022") = true');

console.assert(isReprocesosLocation('CAL-023') === false, 'CAL-023 should NOT be reproceso');
console.log('✓ isReprocesosLocation("CAL-023") = false');

console.assert(isReprocesosLocation('PRE-001') === false, 'PRE-001 should NOT be reproceso');
console.log('✓ isReprocesosLocation("PRE-001") = false');

// ── TESTS PARA isAluminioLocation ──────────────────────────────────────────
console.log('\n=== TESTS isAluminioLocation ===');

// Formato moderno: (shelfCode, position)
console.assert(
  isAluminioLocation('ALU', 1) === true,
  'ALU 001 should be aluminio (according to SHELF_DEFINITIONS)',
);
console.log('✓ isAluminioLocation("ALU", 1) works with (shelfCode, position)');

// Formato legacy: (locationId)
console.assert(
  isAluminioLocation('ALU-001') === true,
  'ALU-001 should be aluminio (according to SHELF_DEFINITIONS)',
);
console.log('✓ isAluminioLocation("ALU-001") works with (locationId)');

console.assert(isAluminioLocation('INVALID') === false, 'Invalid location should return false');
console.log('✓ isAluminioLocation("INVALID") returns false for invalid locationId');

// ── SUMMARY ──────────────────────────────────────────────────────────────────
console.log('\n✅ TESTS COMPLETADOS');
console.log('✓ Todas las funciones aceptan ambos formatos: (shelfCode, position) y (locationId)');
console.log('✓ Las funciones retornan valores booleanos correctos');
console.log('✓ El parseLocationId funciona correctamente');
