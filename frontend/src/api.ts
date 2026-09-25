export interface Principal {
  id: string;
  username: string;
}
export type PbxConnectionState =
  'UNVERIFIED' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'ERROR';

export interface PbxProfile {
  id: string;
  displayName: string;
  providerType: 'ASTERISK';
  enabled: boolean;
  amiHost: string;
  amiPort: number;
  amiUsername: string;
  hasAmiPassword: boolean;
  connectionStatus: PbxConnectionState;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super('Request failed');
  }
}
async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    ...(body
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const error = (await response.json()) as { error?: unknown };
      if (typeof error.error === 'string') code = error.error;
    } catch {
      // Error bodies are intentionally optional.
    }
    throw new ApiError(response.status, code);
  }
  return (await response.json()) as T;
}
export const api = {
  setupStatus: () => request<{ adminSetupRequired: boolean }>('/setup/status'),
  createAdmin: (username: string, password: string, bootstrapToken: string) =>
    request<Principal>('/setup/admin', 'POST', { username, password, bootstrapToken }),
  login: (username: string, password: string) =>
    request<Principal>('/auth/login', 'POST', { username, password }),
  me: () => request<Principal>('/auth/me'),
  logout: () => request<{ status: string }>('/auth/logout', 'POST'),
  listPbx: () => request<{ items: PbxProfile[] }>('/api/pbx-instances'),
  createPbx: (value: object) => request<PbxProfile>('/api/pbx-instances', 'POST', value),
  updatePbx: (id: string, value: object) =>
    request<PbxProfile>(`/api/pbx-instances/${id}`, 'PATCH', value),
  deletePbx: (id: string) => request<{ status: string }>(`/api/pbx-instances/${id}`, 'DELETE'),
  testPbxConnection: (id: string) =>
    request<{
      status: 'verified';
      discovery: {
        metadata: {
          id: string;
          providerType: 'ASTERISK';
          displayName: string;
          product?: string;
          version?: string;
        };
        observedAt: string;
      };
    }>(`/api/pbx-instances/${id}/test-connection`, 'POST'),
};
