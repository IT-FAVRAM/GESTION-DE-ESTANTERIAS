
import React, { useState } from 'react';
import { CARTS_CONFIG, useCarts } from '../hooks/useCarts';
import { ShoppingCartIcon, ChevronRightIcon } from './Icons';
import ShelfDetailModal from './ShelfDetailModal';
import { UserRole } from '../hooks/useRoles';
import { GenericShelfListView } from './GenericShelfListView';

// Define the type for a single cart configuration item
type CartConfigItem = typeof CARTS_CONFIG[number];

interface CartCardProps {
    cart: CartConfigItem;
    onClick: () => void;
}

const CartCard: React.FC<CartCardProps> = ({ cart, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-cyan-500 transition-all text-left flex flex-col justify-between h-40 group relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShoppingCartIcon className="h-24 w-24" />
            </div>
            <div>
                <h3 className="font-black text-xl text-slate-800 dark:text-white uppercase leading-tight mb-2 pr-8">{cart.name}</h3>
                <p className="text-slate-500 text-sm font-medium">{cart.shelves} Baldas</p>
            </div>
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-sm">
                <span>Abrir Carro</span>
                <ChevronRightIcon className="h-4 w-4" />
            </div>
        </button>
    );
};

interface CartsViewProps {
    userRole: string;
}

const CartsView: React.FC<CartsViewProps> = ({ userRole }) => {
    const [activeCartId, setActiveCartId] = useState<string | null>(null);
    const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<'view' | 'add_choice'>('view');

    // This hook will only activate when we select a cart
    const { items, addItem, removeItems, moveItems, loading } = useCarts(activeCartId);

    const activeCartConfig = CARTS_CONFIG.find(c => c.id === activeCartId);

    const getShelfItemCount = (shelfId: string) => {
        return items.filter(i => i.shelfId === shelfId).length;
    };

    if (activeCartId && activeCartConfig) {
        const shelves = Array.from({ length: activeCartConfig.shelves }, (_, i) => i + 1);

        return (
            <>
                <GenericShelfListView 
                    title={activeCartConfig.name}
                    shelves={shelves}
                    getItemCount={getShelfItemCount}
                    loading={loading}
                    userRole={userRole}
                    onBack={() => setActiveCartId(null)}
                    onViewList={(shelfId) => {
                        setModalMode('view');
                        setActiveShelfId(shelfId);
                    }}
                    onAdd={(shelfId) => {
                        setModalMode('add_choice');
                        setActiveShelfId(shelfId);
                    }}
                />

                {activeShelfId && (
                    <ShelfDetailModal 
                        cartName={activeCartConfig.name}
                        shelfId={activeShelfId}
                        shelfLabel={`Balda ${activeShelfId}`}
                        items={items.filter(i => i.shelfId === activeShelfId)}
                        onClose={() => setActiveShelfId(null)}
                        onAddItem={async (type, data) => addItem(activeShelfId, type, data)}
                        onRemoveItems={removeItems}
                        onMoveItems={moveItems}
                        availableShelves={shelves}
                        userRole={userRole}
                        initialMode={modalMode}
                    />
                )}
            </>
        );
    }

    // --- MAIN CARTS LIST ---
    return (
        <div className="pb-24 max-w-5xl mx-auto">
            <div className="flex flex-col items-center justify-center gap-2 mb-8 text-center">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
                    <ShoppingCartIcon className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Carros de Material</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
                    Gestión manual de piezas pequeñas y material auxiliar.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
                {CARTS_CONFIG.map(cart => (
                    <CartCard key={cart.id} cart={cart} onClick={() => setActiveCartId(cart.id)} />
                ))}
            </div>
        </div>
    );
};

export default CartsView;
