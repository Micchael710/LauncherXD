import { spawn } from 'child_process';

export const CREDENTIAL_TARGET_ADMIN = 'LauncherXD/AdminApiToken';
export const CREDENTIAL_TARGET_GITHUB = 'LauncherXD/GitHubToken';

export interface WindowsCredentialStore {
    get(target: string): Promise<string | null>;
    set(target: string, username: string, secret: string): Promise<void>;
    delete(target: string): Promise<void>;
}

export interface WindowsPowerShellRunner {
    run(script: string, stdin?: string): Promise<string>;
}

export class DefaultWindowsPowerShellRunner implements WindowsPowerShellRunner {
    async run(script: string, stdin?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = spawn('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-Command', script
            ], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString('utf8');
            });

            child.on('error', (err) => {
                reject(err);
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`PowerShell process exited with code ${code}`));
                }
            });

            if (stdin !== undefined) {
                child.stdin.write(stdin, 'utf8');
                child.stdin.end();
            } else {
                child.stdin.end();
            }
        });
    }
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
    private runner: WindowsPowerShellRunner;

    constructor(runner?: WindowsPowerShellRunner) {
        this.runner = runner || new DefaultWindowsPowerShellRunner();
    }

    private sanitizeTarget(target: string): string {
        return target.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    async get(target: string): Promise<string | null> {
        if (this.cache.has(target)) {
            return this.cache.get(target) || null;
        }

        if (process.platform !== 'win32' && this.runner instanceof DefaultWindowsPowerShellRunner) {
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
            const stdout = await this.runner.run(script);
            const val = stdout.trim();
            const result = val.length > 0 ? val : null;
            this.cache.set(target, result);
            return result;
        } catch {
            return null;
        }
    }

    async set(target: string, _username: string, secret: string): Promise<void> {
        if (process.platform !== 'win32' && this.runner instanceof DefaultWindowsPowerShellRunner) {
            this.cache.set(target, secret);
            return;
        }

        const cleanTarget = this.sanitizeTarget(target);
        // Transport encoding over STDIN only — never passed in argv or script text
        const base64Secret = Buffer.from(secret, 'utf8').toString('base64');
        const script = `
Add-Type -AssemblyName System.Security
$appDataDir = Join-Path $env:LOCALAPPDATA "LauncherXD\\credentials"
if (!(Test-Path $appDataDir)) { New-Item -ItemType Directory -Path $appDataDir -Force | Out-Null }
$filePath = Join-Path $appDataDir "${cleanTarget}.dat"
$base64Input = [Console]::In.ReadToEnd()
if ($base64Input) {
    $plainBytes = [System.Convert]::FromBase64String($base64Input.Trim())
    $encBytes = [System.Security.Cryptography.ProtectedData]::Protect($plainBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [System.IO.File]::WriteAllBytes($filePath, $encBytes)
}
`;
        try {
            await this.runner.run(script, base64Secret);
            this.cache.set(target, secret);
        } catch {
            throw new Error('credential_store_write_failed');
        }
    }

    async delete(target: string): Promise<void> {
        if (process.platform !== 'win32' && this.runner instanceof DefaultWindowsPowerShellRunner) {
            this.cache.set(target, null);
            return;
        }

        const cleanTarget = this.sanitizeTarget(target);
        const script = `
$appDataDir = Join-Path $env:LOCALAPPDATA "LauncherXD\\credentials"
$filePath = Join-Path $appDataDir "${cleanTarget}.dat"
if (Test-Path $filePath) {
    Remove-Item -Path $filePath -Force -ErrorAction Stop
}
`;
        try {
            await this.runner.run(script);
            this.cache.set(target, null);
        } catch {
            throw new Error('credential_store_delete_failed');
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
