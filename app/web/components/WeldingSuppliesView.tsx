
import React, { useState } from 'react';
import { useWeldingSupplies } from '../hooks/useWeldingSupplies';
import ShelfDetailModal from './ShelfDetailModal';
import { UserRole } from '../hooks/useRoles';
import { GenericShelfListView } from './GenericShelfListView';

interface WeldingSuppliesViewProps {
    userRole: any;
}

const WeldingSuppliesView: React.FC<WeldingSuppliesViewProps> = ({ userRole }) => {
    const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<'view' | 'add_choice'>('view');

    const { items, addItem, removeItems, moveItems, loading } = useWeldingSupplies();

    const TOTAL_SHELVES = 8;
    const shelves = Array.from({ length: TOTAL_SHELVES }, (_, i) => i + 1);

    const getShelfItemCount = (shelfId: string) => {
        return items.filter(i => i.shelfId === shelfId).length;
    };

    return (
        <>
            <GenericShelfListView 
                title="Repuestos Soldadura"
                shelves={shelves}
                getItemCount={getShelfItemCount}
                loading={loading}
                userRole={userRole}
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
                    cartName="Repuestos Soldadura"
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
};

export default WeldingSuppliesView;
