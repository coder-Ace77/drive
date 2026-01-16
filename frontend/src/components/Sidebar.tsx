import React from 'react';
import { HardDrive, Clock } from 'lucide-react';
import type { UserInfo } from '../types';

interface SidebarProps {
    user: UserInfo | null;
    onNavigate: (folderId: string) => void;
    activeTab: 'drive' | 'shared';
    onTabChange: (tab: 'drive' | 'shared') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, onNavigate, activeTab, onTabChange }) => {

    return (
        <aside className="w-64 border-r border-slate-200 p-4 flex flex-col gap-2 bg-slate-50/50">
            <div className="flex items-center gap-2 px-2 mb-8">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-100">
                    <HardDrive className="text-white" size={20} />
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-800">Drive</span>
            </div>
            <nav className="space-y-1">
                <button
                    onClick={() => {
                        onTabChange('drive');
                        if (user?.root_id) onNavigate(user.root_id);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-semibold transition-colors ${activeTab === 'drive'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                        }`}
                >
                    <HardDrive size={20} /> My Drive
                </button>
                <button
                    onClick={() => onTabChange('shared')}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-semibold transition-colors ${activeTab === 'shared'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                        }`}
                >
                    <Clock size={20} /> Shared with me
                </button>
            </nav>
        </aside>
    );
};
