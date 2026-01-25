import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { driveService } from '../../service/driveService';


type ClipboardMode = 'copy' | 'cut';

interface ClipboardState {
    mode: ClipboardMode;
    items: string[];
}

export const useDriveClipboard = (
    _refreshDrive: () => Promise<void>,
    applyDelta: (delta: any) => void
) => {
    const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

    const copyItems = useCallback((ids: string[]) => {
        setClipboard({ mode: 'copy', items: ids });
        toast.info(`Copied ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`, { duration: 2000 });
    }, []);

    const cutItems = useCallback((ids: string[]) => {
        setClipboard({ mode: 'cut', items: ids });
        toast.info(`Cut ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`, { duration: 2000 });
    }, []);

    const pasteItems = useCallback(async (targetFolderId: string) => {
        if (!clipboard || clipboard.items.length === 0) return;

        const toastId = toast.loading(clipboard.mode === 'cut' ? "Moving items..." : "Copying items...");
        try {
            let res;
            if (clipboard.mode === 'cut') {
                res = await driveService.moveItems(clipboard.items, targetFolderId);
            } else {
                res = await driveService.copyItems(clipboard.items, targetFolderId);
            }

            applyDelta(res);

            if (clipboard.mode === 'cut') {
                setClipboard(null);
            }

            toast.success(clipboard.mode === 'cut' ? "Items moved" : "Items copied", { id: toastId });

        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to paste items", { id: toastId });
        }
    }, [clipboard, applyDelta]);

    return {
        clipboard,
        copyItems,
        cutItems,
        pasteItems
    };
};
