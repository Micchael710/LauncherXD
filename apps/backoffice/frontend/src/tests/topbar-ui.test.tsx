import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Topbar } from '../components/layout/Topbar';
import { CredentialsApi } from '../api/credentials';

describe('Topbar Status Indicators UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    test('1. shows Checking initial state while health and credentials requests are pending', () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
        vi.spyOn(CredentialsApi, 'getStatus').mockImplementation(() => new Promise(() => {}));

        render(<Topbar />);

        const backendIndicator = screen.getByTestId('status-backend');
        const adminIndicator = screen.getByTestId('status-admin-api');
        const githubIndicator = screen.getByTestId('status-github-releases');

        expect(backendIndicator.textContent).toContain('Checking');
        expect(adminIndicator.textContent).toContain('Checking');
        expect(githubIndicator.textContent).toContain('Checking');
    });

    test('2. health 200 displays Online for backend, and configured=true displays Configured', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValueOnce({
            admin: { configured: true },
            github: { configured: true }
        });

        render(<Topbar />);

        await waitFor(() => {
            const backendIndicator = screen.getByTestId('status-backend');
            expect(backendIndicator.textContent).toContain('Online');
        });

        const adminIndicator = screen.getByTestId('status-admin-api');
        const githubIndicator = screen.getByTestId('status-github-releases');

        expect(adminIndicator.textContent).toContain('Configured');
        expect(githubIndicator.textContent).toContain('Configured');
    });

    test('3. health failure displays Offline for Backend and marks dependent services Offline', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));
        const credSpy = vi.spyOn(CredentialsApi, 'getStatus');

        render(<Topbar />);

        await waitFor(() => {
            const backendIndicator = screen.getByTestId('status-backend');
            expect(backendIndicator.textContent).toContain('Offline');
        });

        const adminIndicator = screen.getByTestId('status-admin-api');
        const githubIndicator = screen.getByTestId('status-github-releases');

        expect(adminIndicator.textContent).toContain('Offline');
        expect(githubIndicator.textContent).toContain('Offline');
        expect(credSpy).not.toHaveBeenCalled();
    });

    test('4. admin configured false displays Not configured', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValueOnce({
            admin: { configured: false },
            github: { configured: true }
        });

        render(<Topbar />);

        await waitFor(() => {
            expect(screen.getByTestId('status-backend').textContent).toContain('Online');
        });

        expect(screen.getByTestId('status-admin-api').textContent).toContain('Not configured');
        expect(screen.getByTestId('status-github-releases').textContent).toContain('Configured');
    });

    test('5. github configured false displays Not configured', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValueOnce({
            admin: { configured: true },
            github: { configured: false }
        });

        render(<Topbar />);

        await waitFor(() => {
            expect(screen.getByTestId('status-backend').textContent).toContain('Online');
        });

        expect(screen.getByTestId('status-admin-api').textContent).toContain('Configured');
        expect(screen.getByTestId('status-github-releases').textContent).toContain('Not configured');
    });

    test('6. never exposes or renders secret tokens in Topbar DOM', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValueOnce({
            admin: { configured: true },
            github: { configured: true }
        });

        const { container } = render(<Topbar />);

        await waitFor(() => {
            expect(screen.getByTestId('status-backend').textContent).toContain('Online');
        });

        const fullHtml = container.innerHTML.toLowerCase();
        expect(fullHtml).not.toContain('ghp_');
        expect(fullHtml).not.toContain('secret');
        expect(fullHtml).not.toContain('bearer');
        expect(fullHtml).not.toContain('token');
    });
});
