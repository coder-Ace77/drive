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

        // Allow fetching if we have a folder ID, regardless of tab (unless it's root and we are in Drive, handled by Init)
        // For shared tab, we start with specific list, but if we navigate into a folder, we need to fetch.
        if (currentFolderId && !folderChildrenMap[currentFolderId]) {
            // Avoid re-fetching root if already loaded via tree, but for shared folders we need to fetch
            // logic: if it's the user's root, we might have it from Tree, but verifying doesn't hurt.
            // Tree only gave structure, not full updated children list possibly? 
            // actually `get_tree` gives all descendants.
            // Optimization: if we are in Drive tab and it's root, we skipped.
            // But simpler: just check map.
            if (activeTab === 'drive' && currentFolderId === user?.root_id && folderChildrenMap[currentFolderId]) {
                return;
            }
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
            // Ensure we reset current folder if switching to Shared tab, so we see the root list
            // But if we are already in shared tab and navigating, we don't want to reset.
            // This effect runs on activeTab change. 
            // We should reset currentFolderId to null when entering Shared tab?
            // "Shared" tab root doesn't have a folder ID usually, it's a virtual view.
            if (activeTab === 'shared') {
                setCurrentFolderId(null);
            }
        } else {
            if (user?.root_id && !currentFolderId) {
                setCurrentFolderId(user.root_id);
            }
        }
        // Only trigger on activeTab change mainly, or user load
    }, [activeTab, fetchSharedItems, user?.root_id]);


    const applyDelta = useCallback((delta: { added: DriveItem[], updated: DriveItem[], deleted: string[] }) => {
        // ... existing applyDelta code ...
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
        // If history is empty:
        // In Drive: go to root.
        // In Shared: go to null (root of shared).
        if (folderHistory.length === 0) {
            if (activeTab === 'drive' && user?.root_id) {
                setCurrentFolderId(user.root_id);
            } else if (activeTab === 'shared') {
                setCurrentFolderId(null);
            }
            return;
        }
        const prevHistory = [...folderHistory];
        const lastId = prevHistory.pop();
        setFolderHistory(prevHistory);

        // If lastId is undefined/null, it implies we go back to start? 
        // Logic: if we were at root, history is empty.
        // If we navigated deep, history has ids.
        if (lastId) {
            setCurrentFolderId(lastId);
        } else {
            // Handle case where we might pop to "null" if we pushed null? 
            // We don't push null.
            // If we are in Shared and went 1 level deep. History has [null]? No, we only push currentFolderId if it exists.
            // If we started at null (Shared Root), then navigated to A. current=A. history=[].
            // Back -> history empty. Should go to null.
            if (activeTab === 'shared') {
                setCurrentFolderId(null);
            } else if (user?.root_id) {
                setCurrentFolderId(user.root_id);
            }
        }
        if (searchQuery) setSearchQuery("");
    }, [folderHistory, user?.root_id, searchQuery, activeTab]);


    // Computed
    const currentItems = useMemo(() => {
        if (!currentFolderId) return [];
        const childIds = folderChildrenMap[currentFolderId] || [];
        // Support items being in map but maybe not fully loaded? fetch ensures they are.
        return childIds.map(id => itemMap[id]).filter(Boolean);
    }, [currentFolderId, folderChildrenMap, itemMap]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const query = searchQuery.toLowerCase();
        return Object.values(itemMap).filter(item =>
            item.name.toLowerCase().includes(query)
        );
    }, [searchQuery, itemMap]);

    // Decide what items to show
    let displayedItems: DriveItem[] = [];
    if (searchQuery) {
        displayedItems = searchResults || [];
    } else if (activeTab === 'shared' && !currentFolderId) {
        displayedItems = sharedItems;
    } else {
        displayedItems = currentItems;
    }

    const getFolderSize = useCallback((folderId: string): number => {
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
    }, [folderChildrenMap, itemMap]);

    return {
        user,
        isLoading,
        currentFolderId,
        itemMap,
        folderChildrenMap,
        items: displayedItems,
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
