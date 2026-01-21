import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { DriveItem, UserInfo } from '../../types';
import { driveService } from '../../service/driveService';

export const useDriveData = () => {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [itemMap, setItemMap] = useState<Record<string, DriveItem>>({});
    const [folderChildrenMap, setFolderChildrenMap] = useState<Record<string, string[]>>({});
    const [folderHistory, setFolderHistory] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<'drive' | 'shared'>('drive');
    const [sharedItems, setSharedItems] = useState<DriveItem[]>([]);

    const initialized = useRef(false);

    const processTreeData = useCallback((items: DriveItem[]) => {
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
    }, []);

    const refreshDrive = useCallback(async () => {
        try {
            const { tree } = await driveService.getTree();
            processTreeData(tree);
        } catch (err) {
            console.error("Failed to refresh tree", err);
        }
    }, [processTreeData]);

    // Init
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const init = async () => {
            try {
                const [userData, treeData] = await Promise.all([
                    driveService.getMe(),
                    driveService.getTree()
                ]);

                setUser(userData);
                setCurrentFolderId(userData.root_id);
                processTreeData(treeData.tree);
            } catch (err) {
                console.error("Failed to init drive", err);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, [processTreeData]);

    // Folder Navigation fetch
    useEffect(() => {
        const fetchFolderContents = async () => {
            if (!currentFolderId) return;
            if (folderChildrenMap[currentFolderId]) return;
            setIsLoading(true);
            try {
                const { children } = await driveService.getFolder(currentFolderId);

                setItemMap(prev => {
                    const next = { ...prev };
                    children.forEach(item => { next[item.id] = item; });
                    return next;
                });

                setFolderChildrenMap(prev => {
                    const next = { ...prev };
                    next[currentFolderId] = children.map(c => c.id);
                    return next;
                });

            } catch (err) {
                console.error("Failed to fetch folder contents", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentFolderId && !folderChildrenMap[currentFolderId] && currentFolderId !== user?.root_id && activeTab === 'drive') {
            fetchFolderContents();
        }
    }, [currentFolderId, activeTab, user?.root_id, folderChildrenMap]);

    // Shared Items
    const fetchSharedItems = useCallback(async () => {
        try {
            const items = await driveService.getSharedItems();
            setSharedItems(items);
        } catch (err) {
            console.error("Failed to fetch shared items", err);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'shared') {
            fetchSharedItems();
        } else {
            if (user?.root_id && !currentFolderId) {
                setCurrentFolderId(user.root_id);
            }
        }
    }, [activeTab, fetchSharedItems, user?.root_id, currentFolderId]);


    const applyDelta = useCallback((delta: { added: DriveItem[], updated: DriveItem[], deleted: string[] }) => {
        // Similar logic as original hook
        setItemMap(prev => {
            const next = { ...prev };
            delta.deleted.forEach(id => delete next[id]);
            delta.updated.forEach(item => next[item.id] = item);
            delta.added.forEach(item => next[item.id] = item);
            return next;
        });

        setFolderChildrenMap(prev => {
            const next = { ...prev };
            // Removing deleted
            delta.deleted.forEach(id => {
                for (const parentId in next) {
                    next[parentId] = next[parentId].filter(childId => childId !== id);
                }
            });
            // Adding new
            delta.added.forEach(item => {
                if (item.parent_id) {
                    if (!next[item.parent_id]) next[item.parent_id] = [];
                    if (!next[item.parent_id].includes(item.id)) {
                        next[item.parent_id] = [...next[item.parent_id], item.id];
                    }
                }
            });
            return next;
        });
    }, []);


    const navigate = useCallback((folderId: string) => {
        if (currentFolderId) {
            setFolderHistory(prev => [...prev, currentFolderId]);
        }
        setCurrentFolderId(folderId);
        if (searchQuery) setSearchQuery("");
    }, [currentFolderId, searchQuery]);

    const goBack = useCallback(() => {
        if (folderHistory.length === 0 && user?.root_id) {
            setCurrentFolderId(user.root_id);
            return;
        }
        const prevHistory = [...folderHistory];
        const lastId = prevHistory.pop();
        setFolderHistory(prevHistory);
        if (lastId) setCurrentFolderId(lastId);
        if (searchQuery) setSearchQuery("");
    }, [folderHistory, user?.root_id, searchQuery]);


    // Computed
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

    const getFolderSize = useCallback((folderId: string): number => {
        // Logic for folder size
        // This is recursive and might be expensive if map is huge, but kept same as before
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
    }, [folderChildrenMap, itemMap]); // Note: Recursive function needs stable references or to be defined outside if possible, but inside hook relies on state.

    return {
        user,
        isLoading,
        currentFolderId,
        itemMap,
        folderChildrenMap,
        items: activeTab === 'shared' ? sharedItems : (searchQuery ? (searchResults || []) : currentItems),
        searchQuery,
        setSearchQuery,
        navigate,
        goBack,
        refreshDrive,
        applyDelta,
        getFolderSize,
        activeTab,
        setActiveTab,
        folderHistory,
        fetchSharedItems
    };
};
