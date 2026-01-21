import React from 'react';
import { FileGrid } from '../Filegrid';
import { ListView } from '../ListView';
import DriveEmptyState from './DriveEmptyState';
import type { DriveItem } from '../../types';

interface DriveMainProps {
    items: DriveItem[];
    viewMode: 'grid' | 'list';
    selectedId: string | null;
    onSelect: (item: DriveItem) => void;
    onItemClick: (item: DriveItem) => void;
    onDownload: (item: DriveItem) => void;
    onDelete: (id: string) => void;
    onShare: (item: DriveItem) => void;
    isSharedView: boolean;
    selectedItems: Set<string>;
    onToggleSelection: (id: string) => void;
    clipboard: any;
    getFolderSize: (id: string) => number;
    isSearching: boolean;
}

const DriveMain: React.FC<DriveMainProps> = ({
    items,
    viewMode,
    selectedId,
    onSelect,
    onItemClick,
    onDownload,
    onDelete,
    onShare,
    isSharedView,
    selectedItems,
    onToggleSelection,
    clipboard,
    getFolderSize,
    isSearching
}) => {
    return (
        <main className="flex-1 overflow-y-auto bg-white relative">
            {isSearching && (
                <div className="px-6 pt-4 pb-0">
                    <h2 className="text-xl font-bold text-slate-800">Search Results</h2>
                </div>
            )}

            {viewMode === 'grid' ? (
                <FileGrid
                    items={items}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onItemClick={onItemClick}
                    onDownload={onDownload}
                    onDelete={onDelete}
                    onShare={onShare}
                    isSharedView={isSharedView}
                    selectedItems={selectedItems}
                    onToggleSelection={onToggleSelection}
                    clipboard={clipboard}
                />
            ) : (
                <ListView
                    items={items}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onItemClick={onItemClick}
                    onDownload={onDownload}
                    onDelete={onDelete}
                    getFolderSize={getFolderSize}
                    onShare={onShare}
                    isSharedView={isSharedView}
                    selectedItems={selectedItems}
                    onToggleSelection={onToggleSelection}
                    clipboard={clipboard}
                />
            )}

            {items.length === 0 && <DriveEmptyState />}
        </main>
    );
};

export default DriveMain;
