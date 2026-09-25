export interface AmiConnectionTarget {
  /**
   * Original configured host is retained for diagnostics; address is the
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

export interface AmiTransport {
  readonly connected: boolean;
  connect(target: AmiConnectionTarget): Promise<void>;
  disconnect(): Promise<void>;
  request(action: AmiAction): Promise<AmiResponse>;
}
