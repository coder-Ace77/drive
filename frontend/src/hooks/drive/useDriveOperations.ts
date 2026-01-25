import { toast } from 'sonner';
import { driveService } from '../../service/driveService';

interface UseDriveOperationsProps {
    currentFolderId: string | null;
    refreshDrive: () => Promise<void>;
    applyDelta: (delta: any) => void;
    activeTab: 'drive' | 'shared';
    fetchSharedItems: () => Promise<void>;
    selectedItems: Set<string>;
    clearSelection: () => void;
}

export const useDriveOperations = ({
    currentFolderId,
    refreshDrive,
    applyDelta,
    activeTab,
    fetchSharedItems,
    selectedItems,
    clearSelection
}: UseDriveOperationsProps) => {

    const createFolder = async (name: string) => {
        if (!currentFolderId) return;
        try {
            await driveService.createFolder(name, currentFolderId);
            await refreshDrive();
            toast.success("Folder created");
        } catch (err) {
            toast.error("Failed to create folder");
            throw err;
        }
    };

    const deleteItem = async (itemId: string) => {
        try {
            const res = await driveService.deleteItem(itemId);
            applyDelta(res);
            return res;
        } catch (err) {
            throw err;
        }
    };

    const deleteSelectedItems = async () => {
        if (selectedItems.size === 0) return;
        const toastId = toast.loading(`Deleting ${selectedItems.size} items...`);
        try {
            await driveService.deleteItems(Array.from(selectedItems));
            await refreshDrive();
            if (activeTab === 'shared') await fetchSharedItems();
            clearSelection();
            toast.success("Items deleted", { id: toastId });
        } catch (err) {
            toast.error("Failed to delete items", { id: toastId });
            throw err;
        }
    };

    const shareResource = async (resourceId: string, username: string) => {
        await driveService.shareResource(resourceId, username);
    };

    return {
        createFolder,
        deleteItem,
        deleteSelectedItems,
        shareResource
    };
};
