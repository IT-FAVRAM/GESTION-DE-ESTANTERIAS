#!/bin/bash
# Monitor Firestore changes in real-time during E2E testing

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Firestore Real-time Monitor — WMS v3${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Instrucciones:${NC}"
echo "1. Abre Firebase Console: https://console.firebase.google.com"
echo "2. Selecciona proyecto y navega a Firestore"
echo "3. Abre DevTools (F12) en la app: https://localhost:3000"
echo "4. Ejecuta tests según E2E_TEST_PLAN.md"
echo ""
echo -e "${YELLOW}Colecciones a monitorear:${NC}"
echo "  • itemAggregates     → totalActivePresences (Test 1)"
echo "  • shelves/{code}/locations → items array (Test 2, 3)"
echo "  • pickupQueue        → requestType (Test 4)"
echo "  • history            → operarioId (Test 7)"
echo ""
echo -e "${YELLOW}Queries útiles en Firestore Console:${NC}"
echo ""
echo -e "${CYAN}Test 1 - Ubicar multi-posición:${NC}"
echo '  Collection: itemAggregates'
echo '  Field: articleCode == "ART-001"'
echo '  Check: totalActivePresences debe ser 3'
echo ""
echo -e "${CYAN}Test 3 - enviarAlmacen scope:${NC}"
echo '  Collection: shelves/SOL/locations'
echo '  Field: items (debe estar vacío después de enviarAlmacen)'
echo '  Collection: shelves/CAL/locations'
echo '  Field: items (debe seguir teniendo el artículo)'
echo ""
echo -e "${CYAN}Test 4 - CALIDAD TRAER:${NC}"
echo '  Collection: pickupQueue'
echo '  Filter: requestType == "TRAER"'
echo ""
echo -e "${CYAN}Test 7 - Audit log:${NC}"
echo '  Collection: history'
echo '  Filter: articleCode == "ART-005"'
echo '  Check: operarioId es UID (no vacío "")'
echo ""
echo -e "${GREEN}Monitor activo. Vuelve aquí para verificar resultados.${NC}"
echo ""
