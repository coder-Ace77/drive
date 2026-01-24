import { useState, useRef, useEffect } from 'react';
import {
    MoreVertical,
    FolderOpen,
    Download,
    Share2,
    Copy,
    Scissors, // Move icon
    Trash2
} from 'lucide-react';
import type { DriveItem } from '../../types';

interface DriveItemMenuProps {
    item: DriveItem;
    onOpen?: (item: DriveItem) => void;
    onDownload: (item: DriveItem) => void;
    onShare: (item: DriveItem) => void;
    onCopy: (item: DriveItem) => void;
    onMove: (item: DriveItem) => void;
    onDelete: (id: string) => void;
}

const DriveItemMenu = ({
    item,
    onOpen,
    onDownload,
    onShare,
    onCopy,
    onMove,
    onDelete
}: DriveItemMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
                <MoreVertical size={18} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    {item.type === 'folder' && onOpen && (
                        <button
                            onClick={() => handleAction(() => onOpen(item))}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        >
                            <FolderOpen size={16} className="text-slate-500" />
                            Open
                        </button>
                    )}

                    <button
                        onClick={() => handleAction(() => onDownload(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                        <Download size={16} className="text-slate-500" />
                        Download
                    </button>

                    <button
                        onClick={() => handleAction(() => onShare(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                        <Share2 size={16} className="text-slate-500" />
                        Share
                    </button>

                    <div className="h-[1px] bg-slate-100 my-1" />

                    <button
                        onClick={() => handleAction(() => onCopy(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                        <Copy size={16} className="text-slate-500" />
                        Copy
                    </button>

                    <button
                        onClick={() => handleAction(() => onMove(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                        <Scissors size={16} className="text-slate-500" />
                        Move
                    </button>

                    <div className="h-[1px] bg-slate-100 my-1" />

                    <button
                        onClick={() => handleAction(() => onDelete(item.id))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
};

export default DriveItemMenu;
