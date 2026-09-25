import type {
  AmiAction,
  AmiConnectionTarget,
  AmiEventListResult,
  AmiEventListSpec,
  AmiEventListener,
  AmiResponse,
  AmiTransport,
} from './transport.js';

export type MockAmiHandler = (action: AmiAction) => AmiResponse | Promise<AmiResponse>;
export type MockAmiEventListHandler = (
  action: AmiAction,
  spec: AmiEventListSpec,
) => AmiEventListResult | Promise<AmiEventListResult>;

function snapshotAction(action: AmiAction): AmiAction {
  if (!action.fields) return { action: action.action };
  const fields = Object.fromEntries(
    Object.entries(action.fields).map(([key, value]) => [
      key,
      /password|secret|token|key|authorization/i.test(key) ? '<redacted>' : value,
    ]),
  );
  return { action: action.action, fields };
}

export class MockAmiTransport implements AmiTransport {
  connected = false;
  banner: string | undefined = 'Asterisk Call Manager/mock';
  readonly connections: AmiConnectionTarget[] = [];
  readonly actions: AmiAction[] = [];
  private readonly handlers = new Map<string, MockAmiHandler>();
  private readonly eventListHandlers = new Map<string, MockAmiEventListHandler>();
  private readonly eventListeners = new Set<AmiEventListener>();

  on(action: string, handler: MockAmiHandler): this {
    this.handlers.set(action.toLowerCase(), handler);
    return this;
  }

  onEventList(action: string, handler: MockAmiEventListHandler): this {
    this.eventListHandlers.set(action.toLowerCase(), handler);
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
    this.actions.push(snapshotAction(action));
    const handler = this.handlers.get(action.action.toLowerCase());
    if (!handler) {
      return { response: 'Error', message: 'Mock action not configured', fields: {} };
    }
    return handler(action);
  }

  async requestEventList(action: AmiAction, spec: AmiEventListSpec): Promise<AmiEventListResult> {
    if (!this.connected) throw new Error('AMI transport is not connected');
    this.actions.push(snapshotAction(action));
    const handler = this.eventListHandlers.get(action.action.toLowerCase());
    if (!handler) throw new Error('Mock event-list action not configured');
    return handler(action, spec);
  }

  subscribeEvents(listener: AmiEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  emitEvent(event: string, fields: Readonly<Record<string, string>> = {}): void {
    const snapshot = Object.freeze({ ...fields });
    for (const listener of this.eventListeners) listener({ event, fields: snapshot });
  }
}
