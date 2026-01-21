import React from 'react';
import { Trash2 } from 'lucide-react';

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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-6">
            <span className="font-medium">{selectedCount} selected</span>
            <div className="h-6 w-[1px] bg-white/20" />
            <div className="flex items-center gap-2">
                <button
                    onClick={onClear}
                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                >
                    Cancel
                </button>

                <button
                    onClick={onCopy}
                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                >
                    Copy
                </button>
                <button
                    onClick={onMove}
                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                    title="Move"
                >
                    Move
                </button>

                <button
                    onClick={onDelete}
                    className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-500/30"
                >
                    <Trash2 size={16} />
                    Delete
                </button>
            </div>
        </div>
    );
};

export default BulkActionsBar;
