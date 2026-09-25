import { createConnection, isIP, type Socket } from 'node:net';
import {
  AmiTransportError,
  amiField,
  type AmiAction,
  type AmiConnectionTarget,
  type AmiEvent,
  type AmiEventListResult,
  type AmiEventListSpec,
  type AmiEventListener,
  type AmiResponse,
  type AmiTransport,
} from './transport.js';

const FRAME_END = '\r\n\r\n';
const LINE_END = '\r\n';
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_BUFFER_BYTES = 1024 * 1024;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
let nextStreamGeneration = 0;

interface PendingBase {
  actionId: string;
  reject: (error: AmiTransportError) => void;
  timer: NodeJS.Timeout;
}

interface PendingRequest extends PendingBase {
  kind: 'response';
  resolve: (response: AmiResponse) => void;
}

interface PendingEventList extends PendingBase {
  kind: 'event-list';
  spec: AmiEventListSpec;
  response?: AmiResponse;
  events: AmiEvent[];
  completion?: AmiEvent;
  resolve: (result: AmiEventListResult) => void;
}

type PendingOperation = PendingRequest | PendingEventList;

function safeValue(value: string): boolean {
  return !value.includes('\r') && !value.includes('\n') && value.length <= 65536;
}

function serializeAction(action: AmiAction, actionId: string): string {
  if (!SAFE_NAME.test(action.action)) throw new AmiTransportError('INVALID_ACTION');
  const lines = [`Action: ${action.action}`, `ActionID: ${actionId}`];
  for (const [key, value] of Object.entries(action.fields ?? {})) {
    if (
      !SAFE_NAME.test(key) ||
      key.toLowerCase() === 'action' ||
      key.toLowerCase() === 'actionid' ||
      !safeValue(value)
    ) {
      throw new AmiTransportError('INVALID_ACTION');
    }
    lines.push(`${key}: ${value}`);
  }
  return `${lines.join(LINE_END)}${FRAME_END}`;
}

function parseFrame(raw: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of raw.split(LINE_END)) {
    const separator = line.indexOf(':');
    if (separator <= 0) throw new AmiTransportError('PROTOCOL_ERROR');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trimStart();
    if (!key || !SAFE_NAME.test(key)) throw new AmiTransportError('PROTOCOL_ERROR');
    fields[key] = value;
  }
  return fields;
}

function takeCaseInsensitive(fields: Record<string, string>, name: string): string | undefined {
  const expected = name.toLowerCase();
  const key = Object.keys(fields).find((candidate) => candidate.toLowerCase() === expected);
  if (!key) return undefined;
  const value = fields[key];
  delete fields[key];
  return value;
}

/**
 * Plain TCP AMI transport.
 *
 * It always connects to target.address, never target.host, so DNS cannot be
 * re-run after the network policy approved an address. Runtime use remains
 * behind the default-disabled PBX network gate; protocol tests use only a
 * synthetic loopback AMI server.
 */
export class TcpAmiTransport implements AmiTransport {
  connected = false;
  banner: string | undefined;
  private socket: Socket | undefined;
  private receiveBuffer = '';
  private pending: PendingOperation | undefined;
  private actionCounter = 0;
  private streamGeneration = 0;
  private frameSequence = 0;
  private queue: Promise<void> = Promise.resolve();
  private connectResolve: (() => void) | undefined;
  private connectReject: ((error: AmiTransportError) => void) | undefined;
  private connectTimer: NodeJS.Timeout | undefined;
  private readonly eventListeners = new Set<AmiEventListener>();

  constructor(private readonly timeoutMs = DEFAULT_TIMEOUT_MS) {}

  async connect(target: AmiConnectionTarget): Promise<void> {
    if (this.socket || this.connected) throw new AmiTransportError('PROTOCOL_ERROR');
    if (!isIP(target.address) || target.port < 1 || target.port > 65535) {
      throw new AmiTransportError('CONNECTION_FAILED');
    }

    this.streamGeneration = ++nextStreamGeneration;
    this.frameSequence = 0;

    await new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.connectTimer = setTimeout(() => {
        this.failConnection(new AmiTransportError('TIMEOUT'));
        this.socket?.destroy();
      }, this.timeoutMs);
      this.connectTimer.unref();

      const socket = createConnection({
        host: target.address,
        port: target.port,
        family: isIP(target.address) as 4 | 6,
      });
      this.socket = socket;
      socket.setNoDelay(true);
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => this.handleData(chunk));
      socket.on('error', () =>
        this.handleSocketFailure(new AmiTransportError('CONNECTION_FAILED')),
      );
      socket.on('close', () => this.handleSocketFailure(new AmiTransportError('DISCONNECTED')));
    });
  }

  async disconnect(): Promise<void> {
    this.clearConnectTimer();
    this.rejectPending(new AmiTransportError('DISCONNECTED'));
    const socket = this.socket;
    this.socket = undefined;
    this.connected = false;
    this.banner = undefined;
    this.receiveBuffer = '';
    if (socket && !socket.destroyed) socket.destroy();
  }

  request(action: AmiAction): Promise<AmiResponse> {
    const run = this.queue.then(() => this.performRequest(action));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  requestEventList(action: AmiAction, spec: AmiEventListSpec): Promise<AmiEventListResult> {
    const itemEvents = 'itemEvent' in spec ? [spec.itemEvent] : [...spec.itemEvents];
    if (
      itemEvents.length === 0 ||
      itemEvents.some((name) => !SAFE_NAME.test(name)) ||
      !SAFE_NAME.test(spec.completeEvent)
    ) {
      return Promise.reject(new AmiTransportError('INVALID_ACTION'));
    }
    const run = this.queue.then(() => this.performEventListRequest(action, spec));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  subscribeEvents(listener: AmiEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private async performRequest(action: AmiAction): Promise<AmiResponse> {
    const socket = this.socket;
    if (!this.connected || !socket || socket.destroyed) {
      throw new AmiTransportError('DISCONNECTED');
    }
    const actionId = `vm-${++this.actionCounter}`;
    const payload = serializeAction(action, actionId);

    return new Promise<AmiResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.actionId !== actionId) return;
        this.pending = undefined;
        reject(new AmiTransportError('TIMEOUT'));
      }, this.timeoutMs);
      timer.unref();
      this.pending = {
        kind: 'response',
        actionId,
        resolve,
        reject,
        timer,
      };
      socket.write(payload, 'utf8', (error) => {
        if (error && this.pending?.actionId === actionId) {
          clearTimeout(timer);
          this.pending = undefined;
          reject(new AmiTransportError('CONNECTION_FAILED'));
        }
      });
    });
  }

  private async performEventListRequest(
    action: AmiAction,
    spec: AmiEventListSpec,
  ): Promise<AmiEventListResult> {
    const socket = this.socket;
    if (!this.connected || !socket || socket.destroyed) {
      throw new AmiTransportError('DISCONNECTED');
    }
    const actionId = `vm-${++this.actionCounter}`;
    const payload = serializeAction(action, actionId);
    const streamGeneration = this.streamGeneration;
    const streamStartedSequence = this.frameSequence;

    return new Promise<AmiEventListResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.actionId !== actionId) return;
        this.pending = undefined;
        reject(new AmiTransportError('TIMEOUT'));
      }, this.timeoutMs);
      timer.unref();
      this.pending = {
        kind: 'event-list',
        actionId,
        spec,
        events: [],
        resolve: (result) =>
          resolve({
            ...result,
            streamGeneration,
            streamStartedSequence,
          }),
        reject,
        timer,
      };
      socket.write(payload, 'utf8', (error) => {
        if (error && this.pending?.actionId === actionId) {
          clearTimeout(timer);
          this.pending = undefined;
          reject(new AmiTransportError('CONNECTION_FAILED'));
        }
      });
    });
  }

  private handleData(chunk: string): void {
    this.receiveBuffer += chunk;
    if (Buffer.byteLength(this.receiveBuffer, 'utf8') > MAX_BUFFER_BYTES) {
      this.handleSocketFailure(new AmiTransportError('PROTOCOL_ERROR'));
      this.socket?.destroy();
      return;
    }

    if (!this.banner) {
      const lineEnd = this.receiveBuffer.indexOf(LINE_END);
      if (lineEnd < 0) return;
      const banner = this.receiveBuffer.slice(0, lineEnd);
      this.receiveBuffer = this.receiveBuffer.slice(lineEnd + LINE_END.length);
      if (!banner.startsWith('Asterisk Call Manager/')) {
        this.failConnection(new AmiTransportError('PROTOCOL_ERROR'));
        this.socket?.destroy();
        return;
      }
      this.banner = banner;
      this.connected = true;
      this.clearConnectTimer();
      const resolve = this.connectResolve;
      this.connectResolve = undefined;
      this.connectReject = undefined;
      resolve?.();
    }

    while (true) {
      const frameEnd = this.receiveBuffer.indexOf(FRAME_END);
      if (frameEnd < 0) break;
      const raw = this.receiveBuffer.slice(0, frameEnd);
      this.receiveBuffer = this.receiveBuffer.slice(frameEnd + FRAME_END.length);
      if (!raw) continue;
      this.handleFrame(raw);
    }
  }

  private handleFrame(raw: string): void {
    let fields: Record<string, string>;
    try {
      fields = parseFrame(raw);
    } catch {
      this.handleSocketFailure(new AmiTransportError('PROTOCOL_ERROR'));
      this.socket?.destroy();
      return;
    }

    const streamSequence = ++this.frameSequence;
    const streamGeneration = this.streamGeneration;

    const response = takeCaseInsensitive(fields, 'Response');
    if (response) {
      const actionId = takeCaseInsensitive(fields, 'ActionID');
      const message = takeCaseInsensitive(fields, 'Message');
      const pending = this.pending;
      if (!pending) return;
      if (actionId && actionId !== pending.actionId) return;
      const parsed: AmiResponse = {
        response,
        ...(message === undefined ? {} : { message }),
        fields,
      };

      if (pending.kind === 'response') {
        clearTimeout(pending.timer);
        this.pending = undefined;
        pending.resolve(parsed);
        return;
      }

      if (response.toLowerCase() !== 'success') {
        this.rejectPending(new AmiTransportError('PROTOCOL_ERROR'));
        return;
      }
      pending.response = parsed;
      this.completeEventListIfReady(pending);
      return;
    }

    const event = takeCaseInsensitive(fields, 'Event');
    if (!event) return;
    const actionId = amiField(fields, 'ActionID');
    const pending = this.pending;

    if (pending?.kind === 'event-list' && actionId === pending.actionId) {
      const normalized = event.toLowerCase();
      const itemEvents =
        'itemEvent' in pending.spec
          ? [pending.spec.itemEvent.toLowerCase()]
          : pending.spec.itemEvents.map((name) => name.toLowerCase());
      if (itemEvents.includes(normalized)) {
        pending.events.push({
          event,
          fields: Object.freeze({ ...fields }),
          streamGeneration,
          streamSequence,
        });
        return;
      }
      if (normalized === pending.spec.completeEvent.toLowerCase()) {
        const eventListState = amiField(fields, 'EventList')?.toLowerCase();
        if (eventListState === 'cancelled') {
          this.rejectPending(new AmiTransportError('PROTOCOL_ERROR'));
          return;
        }
        pending.completion = {
          event,
          fields: Object.freeze({ ...fields }),
          streamGeneration,
          streamSequence,
        };
        this.completeEventListIfReady(pending);
        return;
      }
      this.rejectPending(new AmiTransportError('PROTOCOL_ERROR'));
      return;
    }

    const snapshot = Object.freeze({ ...fields });
    for (const listener of this.eventListeners) {
      try {
        listener({ event, fields: snapshot, streamGeneration, streamSequence });
      } catch {
        // One consumer must never break AMI frame processing for other consumers.
      }
    }
  }

  private completeEventListIfReady(pending: PendingEventList): void {
    if (!pending.response || !pending.completion || this.pending !== pending) return;
    clearTimeout(pending.timer);
    this.pending = undefined;
    pending.resolve({
      response: pending.response,
      events: pending.events.map((event) => ({
        event: event.event,
        fields: Object.freeze({ ...event.fields }),
        ...(event.streamGeneration === undefined
          ? {}
          : { streamGeneration: event.streamGeneration }),
        ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
      })),
      completion: {
        event: pending.completion.event,
        fields: Object.freeze({ ...pending.completion.fields }),
        ...(pending.completion.streamGeneration === undefined
          ? {}
          : { streamGeneration: pending.completion.streamGeneration }),
        ...(pending.completion.streamSequence === undefined
          ? {}
          : { streamSequence: pending.completion.streamSequence }),
      },
    });
  }

  private failConnection(error: AmiTransportError): void {
    this.clearConnectTimer();
    const reject = this.connectReject;
    this.connectResolve = undefined;
    this.connectReject = undefined;
    this.connected = false;
    reject?.(error);
  }

  private handleSocketFailure(error: AmiTransportError): void {
    if (this.connectReject) this.failConnection(error);
    this.connected = false;
    this.rejectPending(error);
  }

  private rejectPending(error: AmiTransportError): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = undefined;
    pending.reject(error);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = undefined;
  }
}
