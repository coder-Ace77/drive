import React from 'react';
import { driveService } from '../../service/driveService';

interface DriveShareDialogProps {
    isOpen: boolean;
    itemToShare: { name: string } | null;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    onRemove?: (username: string) => void;
}

const DriveShareDialog: React.FC<DriveShareDialogProps> = ({ isOpen, itemToShare, onClose, onSubmit, onRemove }) => {
    const [permissionType, setPermissionType] = React.useState<"read" | "editor">("read");
    const [query, setQuery] = React.useState("");
    const [suggestions, setSuggestions] = React.useState<{ username: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = React.useState(false);

    // Debounce search update
    React.useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 1) {
                try {
                    const results = await driveService.searchUsers(query);
                    setSuggestions(results);
                    setShowSuggestions(true);
                } catch (e) {
                    setSuggestions([]);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    if (!isOpen) return null;

    // We assume itemToShare now includes shared_with based on ResourceResponse
    const sharedUsers = (itemToShare as any)?.shared_with || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 scale-in-95 zoom-in-95 animate-in duration-200" onClick={() => setShowSuggestions(false)}>
                <h3 className="text-xl font-semibold text-slate-800 mb-1">Share "{itemToShare?.name}"</h3>
                <p className="text-sm text-slate-500 mb-6">Manage who has access to this file.</p>

                {/* Add People */}
                <form onSubmit={(e) => {
                    onSubmit(e);
                    setQuery("");
                }} className="mb-6 relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 mb-2 relative">
                        <div className="flex-1 relative">
                            <input
                                name="username"
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoComplete="off"
                                placeholder="Add people by username..."
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all input-username"
                                onFocus={() => query.length >= 1 && setShowSuggestions(true)}
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-20">
                                    {suggestions.map((s) => (
                                        <div
                                            key={s.username}
                                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                                            onClick={() => {
                                                setQuery(s.username);
                                                setShowSuggestions(false);
                                            }}
                                        >
                                            {s.username}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <select
                            name="permissionType"
                            value={permissionType}
                            onChange={(e) => setPermissionType(e.target.value as any)}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none"
                        >
                            <option value="read">Viewer</option>
                            <option value="editor">Editor</option>
                        </select>
                        <button
                            type="submit"
                            className="px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                        >
                            Invite
                        </button>
                    </div>
                </form>

                <div className="h-px bg-slate-100 my-4" />

                {/* Manage Access */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                YOU
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-700">You</p>
                                <p className="text-xs text-slate-500">Owner</p>
                            </div>
                        </div>
                        <span className="text-xs text-slate-400 font-medium px-2">Owner</span>
                    </div>

                    {sharedUsers.map((user: any) => (
                        <div key={user.username} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                    {user.username.slice(0, 2)}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-700">{user.username}</p>
                                    <p className="text-xs text-slate-500">{user.type === 'editor' ? 'Editor' : 'Viewer'}</p>
                                </div>
                            </div>

                            {/* Actions - For now simplistic, just show Remove or rely on re-invite to change */}
                            {/* To fully implement Manage Access properly we need callbacks to update permissions. 
                                For this milestone, user asked "owner should be able to edit...". 
                                The simpler way is: Re-inviting with different perm UPDATES it (backend logic handles this).
                                To REMOVE, we likely need a new handler passed from parent. 
                                Since I am only editing this file, I can't easily add new props without breaking usage.
                                WORKAROUND: Show "Remove" button that might call a special hidden behavior or just visual helper?
                                No, I should fix parent first. But I am in this file. 
                                Let's add a "Remove" button but it needs a prop. 
                                I will revert to just showing the list for now if I can't update parent props safely in one go.
                                WAIT, I can update parent props. I will do that in next step. 
                             */}
                            {onRemove && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(user.username)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-all text-xs"
                                    title="Remove access"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}

                    {sharedUsers.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-2 italic">No one else has access</p>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DriveShareDialog;
