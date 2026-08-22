import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { ReleaseCreatePage } from './pages/ReleaseCreatePage';
import { ReleaseDetailPage } from './pages/ReleaseDetailPage';
import { NewsPage } from './pages/NewsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ModpackPage } from './pages/ModpackPage';
import { SkinsPage } from './pages/SkinsPage';
import { ServerPage } from './pages/ServerPage';
import { ConsolePage } from './pages/ConsolePage';
import { BackupsPage } from './pages/BackupsPage';
import { TasksPage } from './pages/TasksPage';

export function AppRoutes() {
    return (
        <AdminLayout>
            <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/skins" element={<SkinsPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/server" element={<ServerPage />} />
                <Route path="/console" element={<ConsolePage />} />
                <Route path="/backups" element={<BackupsPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/modpack" element={<ModpackPage />} />
                <Route path="/releases" element={<ReleasesPage />} />
                <Route path="/releases/new" element={<ReleaseCreatePage />} />
                <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                <Route path="/settings/*" element={<SettingsPage />} />
            </Routes>
        </AdminLayout>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
}

export default App;
