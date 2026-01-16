import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Confirm",
    isDestructive = false
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4">
                    {isDestructive && (
                        <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                            <AlertTriangle size={24} />
                        </div>
                    )}
                    <p className="text-slate-600 leading-relaxed pt-1">{message}</p>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-4 py-2 text-white font-medium rounded-lg transition-colors shadow-sm ${isDestructive
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-100'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
