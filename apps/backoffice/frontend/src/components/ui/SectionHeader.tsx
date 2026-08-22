import React from 'react';

export interface SectionHeaderProps {
    id?: string;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
    id,
    title,
    subtitle,
    action,
    className = ''
}) => {
    return (
        <div className={`section-header ${className}`.trim()}>
            <div>
                <h2 id={id}>{title}</h2>
                {subtitle && <p className="section-subtitle">{subtitle}</p>}
            </div>
            {action && <div className="section-actions">{action}</div>}
        </div>
    );
};
