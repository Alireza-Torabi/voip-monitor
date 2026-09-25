export interface AmiConnectionTarget {
  /**
   * Original configured host is retained for safe diagnostics; address is the
   * already-resolved and network-policy-approved address to connect to.
   */
  host: string;
  address: string;
  port: number;
}

export interface AmiAction {
  action: string;
  fields?: Readonly<Record<string, string>>;
}

export interface AmiResponse {
  response: string;
  message?: string;
  fields: Readonly<Record<string, string>>;
}

export interface AmiEvent {
  event: string;
  fields: Readonly<Record<string, string>>;
}

export type AmiEventListener = (event: AmiEvent) => void;

export type AmiTransportErrorCode =
  'CONNECTION_FAILED' | 'TIMEOUT' | 'PROTOCOL_ERROR' | 'DISCONNECTED' | 'INVALID_ACTION';

export class AmiTransportError extends Error {
  constructor(readonly code: AmiTransportErrorCode) {
    super(`AMI transport ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'AmiTransportError';
  }
}

export interface AmiTransport {
  readonly connected: boolean;
  readonly banner: string | undefined;
  connect(target: AmiConnectionTarget): Promise<void>;
  disconnect(): Promise<void>;
  request(action: AmiAction): Promise<AmiResponse>;
  subscribeEvents(listener: AmiEventListener): () => void;
}

export function amiField(
  fields: Readonly<Record<string, string>>,
  name: string,
): string | undefined {
  const expected = name.toLowerCase();
  for (const [key, value] of Object.entries(fields)) {
    if (key.toLowerCase() === expected) return value;
  }
  return undefined;
}
