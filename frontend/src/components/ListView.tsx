import { format } from 'date-fns';
import { FileText, Folder, Download, Trash2, Share2 } from 'lucide-react';
import type { DriveItem } from '../types';

interface Props {
    items: DriveItem[];
    selectedId: string | null;
    onSelect: (item: DriveItem) => void;
    onItemClick: (item: DriveItem) => void;
    onDownload: (item: DriveItem) => void;
    onDelete: (id: string) => void;
    onShare: (item: DriveItem) => void;
    getFolderSize: (id: string) => number;
    isSharedView?: boolean;
}

const formatSize = (bytes: number = 0) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const ListView = ({ items, selectedId, onSelect, onItemClick, onDownload, onDelete, getFolderSize, onShare, isSharedView = false }: Props) => {
    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-12 gap-4 px-4 md:px-6 py-3 border-b border-slate-100 text-sm font-medium text-slate-500 min-w-full">
                <div className="col-span-8 md:col-span-6">Name</div>
                <div className="hidden md:block md:col-span-2">Size</div>
                <div className="hidden md:block md:col-span-3">Last Modified</div>
                <div className="col-span-4 md:col-span-1 text-center">Actions</div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {items.map((item) => {
                    const isSelected = selectedId === item.id;
                    const size = item.type === 'file' ? (item.size || 0) : getFolderSize(item.id);

                    return (
                        <div
                            key={item.id}
                            onClick={() => onSelect(item)}
                            onDoubleClick={() => onItemClick(item)}
                            className={`grid grid-cols-12 gap-4 px-4 md:px-6 py-3 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : ''
                                }`}
                        >
                            <div className="col-span-8 md:col-span-6 flex items-center gap-3 overflow-hidden">
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

                            <div className="col-span-4 md:col-span-1 flex justify-end md:justify-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isSharedView && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onShare(item); }}
                                        className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                                        title="Share"
                                    >
                                        <Share2 size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDownload(item); }}
                                    className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                                    title="Download"
                                >
                                    <Download size={16} />
                                </button>
                                {!isSharedView && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                        className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
