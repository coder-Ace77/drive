import React from 'react';
import { AlertCircle, Play, X, Loader2 } from 'lucide-react';

interface ResumeUploadAlertProps {
    session: {
        folderName: string;
        completedPaths: string[];
        totalFiles: number;
    };
    onResume: () => void;
    onCancel: () => void;
    isUploading?: boolean;
}

const ResumeUploadAlert: React.FC<ResumeUploadAlertProps> = ({ session, onResume, onCancel, isUploading = false }) => {
    const uploadedCount = session.completedPaths.length;
    const totalCount = session.totalFiles;
    const percentage = Math.round((uploadedCount / totalCount) * 100);

    // Theme configuration based on state
    const theme = isUploading
        ? {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            iconBg: 'bg-emerald-100/50',
            iconColor: 'text-emerald-600',
            textColor: 'text-emerald-900',
            subTextColor: 'text-emerald-600/80',
            badgeBg: 'bg-emerald-100',
            barBg: 'bg-emerald-100/50',
            barFill: 'bg-emerald-500',
            barShadow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]'
        }
        : {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            iconBg: 'bg-amber-100/50',
            iconColor: 'text-amber-600',
            textColor: 'text-amber-900',
            subTextColor: 'text-amber-600/80',
            badgeBg: 'bg-amber-100',
            barBg: 'bg-amber-100/50',
            barFill: 'bg-amber-500',
            barShadow: 'shadow-[0_0_10px_rgba(245,158,11,0.5)]'
        };

    return (
        <div className={`${theme.bg} border-b ${theme.border} relative group transition-colors duration-300`}>
            <div className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 ${theme.iconBg} rounded-full ${theme.iconColor}`}>
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <AlertCircle size={18} />}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className={`font-bold ${theme.textColor} text-sm`}>
                                {isUploading ? 'Uploading...' : 'Incomplete Detected'}
                            </span>
                            <span className={`${theme.iconColor} text-xs font-medium px-2 py-0.5 ${theme.badgeBg} rounded-full`}>
                                {percentage}%
                            </span>
                            {isUploading && (
                                <span className={`${theme.subTextColor} text-xs ml-1`}>
                                    ({uploadedCount} / {totalCount})
                                </span>
                            )}
                        </div>
                        <span className={`text-xs ${theme.subTextColor} font-medium`}>
                            {session.folderName}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isUploading && (
                        <button
                            onClick={onResume}
                            className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border ${theme.border} shadow-sm hover:shadow ${theme.textColor} rounded-md text-xs font-semibold transition-all hover:opacity-90`}
                        >
                            <Play size={12} className="fill-current" />
                            Resume
                        </button>
                    )}
                    {!isUploading && (
                        <button
                            onClick={onCancel}
                            className={`p-1.5 hover:bg-black/5 ${theme.iconColor} hover:${theme.textColor} rounded-md transition-colors`}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar at the absolute bottom */}
            <div className={`absolute bottom-0 left-0 w-full h-1 ${theme.barBg}`}>
                <div
                    className={`h-full ${theme.barFill} ${theme.barShadow} transition-all duration-300 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

export default ResumeUploadAlert;
