import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../service/api';
import { DriveHeader } from '../components/DriveHeader';
import { FileGrid } from '../components/Filegrid';
import { ListView } from '../components/ListView'; // Import ListView
import { Sidebar } from '../components/Sidebar';
import { Loader2, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { InputDialog } from '../components/ui/InputDialog';
import { useDrive } from '../hooks/useDrive';
import type { DriveItem } from '../types';

const DrivePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const {
    user,
    items,
    navigate: navigateToFolder,
    goBack,
    isLoading,
    createFolder,
    deleteItem,
    uploadFiles,
    canGoBack,
    isSearching,
    setSearchQuery,
    getFolderSize,
    resumableSession,
    clearSession,
    activeTab,
    setActiveTab,
    shareResource
  } = useDrive();

  // UI States
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('view_mode') as 'grid' | 'list') || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('view_mode', viewMode);
  }, [viewMode]);

  const handleCreateFolder = () => {
    setIsCreateFolderOpen(true);
  };

  const submitCreateFolder = async (folderName: string) => {
    try {
      await createFolder(folderName);
      setIsCreateFolderOpen(false);
    } catch (e) {
      // toast handled in hook
    }
  };

  const handleShare = (item: any) => {
    setItemToShare(item);
    setIsShareOpen(true);
  };

  const submitShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;

    if (!itemToShare || !username) return;

    const toastId = toast.loading("Sharing...");
    try {
      await shareResource(itemToShare.id, username);
      toast.dismiss(toastId); // Success toast in hook (or we can rely on hook)
      // The hook uses toast.success/error so we just dismiss loading here if needed, 
      // but hook throws error so we catch it.
      setIsShareOpen(false);
      setItemToShare(null);
    } catch (err) {
      toast.dismiss(toastId);
    }
  };

  // Resume Handler
  const handleResume = () => {
    // Trigger folder selection again
    folderInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if we are resuming
    const isResume = !!resumableSession;

    // Safety check just in case user picked wrong folder? 
    // We trust user for now, or check if foldername matches session.folderName

    await uploadFiles(files, isResume);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/auth');
  };

  const handleDownload = async (item: any) => {
    const toastId = toast.loading("Preparing download...");
    try {
      const res = await api.get(`/download/${item.id}`);
      if (res.data.url) {
        toast.dismiss(toastId);
        window.open(res.data.url, '_blank');
        toast.success("Download started");
      } else {
        toast.error("Failed to get download URL", { id: toastId });
      }
    } catch (err) {
      toast.error("Failed to download file", { id: toastId });
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleItemClick = (item: DriveItem) => {
    if (item.type === 'folder') {
      navigateToFolder(item.id);
    } else {
      // File Logic
      const isImage = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(item.name);
      if (isImage) {
        viewImage(item.id);
      } else {
        // Open Editor
        navigate(`/editor/${item.id}`);
      }
    }
  };

  const viewImage = async (id: string) => {
    try {
      const toastId = toast.loading("Opening image...");
      const res = await api.get(`/download/${id}?disposition=inline`);
      window.open(res.data.url, '_blank');
      toast.dismiss(toastId);
    } catch (err) {
      toast.error("Failed to open image");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <Sidebar
        user={user}
        onNavigate={navigateToFolder}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Resume Alert */}
        {resumableSession && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-sm text-amber-900">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Incomplete Upload Detected:</span>
              <span>Folder "{resumableSession.folderName}" ({resumableSession.completedPaths.length}/{resumableSession.totalFiles} uploaded).</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResume}
                className="font-medium text-amber-700 hover:text-amber-900 underline"
              >
                Select Folder to Resume
              </button>
              <button
                onClick={clearSession}
                className="text-amber-600 hover:text-amber-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <DriveHeader
          username={user?.username || 'User'}
          onUploadFile={() => fileInputRef.current?.click()}
          onUploadFolder={() => folderInputRef.current?.click()}
          onCreateFolder={handleCreateFolder}
          onLogout={handleLogout}
          onBack={goBack}
          canGoBack={canGoBack}
          onSearch={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          // @ts-expect-error webkitdirectory is standard
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderChange}
        />

        <main className="flex-1 overflow-y-auto bg-white">
          {isSearching && (
            <div className="px-6 pt-4 pb-0">
              <h2 className="text-xl font-bold text-slate-800">Search Results</h2>
            </div>
          )}

          {viewMode === 'grid' ? (
            <FileGrid
              items={items}
              selectedId={selectedId}
              onSelect={(item) => setSelectedId(item.id)}
              onItemClick={handleItemClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onShare={handleShare}
              isSharedView={activeTab === 'shared'}
            />
          ) : (
            <ListView
              items={items}
              selectedId={selectedId}
              onSelect={(item) => setSelectedId(item.id)}
              onItemClick={handleItemClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
              getFolderSize={getFolderSize}
              onShare={handleShare}
              isSharedView={activeTab === 'shared'}
            />
          )}

          <InputDialog
            isOpen={isCreateFolderOpen}
            onClose={() => setIsCreateFolderOpen(false)}
            onSubmit={submitCreateFolder}
            title="Create New Folder"
            placeholder="Folder Name"
            submitLabel="Create Folder"
          />

          {/* Share Dialog */}
          {isShareOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 scale-in-95 zoom-in-95 animate-in duration-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Share "{itemToShare?.name}"</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Enter the username of the person you want to share with.
                </p>
                <form onSubmit={submitShare}>
                  <input
                    name="username"
                    autoFocus
                    placeholder="Username"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all mb-6"
                  />
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => { setIsShareOpen(false); setItemToShare(null); }}
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
          )}

          <ConfirmDialog
            isOpen={isDeleteOpen}
            onClose={() => {
              setIsDeleteOpen(false);
              setItemToDelete(null);
            }}
            onConfirm={async () => {
              if (itemToDelete) {
                toast.promise(
                  deleteItem(itemToDelete),
                  {
                    loading: 'Deleting item...',
                    success: 'Item deleted',
                    error: 'Failed to delete item',
                  }
                );
              }
            }}
            title="Delete Item"
            message="Are you sure you want to delete this item? This action cannot be undone."
            confirmLabel="Delete"
            isDestructive
          />

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-96 text-slate-300">
              <HardDrive size={64} strokeWidth={1} className="mb-4 opacity-10" />
              <p className="text-lg font-medium">No items found</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DrivePage;