
const assert = require('assert');

// -----------------------------------------------------------------------------
// LOGIC COPIED FROM lib/csv.ts (sanitizeField)
// -----------------------------------------------------------------------------
const sanitizeCSVField = (value) => {
    if (value === null || value === undefined) return '';
    let str = String(value).trim();

    // 1. Anti-Injection
    if (/^[=+\-@]/.test(str)) {
        str = "'" + str;
    }

    // 2. Escape double quotes
    return `"${str.replace(/"/g, '""')}"`;
};

// -----------------------------------------------------------------------------
// LOGIC COPIED FROM lib/excelExport.ts (sanitizeForExcel)
// -----------------------------------------------------------------------------
const sanitizeExcelField = (val) => {
    if (val === null || val === undefined) return '';

    let str = String(val).trim();

    // 1. Length Limit
    if (str.length > 32000) {
        str = str.substring(0, 32000) + '... (TRUNCATED)';
    }

    // 2. Injection Protection
    if (/^[=+\-@]/.test(str)) {
        return "'" + str;
    }
    return str;
};

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------
console.log("Running Security Sanitization Tests...");

try {
    // Test 1: CSV Normal String
    assert.strictEqual(sanitizeCSVField("Hello"), '"Hello"', "CSV Normal failed");

    // Test 2: CSV Injection
    assert.strictEqual(sanitizeCSVField("=1+1"), '"\'=1+1"', "CSV Injection = failed");
    assert.strictEqual(sanitizeCSVField("+1+1"), '"\'+1+1"', "CSV Injection + failed");
    assert.strictEqual(sanitizeCSVField("-1+1"), '"\'-1+1"', "CSV Injection - failed");
    assert.strictEqual(sanitizeCSVField("@SUM(1,1)"), '"\'@SUM(1,1)"', "CSV Injection @ failed");

    // Test 3: CSV Quote Escaping
    assert.strictEqual(sanitizeCSVField('Hello "World"'), '"Hello ""World"""', "CSV Quotes failed");

    // Test 4: Excel Injection
    assert.strictEqual(sanitizeExcelField("=HYPERLINK(...)"), "'=HYPERLINK(...)", "Excel Injection failed");

    // Test 5: Excel Trimming
    assert.strictEqual(sanitizeExcelField("  abc  "), "abc", "Excel Trimming failed");

    // Test 6: Excel Length Limit
    const longString = "a".repeat(33000);
    const result = sanitizeExcelField(longString);
    assert.ok(result.includes("TRUNCATED"), "Excel Truncation failed");
    assert.ok(result.length < 33000, "Excel Length check failed");

    console.log("✅ ALL TESTS PASSED");
} catch (e) {
    console.error("❌ TEST FAILED:", e.message);
    process.exit(1);
}
