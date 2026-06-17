"use strict";
/**
 * Script para crear los documentos de carros CP1 y CP2 en Firestore
 * si no existen ya.
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
exports.createPlegadoraCarts = void 0;
const admin = __importStar(require("firebase-admin"));
async function createPlegadoraCarts() {
    const db = admin.firestore();
    const carts = [
        {
            code: 'CP1',
            name: 'Carro Plegadora 1',
            section: 'PLEGADORA',
            type: 'cart',
            locationCount: 4,
        },
        {
            code: 'CP2',
            name: 'Carro Plegadora 2',
            section: 'PLEGADORA',
            type: 'cart',
            locationCount: 4,
        },
    ];
    for (const cart of carts) {
        const shelfRef = db.collection('shelves').doc(cart.code);
        const shelfDoc = await shelfRef.get();
        if (!shelfDoc.exists) {
            console.log(`📝 Creando carro: ${cart.code} (${cart.name})`);
            // Crear estructura de ubicaciones
            const locations = {};
            for (let i = 1; i <= cart.locationCount; i++) {
                locations[String(i)] = {
                    position: String(i),
                    items: [],
                    occupied: 0,
                    available: 0,
                    totalCapacity: 1,
                };
            }
            await shelfRef.set(Object.assign(Object.assign({}, cart), { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
            // Crear documentos de ubicaciones
            const locationsRef = shelfRef.collection('locations');
            for (let i = 1; i <= cart.locationCount; i++) {
                const pos = String(i);
                await locationsRef.doc(pos).set({
                    position: pos,
                    items: [],
                    occupied: 0,
                    available: 0,
                    totalCapacity: 1,
                });
            }
            console.log(`✅ Carro creado: ${cart.code}`);
        }
        else {
            console.log(`⏭️ Carro ya existe: ${cart.code}`);
        }
    }
    return {
        ok: true,
        message: 'Carros de PLEGADORA verificados/creados',
    };
}
exports.createPlegadoraCarts = createPlegadoraCarts;
// Ejecutar si es llamado directamente
if (require.main === module) {
    const serviceAccount = require('../../../../../serviceAccount.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'gestion-de-estanterias',
    });
    createPlegadoraCarts()
        .then((result) => {
        console.log('\n✨ Resultado:', JSON.stringify(result, null, 2));
        process.exit(0);
    })
        .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
}
