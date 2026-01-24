import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  isUploading?: boolean;
  onCancelUpload?: () => void;
  clipboard?: { mode: 'copy' | 'cut'; items: string[] } | null;
  onPaste?: () => void;
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
  onMenuClick,
  isUploading = false,
  onCancelUpload,
  clipboard,
  onPaste
}: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Portal Positioning States
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 224 }); // 224=w-56
  const [userMenuPosition, setUserMenuPosition] = useState({ top: 0, left: 0, width: 192 }); // 192=w-48
  const [isMenuPositioned, setIsMenuPositioned] = useState(false);
  const [isUserMenuPositioned, setIsUserMenuPositioned] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null); // Ref for "New" button (or the div wrapping it if needed)
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  const userButtonRef = useRef<HTMLButtonElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Handle "New" Menu Positioning
  useLayoutEffect(() => {
    if (isMenuOpen && menuButtonRef.current) {
      const updatePosition = () => {
        const rect = menuButtonRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Align right of menu with right of button? Or left?
        // Original was right-aligned to container. Let's align Left to button left, or Right to button right.
        // Button is mostly on right side of a divider? No, it's in middle-ish.
        // Let's try Right alignment if it fits, else Left.
        // Actually original code was: absolute right-0. So it aligned to the right edge of the PARENT wrapper.
        // We need to simulate that.

        // Let's align top-right of menu to bottom-right of button.
        // Menu Width: w-56 = 224px.
        const width = 224;
        let top = rect.bottom + 8;
        let left = rect.right - width;

        // Mobile check: ensure it doesn't go off-screen left
        if (left < 10) left = 10;
        // Ensure it doesn't go off-screen right (unlikely if aligned right, but possible)
        if (left + width > window.innerWidth - 10) left = window.innerWidth - 10 - width;

        setMenuPosition({ top, left, width });
        setIsMenuPositioned(true);
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setIsMenuPositioned(false);
    }
  }, [isMenuOpen]);

  // Handle User Menu Positioning
  useLayoutEffect(() => {
    if (isUserMenuOpen && userButtonRef.current) {
      const updatePosition = () => {
        const rect = userButtonRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Align top-right of menu to bottom-right of button
        const width = 192; // w-48
        let top = rect.bottom + 8;
        let left = rect.right - width;

        // Ensure visibility
        if (left < 10) left = 10;

        setUserMenuPosition({ top, left, width });
        setIsUserMenuPositioned(true);
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setIsUserMenuPositioned(false);
    }
  }, [isUserMenuOpen]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // New Menu
      if (
        menuDropdownRef.current &&
        !menuDropdownRef.current.contains(event.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
      // User Menu
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, isUserMenuOpen]);

  return (
    <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 md:px-6 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-slate-600 md:hidden cursor-pointer"
        >
          <Menu size={24} />
        </button>

        {canGoBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors cursor-pointer"
            title="Go back"
          >
            <ChevronLeft size={24} />
          </button>
        )}

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
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            title="List View"
          >
            <ListIcon size={18} />
          </button>
        </div>

        <div className="hidden sm:block h-8 w-[1px] bg-slate-200 mx-1" />

        {/* "New" Dropdown Menu */}
        <div className="relative">
          {isUploading ? (
            <button
              onClick={onCancelUpload}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 md:px-4 py-2 rounded-full font-medium transition shadow-md shadow-red-100 active:scale-95 cursor-pointer"
            >
              <LogOut size={20} className="rotate-180" />
              <span className="hidden sm:inline">Stop Upload</span>
            </button>
          ) : clipboard && clipboard.items.length > 0 && onPaste ? (
            <button
              onClick={onPaste}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full font-medium transition shadow-md active:scale-95 cursor-pointer
                ${clipboard.mode === 'cut' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-100 text-white' : 'bg-green-600 hover:bg-green-700 shadow-green-100 text-white'}`}
            >
              <FileUp size={20} />
              <span className="hidden sm:inline">Paste {clipboard.items.length} Item{clipboard.items.length > 1 ? 's' : ''}</span>
            </button>
          ) : (
            <button
              ref={menuButtonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-full font-medium transition shadow-md shadow-blue-100 active:scale-95 cursor-pointer"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">New</span>
              <ChevronDown size={16} className={`hidden sm:block transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {isMenuOpen && !clipboard?.items.length && createPortal(
            <div
              ref={menuDropdownRef}
              style={{
                position: 'fixed',
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                opacity: isMenuPositioned ? 1 : 0
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-[100] animate-in fade-in zoom-in duration-100 transition-opacity"
            >
              <button onClick={() => { onUploadFile(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer">
                <FileUp size={18} className="text-slate-400" />
                <span className="text-sm font-medium">File upload</span>
              </button>
              <button onClick={() => { onUploadFolder(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer">
                <FolderUp size={18} className="text-slate-400" />
                <span className="text-sm font-medium">Folder upload</span>
              </button>
              <div className="h-[1px] bg-slate-100 my-1" />
              <button onClick={() => { onCreateFolder?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer">
                <FolderPlus size={18} className="text-slate-400" />
                <span className="text-sm font-medium">New folder</span>
              </button>
            </div>,
            document.body
          )}
        </div>

        <div className="hidden md:block h-8 w-[1px] bg-slate-200 mx-1" />

        {/* User Profile & Logout Dropdown */}
        <div className="relative">
          <button
            ref={userButtonRef}
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <div className="text-right hidden md:block px-1">
              <p className="font-semibold text-sm leading-tight">{username}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Pro Plan</p>
            </div>
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-2 rounded-full border border-slate-300">
              <User size={18} className="text-slate-600" />
            </div>
          </button>

          {isUserMenuOpen && createPortal(
            <div
              ref={userDropdownRef}
              style={{
                position: 'fixed',
                top: userMenuPosition.top,
                left: userMenuPosition.left,
                width: userMenuPosition.width,
                opacity: isUserMenuPositioned ? 1 : 0
              }}
              className="bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-[100] animate-in fade-in slide-in-from-top-1 duration-100 transition-opacity"
            >
              <div className="px-4 py-2 border-b border-slate-50 md:hidden">
                <p className="font-bold text-sm">{username}</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut size={18} />
                <span className="text-sm font-semibold">Sign out</span>
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>
    </header>
  );
};