import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../service/api'; 
import { DriveHeader } from '../components/DriveHeader';
import { FileGrid } from '../components/Filegrid';
import type { DriveItem, UserInfo } from '../types';
import { LayoutGrid, List, HardDrive, Clock, Star, Trash, Loader2 } from 'lucide-react';

const DrivePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const [folderHistory, setFolderHistory] = useState<string[]>([]);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await api.get('/me');
      setUser(res.data);
      setCurrentFolderId(res.data.root_id);
      fetchFolderContents(res.data.root_id);
    } catch (err) {
      navigate('/auth');
    }
  };

  const fetchFolderContents = async (folderId: string) => {
    try {
      const res = await api.get(`/folders/${folderId}`);
      setItems(res.data.children || []);
    } catch (err) {
      console.error("Error fetching folder contents", err);
    }
  };

  // --- NEW FOLDER LOGIC ---
  const handleCreateFolder = async () => {
    const folderName = prompt("Enter folder name:");
    if (!folderName || !currentFolderId) return;

    try {
      // Assuming your backend has a POST /folders or handles folders via /resources
      await api.post('/folders', {
        name: folderName,
        parent_id: currentFolderId
      });
      fetchFolderContents(currentFolderId);
    } catch (err) {
      alert("Failed to create folder");
    }
  };

  // --- UPLOAD LOGIC ---
  const processUpload = async (file: File, path: string) => {
    const fileType = file.type || 'application/octet-stream';
    
    // Step 1: Request upload URL
    // IMPORTANT: We send 'path' (e.g., "Documents/Work/resume.pdf")
    // The backend logic must be updated to parse this path and create subfolders.
    const presignedRes = await api.post('/upload', null, {
      params: {
        parent_id: currentFolderId,
        file_name: file.name,
        file_type: fileType,
        relative_path: path 
      }
    });

    const { url, resource_id, s3_key } = presignedRes.data;

    // Step 2: S3 Upload
    await axios.put(url, file, {
      headers: { 'Content-Type': fileType }
    });

    // Step 3: Confirm and Index
    await api.post('/upload/done', null, {
      params: {
        resource_id,
        parent_id: currentFolderId,
        name: file.name,
        s3_key,
        relative_path: path // Pass it back to the indexing route too
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);
    try {
      await processUpload(file, file.name);
      fetchFolderContents(currentFolderId!);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setIsUploading(true);

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // This is the magic: "FolderA/SubB/image.png"
        const path = file.webkitRelativePath || file.name;
        
        setUploadProgress(`Uploading ${i + 1}/${fileArray.length}: ${file.name}`);
        await processUpload(file, path);
      }
      fetchFolderContents(currentFolderId!);
      alert("Folder structure uploaded!");
    } catch (err) {
      console.error(err);
      alert("Folder upload failed mid-way.");
    } finally {
      setIsUploading(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleNavigate = (folderId: string) => {
    if (currentFolderId) {
      setFolderHistory(prev => [...prev, currentFolderId]);
    }
    setCurrentFolderId(folderId);
    fetchFolderContents(folderId);
  };

  const handleBack = () => {
    if (folderHistory.length === 0) return;
    
    const prevHistory = [...folderHistory];
    const lastFolderId = prevHistory.pop(); // Remove last folder from stack
    
    setFolderHistory(prevHistory);
    setCurrentFolderId(lastFolderId || user?.root_id || null);
    if (lastFolderId) fetchFolderContents(lastFolderId);
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); // Or however you handle auth
    navigate('/auth');
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <aside className="w-64 border-r border-slate-200 p-4 flex flex-col gap-2 bg-slate-50/50">
        <div className="flex items-center gap-2 px-2 mb-8">
           <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-100">
              <HardDrive className="text-white" size={20}/>
           </div>
           <span className="font-bold text-xl tracking-tight text-slate-800">Drive</span>
        </div>
        <nav className="space-y-1">
          <button className="flex items-center gap-3 w-full px-4 py-2.5 bg-blue-100 text-blue-700 rounded-xl font-semibold">
            <HardDrive size={20} /> My Drive
          </button>
          <button className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-medium cursor-not-allowed opacity-50">
            <Clock size={20} /> Recent
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <DriveHeader 
          username={user?.username || 'User'} 
          onUploadFile={() => fileInputRef.current?.click()} 
          onUploadFolder={() => folderInputRef.current?.click()} 
          onCreateFolder={handleCreateFolder}
          onLogout={handleLogout}
          onBack={handleBack}
          canGoBack={folderHistory.length > 0} // True if we've moved away from root
        />
        
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        <input 
          type="file" 
          ref={folderInputRef} 
          className="hidden" 
          webkitdirectory="" 
          directory="" 
          multiple 
          onChange={handleFolderChange} 
        />

        <main className="flex-1 overflow-y-auto bg-white">
          {isUploading && (
            <div className="mx-8 mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4 text-blue-700 shadow-sm transition-all animate-pulse">
              <Loader2 size={20} className="animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-bold">Processing Upload...</p>
                <p className="text-xs opacity-70 truncate">{uploadProgress}</p>
              </div>
            </div>
          )}

          <FileGrid 
            items={items} 
            selectedId={selectedItem?.id || null}
            onSelect={setSelectedItem}
            onNavigate={(id) => {
              setCurrentFolderId(id);
              fetchFolderContents(id);
            }}
            onDownload={(item) => window.open(`${import.meta.env.VITE_API_URL}/download/${item.id}`, '_blank')}
            onDelete={async (id) => {
              if (confirm("Delete this item?")) {
                await api.delete(`/resources/${id}`);
                fetchFolderContents(currentFolderId!);
              }
            }}
          />

          {items.length === 0 && !isUploading && (
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