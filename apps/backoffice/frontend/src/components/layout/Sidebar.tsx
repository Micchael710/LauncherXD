import React from 'react';
import { NavLink } from 'react-router-dom';
import { SIDEBAR_NAV_ITEMS } from './sidebarConfig';

export interface SidebarProps {
    onNavigate?: () => void;
    className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, className = '' }) => {
    return (
        <aside className={`app-sidebar ${className}`.trim()} aria-label="Sidebar Navigation">
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <span className="sidebar-title">LauncherXD</span>
                    <span className="sidebar-badge">Backoffice</span>
                </div>
            </div>

            <nav className="sidebar-nav" aria-label="Main Menu">
                <ul className="sidebar-nav-list">
                    {SIDEBAR_NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.path} className="sidebar-nav-item">
                                <NavLink
                                    to={item.path}
                                    end={item.exact}
                                    onClick={onNavigate}
                                    className={({ isActive }) =>
                                        `sidebar-link ${isActive ? 'active' : ''}`
                                    }
                                >
                                    <Icon size={18} className="sidebar-icon" />
                                    <span className="sidebar-label">{item.label}</span>
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="sidebar-footer">
                <span className="sidebar-version-text">LauncherXD Backoffice v1.0</span>
            </div>
        </aside>
    );
};
