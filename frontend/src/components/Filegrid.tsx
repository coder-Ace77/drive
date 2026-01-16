import { Folder, FileText, Download, Trash2, Share2 } from 'lucide-react';
import type { DriveItem } from '../types/index';

interface Props {
  items: DriveItem[];
  selectedId: string | null;
  onSelect: (item: DriveItem) => void;
  onItemClick: (item: DriveItem) => void;
  onDownload: (item: DriveItem) => void;
  onDelete: (id: string) => void;
  onShare: (item: DriveItem) => void;
  isSharedView?: boolean;
}

export const FileGrid = ({ items, selectedId, onSelect, onItemClick, onDownload, onDelete, onShare, isSharedView = false }: Props) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onSelect(item)}
          onDoubleClick={() => onItemClick(item)}
          className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${selectedId === item.id
            ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
            : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
            }`}
        >
          {/* Action Overlay for Selected Item */}
          {selectedId === item.id && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              {!isSharedView && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShare(item); }}
                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                  title="Share"
                >
                  <Share2 size={16} />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(item); }}
                className="p-1 hover:bg-blue-100 rounded text-blue-600"
                title="Download"
              >
                <Download size={16} />
              </button>
              {!isSharedView && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                  className="p-1 hover:bg-red-100 rounded text-red-600"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col items-center text-center">
            {item.type === 'folder' ? (
              <Folder className="text-blue-500 fill-blue-500/10 mb-3" size={48} />
            ) : (
              <FileText className="text-slate-400 mb-3" size={48} />
            )}
            <span className="text-sm font-medium text-slate-700 truncate w-full px-2">
              {item.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};