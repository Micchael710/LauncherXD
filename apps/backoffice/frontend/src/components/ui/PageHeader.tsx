import React from 'react';

export interface PageHeaderProps {
    title: string;
    subtitle?: string;
    badge?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    badge,
    actions,
    className = ''
}) => {
    return (
        <div className={`page-header ${className}`.trim()}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h1>{title}</h1>
                    {badge}
                </div>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="actions-group">{actions}</div>}
        </div>
    );
};
