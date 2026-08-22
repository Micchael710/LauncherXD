import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { LocalCredentialsSection } from '../components/LocalCredentialsSection';
import { CredentialsApi } from '../api/credentials';

describe('LocalCredentialsSection Component', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    test('1. loads and displays Not configured state for both credentials', async () => {
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValue({
            admin: { configured: false },
            github: { configured: false }
        });

        render(<LocalCredentialsSection />);

        expect(screen.getByText('Loading credential status...')).toBeDefined();

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Local Credentials' })).toBeDefined();
        });

        const notConfiguredBadges = screen.getAllByText('Not configured');
        expect(notConfiguredBadges.length).toBe(2);

        const configureButtons = screen.getAllByRole('button', { name: 'Configure' });
        expect(configureButtons.length).toBe(2);
    });

    test('2. displays Configured state and Replace/Remove buttons when tokens are stored', async () => {
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValue({
            admin: { configured: true },
            github: { configured: true }
        });

        render(<LocalCredentialsSection />);

        await waitFor(() => {
            expect(screen.getAllByText('Configured').length).toBe(2);
        });

        const replaceButtons = screen.getAllByRole('button', { name: 'Replace' });
        expect(replaceButtons.length).toBe(2);

        const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
        expect(removeButtons.length).toBe(2);
    });

    test('3. configuring Admin API token shows password input and clears it on save', async () => {
        const getStatusMock = vi.spyOn(CredentialsApi, 'getStatus')
            .mockResolvedValueOnce({ admin: { configured: false }, github: { configured: false } })
            .mockResolvedValueOnce({ admin: { configured: true }, github: { configured: false } });

        const saveAdminMock = vi.spyOn(CredentialsApi, 'saveAdminToken').mockResolvedValue({ configured: true });

        render(<LocalCredentialsSection />);

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: 'Configure' })[0]).toBeDefined();
        });

        // Click configure on Admin API
        fireEvent.click(screen.getAllByRole('button', { name: 'Configure' })[0]);

        const passwordInput = screen.getByLabelText('Admin API Token:') as HTMLInputElement;
        expect(passwordInput.type).toBe('password');

        fireEvent.change(passwordInput, { target: { value: 'dummy_secret_admin_token_123' } });
        expect(passwordInput.value).toBe('dummy_secret_admin_token_123');

        const saveButton = screen.getByRole('button', { name: 'Save' });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(saveAdminMock).toHaveBeenCalledWith('dummy_secret_admin_token_123');
            expect(getStatusMock).toHaveBeenCalledTimes(2);
            expect(screen.getByText('Admin API credential saved securely.')).toBeDefined();
        });

        // Form closed and password input removed from DOM
        expect(screen.queryByLabelText('Admin API Token:')).toBeNull();
    });

    test('4. configuring GitHub token shows password input and saves securely', async () => {
        const getStatusMock = vi.spyOn(CredentialsApi, 'getStatus')
            .mockResolvedValueOnce({ admin: { configured: true }, github: { configured: false } })
            .mockResolvedValueOnce({ admin: { configured: true }, github: { configured: true } });

        const saveGithubMock = vi.spyOn(CredentialsApi, 'saveGitHubToken').mockResolvedValue({ configured: true });

        render(<LocalCredentialsSection />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Configure' })).toBeDefined();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

        const githubInput = screen.getByLabelText('GitHub Token (PAT):') as HTMLInputElement;
        expect(githubInput.type).toBe('password');

        fireEvent.change(githubInput, { target: { value: 'dummy_pat_token_abc' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(saveGithubMock).toHaveBeenCalledWith('dummy_pat_token_abc');
            expect(getStatusMock).toHaveBeenCalledTimes(2);
            expect(screen.getByText('GitHub Releases credential saved securely.')).toBeDefined();
        });
    });

    test('5. removing credentials calls delete API and refreshes status', async () => {
        const getStatusMock = vi.spyOn(CredentialsApi, 'getStatus')
            .mockResolvedValueOnce({ admin: { configured: true }, github: { configured: true } })
            .mockResolvedValueOnce({ admin: { configured: false }, github: { configured: true } });

        const removeAdminMock = vi.spyOn(CredentialsApi, 'removeAdminToken').mockResolvedValue({ configured: false });

        render(<LocalCredentialsSection />);

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDefined();
        });

        fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

        await waitFor(() => {
            expect(removeAdminMock).toHaveBeenCalled();
            expect(getStatusMock).toHaveBeenCalledTimes(2);
            expect(screen.getByText('Admin API credential removed.')).toBeDefined();
        });
    });

    test('6. cancelling form clears input value', async () => {
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValue({
            admin: { configured: false },
            github: { configured: false }
        });

        render(<LocalCredentialsSection />);

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: 'Configure' })[0]).toBeDefined();
        });

        fireEvent.click(screen.getAllByRole('button', { name: 'Configure' })[0]);

        const input = screen.getByLabelText('Admin API Token:') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'temp_token' } });

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByLabelText('Admin API Token:')).toBeNull();
    });

    test('7. credentials cards do not contain hardcoded white or light inline background styles', async () => {
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValue({
            admin: { configured: true },
            github: { configured: false }
        });

        render(<LocalCredentialsSection />);

        await waitFor(() => {
            expect(screen.getByTestId('credential-card-admin')).toBeDefined();
        });

        const adminCard = screen.getByTestId('credential-card-admin');
        const githubCard = screen.getByTestId('credential-card-github');

        expect(adminCard.className).toContain('credential-card');
        expect(githubCard.className).toContain('credential-card');

        // Verify neither card has hardcoded inline white/light background styles
        expect(adminCard.style.backgroundColor).not.toBe('rgb(248, 250, 252)');
        expect(adminCard.style.backgroundColor).not.toBe('#f8fafc');
        expect(adminCard.style.backgroundColor).not.toBe('rgb(255, 255, 255)');
        expect(adminCard.style.backgroundColor).not.toBe('#ffffff');

        expect(githubCard.style.backgroundColor).not.toBe('rgb(248, 250, 252)');
        expect(githubCard.style.backgroundColor).not.toBe('#f8fafc');
        expect(githubCard.style.backgroundColor).not.toBe('rgb(255, 255, 255)');
        expect(githubCard.style.backgroundColor).not.toBe('#ffffff');
    });
});
