import { loadAppConfig, ConfigError } from './config.js';
import { createApp } from './server.js';
import { log, setLogLevel } from './logger.js';
import { SqliteStorage } from './storage/index.js';
import { SecretStore } from './security/secret-store.js';
import { AuthService } from './auth/index.js';
import { SshConfigurationService } from './ssh/configuration.js';
import {
  RestrictedSshSystemMetricsCollectorFactory,
  SystemMetricsRuntime,
} from './collectors/system/runtime.js';
import { AsteriskProviderFactory, ProviderRuntimeManager } from './providers/runtime/index.js';
import { TelephonyStateEngine } from './telephony/state-engine.js';

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
    let secrets;
    try {
      secrets = await SecretStore.open(config, storage);
    } catch {
      log('error', 'secret_storage_initialization_failed');
      storage.close();
      process.exitCode = 1;
    }
    if (secrets) {
      let auth;
      try {
        auth = await AuthService.open(config, storage);
      } catch {
        log('error', 'authentication_initialization_failed');
        secrets.close();
        storage.close();
        process.exitCode = 1;
      }
      if (auth) {
        const providerFactory =
          config.pbxNetworkMode === 'plain_tcp' ? new AsteriskProviderFactory(secrets) : undefined;
        const runtime = new ProviderRuntimeManager(storage, secrets, providerFactory);
        const sshConfiguration = new SshConfigurationService(storage, secrets);
        const systemMetricsFactory =
          config.pbxNetworkMode === 'plain_tcp'
            ? new RestrictedSshSystemMetricsCollectorFactory(sshConfiguration, secrets)
            : undefined;
        const systemMetricsRuntime = new SystemMetricsRuntime(
          storage,
          sshConfiguration,
          systemMetricsFactory,
        );
        const telephonyState = new TelephonyStateEngine(runtime);
        telephonyState.start();
        runtime.start();
        systemMetricsRuntime.start();
        const server = createApp(storage, secrets, auth, runtime, systemMetricsRuntime);
        server.on('error', () => {
          log('error', 'server_error');
          void runtime.stop().finally(() => {
            systemMetricsRuntime.stop();
            telephonyState.stop();
            secrets.close();
            storage.close();
            process.exitCode = 1;
          });
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
            void (async () => {
              clearTimeout(timer);
              await runtime.stop();
              systemMetricsRuntime.stop();
              telephonyState.stop();
              secrets.close();
              storage.close();
              if (error) {
                log('error', 'shutdown_error');
                process.exitCode = 1;
              } else {
                log('info', 'server_stopped');
              }
            })();
          });
        };
        process.once('SIGINT', () => shutdown('SIGINT'));
        process.once('SIGTERM', () => shutdown('SIGTERM'));
      }
    }
  }
}
