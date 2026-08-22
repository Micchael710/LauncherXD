import { test, expect, describe, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { ServerPage } from '../pages/ServerPage';
import { ConsolePage } from '../pages/ConsolePage';
import { BackupsPage } from '../pages/BackupsPage';
import { TasksPage } from '../pages/TasksPage';
import { SkinsPage } from '../pages/SkinsPage';
import { Sidebar } from '../components/layout/Sidebar';
import { SIDEBAR_NAV_ITEMS } from '../components/layout/sidebarConfig';

describe('Pending Modules Visual Design UI Functional Tests (Phase 7E)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // 1. LAS CINCO RUTAS RENDERIZAN PÁGINAS DIFERENTES Y ESPECÍFICAS
    test('1. The five pending routes render distinct, dedicated, specific pages', () => {
        const { unmount: unmountServer } = render(
            <MemoryRouter initialEntries={['/server']}>
                <AppRoutes />
            </MemoryRouter>
        );
        expect(screen.getByTestId('server-page')).toBeDefined();
        expect(screen.getByRole('heading', { name: 'Server Management' })).toBeDefined();
        unmountServer();

        const { unmount: unmountConsole } = render(
            <MemoryRouter initialEntries={['/console']}>
                <AppRoutes />
            </MemoryRouter>
        );
        expect(screen.getByTestId('console-page')).toBeDefined();
        expect(screen.getByRole('heading', { name: 'Server Console' })).toBeDefined();
        unmountConsole();

        const { unmount: unmountBackups } = render(
            <MemoryRouter initialEntries={['/backups']}>
                <AppRoutes />
            </MemoryRouter>
        );
        expect(screen.getByTestId('backups-page')).toBeDefined();
        expect(screen.getByRole('heading', { name: 'Server Backups' })).toBeDefined();
        unmountBackups();

        const { unmount: unmountTasks } = render(
            <MemoryRouter initialEntries={['/tasks']}>
                <AppRoutes />
            </MemoryRouter>
        );
        expect(screen.getByTestId('tasks-page')).toBeDefined();
        expect(screen.getByRole('heading', { name: 'Scheduled Tasks' })).toBeDefined();
        unmountTasks();

        const { unmount: unmountSkins } = render(
            <MemoryRouter initialEntries={['/skins']}>
                <AppRoutes />
            </MemoryRouter>
        );
        expect(screen.getByTestId('skins-page')).toBeDefined();
        expect(screen.getByRole('heading', { name: 'Skin Management' })).toBeDefined();
        unmountSkins();
    });

    // 2. CADA PÁGINA MUESTRA EL BADGE DE INTEGRACIÓN PENDIENTE CORRESPONDIENTE
    test('2. Each pending page displays its exact corresponding integration badge', () => {
        // Server
        const { unmount: u1 } = render(<ServerPage />);
        expect(screen.getByTestId('server-integration-badge').textContent).toBe('Waiting for ZeroDactyl integration');
        u1();

        // Console
        const { unmount: u2 } = render(<ConsolePage />);
        expect(screen.getByTestId('console-integration-badge').textContent).toBe('Waiting for ZeroDactyl integration');
        u2();

        // Backups
        const { unmount: u3 } = render(<BackupsPage />);
        expect(screen.getByTestId('backups-integration-badge').textContent).toBe('Waiting for ZeroDactyl integration');
        u3();

        // Tasks
        const { unmount: u4 } = render(<TasksPage />);
        expect(screen.getByTestId('tasks-integration-badge').textContent).toBe('Waiting for ZeroDactyl integration');
        u4();

        // Skins
        const { unmount: u5 } = render(<SkinsPage />);
        expect(screen.getByTestId('skins-integration-badge').textContent).toBe('Waiting for launcher skin contract');
        u5();
    });

    // 3. SERVER MUESTRA ESTRUCTURA DE ESTADO, JUGADORES Y PROPIEDADES
    test('3. Server page displays status cards, connected players panel, and server properties form', () => {
        render(<ServerPage />);

        expect(screen.getByTestId('server-status-card')).toBeDefined();
        expect(screen.getByTestId('server-status-val').textContent).toBe('Not available');
        expect(screen.getByTestId('server-address-val').textContent).toBe('Waiting for integration');
        expect(screen.getByTestId('server-version-val').textContent).toBe('Not available');
        expect(screen.getByTestId('server-players-val').textContent).toBe('Not available');

        expect(screen.getByTestId('server-players-panel')).toBeDefined();
        expect(screen.getByTestId('players-empty-state')).toBeDefined();
        expect(screen.getByText('No players connected')).toBeDefined();

        expect(screen.getByTestId('server-properties-panel')).toBeDefined();
        expect(screen.getByTestId('prop-server-port')).toBeDefined();
        expect(screen.getByTestId('prop-max-players')).toBeDefined();
        expect(screen.getByTestId('prop-motd')).toBeDefined();
        expect(screen.getByTestId('prop-difficulty')).toBeDefined();
        expect(screen.getByTestId('prop-pvp')).toBeDefined();
    });

    // 4. CONSOLE MUESTRA TERMINAL, FILTROS Y CAMPO DE COMANDOS
    test('4. Console page displays dark terminal viewer with empty stream state, filters, and command input', () => {
        render(<ConsolePage />);

        expect(screen.getByTestId('console-terminal-viewer')).toBeDefined();
        expect(screen.getByTestId('console-terminal-output')).toBeDefined();
        expect(screen.getByText(/Console stream is not available until ZeroDactyl is configured/i)).toBeDefined();

        expect(screen.getByTestId('console-filter-select')).toBeDefined();
        expect(screen.getByTestId('console-lines-select')).toBeDefined();
        expect(screen.getByTestId('console-command-form')).toBeDefined();
        expect(screen.getByTestId('console-command-input')).toBeDefined();
    });

    // 5. BACKUPS MUESTRA FORMULARIO Y TABLA
    test('5. Backups page displays create backup form, backup table with required columns, and real empty state', () => {
        render(<BackupsPage />);

        expect(screen.getByTestId('create-backup-card')).toBeDefined();
        expect(screen.getByTestId('backup-name-input')).toBeDefined();
        expect(screen.getByTestId('backup-type-select')).toBeDefined();
        expect(screen.getByTestId('create-backup-btn')).toBeDefined();

        expect(screen.getByTestId('backups-table-card')).toBeDefined();
        expect(screen.getByTestId('backups-table')).toBeDefined();
        expect(screen.getByText('Name')).toBeDefined();
        expect(screen.getByText('Type')).toBeDefined();
        expect(screen.getByText('Size')).toBeDefined();
        expect(screen.getByText('Created')).toBeDefined();
        expect(screen.getByText('Storage')).toBeDefined();
        expect(screen.getByTestId('backups-empty-state')).toBeDefined();
        expect(screen.getByText(/Backups represent server world and configuration files/i)).toBeDefined();
    });

    // 6. TASKS MUESTRA FORMULARIOS PROGRAMADOS Y TABLA
    test('6. Tasks page displays schedule task form, task action options, cron field, and tasks table', () => {
        render(<TasksPage />);

        expect(screen.getByTestId('create-task-card')).toBeDefined();
        expect(screen.getByTestId('task-name-input')).toBeDefined();
        expect(screen.getByTestId('task-action-select')).toBeDefined();
        expect(screen.getByTestId('task-cron-input')).toBeDefined();
        expect(screen.getByTestId('create-task-btn')).toBeDefined();

        expect(screen.getByTestId('tasks-table-card')).toBeDefined();
        expect(screen.getByTestId('tasks-table')).toBeDefined();
        expect(screen.getByText('Schedule')).toBeDefined();
        expect(screen.getByText('Action')).toBeDefined();
        expect(screen.getByText('Last Run')).toBeDefined();
        expect(screen.getByTestId('tasks-empty-state')).toBeDefined();
    });

    // 7. SKINS MUESTRA PERFILES Y TEXTURAS GLOBALES
    test('7. Skins page displays player profiles table, assign skin form, global textures form, and 3D preview box', () => {
        render(<SkinsPage />);

        expect(screen.getByTestId('skins-profiles-section')).toBeDefined();
        expect(screen.getByTestId('skins-table')).toBeDefined();
        expect(screen.getByText('Player')).toBeDefined();
        expect(screen.getByText('Skin')).toBeDefined();
        expect(screen.getByText('Cape')).toBeDefined();
        expect(screen.getByTestId('skins-empty-state')).toBeDefined();

        expect(screen.getByTestId('skin-profile-form')).toBeDefined();
        expect(screen.getByTestId('skin-player-name-input')).toBeDefined();
        expect(screen.getByTestId('skin-url-input')).toBeDefined();
        expect(screen.getByTestId('cape-url-input')).toBeDefined();
        expect(screen.getByTestId('skin-file-input')).toBeDefined();
        expect(screen.getByTestId('cape-file-input')).toBeDefined();

        expect(screen.getByTestId('skins-global-textures-section')).toBeDefined();
        expect(screen.getByTestId('texture-name-input')).toBeDefined();
        expect(screen.getByTestId('texture-type-select')).toBeDefined();
        expect(screen.getByTestId('texture-desc-input')).toBeDefined();
        expect(screen.getByTestId('texture-file-input')).toBeDefined();
        expect(screen.getByTestId('upload-texture-btn')).toBeDefined();

        expect(screen.getByTestId('skin-preview-box')).toBeDefined();
        expect(screen.getByText(/3D Skin Preview: Waiting for skin asset/i)).toBeDefined();
        expect(screen.getByText(/Skin cloud storage and launcher synchronization will be enabled/i)).toBeDefined();
    });

    // 8. TODAS LAS ACCIONES REMOTAS ESTÁN DESHABILITADAS
    test('8. All action buttons and input controls on pending pages are strictly disabled', () => {
        // Server
        const { unmount: u1 } = render(<ServerPage />);
        expect((screen.getByTestId('server-start-btn') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('server-restart-btn') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('server-stop-btn') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('save-properties-btn') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('prop-server-port') as HTMLInputElement).disabled).toBe(true);
        u1();

        // Console
        const { unmount: u2 } = render(<ConsolePage />);
        expect((screen.getByTestId('console-filter-select') as HTMLSelectElement).disabled).toBe(true);
        expect((screen.getByTestId('console-lines-select') as HTMLSelectElement).disabled).toBe(true);
        expect((screen.getByTestId('console-refresh-btn') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('console-clear-btn') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('console-command-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('console-send-btn') as HTMLButtonElement).disabled).toBe(true);
        u2();

        // Backups
        const { unmount: u3 } = render(<BackupsPage />);
        expect((screen.getByTestId('backup-name-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('backup-type-select') as HTMLSelectElement).disabled).toBe(true);
        expect((screen.getByTestId('create-backup-btn') as HTMLButtonElement).disabled).toBe(true);
        u3();

        // Tasks
        const { unmount: u4 } = render(<TasksPage />);
        expect((screen.getByTestId('task-name-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('task-action-select') as HTMLSelectElement).disabled).toBe(true);
        expect((screen.getByTestId('task-cron-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('create-task-btn') as HTMLButtonElement).disabled).toBe(true);
        u4();

        // Skins
        const { unmount: u5 } = render(<SkinsPage />);
        expect((screen.getByTestId('skin-player-name-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('skin-url-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('cape-url-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('skin-file-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('cape-file-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('save-skin-profile-btn') as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId('texture-name-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('texture-type-select') as HTMLSelectElement).disabled).toBe(true);
        expect((screen.getByTestId('texture-desc-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('texture-file-input') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByTestId('upload-texture-btn') as HTMLButtonElement).disabled).toBe(true);
        u5();
    });

    // 9. NO SE EJECUTA NINGUNA SOLICITUD DE RED AL ABRIR ESTAS PÁGINAS
    test('9. No network fetch requests are executed to releases or server endpoints when navigating across all five pending pages', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={['/']}>
                <AppRoutes />
            </MemoryRouter>
        );

        // Reset any initial dashboard fetch calls
        fetchSpy.mockClear();

        await user.click(screen.getByRole('link', { name: /skins/i }));
        expect(screen.getByTestId('skins-page')).toBeDefined();

        await user.click(screen.getByRole('link', { name: /server/i }));
        expect(screen.getByTestId('server-page')).toBeDefined();

        await user.click(screen.getByRole('link', { name: /console/i }));
        expect(screen.getByTestId('console-page')).toBeDefined();

        await user.click(screen.getByRole('link', { name: /backups/i }));
        expect(screen.getByTestId('backups-page')).toBeDefined();

        await user.click(screen.getByRole('link', { name: /tasks/i }));
        expect(screen.getByTestId('tasks-page')).toBeDefined();

        const remoteApiEndpointCalls = fetchSpy.mock.calls.filter(call => {
            const url = typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
            return url.includes('/api/admin') || url.includes('/api/local/releases') || url.includes('/zerodactyl');
        });
        expect(remoteApiEndpointCalls).toHaveLength(0);
    });

    // 10. NO APARECEN DATOS FALSOS, ESTADOS ONLINE NI LISTAS SIMULADAS
    test('10. No fake online status, mock IP addresses, or fabricated entities appear', () => {
        render(<ServerPage />);
        expect(screen.queryByText(/online/i)).toBeNull();
        expect(screen.queryByText(/127\.0\.0\.1:25565/i)).toBeNull();
        expect(screen.queryByText(/play\.example\.com/i)).toBeNull();
        expect(screen.queryByText(/100\/100/i)).toBeNull();
    });

    // 11. SIDEBAR CONSERVA EL ORDEN Y LAS RUTAS ACTUALES
    test('11. Sidebar preserves all navigation items in exact required order', () => {
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

    // 12. LAS PÁGINAS SE MANTIENEN DENTRO DEL LAYOUT EXISTENTE
    test('12. Pending pages render inside AdminLayout with Topbar, Sidebar, and Content area', () => {
        render(
            <MemoryRouter initialEntries={['/server']}>
                <AppRoutes />
            </MemoryRouter>
        );

        expect(screen.getByRole('banner')).toBeDefined();
        expect(screen.getByRole('link', { name: /dashboard/i })).toBeDefined();
        expect(screen.getByTestId('server-page')).toBeDefined();
    });
});
