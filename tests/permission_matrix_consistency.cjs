const assert = require('assert');
const { can } = require('../lib/permissionMatrix.cjs');

assert.equal(can('ADMIN', 'copyPaste'), true);
assert.equal(can('ADMIN', 'dragMove'), true);
assert.equal(can('ADMIN', 'emptyShelf'), true);
assert.equal(can('ADMIN', 'emptyLocation'), true);

assert.equal(can('JEFE', 'copyPaste'), false);
assert.equal(can('JEFE', 'dragMove'), false);
assert.equal(can('JEFE', 'emptyShelf'), false);
assert.equal(can('JEFE', 'emptyLocation'), true);

assert.equal(can('CARRETILLERO', 'copyPaste'), false);
assert.equal(can('CARRETILLERO', 'dragMove'), false);
assert.equal(can('CARRETILLERO', 'emptyShelf'), false);
assert.equal(can('CARRETILLERO', 'emptyLocation'), true);

console.log('ok');
