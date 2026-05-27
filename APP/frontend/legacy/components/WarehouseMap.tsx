





import React from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { WarehouseConfig } from '../hooks/useWarehouseConfig';
import { InfoIcon } from './Icons';

interface WarehouseMapProps {
    activeWarehouse: string;
    assignments: Assignments;
    onCellClick: (locationId: LocationId) => void;
    config: WarehouseConfig;
}

// Helper to find if an item is spread across multiple locations (Multi-Slot visualization)
const getItemMultiSlotStatus = (assignments: Assignments, barcode: string, orderId: string) => {
    let count = 0;
    for (const loc in assignments) {
        if (assignments[loc as LocationId].some(i => i.barcode === barcode && i.orderId === orderId)) {
            count++;
        }
    }
    return count > 1;
};

const WarehouseMap: React.FC<WarehouseMapProps> = ({ activeWarehouse, assignments, onCellClick, config }) => {

    // --- RENDER CELL HELPER ---
    const renderGenericCell = (locId: LocationId, label: number | string, isRed: boolean = false, isYellow: boolean = false) => {
        const items = assignments[locId] || [];
        const isOccupied = items.length > 0;
        const isMultiSlot = isOccupied && getItemMultiSlotStatus(assignments, items[0].barcode, items[0].orderId);

        return (
            <button
                key={String(label)}
                onClick={() => onCellClick(locId)}
                className={`
                    aspect-square rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center relative shadow-sm min-h-[50px]
                    ${isOccupied
                        ? isRed
                            ? 'bg-red-600 border-red-800 text-white shadow-md'
                            : isMultiSlot
                                ? 'bg-purple-600 border-purple-700 text-white'
                                : 'bg-slate-700 border-slate-800 text-white'
                        : isRed
                            ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                            : isYellow
                                ? 'bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100'
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }
                    ${isRed && isOccupied ? 'ring-2 ring-red-400 ring-offset-1 dark:ring-offset-slate-900' : ''}
                    ${isYellow && isOccupied ? 'border-yellow-500 ring-2 ring-yellow-500 ring-offset-1' : ''}
                `}
            >
                <span className={`absolute top-0.5 left-1 text-[10px] font-bold opacity-60 ${isRed && !isOccupied ? 'text-red-600' : ''}`}>{label}</span>
                {isOccupied ? (
                    <span className="font-bold text-xs truncate w-full px-1 text-center">{items[0].barcode.slice(0, 6)}..</span>
                ) : (
                    <span className="text-xl opacity-20">•</span>
                )}
            </button>
        );
    }

    // --- CUSTOM LAYOUT FOR SOLDADURA (SOL) ---
    if (activeWarehouse === 'SOL') {
        const pad3 = (n: number) => n.toString().padStart(3, '0');
        const s1 = (pos: number) => `SOL-E1-B1-SOL ${pad3(pos)}` as LocationId;
        const s2 = (pos: number) => `SOL-E2-B1-SOL ${pad3(pos)}` as LocationId;

        return (
            <div className="flex flex-col gap-8 p-2 overflow-x-auto">

                {/* BLOQUE SUPERIOR (ESTANTERÍA A) */}
                <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-300 dark:border-slate-700 min-w-[600px]">
                    <h3 className="text-center mb-4 font-bold text-slate-600 dark:text-slate-300">Estantería Principal</h3>
                    <div className="flex gap-6 justify-center">
                        {/* Columna Roja (1-4) */}
                        <div className="flex flex-col gap-2 w-16 justify-end">
                            {renderGenericCell(s1(4), 4, true)}
                            {renderGenericCell(s1(3), 3, true)}
                            {renderGenericCell(s1(2), 2, true)}
                            {renderGenericCell(s1(1), 1, true)}
                        </div>

                        {/* Columna (5-10) */}
                        <div className="flex flex-col gap-2 w-24 justify-start">
                            <div className="flex gap-2">{renderGenericCell(s2(9), 9)} {renderGenericCell(s2(10), 10)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(7), 7)} {renderGenericCell(s2(8), 8)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(5), 5)} {renderGenericCell(s2(6), 6)}</div>
                        </div>

                        {/* Columna (17-25) */}
                        <div className="flex flex-col gap-2 w-36 justify-start">
                            <div className="flex gap-2">{renderGenericCell(s2(23), 23)} {renderGenericCell(s2(24), 24)} {renderGenericCell(s2(25), 25)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(20), 20)} {renderGenericCell(s2(21), 21)} {renderGenericCell(s2(22), 22)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(17), 17)} {renderGenericCell(s2(18), 18)} {renderGenericCell(s2(19), 19)}</div>
                        </div>

                        {/* Columna (32-40) */}
                        <div className="flex flex-col gap-2 w-36 justify-start">
                            <div className="flex gap-2">{renderGenericCell(s2(38), 38)} {renderGenericCell(s2(39), 39)} {renderGenericCell(s2(40), 40)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(35), 35)} {renderGenericCell(s2(36), 36)} {renderGenericCell(s2(37), 37)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(32), 32)} {renderGenericCell(s2(33), 33)} {renderGenericCell(s2(34), 34)}</div>
                        </div>

                        {/* Columna (41-49) */}
                        <div className="flex flex-col gap-2 w-36 justify-start">
                            <div className="flex gap-2">{renderGenericCell(s2(47), 47)} {renderGenericCell(s2(48), 48)} {renderGenericCell(s2(49), 49)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(44), 44)} {renderGenericCell(s2(45), 45)} {renderGenericCell(s2(46), 46)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(41), 41)} {renderGenericCell(s2(42), 42)} {renderGenericCell(s2(43), 43)}</div>
                        </div>

                        {/* Columna (50-58) */}
                        <div className="flex flex-col gap-2 w-36 justify-start">
                            <div className="flex gap-2">{renderGenericCell(s2(56), 56)} {renderGenericCell(s2(57), 57)} {renderGenericCell(s2(58), 58)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(53), 53)} {renderGenericCell(s2(54), 54)} {renderGenericCell(s2(55), 55)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(50), 50)} {renderGenericCell(s2(51), 51)} {renderGenericCell(s2(52), 52)}</div>
                        </div>

                        {/* Columna (59-67) */}
                        <div className="flex flex-col gap-2 w-36 justify-start">
                            <div className="flex gap-2">{renderGenericCell(s2(65), 65)} {renderGenericCell(s2(66), 66)} {renderGenericCell(s2(67), 67)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(62), 62)} {renderGenericCell(s2(63), 63)} {renderGenericCell(s2(64), 64)}</div>
                            <div className="flex gap-2">{renderGenericCell(s2(59), 59)} {renderGenericCell(s2(60), 60)} {renderGenericCell(s2(61), 61)}</div>
                        </div>

                        {/* Columna (68-70) */}
                        <div className="flex flex-col gap-2 w-36 justify-start">
                            <div className="flex gap-2">{renderGenericCell(s2(68), 68)} {renderGenericCell(s2(69), 69)} {renderGenericCell(s2(70), 70)}</div>
                        </div>
                    </div>
                </div>

                {/* BLOQUE INFERIOR (ESTANTERÍA B / MESA) */}
                <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-300 dark:border-slate-700 min-w-[500px]">
                    <h3 className="text-center mb-4 font-bold text-slate-600 dark:text-slate-300">Estantería Secundaria</h3>
                    <div className="flex gap-8 justify-center items-start">

                        {/* Columna 11-13 */}
                        <div className="flex flex-col gap-2 w-16">
                            {renderGenericCell(s2(11), 11)}
                            {renderGenericCell(s2(12), 12)}
                            {renderGenericCell(s2(13), 13)}
                        </div>

                        {/* Bloque 14-16 */}
                        <div className="flex gap-2 w-36">
                            {renderGenericCell(s2(14), 14)}
                            {renderGenericCell(s2(15), 15)}
                            {renderGenericCell(s2(16), 16)}
                        </div>

                        {/* Bloque Derecho (29-31 arriba, 26-28 abajo) */}
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2">
                                {renderGenericCell(s2(29), 29)}
                                {renderGenericCell(s2(30), 30)}
                                {renderGenericCell(s2(31), 31)}
                            </div>
                            <div className="flex gap-2">
                                {renderGenericCell(s2(26), 26)}
                                {renderGenericCell(s2(27), 27)}
                                {renderGenericCell(s2(28), 28)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- CUSTOM LAYOUT FOR ROBOT SOLDADURA (RSO) ---
    if (activeWarehouse === 'RSO') {
        const leftCol = ['ROB.SOL 001', 'ROB.SOL 003', 'ROB.SOL 005', 'ROB.SOL 007'];
        const rightCol = ['ROB.SOL 002', 'ROB.SOL 004', 'ROB.SOL 006', 'ROB.SOL 008'];

        return (
            <div className="max-w-md mx-auto p-4">
                <div className="bg-slate-100 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-300 dark:border-slate-700 shadow-lg">
                    <h3 className="text-center mb-6 font-black text-lg">Robot Soldadura</h3>
                    <div className="flex justify-center gap-6">
                        <div className="flex flex-col gap-3">
                            {leftCol.map(pos => renderGenericCell(`RSO-E1-B1-${pos}` as LocationId, pos.replace('ROB.SOL ', '')))}
                        </div>
                        <div className="flex flex-col gap-3">
                            {rightCol.map(pos => renderGenericCell(`RSO-E1-B1-${pos}` as LocationId, pos.replace('ROB.SOL ', '')))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- CUSTOM LAYOUT FOR ZINCADO (ZIN) ---
    if (activeWarehouse === 'ZIN') {
        const racks = [5, 4, 3, 2, 1];

        return (
            <div className="max-w-sm mx-auto p-4">
                <div className="bg-slate-100 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-300 dark:border-slate-700 shadow-lg">
                    <h3 className="text-center mb-6 font-black text-lg">Estantería Zincado</h3>
                    <div className="flex flex-col items-center gap-3">
                        {racks.map(r => (
                            <div key={r} className="w-full flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400 w-12 text-right">Balda {r}</span>
                                <div className="flex-grow">
                                    {renderGenericCell(`ZIN-E1-B${r}-1` as LocationId, `Posición 1`)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // --- CUSTOM LAYOUT FOR RPL (ROBOT PLEGADO) ---
    if (activeWarehouse === 'RPL') {
        const pad3 = (n: number) => n.toString().padStart(3, '0');
        const est1 = Array.from({ length: 14 }, (_, i) => `ROB.PLE ${pad3(i + 1)}`);
        const est2 = Array.from({ length: 21 }, (_, i) => `ROB.PLE ${pad3(i + 15)}`);

        return (
            <div className="flex flex-col gap-6 p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Estantería 1 */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 text-center">Estantería 1</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {est1.map(pos => renderGenericCell(`RPL-E1-B1-${pos}` as LocationId, pos.replace('ROB.PLE ', '')))}
                        </div>
                    </div>
                    {/* Estantería 2 */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 text-center">Estantería 2</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {est2.map(pos => renderGenericCell(`RPL-E2-B1-${pos}` as LocationId, pos.replace('ROB.PLE ', '')))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeWarehouse === 'COM') {
        const pad3 = (n: number) => n.toString().padStart(3, '0');
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Estanterías 1-6 (Ahora COM 001 - COM 018) */}
                {[1, 2, 3, 4, 5, 6].map(shelf => (
                    <div key={shelf} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 text-center pb-2 border-b border-slate-100 dark:border-slate-800">Balda {shelf}</h3>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3].map(i => {
                                        const num = (shelf - 1) * 3 + i;
                                        const label = `COM ${pad3(num)}`;
                                        return renderGenericCell(`COM-E${shelf}-B1-${label}` as LocationId, label);
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Fallback to GENERIC LAYOUT
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {config.shelves.map(shelf => (
                <div key={shelf} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 text-center pb-2 border-b border-slate-100 dark:border-slate-800">Estantería {shelf}</h3>
                    <div className="space-y-4">
                        {config.racks.map(rack => (
                            <div key={rack} className="flex flex-col gap-1">
                                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide pl-1">Rack {rack}</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {config.positions.map(pos => renderGenericCell(`${activeWarehouse}-E${shelf}-B${rack}-${pos}` as LocationId, pos))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default WarehouseMap;


