import { useState, useCallback } from 'react';
import type { DriveItem } from '../../types';

export const useDriveSelection = (items: DriveItem[]) => {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const toggleSelection = useCallback((id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            const allIds = items.map(item => item.id);
            setSelectedItems(new Set(allIds));
        }
    }, [items, selectedItems.size]);

    const clearSelection = useCallback(() => {
        setSelectedItems(new Set());
    }, []);

    return {
        selectedItems,
        toggleSelection,
        selectAll,
        clearSelection,
        setSelectedItems
    };
};
