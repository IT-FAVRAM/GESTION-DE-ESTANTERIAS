import React, { useState, useEffect } from 'react';
import { db, auth } from '../legacy/firebaseCompat';
import firebase from 'firebase/compat/app';
import { CheckIcon, LoadingIcon, MapIcon, BoxIcon, CloseIcon } from './Icons';

interface MaterialRequest {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    readBy: string[];
    status?: 'PENDING' | 'COMPLETED';
    completedBy?: string;
    completedAt?: string;
    metadata?: {
        barcode?: string;
        location?: string;
        priority?: 'high' | 'normal';
    };
}

interface CarretilleroRequestsViewProps {
    onNavigateToLocation?: (location: string) => void;
}

function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `hace ${days}d`;
    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}min`;
    return 'ahora';
}

const CarretilleroRequestsView: React.FC<CarretilleroRequestsViewProps> = ({ onNavigateToLocation }) => {
    const [requests, setRequests] = useState<MaterialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        const unsub = db.collection('notifications')
            .where('targetRole', '==', 'CARRETILLERO')
            .where('type', '==', 'request_material')
            .orderBy('timestamp', 'desc')
            .limit(1000)
            .onSnapshot(snap => {
                const items: MaterialRequest[] = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    items.push({ id: doc.id, ...data } as MaterialRequest);
                });
                // Sort by timestamp descending
                items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setRequests(items);
                setLoading(false);
            });

        return () => unsub();
    }, []);

    const markAsComplete = async (requestId: string) => {
        if (!auth.currentUser || processingId) return;
        setProcessingId(requestId);
        try {
            await db.collection('notifications').doc(requestId).update({
                status: 'COMPLETED',
                completedBy: auth.currentUser.uid,
                completedAt: new Date().toISOString(),
                readBy: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
            });
        } catch (e) {
            console.error("Error marcando solicitud como completada:", e);
        } finally {
            setProcessingId(null);
        }
    };

    const pendingRequests = requests.filter(r => r.status !== 'COMPLETED');
    const completedRequests = requests.filter(r => r.status === 'COMPLETED');

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <LoadingIcon className="h-10 w-10 text-cyan-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 pb-20 space-y-6 animate-fade-in">
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                📦 Solicitudes de Material
            </h2>

            {/* PENDING REQUESTS */}
            <div>
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                    Pendientes ({pendingRequests.length})
                </h3>
                {pendingRequests.length === 0 ? (
                    <div className="text-center py-8 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <p className="text-slate-500 dark:text-slate-400">👍 No hay solicitudes pendientes</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingRequests.map(req => (
                            <div key={req.id} className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border p-4 ${req.metadata?.priority === 'high' ? 'border-red-400 ring-2 ring-red-400/50' : 'border-slate-200 dark:border-slate-700'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-800 dark:text-white">{req.title}</h4>
                                    <span className="text-xs text-slate-400">{timeAgo(req.timestamp)}</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{req.message}</p>

                                {req.metadata?.barcode && (
                                    <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 mb-2">🔖 {req.metadata.barcode}</p>
                                )}
                                {req.metadata?.location && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">📍 {req.metadata.location}</p>
                                )}

                                <div className="flex gap-2">
                                    {req.metadata?.location && onNavigateToLocation && (
                                        <button
                                            onClick={() => onNavigateToLocation(req.metadata!.location!)}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <MapIcon className="h-5 w-5" /> Ver Ubicación
                                        </button>
                                    )}
                                    <button
                                        onClick={() => markAsComplete(req.id)}
                                        disabled={processingId === req.id}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {processingId === req.id ? <LoadingIcon className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5" />}
                                        Completado
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* COMPLETED REQUESTS */}
            {completedRequests.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">
                        Completadas Hoy ({completedRequests.length})
                    </h3>
                    <div className="space-y-2 opacity-60">
                        {completedRequests.slice(0, 5).map(req => (
                            <div key={req.id} className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-sm text-slate-600 dark:text-slate-300 line-through">{req.title}</p>
                                    {req.metadata?.barcode && <p className="text-xs text-slate-400">{req.metadata.barcode}</p>}
                                </div>
                                <CheckIcon className="h-5 w-5 text-emerald-500" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarretilleroRequestsView;
