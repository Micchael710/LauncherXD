import React from 'react';

export interface StatusPillProps {
    status: string;
    label?: string;
    variant?: 'online' | 'offline' | 'checking' | 'configured' | 'not-configured' | 'draft' | 'published' | 'deprecated' | 'stable' | 'beta' | 'ready' | 'not-ready' | 'launcher' | 'modpack' | 'custom';
    className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
    status,
    label,
    variant,
    className = ''
}) => {
    const getBadgeClass = (statusStr: string, forcedVariant?: string) => {
        if (forcedVariant && forcedVariant !== 'custom') {
            return `badge badge-${forcedVariant}`;
        }
        const s = statusStr.toLowerCase();
        switch (s) {
            case 'online':
            case 'published':
            case 'ready':
                return 'badge badge-online badge-published';
            case 'offline':
            case 'deprecated':
                return 'badge badge-offline badge-deprecated';
            case 'checking':
                return 'badge badge-checking';
            case 'configured':
                return 'badge badge-configured';
            case 'not configured':
            case 'not_configured':
            case 'pending':
            case 'pending implementation':
                return 'badge badge-not-configured';
            case 'draft':
                return 'badge badge-draft';
            case 'stable':
                return 'badge badge-stable';
            case 'beta':
                return 'badge badge-beta';
            case 'launcher':
                return 'badge badge-launcher';
            case 'modpack':
                return 'badge badge-modpack';
            default:
                return 'badge';
        }
    };

    const displayText = label || status;
    const badgeClass = `${getBadgeClass(status, variant)} ${className}`.trim();

    return (
        <span className={badgeClass}>
            <span className="status-dot" aria-hidden="true" />
            {displayText}
        </span>
    );
};
