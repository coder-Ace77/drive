import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    MoreVertical,
    FolderOpen,
    Download,
    Share2,
    Copy,
    Scissors, // Move icon
    Trash2,
    FileText,
    Folder
} from 'lucide-react';
import type { DriveItem } from '../../types';
import { formatSize } from '../../utils/format';

interface DriveItemMenuProps {
    item: DriveItem;
    size?: number;
    onOpen?: (item: DriveItem) => void;
    onDownload: (item: DriveItem) => void;
    onShare: (item: DriveItem) => void;
    onCopy: (item: DriveItem) => void;
    onMove: (item: DriveItem) => void;
    onDelete: (id: string) => void;
    isOpen?: boolean;
    onToggle?: (isOpen: boolean) => void;
}

const DriveItemMenu = ({
    item,
    size,
    onOpen,
    onDownload,
    onShare,
    onCopy,
    onMove,
    onDelete,
    isOpen: externalIsOpen,
    onToggle,
}: DriveItemMenuProps) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [isPositioned, setIsPositioned] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const isControlled = externalIsOpen !== undefined;
    const isOpen = isControlled ? externalIsOpen : internalIsOpen;

    const handleToggle = (newState: boolean) => {
        if (!newState) {
            setIsPositioned(false);
        }
        if (isControlled && onToggle) {
            onToggle(newState);
        } else {
            setInternalIsOpen(newState);
        }
    };

    // Calculate position when menu opens
    useLayoutEffect(() => {
        if (isOpen && buttonRef.current) {
            const updatePosition = () => {
                const buttonRect = buttonRef.current?.getBoundingClientRect();
                if (!buttonRect) return;

                const MENU_WIDTH = 224; // w-56 = 14rem = 224px
                const MENU_HEIGHT_ESTIMATE = 320; // estimate max height

                let top = buttonRect.bottom + 4;
                let left = buttonRect.right - MENU_WIDTH;

                // Check if menu goes off screen vertically
                const spaceBelow = window.innerHeight - buttonRect.bottom;
                const dropUp = spaceBelow < 300; // heuristic

                if (dropUp) {
                    setMenuPosition({
                        top: buttonRect.top - 8, // We'll use CSS 'transform: translateY(-100%)' to flip it up
                        left: left
                    });
                } else {
                    setMenuPosition({ top: buttonRect.bottom + 4, left: left });
                }

                // Mobile adjustment if needed (center it?)
                if (left < 10) {
                    left = 10;
                }

                setIsPositioned(true);
            };

            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
                // Note: We don't reset isPositioned here on cleanup of effect re-run,
                // but when isOpen becomes false, we want to reset it.
                // However, effect cleanup runs when isOpen changes to false too.
            };
        } else {
            setIsPositioned(false);
        }
    }, [isOpen]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is on button or menu
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                handleToggle(false);
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
        handleToggle(false);
    };

    // Calculate drop direction for CSS transform
    // Simple heuristic again inside render for the specific transform class
    // We use state for reliability now via isPositioned logic, but for transform style we need the specific boolean
    // Actually, we can just check the style top vs button top?
    // Or just store dropUp in state.
    // Let's store dropUp in state for cleanliness.

    // Instead of complex state, let's just re-calc cheaply:
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    const dropUp = buttonRect && (window.innerHeight - buttonRect.bottom < 300);

    return (
        <>
            <button
                ref={buttonRef}
                onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(!isOpen);
                }}
                className={`p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors cursor-pointer ${isOpen ? 'bg-slate-100 text-slate-700' : ''}`}
            >
                <MoreVertical size={18} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: menuPosition.top,
                        left: menuPosition.left,
                        transform: dropUp ? 'translateY(-100%)' : 'none',
                        opacity: isPositioned ? 1 : 0,
                    }}
                    className="w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-100 origin-top-right transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Section */}
                    <div className="px-4 py-3 border-b border-slate-100 mb-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                                {item.type === 'folder' ? (
                                    <Folder size={16} className="text-blue-500" />
                                ) : (
                                    <FileText size={16} className="text-blue-500" />
                                )}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium text-slate-700 truncate" title={item.name}>
                                    {item.name}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {formatSize(size ?? item.size ?? 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {item.type === 'folder' && onOpen && (
                        <button
                            onClick={() => handleAction(() => onOpen(item))}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                        >
                            <FolderOpen size={16} className="text-slate-500" />
                            Open
                        </button>
                    )}

                    <button
                        onClick={() => handleAction(() => onDownload(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                        <Download size={16} className="text-slate-500" />
                        Download
                    </button>

                    <button
                        onClick={() => handleAction(() => onShare(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                        <Share2 size={16} className="text-slate-500" />
                        Share
                    </button>

                    <div className="h-[1px] bg-slate-100 my-1" />

                    <button
                        onClick={() => handleAction(() => onCopy(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                        <Copy size={16} className="text-slate-500" />
                        Copy
                    </button>

                    <button
                        onClick={() => handleAction(() => onMove(item))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                        <Scissors size={16} className="text-slate-500" />
                        Move
                    </button>

                    <div className="h-[1px] bg-slate-100 my-1" />

                    <button
                        onClick={() => handleAction(() => onDelete(item.id))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};

export default DriveItemMenu;
