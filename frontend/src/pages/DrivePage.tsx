import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriveHeader } from '../components/DriveHeader';
import { Sidebar } from '../components/Sidebar';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DriveItem } from '../types';
import { driveService } from '../service/driveService';

import { useDriveData } from '../hooks/drive/useDriveData';
import { useDriveSelection } from '../hooks/drive/useDriveSelection';
import { useDriveClipboard } from '../hooks/drive/useDriveClipboard';
import { useDriveUpload } from '../hooks/drive/useDriveUpload';
import { useDriveOperations } from '../hooks/drive/useDriveOperations';

import ResumeUploadAlert from '../components/drive/ResumeUploadAlert';
import BulkActionsBar from '../components/drive/BulkActionsBar';
import DriveMain from '../components/drive/DriveMain';
import DriveDialogs from '../components/drive/DriveDialogs';

const DrivePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const {
    user,
    isLoading,
    currentFolderId,
    items,
    navigate: navigateToFolder,
    goBack,
    refreshDrive,
    applyDelta,
    getFolderSize,
    activeTab,
    setActiveTab,
    folderHistory,
    searchQuery,
    setSearchQuery,
    fetchSharedItems
  } = useDriveData();

  const isSearching = !!searchQuery;

  const canGoBack = activeTab === 'drive' && (folderHistory.length > 0 || (currentFolderId !== user?.root_id));

  const { selectedItems, toggleSelection, clearSelection, } = useDriveSelection(items);
  const { clipboard, copyItems, cutItems, pasteItems } = useDriveClipboard(refreshDrive, applyDelta);
  const { resumableSession, uploadFiles, clearSession, isUploading, cancelUpload, uploadSpeed } = useDriveUpload(currentFolderId, applyDelta);

  const { createFolder,
    deleteItem,
    deleteSelectedItems,
  } = useDriveOperations({
    currentFolderId,
    refreshDrive,
    applyDelta,
    activeTab,
    fetchSharedItems,
    selectedItems,
    clearSelection
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('view_mode') as 'grid' | 'list') || 'grid';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        const itemsToCopy = selectedItems.size > 0 ? Array.from(selectedItems) : (selectedId ? [selectedId] : []);

        if (itemsToCopy.length > 0) {
          if (copyItems) copyItems(itemsToCopy);
        } else {
          toast.error("Select items to copy");
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        const itemsToCut = selectedItems.size > 0 ? Array.from(selectedItems) : (selectedId ? [selectedId] : []);

        if (itemsToCut.length > 0) {
          if (cutItems) cutItems(itemsToCut);
        } else {
          toast.error("Select items to cut");
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (clipboard && clipboard.items.length > 0) {
          if (currentFolderId && pasteItems) {
            pasteItems(currentFolderId);
          }
        } else {
          toast.error("Clipboard is empty");
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, clipboard, currentFolderId, selectedId, copyItems, cutItems, pasteItems]);

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

  const handleResume = () => {
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
    const isResume = !!resumableSession;
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
      const url = await driveService.getDownloadUrl(item.id);
      toast.dismiss(toastId);
      window.open(url, '_blank');
      toast.success("Download started");
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
      const isImage = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(item.name);
      if (isImage) {
        viewImage(item.id);
      } else {
        navigate(`/editor/${item.id}`);
      }
    }
  };

  const viewImage = async (id: string) => {
    try {
      const toastId = toast.loading("Opening image...");
      const url = await driveService.getViewUrl(id);
      window.open(url, '_blank');
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
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {resumableSession && (
          <ResumeUploadAlert
            session={resumableSession}
            onResume={handleResume}
            onCancel={clearSession}
            isUploading={isUploading}
            uploadSpeed={uploadSpeed}
          />
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
          onMenuClick={() => setIsSidebarOpen(true)}
          isUploading={isUploading}
          onCancelUpload={cancelUpload}
          clipboard={clipboard}
          onPaste={() => currentFolderId && pasteItems && pasteItems(currentFolderId)}
        />

        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          // @ts-expect-error 
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderChange}
        />

        <DriveMain
          items={items}
          viewMode={viewMode}
          selectedId={selectedId}
          onSelect={(item) => setSelectedId(item.id)}
          onItemClick={handleItemClick}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onShare={handleShare}
          onCopy={(item) => copyItems && copyItems([item.id])}
          onMove={(item) => cutItems && cutItems([item.id])}
          isSharedView={activeTab === 'shared'}
          selectedItems={selectedItems}
          onToggleSelection={toggleSelection}
          clipboard={clipboard}
          getFolderSize={getFolderSize}
          isSearching={isSearching}
        />

        <DriveDialogs
          isCreateFolderOpen={isCreateFolderOpen}
          setIsCreateFolderOpen={setIsCreateFolderOpen}
          submitCreateFolder={submitCreateFolder}
          isShareOpen={isShareOpen}
          setIsShareOpen={setIsShareOpen}
          itemToShare={itemToShare}
          setItemToShare={setItemToShare}
          isDeleteOpen={isDeleteOpen}
          setIsDeleteOpen={setIsDeleteOpen}
          itemToDelete={itemToDelete}
          setItemToDelete={setItemToDelete}
          deleteSelectedItems={deleteSelectedItems}
          deleteItem={deleteItem}
          selectedItemsCount={selectedItems.size}
        />

        {selectedItems.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedItems.size}
            onClear={clearSelection}
            onCopy={() => copyItems && copyItems(Array.from(selectedItems))}
            onMove={() => cutItems && cutItems(Array.from(selectedItems))}
            onDelete={() => setIsDeleteOpen(true)}
          />
        )}
      </div>
    </div>
  );
};

export default DrivePage;