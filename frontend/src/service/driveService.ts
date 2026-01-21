import api from './api';
import type { DriveItem, BulkInitResponse, UserInfo } from '../types';

export const driveService = {
    getDownloadUrl: async (itemId: string): Promise<string> => {
        const res = await api.get(`/download/${itemId}`);
        if (res.data.url) return res.data.url;
        throw new Error("Failed to get download URL");
    },

    getViewUrl: async (itemId: string): Promise<string> => {
        const res = await api.get(`/download/${itemId}?disposition=inline`);
        if (res.data.url) return res.data.url;
        throw new Error("Failed to get view URL");
    },

    shareResource: async (resourceId: string, username: string): Promise<void> => {
        await api.post(`/resources/${resourceId}/share`, { username });
    },

    getMe: async (): Promise<UserInfo> => {
        const res = await api.get('/auth/me');
        return res.data;
    },

    getTree: async (): Promise<{ tree: DriveItem[] }> => {
        const res = await api.get('/tree');
        return res.data;
    },

    getFolder: async (folderId: string): Promise<{ children: DriveItem[] }> => {
        const res = await api.get(`/folders/${folderId}`);
        return res.data;
    },

    createFolder: async (name: string, parentId: string): Promise<void> => {
        await api.post('/folders', { name, parent_id: parentId });
    },

    deleteItem: async (itemId: string): Promise<{ deleted: string[], added: any[], updated: any[] }> => {
        const res = await api.delete(`/resources/${itemId}`);
        return res.data;
    },

    deleteItems: async (resourceIds: string[]): Promise<void> => {
        await api.delete('/resources/bulk-delete', {
            data: { resource_ids: resourceIds }
        });
    },

    uploadInit: async (payload: { parent_id: string, files: any[] }): Promise<BulkInitResponse> => {
        const res = await api.post('/upload/bulk', payload);
        return res.data;
    },

    uploadConfirm: async (payload: any): Promise<DriveItem> => {
        const res = await api.post('/upload/confirm', payload);
        return res.data;
    },

    moveItems: async (resourceIds: string[], targetParentId: string): Promise<any> => {
        const res = await api.post('/resources/move', {
            resource_ids: resourceIds,
            target_parent_id: targetParentId
        });
        return res.data;
    },

    copyItems: async (resourceIds: string[], targetParentId: string): Promise<any> => {
        const res = await api.post('/resources/copy', {
            resource_ids: resourceIds,
            target_parent_id: targetParentId
        });
        return res.data;
    },

    getSharedItems: async (): Promise<DriveItem[]> => {
        const res = await api.get('/shared');
        return res.data;
    }
};
