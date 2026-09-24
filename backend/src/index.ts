import { createApp } from './server.js';
import { log } from './logger.js';

const port = Number(process.env.APP_PORT ?? '3000');
const host = process.env.APP_HOST ?? '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  log('error', 'invalid_port');
  process.exitCode = 1;
} else {
  const server = createApp();
  server.on('error', () => {
    log('error', 'server_error');
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    log('info', 'server_started', { host, port });
  });

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    log('info', 'shutdown_started', { signal });
    const timer = setTimeout(() => {
      log('error', 'shutdown_timeout');
      server.closeAllConnections();
      process.exitCode = 1;
    }, 5000);
    timer.unref();
    server.close((error) => {
      clearTimeout(timer);
      if (error) {
        log('error', 'shutdown_error');
        process.exitCode = 1;
      } else {
        log('info', 'server_stopped');
      }
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}
