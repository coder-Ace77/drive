export interface DriveItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent_id: string | null;
  s3_key?: string;
  size?: number;
  created_at: string;
}

export interface UserInfo {
  username: string;
  root_id: string;
}