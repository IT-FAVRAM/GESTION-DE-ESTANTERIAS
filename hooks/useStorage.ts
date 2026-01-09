
import { useLocalStorage } from './useLocalStorage';
import { FinishedItem } from '../lib/warehouseData';

export const useStorage = () => {
  const [finishedItems, setFinishedItems, syncFinishedItems] = useLocalStorage<FinishedItem[]>('warehouse_finished_items', []);

  const addFinishedItem = (item: Omit<FinishedItem, 'id'>) => {
    setFinishedItems(prev => {
        const newItem: FinishedItem = {
            id: crypto.randomUUID(),
            ...item
        };
        // Add to top of list
        return [newItem, ...prev];
    });
  };

  const removeFinishedItem = (id: string) => {
      setFinishedItems(prev => prev.filter(item => item.id !== id));
  }

  return {
    finishedItems,
    setFinishedItems,
    addFinishedItem,
    removeFinishedItem,
    syncFinishedItems
  };
};
