




import React, { useState } from 'react';
import { Assignments, LocationId } from '../lib/warehouseData';
import { GenericShelfListView } from './GenericShelfListView';
import { useRoles } from '../hooks/useRoles';
import ShelfDetailModal from './ShelfDetailModal';
import { CartItem } from '../hooks/useCarts'; // Reusing interface but mapping on fly

interface CartWarehouseViewProps {
    activeWarehouse: string;
    assignments: Assignments;
    onViewLocation: (locationId: LocationId) => void;
    onAddLocation: (locationId: LocationId) => void;
    onDirectAssign: (barcode: string, orderId: string, location: LocationId) => void;
    onInitiateDelete: (barcode: string, location: LocationId, orderId?: string) => void;
    onDirectRemove: (barcode: string, location: LocationId, orderId: string) => void;
}

export const CartWarehouseView: React.FC<CartWarehouseViewProps> = ({ 
    activeWarehouse, 
    assignments, 
    onDirectAssign,
    onInitiateDelete,
    onDirectRemove
}) => {
    const { role } = useRoles();
    const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<'view' | 'add_choice'>('view');
    
    // Determine configuration based on warehouse code
    let title = activeWarehouse;
    let shelvesCount = 0;

    if (activeWarehouse === 'CSO') {
        title = 'Carro Soldadura';
        shelvesCount = 8;
    } else if (activeWarehouse === 'CXP') {
        title = 'Carro SXP';
        shelvesCount = 4;
    } else if (activeWarehouse === 'CRP') {
        title = 'Carro Rob. Plegado';
        shelvesCount = 4;
    }

    const shelves = Array.from({ length: shelvesCount }, (_, i) => i + 1);

    const getLocId = (shelfId: string) => `${activeWarehouse}-E${shelfId}-B1-1` as LocationId;

    const getItemCount = (shelfId: string) => {
        const locId = getLocId(shelfId);
        return assignments[locId]?.length || 0;
    };

    const handleViewList = (shelfId: string) => {
        setActiveShelfId(shelfId);
        setModalMode('view');
    };

    const handleAdd = (shelfId: string) => {
        setActiveShelfId(shelfId);
        setModalMode('add_choice');
    };

    // --- DATA MAPPING & ACTIONS FOR MODAL ---

    // Map AssignmentItems to CartItems interface for compatibility with ShelfDetailModal
    const currentShelfItems: CartItem[] = activeShelfId ? (assignments[getLocId(activeShelfId)] || []).map(item => ({
        id: `${item.barcode}-${item.orderId}`, // Synthetic ID
        shelfId: activeShelfId,
        type: item.orderId === 'GENERAL' ? 'plain' : 'article',
        description: item.orderId === 'GENERAL' ? item.barcode : item.barcode, // Barcode holds text in free text mode
        barcode: item.barcode,
        orderId: item.orderId,
        addedBy: 'system', // Not tracking user here in local state
        createdAt: item.timestamp
    })) : [];

    const handleAddItem = async (type: 'article' | 'plain', data: any) => {
        if (!activeShelfId) return;
        const locId = getLocId(activeShelfId);
        
        if (type === 'article') {
            onDirectAssign(data.barcode, data.orderId, locId);
        } else {
            // Store free text: Barcode = Text, OrderId = GENERAL
            onDirectAssign(data.description, 'GENERAL', locId);
        }
    };

    const handleRemoveItems = async (ids: string[]) => {
        if (!activeShelfId) return;
        const locId = getLocId(activeShelfId);
        
        ids.forEach(id => {
            // Parse ID or find item
            const item = currentShelfItems.find(i => i.id === id);
            if (item && item.barcode && item.orderId) {
                onDirectRemove(item.barcode, locId, item.orderId);
            }
        });
    };

    const handleMoveItems = async (ids: string[], targetShelfId: string) => {
        if (!activeShelfId) return;
        const targetLocId = getLocId(targetShelfId);
        const sourceLocId = getLocId(activeShelfId);

        ids.forEach(id => {
            const item = currentShelfItems.find(i => i.id === id);
            if (item && item.barcode && item.orderId) {
                // 1. Add to new location
                onDirectAssign(item.barcode, item.orderId, targetLocId);
                // 2. Remove from old location
                onDirectRemove(item.barcode, sourceLocId, item.orderId);
            }
        });
    };

    return (
        <>
            <GenericShelfListView
                title={title}
                shelves={shelves}
                getItemCount={getItemCount}
                onViewList={handleViewList}
                onAdd={handleAdd}
                loading={false}
                userRole={role!}
            />

            {activeShelfId && (
                <ShelfDetailModal 
                    cartName={title}
                    shelfId={activeShelfId}
                    shelfLabel={`Balda ${activeShelfId}`}
                    items={currentShelfItems}
                    onClose={() => setActiveShelfId(null)}
                    onAddItem={handleAddItem}
                    onRemoveItems={handleRemoveItems}
                    onMoveItems={handleMoveItems}
                    availableShelves={shelves}
                    userRole={role!}
                    initialMode={modalMode}
                />
            )}
        </>
    );
};