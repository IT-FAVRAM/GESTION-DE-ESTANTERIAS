const admin = require('../APP/backend/node_modules/firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccount.json'))
});

const { shelfOperate } = require('../APP/backend/lib/src/index.js');

const CSV_PATH = path.join(__dirname, '../resultados_pruebas_QA.csv');
const ARTICLE = 'TEST-QA-001';
const ORDER = 'OF-TEST-999';

const ROLES_TO_TEST = [
  { role: 'ADMIN', section: null, device: 'Desktop', inputMethod: 'TEXTO_MANUAL' },
  { role: 'CARRETILLERO', section: null, device: 'Mobile', inputMethod: 'QR_PISTOLA' },
  { role: 'JEFE_SECCION', section: 'PRENSAS', device: 'Desktop', inputMethod: 'TEXTO_MANUAL' },
  { role: 'OPERARIO', section: 'PRENSAS', device: 'Mobile', inputMethod: 'OCR' }
];

async function runTest() {
  let csvContent = 'FechaHora,Rol,Dispositivo,Flujo,Metodo_Entrada,Resultado,Detalle_Error\n';
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const writeResult = (role, device, flow, inputMethod, result, detail = 'N/A') => {
    const safeDetail = detail.replace(/,/g, ';').replace(/\n/g, ' ');
    const line = `${nowStr},${role},${device},${flow},${inputMethod},${result},${safeDetail}\n`;
    csvContent += line;
    console.log(line.trim());
  };

  const getMockContext = (roleObj) => ({
    auth: {
      uid: `test-${roleObj.role.toLowerCase()}`,
      token: {
        role: roleObj.role,
        section: roleObj.section,
        email: `test-${roleObj.role.toLowerCase()}@example.com`,
        firebase: { sign_in_provider: 'password' }
      }
    }
  });

  const cleanup = async () => {
      console.log('--- Cleaning up test state ---');
      try {
          const aggRef = admin.firestore().collection('itemAggregates').doc(`${ARTICLE}__${ORDER}`);
          const aggSnap = await aggRef.get();
          if (aggSnap.exists) {
            const presenceIds = aggSnap.data().activePresenceIds || [];
            for (const pid of presenceIds) {
               await admin.firestore().collection('items').doc(pid).delete();
            }
          }
          await aggRef.delete();
      } catch (e) {}
  };

  for (const t of ROLES_TO_TEST) {
    console.log(`\nTesting Role: ${t.role}`);
    await cleanup();
    const context = getMockContext(t);

    // Flujo 1: UBICAR MULTI
    try {
      await shelfOperate.run({
        op: 'ubicarMulti',
        payload: {
          shelfCode: 'PME',
          articleCode: ARTICLE,
          orderFab: ORDER,
          positions: ['URG MEC-PRE 001', 'URG MEC-PRE 002']
        }
      }, context);
      writeResult(t.role, t.device, 'UBICAR', t.inputMethod, 'PASS');
    } catch (e) {
      writeResult(t.role, t.device, 'UBICAR', t.inputMethod, 'FAIL', e.message);
      continue;
    }

    // Flujo 2: MOVER
    try {
      await shelfOperate.run({
        op: 'mover',
        payload: {
          shelfCode: 'PME',
          articleCode: ARTICLE,
          orderFab: ORDER,
          newPositions: ['URG MEC-PRE 003', 'URG MEC-PRE 004']
        }
      }, context);
      writeResult(t.role, t.device, 'MOVER', t.inputMethod, 'PASS');
    } catch (e) {
      writeResult(t.role, t.device, 'MOVER', t.inputMethod, 'FAIL', e.message);
    }

    // Flujo 3: REUBICAR (Solo ADMIN)
    if (t.role === 'ADMIN') {
        try {
          await shelfOperate.run({
            op: 'reubicar',
            payload: {
              shelfCode: 'PME',
              fromShelfCode: 'PME',
              toShelfCode: 'ALMACEN',
              articleCode: ARTICLE,
              orderFab: ORDER,
              newPositions: ['POS-TEMP-1', 'POS-TEMP-2']
            }
          }, context);
          writeResult(t.role, t.device, 'REUBICAR', t.inputMethod, 'PASS');
        } catch (e) {
          writeResult(t.role, t.device, 'REUBICAR', t.inputMethod, 'FAIL', e.message);
        }
    }

    // Flujo 4: ENVIAR ALMACEN o RETIRAR
    if (['CARRETILLERO', 'ADMIN'].includes(t.role)) {
       try {
        await shelfOperate.run({
          op: 'enviarAlmacen',
          payload: {
            shelfCode: t.role === 'ADMIN' ? 'ALMACEN' : 'PME',
            articleCode: ARTICLE,
            orderFab: ORDER
          }
        }, context);
        writeResult(t.role, t.device, 'ALMACEN', t.inputMethod, 'PASS');
      } catch (e) {
        writeResult(t.role, t.device, 'ALMACEN', t.inputMethod, 'FAIL', e.message);
      }
    } else {
       // Flujo 5: RETIRAR
       try {
        await shelfOperate.run({
          op: 'retirar',
          payload: {
            shelfCode: 'PME',
            articleCode: ARTICLE,
            orderFab: ORDER
          }
        }, context);
        writeResult(t.role, t.device, 'RETIRAR', t.inputMethod, 'PASS');
      } catch (e) {
        writeResult(t.role, t.device, 'RETIRAR', t.inputMethod, 'FAIL', e.message);
      }
    }
  }

  await cleanup();
  fs.writeFileSync(CSV_PATH, csvContent, 'utf8');
  console.log(`\n✅ Resultados guardados en: ${CSV_PATH}`);
  process.exit(0);
}

runTest();
