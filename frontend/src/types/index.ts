export interface DriveItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent_id: string | null;
  s3_key?: string;
  size?: number;
  created_at: string;
  updated_at?: string;
}

export interface UserInfo {
  username: string;
  root_id: string;
}

export interface FileUploadResponse {
  url: string;
  resource_id: string;
  s3_key: string;
  actual_parent_id: string;
}

export interface FileInitItem {
  file_name: string;
  file_type: string;
  relative_path?: string;
}

export interface BulkFileUploadInit {
  parent_id: string;
  files: FileInitItem[];
}

export interface BulkInitResponse {
  files: FileUploadResponse[];
  delta?: {
    added: DriveItem[];
    updated: DriveItem[];
    deleted: string[];
  };
}