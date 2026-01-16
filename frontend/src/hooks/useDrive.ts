import { useState, useEffect, useMemo } from 'react';
import api from '../service/api';
import type { DriveItem, UserInfo } from '../types';
import { toast } from 'sonner';
import axios from 'axios';

export const useDrive = () => {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [itemMap, setItemMap] = useState<Record<string, DriveItem>>({});
    const [folderChildrenMap, setFolderChildrenMap] = useState<Record<string, string[]>>({});
    const [folderHistory, setFolderHistory] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Resumable Session State
    interface UploadSession {
        id: string;
        timestamp: number;
        totalFiles: number;
        folderName: string; // "MyFolder" or "Mixed Files"
        completedPaths: string[];
        targetFolderId: string;
    }
    const [resumableSession, setResumableSession] = useState<UploadSession | null>(null);

    // Initial Fetch checks for session too
    useEffect(() => {
        const init = async () => {
            try {
                // Check Session
                const saved = localStorage.getItem('upload_session');
                if (saved) {
                    const session: UploadSession = JSON.parse(saved);
                    // Expire after 24h? For now, keep it simple.
                    setResumableSession(session);
                }

                const [userRes, treeRes] = await Promise.all([
                    api.get('/auth/me'),
                    api.get('/tree')
                ]);

                setUser(userRes.data);
                const rootId = userRes.data.root_id;
                setCurrentFolderId(rootId);

                processTreeData(treeRes.data.tree);
            } catch (err) {
                console.error("Failed to init drive", err);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // ... (processTreeData, refreshDrive, currentItems, searchResults, navigate, goBack, createFolder, deleteItem) ...

    const processTreeData = (items: DriveItem[]) => {
        const iMap: Record<string, DriveItem> = {};
        const cMap: Record<string, string[]> = {};

        items.forEach(item => {
            iMap[item.id] = item;
            if (item.parent_id) {
                if (!cMap[item.parent_id]) cMap[item.parent_id] = [];
                cMap[item.parent_id].push(item.id);
            }
        });

        setItemMap(iMap);
        setFolderChildrenMap(cMap);
    };

    const refreshDrive = async () => {
        try {
            const res = await api.get('/tree');
            processTreeData(res.data.tree);
        } catch (err) {
            console.error("Failed to refresh tree", err);
        }
    };

    // Derived State
    const currentItems = useMemo(() => {
        if (!currentFolderId) return [];
        const childIds = folderChildrenMap[currentFolderId] || [];
        return childIds.map(id => itemMap[id]).filter(Boolean);
    }, [currentFolderId, folderChildrenMap, itemMap]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;

        const query = searchQuery.toLowerCase();
        return Object.values(itemMap).filter(item =>
            item.name.toLowerCase().includes(query)
        );
    }, [searchQuery, itemMap]);

    // Navigation
    const navigate = (folderId: string) => {
        if (currentFolderId) {
            setFolderHistory(prev => [...prev, currentFolderId]);
        }
        setCurrentFolderId(folderId);
        if (searchQuery) setSearchQuery("");
    };

    const goBack = () => {
        if (folderHistory.length === 0 && user?.root_id) {
            setCurrentFolderId(user.root_id);
            return;
        }
        const prevHistory = [...folderHistory];
        const lastId = prevHistory.pop();
        setFolderHistory(prevHistory);
        if (lastId) setCurrentFolderId(lastId);
        if (searchQuery) setSearchQuery("");
    };

    // Actions
    const createFolder = async (name: string) => {
        if (!currentFolderId) return;
        try {
            await api.post('/folders', { name, parent_id: currentFolderId });
            await refreshDrive();
            toast.success("Folder created");
        } catch (err) {
            toast.error("Failed to create folder");
            throw err;
        }
    };

    const deleteItem = async (itemId: string) => {
        const toastId = toast.loading("Deleting item...");
        try {
            await api.delete(`/resources/${itemId}`);
            await refreshDrive();
            toast.success("Item deleted", { id: toastId });
        } catch (err) {
            toast.error("Failed to delete item", { id: toastId });
            throw err;
        }
    };

    // --- UPLOAD LOGIC with RESUME ---

    // Single file upload core (private helper)
    const _uploadSingle = async (file: File, relativePath: string, parentId: string) => {
        const fileType = file.type || 'application/octet-stream';
        // 1. Init
        const initRes = await api.post('/upload', {
            parent_id: parentId,
            file_name: file.name,
            file_type: fileType,
            relative_path: relativePath
        });
        const { url, resource_id, s3_key, actual_parent_id } = initRes.data;
        // 2. Put
        await axios.put(url, file, { headers: { 'Content-Type': fileType } });
        // 3. Confirm
        await api.post('/upload/done', {
            resource_id, parent_id: actual_parent_id, name: file.name, size: file.size, s3_key, relative_path: relativePath
        });
    };

    const uploadFiles = async (files: FileList | File[], isResume = false) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        // Use current folder or the one from session
        const targetId = isResume && resumableSession ? resumableSession.targetFolderId : currentFolderId;
        if (!targetId) return;

        // Initialize Session if new
        let session = resumableSession;
        if (!isResume) {
            session = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                totalFiles: fileArray.length,
                folderName: fileArray[0].webkitRelativePath ? fileArray[0].webkitRelativePath.split('/')[0] : "Files",
                completedPaths: [],
                targetFolderId: targetId
            };
            setResumableSession(session);
            localStorage.setItem('upload_session', JSON.stringify(session));
        }

        const toastId = toast.loading(isResume ? `Resuming upload...` : `Preparing upload...`);

        try {
            let completedCount = session!.completedPaths.length;

            for (const file of fileArray) {
                const path = file.webkitRelativePath || file.name;

                // Skip if already done
                if (session!.completedPaths.includes(path)) {
                    continue;
                }

                toast.loading(`Uploading ${completedCount + 1}/${session!.totalFiles}: ${file.name}`, { id: toastId });

                try {
                    await _uploadSingle(file, path, targetId);

                    // Update Session
                    session!.completedPaths.push(path);
                    localStorage.setItem('upload_session', JSON.stringify(session));
                    setResumableSession({ ...session! }); // Force update
                    completedCount++;

                } catch (err) {
                    console.error(`Failed to upload ${file.name}`, err);
                    // Continue to next? Or stop? 
                    // Stopping is safer for resume logic. User can retry.
                    toast.error(`Error uploading ${file.name}. Reload to resume later.`, { id: toastId });
                    throw err;
                }
            }

            // Success: Clear Session
            localStorage.removeItem('upload_session');
            setResumableSession(null);
            await refreshDrive();
            toast.success("Upload complete!", { id: toastId });

        } catch (err) {
            // Error already shown above for file. 
            // Session remains in localStorage for resume.
        }
    };

    const clearSession = () => {
        localStorage.removeItem('upload_session');
        setResumableSession(null);
    };

    const getFolderSize = (folderId: string): number => {
        const childIds = folderChildrenMap[folderId] || [];
        let total = 0;
        for (const id of childIds) {
            const item = itemMap[id];
            if (!item) continue;
            if (item.type === 'file') {
                total += item.size || 0;
            } else {
                total += getFolderSize(item.id);
            }
        }
        return total;
    };

    // Sharing State
    const [activeTab, setActiveTab] = useState<'drive' | 'shared'>('drive');
    const [sharedItems, setSharedItems] = useState<DriveItem[]>([]);

    useEffect(() => {
        if (activeTab === 'shared') {
            fetchSharedItems();
            // Reset to root of shared tab? 
            // If we are deep navigating shared folders, we rely on currentFolderId.
        } else {
            // Switch back to drive root if needed? 
            // For now, let's keep separate history or reset?
            // If switching tabs, we might want to reset `currentFolderId` to root or keep it?
            // Let's reset to root if we switch back to drive to avoid confusion?
            if (user?.root_id && !currentFolderId) {
                setCurrentFolderId(user.root_id);
            }
        }
    }, [activeTab]);

    // Fetch folder contents if needed (for shared folders not in tree)
    useEffect(() => {
        const fetchFolderContents = async () => {
            if (!currentFolderId) return;

            // If we already have children in map, no need to fetch (unless force refresh?)
            if (folderChildrenMap[currentFolderId]) return;

            // If we are in 'drive' tab, we expect tree to have everything? 
            // But maybe lazily loaded?
            // If 'shared' tab, we DEFINITELY need to fetch if not in map.

            setIsLoading(true);
            try {
                const res = await api.get(`/folders/${currentFolderId}`);
                const children = res.data.children;

                // Merge into maps
                const newIMap = { ...itemMap };
                const newCMap = { ...folderChildrenMap };

                newCMap[currentFolderId] = [];
                children.forEach((item: DriveItem) => {
                    newIMap[item.id] = item;
                    newCMap[currentFolderId].push(item.id);
                });

                setItemMap(newIMap);
                setFolderChildrenMap(newCMap);
            } catch (err) {
                console.error("Failed to fetch folder contents", err);

                // If 403/404, maybe go back?
            } finally {
                setIsLoading(false);
            }
        };

        if (currentFolderId && !folderChildrenMap[currentFolderId] && currentFolderId !== user?.root_id) {
            // Only fetch if it's not the root (which should be in tree)
            // And if we are actually navigating.
            fetchFolderContents();
        }
    }, [currentFolderId, activeTab]);

    const fetchSharedItems = async () => {
        try {
            const res = await api.get('/shared');
            setSharedItems(res.data);
        } catch (err) {
            console.error("Failed to fetch shared items", err);
        }
    };

    const shareResource = async (resourceId: string, username: string) => {
        try {
            await api.post(`/resources/${resourceId}/share`, { username });
            toast.success("Shared successfully");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to share");
            throw err;
        }
    };

    return {
        user,
        items: activeTab === 'shared' ? sharedItems : (searchQuery ? (searchResults || []) : currentItems),
        currentFolderId,
        navigate,
        goBack,
        isLoading,
        refresh: refreshDrive,
        createFolder,
        deleteItem,
        uploadFiles,
        canGoBack: activeTab === 'drive' && (folderHistory.length > 0 || (currentFolderId !== user?.root_id)),
        isSearching: !!searchQuery,
        setSearchQuery,
        getFolderSize,
        resumableSession,
        clearSession,
        activeTab,
        setActiveTab,
        shareResource
    };
};
