export interface AdminIdentity {
  subject: string;
  email?: string;
}

export interface AdminAuthProvider {
  authenticate(request: Request): Promise<AdminIdentity>;
}

