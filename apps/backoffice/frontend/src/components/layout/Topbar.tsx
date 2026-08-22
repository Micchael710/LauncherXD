import React, { useEffect, useState, useCallback } from 'react';
import { Menu, RefreshCw, Server, Shield, GitBranch } from 'lucide-react';
import { CredentialsApi } from '../../api/credentials';

export type BackendStatus = 'Checking' | 'Online' | 'Offline';
export type ServiceStatus = 'Checking' | 'Configured' | 'Not configured' | 'Offline';

export interface TopbarProps {
    onToggleMobileNav?: () => void;
    className?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileNav, className = '' }) => {
    const [backendStatus, setBackendStatus] = useState<BackendStatus>('Checking');
    const [adminStatus, setAdminStatus] = useState<ServiceStatus>('Checking');
    const [githubStatus, setGithubStatus] = useState<ServiceStatus>('Checking');
    const [isChecking, setIsChecking] = useState<boolean>(false);

    const checkStatus = useCallback(async () => {
        setIsChecking(true);
        // 1. Check Local Backend Health
        let backendOnline = false;
        try {
            const healthRes = await fetch('http://127.0.0.1:3000/health');
            if (healthRes.ok) {
                setBackendStatus('Online');
                backendOnline = true;
            } else {
                setBackendStatus('Offline');
            }
        } catch {
            setBackendStatus('Offline');
        }

        // 2. Check Admin API & GitHub Releases via CredentialsApi
        if (!backendOnline) {
            setAdminStatus('Offline');
            setGithubStatus('Offline');
            setIsChecking(false);
            return;
        }

        try {
            const credStatus = await CredentialsApi.getStatus();
            setAdminStatus(credStatus?.admin?.configured ? 'Configured' : 'Not configured');
            setGithubStatus(credStatus?.github?.configured ? 'Configured' : 'Not configured');
        } catch {
            setAdminStatus('Offline');
            setGithubStatus('Offline');
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const getStatusClass = (status: BackendStatus | ServiceStatus) => {
        switch (status) {
            case 'Online':
                return 'status-pill-online';
            case 'Configured':
                return 'status-pill-configured';
            case 'Offline':
                return 'status-pill-offline';
            case 'Not configured':
                return 'status-pill-not-configured';
            case 'Checking':
            default:
                return 'status-pill-checking';
        }
    };

    return (
        <header className={`app-topbar ${className}`.trim()} role="banner">
            <div className="topbar-left">
                {onToggleMobileNav && (
                    <button
                        type="button"
                        onClick={onToggleMobileNav}
                        className="btn-icon mobile-menu-btn"
                        aria-label="Toggle navigation menu"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <div className="topbar-breadcrumbs">
                    <span className="topbar-title">Back Office</span>
                </div>
            </div>

            <div className="topbar-status-group" aria-label="System Status Indicators">
                {/* Local Backend Indicator */}
                <div
                    className={`topbar-status-item ${getStatusClass(backendStatus)}`}
                    data-testid="status-backend"
                >
                    <Server size={14} className="topbar-status-icon" />
                    <span className="topbar-status-label">Local Backend:</span>
                    <span className="topbar-status-value">
                        <span className="status-dot" aria-hidden="true" />
                        {backendStatus}
                    </span>
                </div>

                {/* Admin API Indicator */}
                <div
                    className={`topbar-status-item ${getStatusClass(adminStatus)}`}
                    data-testid="status-admin-api"
                >
                    <Shield size={14} className="topbar-status-icon" />
                    <span className="topbar-status-label">Admin API:</span>
                    <span className="topbar-status-value">
                        <span className="status-dot" aria-hidden="true" />
                        {adminStatus}
                    </span>
                </div>

                {/* GitHub Releases Indicator */}
                <div
                    className={`topbar-status-item ${getStatusClass(githubStatus)}`}
                    data-testid="status-github-releases"
                >
                    <GitBranch size={14} className="topbar-status-icon" />
                    <span className="topbar-status-label">GitHub Releases:</span>
                    <span className="topbar-status-value">
                        <span className="status-dot" aria-hidden="true" />
                        {githubStatus}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => checkStatus()}
                    disabled={isChecking}
                    className="topbar-refresh-btn"
                    title="Refresh status indicators"
                    aria-label="Refresh status"
                >
                    <RefreshCw size={14} className={isChecking ? 'spin' : ''} />
                </button>
            </div>
        </header>
    );
};
