
import { LocationId } from './warehouseData';
import { isValidLayoutLocation } from './warehouseLayout';

interface ParseLocationOptions {
    strict?: boolean;
}

export const parseLocationFromText = (
    extractedText: string,
    assignments: Record<string, any[]>,
    options: ParseLocationOptions = {}
): LocationId | null => {
    const locationText = extractedText.toUpperCase().trim();
    if (!locationText) return null;

    // Special logic for final location handled in caller or here? 
    // The original code handled ALMACEN check separately for finalizing workflow.
    // This function focuses on mapping standard warehouse location codes.

    // Check for exact match in keys first (fallback in original code, but good to check)
    const exactKey = Object.keys(assignments).find(k => k === locationText);
    if (exactKey) return exactKey as LocationId;

    const normalizedText = locationText.replace(/[\.\-_]/g, ' ').replace(/\s+/g, ' ');

    const whMappings = [
        { keyword: 'ROB SOL', code: 'RSO' }, { keyword: 'ROB.SOL', code: 'RSO' },
        { keyword: 'ROB PLE', code: 'RPL' }, { keyword: 'RPL', code: 'RPL' },
        { keyword: 'MEC', code: 'MEC' }, { keyword: 'PLE', code: 'PLE' },
        { keyword: 'SOL', code: 'SOL' }, { keyword: 'REP', code: 'REP' },
        { keyword: 'PIN', code: 'PIN' },
        { keyword: 'SXP', code: 'SXP' },
        { keyword: 'COM', code: 'COM' }, { keyword: 'CAL', code: 'CAL' },
        { keyword: 'ZIN', code: 'ZIN' }, { keyword: 'BALDA', code: 'ZIN' },
        { keyword: 'CARRO 1', code: 'C1' }, { keyword: 'CARRO 2', code: 'C2' },
        { keyword: 'C1', code: 'C1' }, { keyword: 'C2', code: 'C2' }
    ];

    let matchedCode: string | null = null;
    let matchedNumber: number = 0;

    for (const map of whMappings) {
        if (normalizedText.includes(map.keyword)) {
            const digitMatch = normalizedText.match(/(\d+)/);
            if (digitMatch) {
                matchedCode = map.code;
                matchedNumber = parseInt(digitMatch[0], 10);
                break;
            }
        }
    }

    let matchedLocation: LocationId | null = null;
    const pad3 = (n: number) => n.toString().padStart(3, '0');
    const numStr = pad3(matchedNumber);

    if (matchedCode) {
        if (matchedCode === 'MEC') {
            let shelf;
            if (matchedNumber <= 4) shelf = 'URGENTE';
            else if (matchedNumber <= 13) shelf = 'GEN_A';
            else if (matchedNumber <= 22) shelf = 'GEN_B';
            else if (matchedNumber <= 34) shelf = 'GEN_C';
            else shelf = 'GEN_D';
            matchedLocation = `MEC-E-${shelf}-B1-MEC ${numStr}` as LocationId;
        }
        else if (matchedCode === 'SOL') {
            const shelf = matchedNumber <= 4 ? '1' : '2';
            const suffix = matchedNumber >= 41 ? matchedNumber.toString() : numStr;
            matchedLocation = `SOL-E${shelf}-B1-SOL ${suffix}` as LocationId;
        }
        else if (matchedCode === 'PLE') {
            matchedLocation = `PLE-E1-B1-PLE ${numStr}` as LocationId;
        }
        else if (matchedCode === 'SXP') matchedLocation = `SXP-E1-B1-SXP ${numStr}` as LocationId;
        else if (matchedCode === 'RSO') matchedLocation = `RSO-E1-B1-ROB.SOL ${numStr}` as LocationId;
        else if (matchedCode === 'RPL') {
            const shelf = matchedNumber <= 14 ? '1' : '2';
            matchedLocation = `RPL-E${shelf}-B1-RPL ${numStr}` as LocationId;
        }
        else if (matchedCode === 'REP') {
            if (matchedNumber <= 4) matchedLocation = `REP-E-URGENTE-B1-REP ${numStr}` as LocationId;
            else if (matchedNumber <= 14) matchedLocation = `REP-E-ALUMINIO-B1-REP ${numStr}` as LocationId;
            else if (matchedNumber <= 24) matchedLocation = `REP-E-NORMAL-B1-REP ${numStr}` as LocationId;
            else if (matchedNumber <= 40) matchedLocation = `REP-E-MODULAR-B1-REP ${numStr}` as LocationId;
            else matchedLocation = `REP-E-MODULAR-B1-REP ${numStr}` as LocationId;
        }
        else if (matchedCode === 'PIN') {
            const shelf = matchedNumber <= 27 ? 'DENTRO' : 'FUERA';
            matchedLocation = `PIN-E-${shelf}-B1-PIN ${numStr}` as LocationId;
        }
        else if (matchedCode === 'CAL') {
            const shelf = matchedNumber <= 22 ? 'RECHAZOS' : 'GENERAL';
            matchedLocation = `CAL-E-${shelf}-B1-CAL ${numStr}` as LocationId;
        }
        else if (matchedCode === 'COM') {
            matchedLocation = `COM-E1-B1-COM ${numStr}` as LocationId;
        }
        else if (matchedCode === 'ZIN') {
            if (matchedNumber >= 1 && matchedNumber <= 5) matchedLocation = `ZIN-E1-B${matchedNumber}-1` as LocationId;
        }
        else if (matchedCode === 'C1') matchedLocation = `PLE-E1-B1-PLE C1-${matchedNumber}` as LocationId;
        else if (matchedCode === 'C2') matchedLocation = `PLE-E1-B1-PLE C2-${matchedNumber}` as LocationId;
    }

    if (!matchedLocation && !options.strict) {
        // Soft match attempt
        const foundKey = Object.keys(assignments).find(k => k.endsWith(locationText) || k.includes(locationText));
        if (foundKey) matchedLocation = foundKey as LocationId;
    }

    if (matchedLocation && !isValidLayoutLocation(matchedLocation)) {
        return null;
    }

    return matchedLocation;
};
