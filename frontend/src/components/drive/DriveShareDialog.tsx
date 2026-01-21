import React from 'react';

interface DriveShareDialogProps {
    isOpen: boolean;
    itemToShare: { name: string } | null;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}

const DriveShareDialog: React.FC<DriveShareDialogProps> = ({ isOpen, itemToShare, onClose, onSubmit }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 scale-in-95 zoom-in-95 animate-in duration-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Share "{itemToShare?.name}"</h3>
                <p className="text-sm text-slate-500 mb-6">
                    Enter the username of the person you want to share with.
                </p>
                <form onSubmit={onSubmit}>
                    <input
                        name="username"
                        autoFocus
                        placeholder="Username"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all mb-6"
                    />
                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-200"
                        >
                            Share
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DriveShareDialog;
