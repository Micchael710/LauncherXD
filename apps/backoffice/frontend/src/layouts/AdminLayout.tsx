import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { MobileNavigation } from '../components/layout/MobileNavigation';

export interface AdminLayoutProps {
    children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <div className="app-container">
            {/* Desktop Sidebar */}
            <div className="sidebar-desktop-container">
                <Sidebar />
            </div>

            {/* Mobile Drawer */}
            <MobileNavigation
                isOpen={mobileNavOpen}
                onClose={() => setMobileNavOpen(false)}
            />

            {/* Main Application Area */}
            <div className="app-main">
                <Topbar onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)} />
                <main className="content-viewport" id="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};
