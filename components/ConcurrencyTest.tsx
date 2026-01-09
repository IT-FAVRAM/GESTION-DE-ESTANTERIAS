import React, { useState } from 'react';
import { assignItemTransaction } from '../lib/inventoryTransactions';
import { db } from '../lib/firebase';
import { LocationId } from '../lib/warehouseData';

const TEST_LOC = 'MEC-E-URGENTE-B1-MEC 001' as LocationId; // Use a valid location

export const ConcurrencyTest: React.FC = () => {
    const [status, setStatus] = useState<string>('Idle');
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(p => [...p, msg]);

    const runSemultaneousAdds = async () => {
        setStatus('Running...');
        setLogs([]);
        addLog(`Starting simultaneous writes to ${TEST_LOC}`);

        const itemA = { barcode: 'TEST-A', orderId: '1001' };
        const itemB = { barcode: 'TEST-B', orderId: '1002' };

        // 1. Clean location first
        await db.collection("assignments").doc("MEC").collection("locations").doc(TEST_LOC).delete();
        addLog('Cleaned location.');

        // 2. Fire two transactions at once
        const p1 = assignItemTransaction(itemA.barcode, itemA.orderId, TEST_LOC, { user: 'SimUserA' });
        const p2 = assignItemTransaction(itemB.barcode, itemB.orderId, TEST_LOC, { user: 'SimUserB' });

        try {
            await Promise.all([p1, p2]);
            addLog('Both transactions finished.');

            // 3. Verify result
            const doc = await db.collection("assignments").doc("MEC").collection("locations").doc(TEST_LOC).get();
            const data = doc.data();
            const items = data?.items || [];

            addLog(`Final Items in DB: ${JSON.stringify(items)}`);

            const hasA = items.some((i: any) => i.barcode === 'TEST-A');
            const hasB = items.some((i: any) => i.barcode === 'TEST-B');

            if (hasA && hasB) {
                setStatus('SUCCESS: Both items exist! Concurrency handled.');
            } else {
                setStatus('FAILURE: Data loss detected.');
            }

        } catch (e: any) {
            addLog(`Error: ${e.message}`);
            setStatus('Error during execution');
        }
    };

    return (
        <div style={{ padding: 20, border: '1px solid #ccc', margin: 20 }}>
            <h3>Prueba de Concurrencia</h3>
            <button onClick={runSemultaneousAdds} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Ejecutar Simulación (Race Condition)
            </button>
            <div style={{ marginTop: 20 }}>
                <strong>Status:</strong> {status}
            </div>
            <pre style={{ background: '#f0f0f0', padding: 10, marginTop: 10 }}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </pre>
        </div>
    );
};
