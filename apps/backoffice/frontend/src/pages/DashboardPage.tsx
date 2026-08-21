import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ReleasesApi } from '../api/releases';
import { NewsApi } from '../api/news';
import { SettingsApi } from '../api/settings';
import { formatApiErrorMessage } from '../api/client';
import type { Release } from '../types/releases';
import type { NewsItem } from '../types/news';
import type { SettingItem } from '../types/settings';

export const DashboardPage: React.FC = () => {
    const [releases, setReleases] = useState<Release[] | null>(null);
    const [news, setNews] = useState<NewsItem[] | null>(null);
    const [settings, setSettings] = useState<SettingItem[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const loadDashboardData = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const [releasesRes, newsRes, settingsRes] = await Promise.all([
                ReleasesApi.listReleases(),
                NewsApi.listNews(),
                SettingsApi.listSettings()
            ]);
            setReleases(releasesRes.value || []);
            setNews(newsRes.value || []);
            setSettings(settingsRes.value || []);
        } catch (err: unknown) {
            setError(formatApiErrorMessage(err));
            setReleases(null);
            setNews(null);
            setSettings(null);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    if (isLoading) {
        return <div data-testid="dashboard-loading" className="state-loading">Loading dashboard...</div>;
    }

    if (error) {
        return (
            <div>
                <div className="page-header">
                    <h1>Dashboard</h1>
                </div>
                <div className="card" style={{ maxWidth: '600px' }}>
                    <div role="alert" className="alert alert-danger">
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Connection Error</div>
                        <div>{error}</div>
                        {error === 'Admin authentication is not configured.' && (
                            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#7f1d1d' }}>
                                Admin API credentials or Cloudflare Access tokens have not been configured. You can configure them in Settings → Local Credentials.
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => loadDashboardData(false)}
                        className="btn btn-primary"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!releases || !news || !settings) {
        return null;
    }

    const totalReleases = releases.length;
    const draftReleases = releases.filter((r) => r.status === 'draft').length;
    const publishedReleases = releases.filter((r) => r.status === 'published').length;
    const deprecatedReleases = releases.filter((r) => r.status === 'deprecated').length;
    const launcherReleases = releases.filter((r) => r.release_type === 'launcher').length;
    const modpackReleases = releases.filter((r) => r.release_type === 'modpack').length;

    const totalNews = news.length;
    const publishedNews = news.filter((n) => n.published === true).length;
    const draftNews = news.filter((n) => n.published === false).length;

    const totalSettings = settings.length;
    const publicSettings = settings.filter((s) => s.is_public === true).length;
    const privateSettings = settings.filter((s) => s.is_public === false).length;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Overview of system metrics, release lifecycles, and configuration.</p>
                </div>
                <button
                    type="button"
                    onClick={() => loadDashboardData(true)}
                    disabled={isRefreshing}
                    className="btn btn-secondary"
                >
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Platform Metrics */}
            <div className="dashboard-grid">
                {/* Releases Summary Card */}
                <div className="metric-card" data-testid="card-releases">
                    <div>
                        <span className="metric-title">Releases</span>
                        <div className="metric-value">
                            {totalReleases} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>Total</span>
                        </div>
                    </div>
                    <ul className="metric-sublist">
                        <li><span>Draft:</span> <strong>{draftReleases}</strong></li>
                        <li><span>Published:</span> <strong>{publishedReleases}</strong></li>
                        <li><span>Deprecated:</span> <strong>{deprecatedReleases}</strong></li>
                        <li><span>Launcher / Modpack:</span> <strong>{launcherReleases} / {modpackReleases}</strong></li>
                    </ul>
                    <Link to="/releases" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>
                        Manage Releases
                    </Link>
                </div>

                {/* News Summary Card */}
                <div className="metric-card" data-testid="card-news">
                    <div>
                        <span className="metric-title">News Announcements</span>
                        <div className="metric-value">
                            {totalNews} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>Total</span>
                        </div>
                    </div>
                    <ul className="metric-sublist">
                        <li><span>Published:</span> <strong>{publishedNews}</strong></li>
                        <li><span>Draft:</span> <strong>{draftNews}</strong></li>
                    </ul>
                    <Link to="/news" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>
                        Manage News
                    </Link>
                </div>

                {/* Settings Summary Card */}
                <div className="metric-card" data-testid="card-settings">
                    <div>
                        <span className="metric-title">Settings</span>
                        <div className="metric-value">
                            {totalSettings} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>Total</span>
                        </div>
                    </div>
                    <ul className="metric-sublist">
                        <li><span>Public:</span> <strong>{publicSettings}</strong></li>
                        <li><span>Private:</span> <strong>{privateSettings}</strong></li>
                    </ul>
                    <Link to="/settings" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>
                        Manage Settings
                    </Link>
                </div>
            </div>

            {/* System Status Summary */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">System & Security Status</span>
                </div>
                <div className="info-grid">
                    <div className="info-item">
                        <div className="info-item-label">Admin API</div>
                        <div className="info-item-value" style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                            Connected
                        </div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Auth Provider</div>
                        <div className="info-item-value" style={{ color: 'var(--color-primary)' }}>
                            Admin API Token / Cloudflare Access Fallback
                        </div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Architecture</div>
                        <div className="info-item-value" style={{ fontSize: '0.875rem' }}>
                            Client → Local Proxy (127.0.0.1:3000) → Cloudflare Worker
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
