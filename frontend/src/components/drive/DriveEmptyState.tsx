import { HardDrive } from 'lucide-react';

interface Props {
    isSearching?: boolean;
}

const DriveEmptyState = ({ isSearching = false }: Props) => {
    return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-300">
            <HardDrive size={64} strokeWidth={1} className="mb-4 opacity-10" />
            <p className="text-lg font-medium">{isSearching ? "No results found" : "No items found"}</p>
        </div>
    );
};

export default DriveEmptyState;
