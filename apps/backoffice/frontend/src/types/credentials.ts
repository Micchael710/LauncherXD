export interface CredentialStatus {
    configured: boolean;
}

export interface CredentialsStatusResponse {
    admin: CredentialStatus;
    github: CredentialStatus;
}

export interface ConfigureCredentialInput {
    token: string;
}

export interface ConfigureCredentialResponse {
    configured: boolean;
}
