import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { SIDEBAR_NAV_ITEMS } from '../components/layout/sidebarConfig';
import { PendingFeaturePage } from '../pages/PendingFeaturePage';

describe('Sidebar Navigation UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    test('1. renders all ten navigation sections in exact required order', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <Sidebar />
            </MemoryRouter>
        );

        const expectedLabels = [
            'Dashboard',
            'Skins',
            'News',
            'Server',
            'Console',
            'Backups',
            'Tasks',
            'Modpack',
            'Versions',
            'Settings'
        ];

        const renderedLinks = screen.getAllByRole('link');
        expect(renderedLinks).toHaveLength(10);

        expectedLabels.forEach((label, index) => {
            expect(renderedLinks[index].textContent).toContain(label);
            expect(SIDEBAR_NAV_ITEMS[index].label).toBe(label);
        });
    });

    test('2. highlights the active navigation link according to the current route', () => {
        render(
            <MemoryRouter initialEntries={['/news']}>
                <Sidebar />
            </MemoryRouter>
        );

        const activeLink = screen.getByRole('link', { name: /news/i });
        expect(activeLink.className).toContain('active');

        const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
        expect(dashboardLink.className).not.toContain('active');
    });

    test('3. "Versions" link points to the releases route (/releases)', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <Sidebar />
            </MemoryRouter>
        );

        const versionsLink = screen.getByRole('link', { name: /versions/i });
        expect(versionsLink.getAttribute('href')).toBe('/releases');
    });

    test('4. pending feature pages render Not configured status without executing network requests', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={['/']}>
                <Sidebar />
                <Routes>
                    <Route path="/" element={<div>Dashboard Content</div>} />
                    <Route
                        path="/skins"
                        element={
                            <PendingFeaturePage
                                title="Skins"
                                description="Skin management and preview"
                                featureKey="skins"
                            />
                        }
                    />
                    <Route
                        path="/server"
                        element={
                            <PendingFeaturePage
                                title="Server"
                                description="Server control"
                                featureKey="server"
                            />
                        }
                    />
                    <Route
                        path="/console"
                        element={
                            <PendingFeaturePage
                                title="Console"
                                description="Server console"
                                featureKey="console"
                            />
                        }
                    />
                    <Route
                        path="/backups"
                        element={
                            <PendingFeaturePage
                                title="Backups"
                                description="World backups"
                                featureKey="backups"
                            />
                        }
                    />
                    <Route
                        path="/tasks"
                        element={
                            <PendingFeaturePage
                                title="Tasks"
                                description="Scheduled tasks"
                                featureKey="tasks"
                            />
                        }
                    />
                    <Route
                        path="/modpack"
                        element={
                            <PendingFeaturePage
                                title="Modpack"
                                description="Modpack manager"
                                featureKey="modpack"
                            />
                        }
                    />
                </Routes>
            </MemoryRouter>
        );

        // Click Skins navigation link
        await user.click(screen.getByRole('link', { name: /skins/i }));
        expect(screen.getByTestId('page-pending-skins')).toBeDefined();
        expect(screen.getByText('Pending implementation')).toBeDefined();
        expect(screen.getByText(/This feature is not configured in the current version/i)).toBeDefined();

        // Click Server navigation link
        await user.click(screen.getByRole('link', { name: /server/i }));
        expect(screen.getByTestId('page-pending-server')).toBeDefined();

        // Click Console navigation link
        await user.click(screen.getByRole('link', { name: /console/i }));
        expect(screen.getByTestId('page-pending-console')).toBeDefined();

        // Click Backups navigation link
        await user.click(screen.getByRole('link', { name: /backups/i }));
        expect(screen.getByTestId('page-pending-backups')).toBeDefined();

        // Click Tasks navigation link
        await user.click(screen.getByRole('link', { name: /tasks/i }));
        expect(screen.getByTestId('page-pending-tasks')).toBeDefined();

        // Click Modpack navigation link
        await user.click(screen.getByRole('link', { name: /modpack/i }));
        expect(screen.getByTestId('page-pending-modpack')).toBeDefined();

        // Verify zero network requests were dispatched
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
