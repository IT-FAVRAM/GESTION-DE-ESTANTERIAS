import { LocationId } from './warehouseData';

/**
 * Generates all valid LocationIds for a given warehouse based on the UI layout.
 * This is the SINGLE SOURCE OF TRUTH for valid locations.
 */
export const generateLayoutLocations = (whCode: string): LocationId[] => {
    const pad3 = (n: number) => n.toString().padStart(3, '0');
    const locs: LocationId[] = [];

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
                locs.push(`MEC-E-${shelf}-B1-MEC ${pad3(i)}` as LocationId);
            }
            break;
        case 'PLE':
            // Estantería 1 (1-16)
            for (let i = 1; i <= 6; i++) locs.push(`PLE-E1-B1-PLE ${pad3(i)}` as LocationId);
            for (let i = 7; i <= 16; i++) locs.push(`PLE-E1-B1-PLE ${pad3(i)}` as LocationId);
            // Estantería 2 (17-30)
            for (let i = 17; i <= 30; i++) locs.push(`PLE-E1-B1-PLE ${pad3(i)}` as LocationId);
            // Punzonadora (31-53)
            for (let i = 31; i <= 53; i++) locs.push(`PLE-E1-B1-PLE ${pad3(i)}` as LocationId);
            // Carros (C1, C2, CR)
            for (let i = 1; i <= 4; i++) locs.push(`PLE-E1-B1-PLE C1-${i}` as LocationId);
            for (let i = 1; i <= 4; i++) locs.push(`PLE-E1-B1-PLE C2-${i}` as LocationId);
            break;
        case 'SOL':
            for (let i = 1; i <= 4; i++) locs.push(`SOL-E1-B1-SOL ${pad3(i)}` as LocationId);
            for (let i = 5; i <= 70; i++) {
                const suffix = i >= 41 ? i.toString() : pad3(i);
                locs.push(`SOL-E2-B1-SOL ${suffix}` as LocationId);
            }
            break;
        case 'RSO':
            for (let i = 1; i <= 8; i++) locs.push(`RSO-E1-B1-ROB.SOL ${pad3(i)}` as LocationId);
            break;
        case 'REP':
            for (let i = 1; i <= 4; i++) locs.push(`REP-E-URGENTE-B1-REP ${pad3(i)}` as LocationId);
            for (let i = 5; i <= 14; i++) locs.push(`REP-E-ALUMINIO-B1-REP ${pad3(i)}` as LocationId);
            for (let i = 15; i <= 24; i++) locs.push(`REP-E-NORMAL-B1-REP ${pad3(i)}` as LocationId);
            for (let i = 25; i <= 39; i++) locs.push(`REP-E-MODULAR-B1-REP ${pad3(i)}` as LocationId);
            break;
        case 'PIN':
            for (let i = 1; i <= 15; i++) locs.push(`PIN-E-DENTRO-B1-PIN ${pad3(i)}` as LocationId);
            for (let i = 16; i <= 27; i++) locs.push(`PIN-E-FUERA-B1-PIN ${pad3(i)}` as LocationId);
            break;

        case 'SXP':
            for (let i = 1; i <= 10; i++) locs.push(`SXP-E1-B1-SXP ${pad3(i)}` as LocationId);
            break;
        case 'COM':
            for (let i = 1; i <= 18; i++) locs.push(`COM-E1-B1-COM ${pad3(i)}` as LocationId);
            break;
        case 'RPL':
            // Est1 1-14, Est2 15-35
            for (let i = 1; i <= 14; i++) locs.push(`RPL-E1-B1-RPL ${pad3(i)}` as LocationId);
            for (let i = 1; i <= 21; i++) {
                const num = i + 14;
                locs.push(`RPL-E2-B1-RPL ${pad3(num)}` as LocationId);
            }
            break;
        case 'CAL':
            for (let i = 1; i <= 22; i++) locs.push(`CAL-E-RECHAZOS-B1-CAL ${pad3(i)}` as LocationId);
            for (let i = 23; i <= 34; i++) locs.push(`CAL-E-GENERAL-B1-CAL ${pad3(i)}` as LocationId);
            break;
        case 'ZIN':
            for (let b = 5; b >= 1; b--) locs.push(`ZIN-E1-B${b}-1` as LocationId);
            break;
    }

    return locs;
};

// Cache for valid locations
let validLocationCache: Set<string> | null = null;
const KNOWN_CODES = ['MEC', 'PLE', 'SOL', 'RSO', 'REP', 'PIN', 'SXP', 'COM', 'RPL', 'CAL', 'ZIN'];

export const isValidLayoutLocation = (locId: string): boolean => {
    if (!validLocationCache) {
        validLocationCache = new Set();
        KNOWN_CODES.forEach(code => {
            const locs = generateLayoutLocations(code);
            locs.forEach(l => validLocationCache!.add(l));
        });
    }
    return validLocationCache.has(locId);
};


