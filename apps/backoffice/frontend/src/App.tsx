import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { ReleaseCreatePage } from './pages/ReleaseCreatePage';
import { ReleaseDetailPage } from './pages/ReleaseDetailPage';
import { NewsPage } from './pages/NewsPage';
import { SettingsPage } from './pages/SettingsPage';

const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="app-container">
        <aside className="app-sidebar">
            <div className="sidebar-header">
                <span className="sidebar-title">LauncherXD</span>
                <span className="sidebar-badge">Admin</span>
            </div>
            <ul className="sidebar-nav">
                <li className="sidebar-nav-item">
                    <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        Dashboard
                    </NavLink>
                </li>
                <li className="sidebar-nav-item">
                    <NavLink to="/releases" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        Releases
                    </NavLink>
                </li>
                <li className="sidebar-nav-item">
                    <NavLink to="/news" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        News
                    </NavLink>
                </li>
                <li className="sidebar-nav-item">
                    <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        Settings
                    </NavLink>
                </li>
            </ul>
            <div className="sidebar-footer">
                <span>LauncherXD Back Office v1.0</span>
            </div>
        </aside>
        <div className="app-main">
            <header className="app-topbar">
                <div className="topbar-breadcrumbs">
                    <span>Back Office</span>
                </div>
                <div className="topbar-status">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#16a34a', fontWeight: 500 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                        Backend: 127.0.0.1:3000
                    </span>
                </div>
            </header>
            <main className="content-viewport">
                {children}
            </main>
        </div>
    </div>
);

function App() {
  return (
    <BrowserRouter>
      <Layout>
          <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/releases" element={<ReleasesPage />} />
              <Route path="/releases/new" element={<ReleaseCreatePage />} />
              <Route path="/releases/:id" element={<ReleaseDetailPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/settings/*" element={<SettingsPage />} />
          </Routes>
      </Layout>
    </BrowserRouter>
  );
}
export default App;
