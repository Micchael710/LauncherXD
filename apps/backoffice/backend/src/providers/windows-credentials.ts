import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const CREDENTIAL_TARGET_ADMIN = 'LauncherXD/AdminApiToken';
export const CREDENTIAL_TARGET_GITHUB = 'LauncherXD/GitHubToken';

export interface WindowsCredentialStore {
    get(target: string): Promise<string | null>;
    set(target: string, username: string, secret: string): Promise<void>;
    delete(target: string): Promise<void>;
}

export class MemoryCredentialStore implements WindowsCredentialStore {
    private storage = new Map<string, string>();

    async get(target: string): Promise<string | null> {
        return this.storage.get(target) || null;
    }

    async set(target: string, _username: string, secret: string): Promise<void> {
        this.storage.set(target, secret);
    }

    async delete(target: string): Promise<void> {
        this.storage.delete(target);
    }
}

export class NativeWindowsCredentialStore implements WindowsCredentialStore {
    private cache = new Map<string, string | null>();

    private sanitizeTarget(target: string): string {
        return target.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    async get(target: string): Promise<string | null> {
        if (this.cache.has(target)) {
            return this.cache.get(target) || null;
        }

        if (process.platform !== 'win32') {
            return null;
        }

        try {
            const cleanTarget = this.sanitizeTarget(target);
            const script = `
Add-Type -AssemblyName System.Security
$appDataDir = Join-Path $env:LOCALAPPDATA "LauncherXD\\credentials"
$filePath = Join-Path $appDataDir "${cleanTarget}.dat"
if (Test-Path $filePath) {
    $encBytes = [System.IO.File]::ReadAllBytes($filePath)
    $decBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($encBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($decBytes))
}
`;
            const { stdout } = await execFileAsync('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-Command', script
            ]);

            const val = stdout.trim();
            const result = val.length > 0 ? val : null;
            this.cache.set(target, result);
            return result;
        } catch {
            return null;
        }
    }

    async set(target: string, _username: string, secret: string): Promise<void> {
        if (process.platform !== 'win32') {
            this.cache.set(target, secret);
            return;
        }

        const cleanTarget = this.sanitizeTarget(target);
        const base64Secret = Buffer.from(secret, 'utf8').toString('base64');
        const script = `
Add-Type -AssemblyName System.Security
$appDataDir = Join-Path $env:LOCALAPPDATA "LauncherXD\\credentials"
if (!(Test-Path $appDataDir)) { New-Item -ItemType Directory -Path $appDataDir -Force | Out-Null }
$filePath = Join-Path $appDataDir "${cleanTarget}.dat"
$plainBytes = [System.Convert]::FromBase64String("${base64Secret}")
$encBytes = [System.Security.Cryptography.ProtectedData]::Protect($plainBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[System.IO.File]::WriteAllBytes($filePath, $encBytes)
`;
        await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-Command', script
        ]);

        this.cache.set(target, secret);
    }

    async delete(target: string): Promise<void> {
        this.cache.set(target, null);

        if (process.platform !== 'win32') {
            return;
        }

        try {
            const cleanTarget = this.sanitizeTarget(target);
            const script = `
$appDataDir = Join-Path $env:LOCALAPPDATA "LauncherXD\\credentials"
$filePath = Join-Path $appDataDir "${cleanTarget}.dat"
if (Test-Path $filePath) {
    Remove-Item -Path $filePath -Force -ErrorAction SilentlyContinue
}
`;
            await execFileAsync('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-Command', script
            ]);
        } catch {
            // Ignore deletion errors
        }
    }
}

let defaultStoreInstance: WindowsCredentialStore | null = null;

export function getDefaultCredentialStore(): WindowsCredentialStore {
    if (!defaultStoreInstance) {
        if (process.env.NODE_ENV === 'test') {
            defaultStoreInstance = new MemoryCredentialStore();
        } else {
            defaultStoreInstance = new NativeWindowsCredentialStore();
        }
    }
    return defaultStoreInstance;
}

export function setDefaultCredentialStore(store: WindowsCredentialStore | null): void {
    defaultStoreInstance = store;
}
