export interface ValidationIssue {
    code: string;
    path?: string;
    message?: string;
}

export interface ReleaseValidationResponse {
    valid: boolean;
    issues: ValidationIssue[];
}
