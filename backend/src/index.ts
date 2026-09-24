import { loadAppConfig, ConfigError } from './config.js';
import { createApp } from './server.js';
import { log, setLogLevel } from './logger.js';

let config;
try {
  config = loadAppConfig(process.env);
} catch (error) {
  if (error instanceof ConfigError) {
    log('error', 'invalid_configuration', { fields: error.fields.join(', ') });
  } else {
    log('error', 'configuration_error');
  }
  process.exitCode = 1;
}

if (config) {
  setLogLevel(config.logLevel);
  const server = createApp();
  server.on('error', () => {
    log('error', 'server_error');
    process.exitCode = 1;
  });
  server.listen(config.http.port, config.http.host, () => {
    log('info', 'server_started', { host: config.http.host, port: config.http.port });
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
