import React from 'react';
import { Trash2, X, Copy, Scissors } from 'lucide-react';

interface BulkActionsBarProps {
    selectedCount: number;
    onClear: () => void;
    onCopy: () => void;
    onMove: () => void;
    onDelete: () => void;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onClear,
    onCopy,
    onMove,
    onDelete
}) => {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-4 md:px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 md:gap-6 animate-in slide-in-from-bottom-6 w-[calc(100%-2rem)] md:w-auto justify-between md:justify-start">
            <span className="font-medium whitespace-nowrap">{selectedCount} selected</span>
            <div className="h-6 w-[1px] bg-white/20 hidden md:block" />
            <div className="flex items-center gap-2">
                <button
                    onClick={onClear}
                    className="p-2 md:px-3 md:py-1.5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    title="Cancel selection"
                >
                    <X size={18} className="md:hidden" />
                    <span className="hidden md:inline">Cancel</span>
                </button>

                <button
                    onClick={onCopy}
                    className="p-2 md:px-3 md:py-1.5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    title="Copy selected"
                >
                    <Copy size={18} className="md:hidden" />
                    <span className="hidden md:inline">Copy</span>
                </button>
                <button
                    onClick={onMove}
                    className="p-2 md:px-3 md:py-1.5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    title="Move selected"
                >
                    <Scissors size={18} className="md:hidden" />
                    <span className="hidden md:inline">Move</span>
                </button>

                <button
                    onClick={onDelete}
                    className="flex items-center gap-2 p-2 md:px-4 md:py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-500/30 ml-1 cursor-pointer"
                    title="Delete selected"
                >
                    <Trash2 size={18} />
                    <span className="hidden md:inline">Delete</span>
                </button>
            </div>
        </div>
    );
};

export default BulkActionsBar;
