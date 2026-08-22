import React from 'react';

export interface CardProps {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerClassName?: string;
    dataTestId?: string;
    role?: string;
    ariaLabelledby?: string;
}

export const Card: React.FC<CardProps> = ({
    title,
    subtitle,
    action,
    children,
    className = '',
    headerClassName = '',
    dataTestId,
    role,
    ariaLabelledby
}) => {
    const hasHeader = Boolean(title || subtitle || action);

    return (
        <div
            className={`card ${className}`.trim()}
            data-testid={dataTestId}
            role={role}
            aria-labelledby={ariaLabelledby}
        >
            {hasHeader && (
                <div className={`card-header ${headerClassName}`.trim()}>
                    <div>
                        {typeof title === 'string' ? <span className="card-title">{title}</span> : title}
                        {subtitle && <p className="card-subtitle">{subtitle}</p>}
                    </div>
                    {action && <div className="card-actions">{action}</div>}
                </div>
            )}
            <div className="card-body">
                {children}
            </div>
        </div>
    );
};
