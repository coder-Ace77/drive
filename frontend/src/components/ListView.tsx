import { format } from 'date-fns';
import { FileText, Folder, Check } from 'lucide-react';
import type { DriveItem } from '../types';
import DriveItemMenu from './drive/DriveItemMenu';

interface Props {
    items: DriveItem[];
    selectedId: string | null;
    onSelect: (item: DriveItem) => void;
    onItemClick: (item: DriveItem) => void;
    onDownload: (item: DriveItem) => void;
    onDelete: (id: string) => void;
    onShare: (item: DriveItem) => void;
    onCopy: (item: DriveItem) => void;
    onMove: (item: DriveItem) => void;
    getFolderSize: (id: string) => number;
    isSharedView?: boolean;
    // Selection Props
    selectedItems?: Set<string>;
    onToggleSelection?: (id: string) => void;
    clipboard?: { mode: 'copy' | 'cut'; items: string[] } | null;
}

const formatSize = (bytes: number = 0) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const ListView = ({
    items,
    selectedId,
    onSelect,
    onItemClick,
    onDownload,
    onDelete,
    onShare,
    onCopy,
    onMove,
    getFolderSize,
    isSharedView = false,
    selectedItems,
    onToggleSelection,
    clipboard
}: Props) => {
    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-12 gap-4 px-4 md:px-6 py-3 border-b border-slate-100 text-sm font-medium text-slate-500 min-w-full sticky top-0 bg-white z-10">
                {/* Checkbox Header Placeholder */}
                <div className="w-10"></div>

                <div className="col-span-7 md:col-span-5">Name</div>
                <div className="hidden md:block md:col-span-2">Size</div>
                <div className="hidden md:block md:col-span-3">Last Modified</div>
                <div className="col-span-4 md:col-span-1 text-right md:text-center pr-2 md:pr-0">Actions</div>
            </div>

            <div className="flex-1 overflow-y-auto pb-20">
                {items.map((item) => {
                    const isSelected = selectedItems?.has(item.id);
                    const size = item.type === 'file' ? (item.size || 0) : getFolderSize(item.id);
                    const isCut = clipboard?.mode === 'cut' && clipboard.items.includes(item.id);

                    return (
                        <div
                            key={item.id}
                            onClick={() => {
                                if (onToggleSelection && isSelected) {
                                    onToggleSelection(item.id);
                                } else {
                                    onSelect(item);
                                }
                            }}
                            onDoubleClick={() => onItemClick(item)}
                            className={`grid grid-cols-12 gap-4 px-4 md:px-6 py-3 items-center border-b border-slate-50 transition-colors cursor-pointer group 
                                ${isSelected
                                    ? 'bg-blue-50/60 hover:bg-blue-100/50'
                                    : selectedId === item.id
                                        ? 'bg-blue-50/30'
                                        : 'hover:bg-slate-50'}
                                ${isCut ? 'opacity-50 grayscale text-slate-400' : ''}
                                `}
                        >
                            {/* Checkbox Column */}
                            <div
                                className="w-10 flex items-center justify-start"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onToggleSelection) onToggleSelection(item.id);
                                }}
                            >
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors 
                                    ${isSelected
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'bg-white border-slate-300 opacity-60 group-hover:opacity-100'
                                    }`}>
                                    {isSelected && <Check size={14} className="text-white" />}
                                </div>
                            </div>

                            <div className="col-span-7 md:col-span-5 flex items-center gap-3 overflow-hidden">
                                {item.type === 'folder' ? (
                                    <Folder className="text-blue-500 fill-blue-500/20 flex-shrink-0" size={20} />
                                ) : (
                                    <FileText className="text-slate-400 flex-shrink-0" size={20} />
                                )}
                                <span className={`font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {item.name}
                                </span>
                            </div>

                            <div className="hidden md:block md:col-span-2 text-sm text-slate-500">
                                {formatSize(size)}
                            </div>

                            <div className="hidden md:block md:col-span-3 text-sm text-slate-500">
                                {item.updated_at ? format(new Date(item.updated_at), 'MMM d, yyyy') : '-'}
                            </div>

                            <div className="col-span-4 md:col-span-1 flex justify-end md:justify-center">
                                {/* Shared View Limits Actions, so we might need to adjust DriveItemMenu or pass a flag, but for now we just show what's possible */}
                                {!isSharedView && (
                                    <DriveItemMenu
                                        item={item}
                                        onOpen={item.type === 'folder' ? onItemClick : undefined}
                                        onDownload={onDownload}
                                        onShare={onShare}
                                        onCopy={onCopy}
                                        onMove={onMove}
                                        onDelete={onDelete}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
