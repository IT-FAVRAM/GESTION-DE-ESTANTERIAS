import React, { useState } from 'react';
import { InboundOrder } from '../lib/warehouseData';
import { UserRole } from '../hooks/useRoles';
import { useInboundOrders } from '../hooks/useInboundOrders';
import { PlusCircleIcon, TrashIcon, LoadingIcon, ErrorIcon } from './Icons';

interface InboundManagementProps {
    role: UserRole | null;
}

export const InboundManagement: React.FC<InboundManagementProps> = ({ role }) => {
    const { orders, loading, error, createOrder, updateOrder, deleteOrder } = useInboundOrders(100);
    const [localError, setLocalError] = useState<string | null>(null);

    // New Order Form
    const [isCreating, setIsCreating] = useState(false);
    const [newOrderNumber, setNewOrderNumber] = useState('');
    const [newSupplier, setNewSupplier] = useState('');
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newDateSolicitud, setNewDateSolicitud] = useState(new Date().toISOString().split('T')[0]);
    const [newDatePrometida, setNewDatePrometida] = useState('');

    const handleCreate = async () => {
        if (!newOrderNumber || !newSupplier || !newDateSolicitud) return;

        const order: InboundOrder = {
            orderNumber: newOrderNumber,
            supplierId: newSupplier,
            supplierName: newSupplierName || newSupplier,
            status: 'SOLICITADO',
            fecha_solicitud: new Date(newDateSolicitud).toISOString(),
            fecha_prometida: newDatePrometida ? new Date(newDatePrometida).toISOString() : undefined,
            createdAt: new Date().toISOString(),
            createdBy: 'user', // We might want email here if available
            updatedAt: new Date().toISOString(),
            updatedBy: 'user'
        };

        const result = await createOrder(order);
        if (result.success) {
            setIsCreating(false);
            setNewOrderNumber('');
            setNewSupplier('');
            setNewSupplierName('');
            setNewDateSolicitud(new Date().toISOString().split('T')[0]);
            setNewDatePrometida('');
            setLocalError(null);
        } else {
            setLocalError(result.error || "Error creando pedido");
        }
    };

    const handleUpdateStatus = async (orderId: string, updates: Partial<InboundOrder>) => {
        const result = await updateOrder(orderId, updates);
        if (!result.success) {
            setLocalError(result.error || "Error actualizando pedido");
        } else {
            // Optional: Show success feedback?
        }
    };

    const handleDelete = async (orderId: string) => {
        if (!confirm('¿Eliminar pedido?')) return;
        const result = await deleteOrder(orderId);
        if (!result.success) {
            setLocalError(result.error || "Error borrando pedido");
        }
    };

    const canEdit = role === 'ADMIN' || role === 'JEFE';
    const canDelete = role === 'ADMIN';

    if (loading) return <div className="p-4 text-white"><LoadingIcon className="animate-spin h-6 w-6" /> Cargando pedidos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Gestión de Pedidos de Entrada</h3>
                {canEdit && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold"
                    >
                        <PlusCircleIcon className="h-5 w-5" /> Nuevo Pedido
                    </button>
                )}
            </div>

            {(error || localError) && (
                <div className="bg-red-900/50 p-4 rounded border border-red-500 text-red-100 flex gap-2">
                    <ErrorIcon className="h-5 w-5" /> {error || localError}
                </div>
            )}

            {/* CREATE FORM */}
            {isCreating && (
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-slide-up">
                    <h4 className="font-bold text-cyan-400 mb-4">Registrar Nuevo Pedido</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input type="text" placeholder="Número Pedido (OF)" value={newOrderNumber} onChange={e => setNewOrderNumber(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        <input type="text" placeholder="ID Proveedor" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        <input type="text" placeholder="Nombre Proveedor (Opcional)" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-slate-400 block">Fecha Solicitud</label>
                                <input type="date" value={newDateSolicitud} onChange={e => setNewDateSolicitud(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-slate-400 block">Fecha Prometida</label>
                                <input type="date" value={newDatePrometida} onChange={e => setNewDatePrometida(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white px-4 py-2">Cancelar</button>
                        <button onClick={handleCreate} className="bg-cyan-600 text-white px-6 py-2 rounded font-bold hover:bg-cyan-500">Guardar</button>
                    </div>
                </div>
            )}

            {/* ORDER LIST */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-400">
                        <tr>
                            <th className="px-4 py-3">OF / Pedido</th>
                            <th className="px-4 py-3">Proveedor</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3">Fechas Clave</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {orders.map(order => (
                            <tr key={order.orderNumber} className="hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-mono text-white font-bold">{order.orderNumber}</td>
                                <td className="px-4 py-3">
                                    <div className="text-white">{order.supplierName}</div>
                                    <div className="text-xs text-slate-500">{order.supplierId}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'DISPONIBLE' ? 'bg-green-900/50 text-green-400' :
                                        order.status === 'EN_MUELLE' ? 'bg-yellow-900/50 text-yellow-400' :
                                            'bg-slate-700 text-slate-300'
                                        }`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs space-y-1">
                                    <div>Sol: {new Date(order.fecha_solicitud).toLocaleDateString()}</div>
                                    {order.fecha_recepcion_muelle && <div className="text-yellow-400">Muelle: {new Date(order.fecha_recepcion_muelle).toLocaleDateString()}</div>}
                                    {order.fecha_disponible_estanteria && <div className="text-green-400">Disp: {new Date(order.fecha_disponible_estanteria).toLocaleDateString()}</div>}
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    {canEdit && !order.fecha_recepcion_muelle && (
                                        <button
                                            onClick={() => handleUpdateStatus(order.orderNumber, {
                                                status: 'EN_MUELLE',
                                                fecha_recepcion_muelle: new Date().toISOString()
                                            })}
                                            className="bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white px-2 py-1 rounded text-xs font-bold border border-yellow-600/50 transition-colors"
                                            title="Confirmar llegada a muelle"
                                        >
                                            Llegada Muelle
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => handleDelete(order.orderNumber)} className="text-slate-600 hover:text-red-500 transition-colors">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {orders.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500 italic">No hay pedidos registrados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
