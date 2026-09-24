import { loadAppConfig, ConfigError } from './config.js';
import { createApp } from './server.js';
import { log, setLogLevel } from './logger.js';
import { SqliteStorage } from './storage/index.js';

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
  let storage;
  try {
    storage = await SqliteStorage.open(config);
  } catch {
    log('error', 'storage_initialization_failed');
    process.exitCode = 1;
  }
  if (storage) {
    const server = createApp(storage);
    server.on('error', () => {
      log('error', 'server_error');
      storage.close();
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
        storage.close();
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
}
