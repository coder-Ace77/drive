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
    const [uploadSpeed, setUploadSpeed] = useState<string>("");

    const abortControllerRef = useRef<AbortController | null>(null);

    // Dynamic concurrency state
    const concurrencyRef = useRef(3);
    const activeUploadsRef = useRef(0);

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
        concurrencyRef.current = 3; // Reset start concurrency
        activeUploadsRef.current = 0;

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

            // Queue Setup
            const queue = pendingFiles.map((file, i) => ({
                file,
                config: uploadConfigs[i],
                path: file.webkitRelativePath || file.name
            }));

            let lastLoaded = 0;
            let lastTime = Date.now();
            const THROTTLE_MS = 800;

            const processQueue = async () => {
                if (abortControllerRef.current?.signal.aborted) return;

                // Spawn workers until limit reached or queue empty
                while (
                    queue.length > 0 &&
                    activeUploadsRef.current < concurrencyRef.current &&
                    !abortControllerRef.current?.signal.aborted
                ) {
                    const item = queue.shift();
                    if (!item) break;

                    activeUploadsRef.current++;

                    // Upload Item Function
                    const uploadItem = async () => {
                        try {
                            await axios.put(item.config.url, item.file, {
                                headers: { 'Content-Type': item.file.type || 'application/octet-stream' },
                                signal: abortControllerRef.current?.signal,
                                onUploadProgress: (progressEvent) => {
                                    const now = Date.now();
                                    if (now - lastTime >= THROTTLE_MS && progressEvent.loaded > 0) {
                                        const timeDiff = (now - lastTime) / 1000;
                                        const loadedDiff = progressEvent.loaded - lastLoaded;
                                        if (timeDiff > 0) {
                                            const speedBytesPerSec = loadedDiff / timeDiff;
                                            const speedMBPerSec = (speedBytesPerSec / (1024 * 1024)).toFixed(1);
                                            // Optional: Show Active Concurrency in UI for debug/fun? 
                                            // setUploadSpeed(`${speedMBPerSec} MB/s (C:${concurrencyRef.current})`);
                                            setUploadSpeed(`${speedMBPerSec} MB/s`);
                                            lastLoaded = progressEvent.loaded;
                                            lastTime = now;
                                        }
                                    }
                                }
                            });

                            const confirmRes = await driveService.uploadConfirm({
                                resource_id: item.config.resource_id,
                                parent_id: item.config.actual_parent_id,
                                name: item.file.name,
                                size: item.file.size,
                                s3_key: item.config.s3_key,
                                relative_path: item.path
                            });

                            applyDelta({
                                added: [confirmRes],
                                updated: [],
                                deleted: []
                            });

                            session!.completedPaths.push(item.path);
                            localStorage.setItem('upload_session', JSON.stringify(session));
                            setResumableSession({ ...session! });

                            // Success - Ramp Up
                            // Limit max concurrency to 10 for browser sanity
                            if (concurrencyRef.current < 10) {
                                concurrencyRef.current += 1;
                            }

                        } catch (err) {
                            if (axios.isCancel(err)) throw err;
                            console.error(`Failed to upload ${item.file.name}`, err);
                            toast.error(`Error uploading ${item.file.name}`);

                            // Failure - Ramp Down
                            concurrencyRef.current = Math.max(1, Math.floor(concurrencyRef.current / 2));
                        } finally {
                            activeUploadsRef.current--;
                            processQueue(); // Trigger next
                        }
                    };

                    // Start the upload without awaiting it here (fire and forget / independent promise)
                    uploadItem().catch(err => {
                        if (axios.isCancel(err) || (err as Error).message === 'Upload cancelled') {
                            // Handled globally
                        }
                    });
                }

                // Completion Check
                // We are done if queue is empty AND no active uploads
                if (queue.length === 0 && activeUploadsRef.current === 0) {
                    if (!abortControllerRef.current?.signal.aborted) {
                        localStorage.removeItem('upload_session');
                        setResumableSession(null);
                        setIsUploading(false);
                        toast.success("Upload complete!");
                    }
                }
            };

            // Kickoff
            processQueue();

        } catch (err) {
            if (axios.isCancel(err) || (err as Error).message === 'Upload cancelled') {
                console.log("Upload was cancelled");
            } else {
                console.error("Bulk upload failed", err);
                toast.error("Upload failed", { id: toastId });
                setIsUploading(false);
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
        cancelUpload,
        uploadSpeed
    };
};
