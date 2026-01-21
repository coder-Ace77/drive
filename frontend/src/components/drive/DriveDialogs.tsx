import React from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { InputDialog } from '../ui/InputDialog';
import DriveShareDialog from './DriveShareDialog';
import { driveService } from '../../service/driveService';

interface DriveDialogsProps {
    isCreateFolderOpen: boolean;
    setIsCreateFolderOpen: (open: boolean) => void;
    submitCreateFolder: (name: string) => Promise<void>;

    isShareOpen: boolean;
    setIsShareOpen: (open: boolean) => void;
    itemToShare: { id: string; name: string } | null;
    setItemToShare: (item: any) => void;
    onShareSuccess?: () => void; // Optional callback if we want to refresh or something

    isDeleteOpen: boolean;
    setIsDeleteOpen: (open: boolean) => void;
    itemToDelete: string | null;
    setItemToDelete: (id: string | null) => void;
    deleteSelectedItems: () => Promise<void>;
    deleteItem: (id: string) => Promise<any>;
    selectedItemsCount: number;
}

const DriveDialogs: React.FC<DriveDialogsProps> = ({
    isCreateFolderOpen,
    setIsCreateFolderOpen,
    submitCreateFolder,
    isShareOpen,
    setIsShareOpen,
    itemToShare,
    setItemToShare,
    isDeleteOpen,
    setIsDeleteOpen,
    itemToDelete,
    setItemToDelete,
    deleteSelectedItems,
    deleteItem,
    selectedItemsCount
}) => {

    const handleSubmitShare = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const username = (form.elements.namedItem('username') as HTMLInputElement).value;

        if (!itemToShare || !username) return;

        const toastId = toast.loading("Sharing...");
        try {
            await driveService.shareResource(itemToShare.id, username);
            toast.dismiss(toastId);
            toast.success("Shared successfully");
            setIsShareOpen(false);
            setItemToShare(null);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to share");
            toast.dismiss(toastId);
        }
    };

    return (
        <>
            <InputDialog
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                onSubmit={submitCreateFolder}
                title="Create New Folder"
                placeholder="Folder Name"
                submitLabel="Create Folder"
            />

            <DriveShareDialog
                isOpen={isShareOpen}
                itemToShare={itemToShare}
                onClose={() => {
                    setIsShareOpen(false);
                    setItemToShare(null);
                }}
                onSubmit={handleSubmitShare}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => {
                    setIsDeleteOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={async () => {
                    if (selectedItemsCount > 0 && !itemToDelete) {
                        await deleteSelectedItems();
                    } else if (itemToDelete) {
                        toast.promise(deleteItem(itemToDelete), {
                            loading: 'Deleting item...',
                            success: 'Item deleted',
                            error: 'Failed to delete item',
                        });
                    }
                }}
                title={selectedItemsCount > 0 && !itemToDelete ? `Delete ${selectedItemsCount} Items?` : "Delete Item"}
                message="Are you sure you want to delete these items? This action cannot be undone."
                confirmLabel="Delete"
                isDestructive
            />
        </>
    );
};

export default DriveDialogs;
