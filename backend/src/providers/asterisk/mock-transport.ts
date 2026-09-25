import type { AmiAction, AmiConnectionTarget, AmiResponse, AmiTransport } from './transport.js';

export type MockAmiHandler = (action: AmiAction) => AmiResponse | Promise<AmiResponse>;

export class MockAmiTransport implements AmiTransport {
  connected = false;
  readonly connections: AmiConnectionTarget[] = [];
  readonly actions: AmiAction[] = [];
  private readonly handlers = new Map<string, MockAmiHandler>();

  on(action: string, handler: MockAmiHandler): this {
    this.handlers.set(action.toLowerCase(), handler);
    return this;
  }

  async connect(target: AmiConnectionTarget): Promise<void> {
    this.connections.push({ ...target });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async request(action: AmiAction): Promise<AmiResponse> {
    if (!this.connected) throw new Error('AMI transport is not connected');
    this.actions.push(
      action.fields
        ? { action: action.action, fields: { ...action.fields } }
        : { action: action.action },
    );
    const handler = this.handlers.get(action.action.toLowerCase());
    if (!handler) {
      return { response: 'Error', message: 'Mock action not configured', fields: {} };
    }
    return handler(action);
  }
}
