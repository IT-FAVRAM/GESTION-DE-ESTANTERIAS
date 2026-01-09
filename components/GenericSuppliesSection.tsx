
import React, { useState } from 'react';
import { useGenericSupplies } from '../hooks/useGenericSupplies';
import ShelfDetailModal from './ShelfDetailModal';
import { UserRole } from '../hooks/useRoles';
import { GenericShelfListView } from './GenericShelfListView';

interface GenericSuppliesSectionProps {
    userRole: UserRole;
    title: string;
    docId: string; // ID del documento en Firebase (ej: CARRO_SOLDADURA)
    totalShelves?: number;
}

const GenericSuppliesSection: React.FC<GenericSuppliesSectionProps> = ({ userRole, title, docId, totalShelves = 8 }) => {
    const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<'view' | 'add_choice'>('view');

    const { items, addItem, removeItems, moveItems, loading } = useGenericSupplies(docId);

    const shelves = Array.from({ length: totalShelves }, (_, i) => i + 1);

    const getShelfItemCount = (shelfId: string) => {
        return items.filter(i => i.shelfId === shelfId).length;
    };

    return (
        <>
            <GenericShelfListView 
                title={title}
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
                    cartName={title}
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

export default GenericSuppliesSection;
