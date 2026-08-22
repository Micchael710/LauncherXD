import React from 'react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';

export interface PendingFeaturePageProps {
    title: string;
    description: string;
    featureKey: string;
    icon?: React.ReactNode;
}

export const PendingFeaturePage: React.FC<PendingFeaturePageProps> = ({
    title,
    description,
    featureKey,
    icon
}) => {
    return (
        <div data-testid={`page-pending-${featureKey}`}>
            <PageHeader
                title={title}
                subtitle={description}
                badge={<StatusPill status="Pending implementation" variant="not-configured" />}
            />

            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {icon}
                        <span>Module Status</span>
                    </div>
                }
                className="pending-feature-card"
            >
                <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
                    <strong>Notice:</strong> This feature is not configured in the current version of LauncherXD Backoffice.
                </div>

                <div className="info-grid">
                    <div className="info-item">
                        <div className="info-item-label">Status</div>
                        <div className="info-item-value">Pending Implementation</div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Scheduled Phase</div>
                        <div className="info-item-value">Future Module Integration</div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Integration Requirement</div>
                        <div className="info-item-value">Requires backend API configuration and worker bindings.</div>
                    </div>
                </div>

                <p style={{ marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    No remote requests or simulated mock data are executed for this section until official integration is deployed.
                </p>
            </Card>
        </div>
    );
};
