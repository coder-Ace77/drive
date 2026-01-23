import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { driveService } from '../../service/driveService';

interface UploadSession {
    id: string;
    timestamp: number;
    totalFiles: number;
    folderName: string;
    completedPaths: string[];
    targetFolderId: string;
}

export const useDriveUpload = (
    currentFolderId: string | null,
    applyDelta: (delta: any) => void
) => {
    const [resumableSession, setResumableSession] = useState<UploadSession | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Load session on mount
    useEffect(() => {
        const saved = localStorage.getItem('upload_session');
        if (saved) {
            setResumableSession(JSON.parse(saved));
        }
    }, []);

    const cancelUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsUploading(false);
        setResumableSession(null);
        localStorage.removeItem('upload_session');
        toast.info("Upload cancelled");
    };

    const uploadFiles = async (files: FileList | File[], isResume = false) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;
        const targetId = isResume && resumableSession ? resumableSession.targetFolderId : currentFolderId;
        if (!targetId) return;

        // Reset controller for new upload
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

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

        setIsUploading(true);
        const toastId = toast.loading(isResume ? `Resuming upload...` : `Preparing upload...`);

        try {
            const pendingFiles = fileArray.filter(file => {
                const path = file.webkitRelativePath || file.name;
                return !session!.completedPaths.includes(path);
            });

            if (pendingFiles.length === 0) {
                toast.success("All files already uploaded", { id: toastId });
                localStorage.removeItem('upload_session');
                setResumableSession(null);
                setIsUploading(false);
                return;
            }

            toast.loading(`Initializing upload for ${pendingFiles.length} files...`, { id: toastId });

            const bulkInitPayload = {
                parent_id: targetId,
                files: pendingFiles.map(f => ({
                    file_name: f.name,
                    file_type: f.type || 'application/octet-stream',
                    relative_path: f.webkitRelativePath || f.name
                }))
            };

            const initRes = await driveService.uploadInit(bulkInitPayload);
            const uploadConfigs = initRes.files;

            if (initRes.delta) {
                applyDelta(initRes.delta);
            }

            // Dimiss the loading toast so we don't have overlays. Use the UI bar for progress.
            toast.dismiss(toastId);

            const CONCURRENCY = 5;
            for (let i = 0; i < pendingFiles.length; i += CONCURRENCY) {
                // Check cancellation before batch
                if (abortControllerRef.current?.signal.aborted) {
                    throw new Error('Upload cancelled');
                }

                const batch = pendingFiles.slice(i, i + CONCURRENCY);

                await Promise.all(batch.map(async (file, batchIndex) => {
                    const globalIndex = i + batchIndex;
                    const config = uploadConfigs[globalIndex];
                    const path = file.webkitRelativePath || file.name;

                    try {
                        await axios.put(config.url, file, {
                            headers: { 'Content-Type': file.type || 'application/octet-stream' },
                            signal: abortControllerRef.current?.signal
                        });

                        const confirmRes = await driveService.uploadConfirm({
                            resource_id: config.resource_id,
                            parent_id: config.actual_parent_id,
                            name: file.name,
                            size: file.size,
                            s3_key: config.s3_key,
                            relative_path: path
                        });

                        applyDelta({
                            added: [confirmRes],
                            updated: [],
                            deleted: []
                        });

                        session!.completedPaths.push(path);

                    } catch (err) {
                        if (axios.isCancel(err)) {
                            throw err;
                        }
                        console.error(`Failed to upload ${file.name}`, err);
                        // Optional: Keep error toasts as they are important
                        toast.error(`Error uploading ${file.name}.`);
                    }
                }));

                localStorage.setItem('upload_session', JSON.stringify(session));
                setResumableSession({ ...session! });
            }

            localStorage.removeItem('upload_session');
            setResumableSession(null);
            toast.success("Upload complete!");

        } catch (err) {
            if (axios.isCancel(err) || (err as Error).message === 'Upload cancelled') {
                console.log("Upload was cancelled");
                // Toast handled in cancelUpload or not needed
            } else {
                console.error("Bulk upload failed", err);
                toast.error("Upload failed", { id: toastId });
            }
        } finally {
            if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
                setIsUploading(false);
                abortControllerRef.current = null;
            }
        }
    };

    const clearSession = () => {
        localStorage.removeItem('upload_session');
        setResumableSession(null);
    };

    return {
        resumableSession,
        uploadFiles,
        clearSession,
        isUploading,
        cancelUpload
    };
};
