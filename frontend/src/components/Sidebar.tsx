import React from 'react';
import { HardDrive, Clock, X } from 'lucide-react';
import type { UserInfo } from '../types';

interface SidebarProps {
    user: UserInfo | null;
    onNavigate: (folderId: string) => void;
    activeTab: 'drive' | 'shared';
    onTabChange: (tab: 'drive' | 'shared') => void;
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    user,
    onNavigate,
    activeTab,
    onTabChange,
    isOpen,
    onClose
}) => {
    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden animate-in fade-in"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Content */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-2 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex items-center justify-between px-2 mb-8">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-100">
                            <HardDrive className="text-white" size={20} />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-slate-800">Drive</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="md:hidden p-1 hover:bg-slate-200 rounded-lg text-slate-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="space-y-1">
                    <button
                        onClick={() => {
                            onTabChange('drive');
                            if (user?.root_id) onNavigate(user.root_id);
                            onClose();
                        }}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-semibold transition-colors ${activeTab === 'drive'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <HardDrive size={20} /> My Drive
                    </button>
                    <button
                        onClick={() => {
                            onTabChange('shared');
                            onClose();
                        }}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-semibold transition-colors ${activeTab === 'shared'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <Clock size={20} /> Shared with me
                    </button>
                </nav>
            </aside>
        </>
    );
};
