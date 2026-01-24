import { Folder, FileText, Check } from 'lucide-react';
import type { DriveItem } from '../types/index';
import DriveItemMenu from './drive/DriveItemMenu';

interface Props {
  items: DriveItem[];
  selectedId: string | null;
  onSelect: (item: DriveItem) => void;
  onItemClick: (item: DriveItem) => void;
  onDownload: (item: DriveItem) => void;
  onDelete: (id: string) => void;
  onShare: (item: DriveItem) => void;
  onCopy: (item: DriveItem) => void;
  onMove: (item: DriveItem) => void;
  isSharedView?: boolean;
  // Selection Props
  selectedItems?: Set<string>;
  onToggleSelection?: (id: string) => void;
  clipboard?: { mode: 'copy' | 'cut'; items: string[] } | null;
}

export const FileGrid = ({
  items,
  selectedId,
  onSelect,
  onItemClick,
  onDownload,
  onDelete,
  onShare,
  onCopy,
  onMove,
  isSharedView = false,
  selectedItems,
  onToggleSelection,
  clipboard
}: Props) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6 pb-24">
      {items.map((item) => {
        const isSelected = selectedItems?.has(item.id);
        const isCut = clipboard?.mode === 'cut' && clipboard.items.includes(item.id);

        return (
          <div
            key={item.id}
            onClick={() => {
              if (onToggleSelection && isSelected) {
                onToggleSelection(item.id);
              } else {
                onSelect(item);
              }
            }}
            onDoubleClick={() => onItemClick(item)}
            className={`p-4 rounded-xl border transition-all cursor-pointer group relative 
              ${isSelected
                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-md'
                : selectedId === item.id
                  ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                  : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}
              ${isCut ? 'opacity-50 grayscale border-dashed' : ''}
              `}
          >
            {/* Checkbox Overlay */}
            {onToggleSelection && (
              <div
                className={`absolute top-3 left-3 z-10 ${isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'} transition-opacity`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelection(item.id);
                }}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 hover:border-blue-400'}`}>
                  {isSelected && <Check size={14} className="text-white" />}
                </div>
              </div>
            )}

            {/* Menu Overlay */}
            {!isSharedView && (
              <div className="absolute top-2 right-2 z-10">
                <DriveItemMenu
                  item={item}
                  onOpen={item.type === 'folder' ? onItemClick : undefined}
                  onDownload={onDownload}
                  onShare={onShare}
                  onCopy={onCopy}
                  onMove={onMove}
                  onDelete={onDelete}
                />
              </div>
            )}

            <div className="flex flex-col items-center text-center mt-2">
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
        )
      })}
    </div>
  );
};