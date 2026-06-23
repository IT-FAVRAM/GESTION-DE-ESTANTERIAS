"use strict";
/**
 * Script para actualizar el kiosk de PLEGADORA (device_1781522157962_dp474z)
 * y agregar acceso a AUTOPLEGADORA (CRP, RPL)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlegadoraKiosk = void 0;
const admin = __importStar(require("firebase-admin"));
async function updatePlegadoraKiosk() {
    var _a;
    const db = admin.firestore();
    // Paso 0: Listar dispositivos para encontrar PLEGADORA
    console.log('🔍 Buscando dispositivos de PLEGADORA...');
    const devicesSnap = await db.collection('dispositivos').get();
    let targetDevice = null;
    let deviceId = '';
    for (const doc of devicesSnap.docs) {
        const data = doc.data();
        if (((_a = data.name) === null || _a === void 0 ? void 0 : _a.includes('Plegador')) || data.assignedShelf === 'PLE' || doc.id.includes('ple') || doc.id.includes('plegador')) {
            console.log(`  ✓ Encontrado: ${doc.id} (${data.name || 'sin nombre'}, shelf: ${data.assignedShelf || 'N/A'})`);
            targetDevice = Object.assign({ id: doc.id }, data);
            deviceId = doc.id;
            break;
        }
    }
    if (!targetDevice) {
        console.log('  Listando todos los dispositivos:');
        for (const doc of devicesSnap.docs) {
            const data = doc.data();
            console.log(`  - ${doc.id}: ${data.name || 'sin nombre'} (shelf: ${data.assignedShelf || 'N/A'})`);
        }
        return { ok: false, error: 'No PLEGADORA device found', availableDevices: devicesSnap.docs.map(d => (Object.assign({ id: d.id }, d.data()))) };
    }
    // Paso 1: Usar el dispositivo encontrado
    const deviceDoc = await db.collection('dispositivos').doc(deviceId).get();
    if (!deviceDoc.exists) {
        console.error(`❌ Dispositivo no encontrado: ${deviceId}`);
        return { ok: false, error: 'Device not found' };
    }
    const device = deviceDoc.data();
    let kioskId = device.kioskId;
    const assignedShelf = device.assignedShelf; // Probablemente 'PLE'
    console.log(`📱 Device: ${deviceId}`);
    console.log(`🏷️ KioskId: ${kioskId}`);
    console.log(`📦 Assigned Shelf: ${assignedShelf}`);
    // Si no tiene kioskId, usar el deviceId como kioskId
    if (!kioskId) {
        console.log(`⚠️ Dispositivo sin kioskId, usando deviceId como kioskId`);
        kioskId = deviceId;
        // Actualizar el dispositivo con el kioskId
        await db.collection('dispositivos').doc(deviceId).update({ kioskId });
        console.log(`✅ Dispositivo actualizado con kioskId: ${kioskId}`);
    }
    // Paso 2: Actualizar el documento del kiosk
    const kioskRef = db.collection('kiosks').doc(kioskId);
    const kioskDoc = await kioskRef.get();
    if (!kioskDoc.exists) {
        console.log(`⚠️ Kiosk no existe, creando...`);
        // Crear el documento del kiosk si no existe
        const shelves = [assignedShelf, 'CP1', 'CP2', 'CRP', 'RPL'].filter(Boolean);
        await kioskRef.set({
            id: kioskId,
            name: 'Plegadora',
            shelves,
            location: 'Plegadora',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Kiosk creado con estanterías: ${shelves.join(', ')}`);
    }
    else {
        // Actualizar el documento existente
        const kioskData = kioskDoc.data();
        const currentShelves = kioskData.shelves || [assignedShelf];
        const newShelves = Array.from(new Set([...currentShelves, 'CP1', 'CP2', 'CRP', 'RPL'])).filter(Boolean);
        console.log(`📝 Estanterías actuales: ${currentShelves.join(', ')}`);
        console.log(`📝 Nuevas estanterías: ${newShelves.join(', ')}`);
        await kioskRef.update({
            shelves: newShelves,
            updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Kiosk actualizado`);
    }
    return {
        ok: true,
        deviceId,
        kioskId,
        shelves: ['PLE', 'CP1', 'CP2', 'CRP', 'RPL'],
    };
}
exports.updatePlegadoraKiosk = updatePlegadoraKiosk;
// Ejecutar si es llamado directamente
if (require.main === module) {
    const serviceAccount = require('../../../../../serviceAccount.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'gestion-de-estanterias',
    });
    updatePlegadoraKiosk()
        .then((result) => {
        console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
        process.exit(0);
    })
        .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
}
