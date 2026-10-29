
import React from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncIndicatorProps {
    isSyncing: boolean;
    label?: string; // Optional label, default "Syncing..."
    className?: string;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ isSyncing, label = "Syncing...", className = "" }) => {
    if (!isSyncing) return null;

    return (
        <div className={`flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100 animate-in fade-in zoom-in duration-300 ${className}`}>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{label}</span>
        </div>
    );
};
