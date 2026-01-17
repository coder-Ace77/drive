import { useState, useRef, useEffect } from 'react';
import {
  Search, Plus, User, FileUp, FolderUp,
  FolderPlus, ChevronDown, ChevronLeft, LogOut,
  LayoutGrid, List as ListIcon, Menu
} from 'lucide-react';

interface Props {
  username: string;
  onUploadFile: () => void;
  onUploadFolder: () => void;
  onCreateFolder?: () => void;
  onLogout: () => void;
  onBack: () => void;
  canGoBack: boolean;
  onSearch: (query: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onMenuClick: () => void;
}

export const DriveHeader = ({
  username,
  onUploadFile,
  onUploadFolder,
  onCreateFolder,
  onLogout,
  onBack,
  canGoBack,
  onSearch,
  viewMode,
  onViewModeChange,
  onMenuClick
}: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 md:px-6 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-slate-600 md:hidden"
        >
          <Menu size={24} />
        </button>

        {canGoBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            title="Go back"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search"
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 ml-2 md:ml-4">
        {/* View Toggle */}
        <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            title="List View"
          >
            <ListIcon size={18} />
          </button>
        </div>

        <div className="hidden sm:block h-8 w-[1px] bg-slate-200 mx-1" />

        {/* "New" Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-full font-medium transition shadow-md shadow-blue-100 active:scale-95"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">New</span>
            <ChevronDown size={16} className={`hidden sm:block transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in duration-100">
              <button onClick={() => { onUploadFile(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50">
                <FileUp size={18} className="text-slate-400" />
                <span className="text-sm font-medium">File upload</span>
              </button>
              <button onClick={() => { onUploadFolder(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50">
                <FolderUp size={18} className="text-slate-400" />
                <span className="text-sm font-medium">Folder upload</span>
              </button>
              <div className="h-[1px] bg-slate-100 my-1" />
              <button onClick={() => { onCreateFolder?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50">
                <FolderPlus size={18} className="text-slate-400" />
                <span className="text-sm font-medium">New folder</span>
              </button>
            </div>
          )}
        </div>

        <div className="hidden md:block h-8 w-[1px] bg-slate-200 mx-1" />

        {/* User Profile & Logout Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <div className="text-right hidden md:block px-1">
              <p className="font-semibold text-sm leading-tight">{username}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Pro Plan</p>
            </div>
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-2 rounded-full border border-slate-300">
              <User size={18} className="text-slate-600" />
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="px-4 py-2 border-b border-slate-50 md:hidden">
                <p className="font-bold text-sm">{username}</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                <span className="text-sm font-semibold">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};