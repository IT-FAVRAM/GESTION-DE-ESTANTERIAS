
import { useCallback } from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { validateCode } from '../lib/codeValidation';
import { ValidationResult as ScannerValidationResult } from '../components/Scanner';

export const useScannerLogic = (assignments: Assignments) => {
    
    const validateScannedBarcode = useCallback((code: string): ScannerValidationResult => {
        const result = validateCode(code, true);
    
        if (!result.isValid) {
            return { 
                isValid: false, 
                type: result.severity === 'warning' ? 'warning' : 'error', 
                message: result.message, 
                details: result.details 
            };
        }
    
        if (result.type === 'location') {
            return { 
                isValid: false, 
                type: 'warning', 
                message: 'Es una ubicación', 
                details: 'Escanea un artículo primero' 
            };
        }
    
        let foundLocation: string | undefined;
        for (const locId in assignments) {
            if (assignments[locId as LocationId].some(item => item.barcode === result.normalizedCode)) {
                foundLocation = locId;
                break;
            }
        }
    
        if (foundLocation) {
            return { 
                isValid: true, 
                type: 'warning', 
                message: 'Ya asignado', 
                details: `En: ${foundLocation}` 
            };
        }
    
        return { 
            isValid: true, 
            type: 'success', 
            message: result.message, 
            details: result.details
        };
    
      }, [assignments]);

      return {
        validateScannedBarcode
      };
};
