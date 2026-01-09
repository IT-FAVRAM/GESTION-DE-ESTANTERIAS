
const assert = require('assert');

// -----------------------------------------------------------------------------
// MOCK WAREHOUSE DATA (Simplified for test)
// -----------------------------------------------------------------------------
const WAREHOUSES = ['MEC', 'PLE'];

// -----------------------------------------------------------------------------
// LOGIC COPIED FROM lib/warehouseLayout.ts
// -----------------------------------------------------------------------------
const generateLayoutLocations = (whCode) => {
    const pad3 = (n) => n.toString().padStart(3, '0');
    const locs = [];

    switch (whCode) {
        case 'MEC':
            for (let i = 1; i <= 46; i++) {
                let shelf = 'URGENTE';
                if (i > 4) {
                    if (i <= 13) shelf = 'GEN_A';
                    else if (i <= 22) shelf = 'GEN_B';
                    else if (i <= 34) shelf = 'GEN_C';
                    else shelf = 'GEN_D';
                }
                locs.push(`MEC-E-${shelf}-B1-MEC ${pad3(i)}`);
            }
            break;
    }
    return locs;
};

// Cache for valid locations
let validLocationCache = null;
const KNOWN_CODES = ['MEC'];

const isValidLayoutLocation = (locId) => {
    if (!validLocationCache) {
        validLocationCache = new Set();
        KNOWN_CODES.forEach(code => {
            const locs = generateLayoutLocations(code);
            locs.forEach(l => validLocationCache.add(l));
        });
    }
    return validLocationCache.has(locId);
};

// -----------------------------------------------------------------------------
// LOGIC FROM lib/codeValidation.ts (Simplified wrapper)
// -----------------------------------------------------------------------------
const validateCode = (code) => {
    // 1. Strict Check
    if (isValidLayoutLocation(code)) {
        return { isValid: true, msg: 'Valid' };
    }

    // 2. Ghost Check
    const warehousePrefix = WAREHOUSES.find(w => code.startsWith(w + '-'));
    if (warehousePrefix) {
        return { isValid: false, msg: 'Ghost Location' };
    }

    return { isValid: true, msg: 'Item/Unknown' }; // Fallback
};

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------
console.log("Running Strict Validation Tests...");

try {
    // 1. Valid Location
    const valid = "MEC-E-URGENTE-B1-MEC 001";
    assert.strictEqual(validateCode(valid).isValid, true, "Valid location failed");

    // 2. Ghost Location (Correct prefix structure, but ID 999 not in layout)
    const ghost = "MEC-E-URGENTE-B1-MEC 999";
    assert.strictEqual(validateCode(ghost).isValid, false, "Ghost location passed (Should fail)");
    assert.strictEqual(validateCode(ghost).msg, 'Ghost Location', "Ghost location msg mismatch");

    // 3. Malformed Location
    const malformed = "MEC-XYZ-garbage";
    assert.strictEqual(validateCode(malformed).isValid, false, "Malformed location passed");

    console.log("✅ ALL VALIDATION TESTS PASSED");
} catch (e) {
    console.error("❌ TEST FAILED:", e.message);
    process.exit(1);
}
