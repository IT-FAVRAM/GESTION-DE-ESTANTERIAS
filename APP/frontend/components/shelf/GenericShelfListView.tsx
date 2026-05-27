
import React from 'react';
import { ShelfModuleLayout } from './ShelfModuleLayout';
import { ShelfRow } from './ShelfRow';
import { UserRole } from '../hooks/useRoles';

interface GenericShelfListViewProps {
    title: string;
    subTitle?: string;
    shelves: number[];
    getItemCount: (shelfId: string) => number;
    onViewList: (shelfId: string) => void;
    onAdd: (shelfId: string) => void;
    loading: boolean;
    userRole: string;
    onBack?: () => void;
}

export const GenericShelfListView: React.FC<GenericShelfListViewProps> = ({
    title,
    subTitle,
    shelves,
    getItemCount,
    onViewList,
    onAdd,
    loading,
    userRole,
    onBack
}) => {
    const canAdd = userRole === 'CARRETILLERO' || userRole === 'JEFE' || userRole === 'ADMIN';

    return (
        <ShelfModuleLayout title={title} subTitle={subTitle} onBack={onBack}>
            <div className="grid gap-3 md:gap-4 grid-cols-1">
                {shelves.map(shelfNum => {
                    const count = getItemCount(String(shelfNum));
                    return (
                        <ShelfRow 
                            key={shelfNum}
                            label={`Balda ${shelfNum}`}
                            itemCount={count}
                            loading={loading}
                            canAdd={canAdd}
                            onViewList={() => onViewList(String(shelfNum))}
                            onAdd={() => onAdd(String(shelfNum))}
                        />
                    );
                })}
            </div>
        </ShelfModuleLayout>
    );
};


