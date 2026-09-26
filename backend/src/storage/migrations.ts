/** Append migrations only; changing an applied migration is a startup error. */
export const migrations = [
  {
    version: 1,
    name: 'initial_application_state',
    sql: `
      CREATE TABLE application_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        setup_state TEXT NOT NULL CHECK (setup_state IN ('SETUP_REQUIRED', 'SETUP_IN_PROGRESS', 'COMPLETE')),
        updated_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO application_state (id, setup_state, updated_at)
        VALUES (1, 'SETUP_REQUIRED', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      CREATE TABLE pbx_instance (
        id TEXT PRIMARY KEY,
        provider_type TEXT NOT NULL CHECK (provider_type = 'ASTERISK'),
        display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
        product TEXT,
        version TEXT,
        timezone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
    `,
  },
  {
    version: 2,
    name: 'encrypted_pbx_secrets',
    sql: `
      CREATE TABLE pbx_secret (
        pbx_instance_id TEXT NOT NULL REFERENCES pbx_instance(id) ON DELETE CASCADE,
        secret_name TEXT NOT NULL CHECK (length(secret_name) BETWEEN 1 AND 64),
        envelope_version INTEGER NOT NULL,
        key_version INTEGER NOT NULL,
        nonce BLOB NOT NULL,
        auth_tag BLOB NOT NULL,
        ciphertext BLOB NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (pbx_instance_id, secret_name)
      ) STRICT;
    `,
  },
  {
    version: 3,
    name: 'local_authentication',
    sql: `
      CREATE TABLE administrator (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 64),
        password_hash TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      ) STRICT;
      CREATE TABLE auth_session (
        token_digest TEXT PRIMARY KEY CHECK (length(token_digest) = 64),
        administrator_id TEXT NOT NULL REFERENCES administrator(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX auth_session_expiry ON auth_session(expires_at);
    `,
  },
  {
    version: 4,
    name: 'pbx_onboarding_profiles',
    sql: `
      ALTER TABLE pbx_instance ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1));
      CREATE TABLE asterisk_config (
        pbx_instance_id TEXT PRIMARY KEY REFERENCES pbx_instance(id) ON DELETE CASCADE,
        ami_host TEXT NOT NULL CHECK (length(ami_host) BETWEEN 1 AND 253),
        ami_port INTEGER NOT NULL CHECK (ami_port BETWEEN 1 AND 65535),
        ami_username TEXT NOT NULL CHECK (length(ami_username) BETWEEN 1 AND 128)
      ) STRICT;
      CREATE TABLE application_state_next (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        setup_state TEXT NOT NULL CHECK (setup_state IN ('SETUP_REQUIRED', 'SETUP_IN_PROGRESS', 'PBX_CONFIGURED_UNVERIFIED', 'COMPLETE')),
        updated_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO application_state_next SELECT id, setup_state, updated_at FROM application_state;
      DROP TABLE application_state;
      ALTER TABLE application_state_next RENAME TO application_state;
    `,
  },
  {
    version: 5,
    name: 'pbx_verification_state',
    sql: `
      ALTER TABLE asterisk_config ADD COLUMN last_verified_at TEXT;
    `,
  },
  {
    version: 6,
    name: 'restricted_ssh_configuration',
    sql: `
      CREATE TABLE ssh_config (
        pbx_instance_id TEXT PRIMARY KEY REFERENCES pbx_instance(id) ON DELETE CASCADE,
        ssh_host TEXT NOT NULL CHECK (length(ssh_host) BETWEEN 1 AND 253),
        ssh_port INTEGER NOT NULL CHECK (ssh_port BETWEEN 1 AND 65535),
        ssh_username TEXT NOT NULL CHECK (length(ssh_username) BETWEEN 1 AND 128),
        auth_method TEXT NOT NULL CHECK (auth_method IN ('PASSWORD', 'PRIVATE_KEY')),
        host_key_policy TEXT NOT NULL CHECK (host_key_policy = 'PINNED_SHA256'),
        host_key_fingerprint TEXT NOT NULL CHECK (length(host_key_fingerprint) = 50),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
    `,
  },
  {
    version: 7,
    name: 'system_metrics_persistence',
    sql: `
      CREATE TABLE system_metric_current (
        pbx_instance_id TEXT PRIMARY KEY REFERENCES pbx_instance(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source = 'SSH'),
        observed_at TEXT NOT NULL,
        sample_json TEXT NOT NULL CHECK (json_valid(sample_json)),
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE system_metric_history (
        id INTEGER PRIMARY KEY,
        pbx_instance_id TEXT NOT NULL REFERENCES pbx_instance(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source = 'SSH'),
        observed_at TEXT NOT NULL,
        sample_json TEXT NOT NULL CHECK (json_valid(sample_json)),
        UNIQUE (pbx_instance_id, source, observed_at)
      ) STRICT;
      CREATE INDEX system_metric_history_instance_observed
        ON system_metric_history(pbx_instance_id, observed_at);
    `,
  },
  {
    version: 8,
    name: 'security_event_persistence',
    sql: `
      CREATE TABLE security_event_current (
        pbx_instance_id TEXT PRIMARY KEY REFERENCES pbx_instance(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source = 'AMI'),
        observed_at TEXT NOT NULL,
        stream_generation INTEGER,
        stream_sequence INTEGER,
        event_json TEXT NOT NULL CHECK (json_valid(event_json)),
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE security_event_history (
        id INTEGER PRIMARY KEY,
        event_key TEXT NOT NULL UNIQUE,
        pbx_instance_id TEXT NOT NULL REFERENCES pbx_instance(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source = 'AMI'),
        observed_at TEXT NOT NULL,
        stream_generation INTEGER,
        stream_sequence INTEGER,
        event_json TEXT NOT NULL CHECK (json_valid(event_json))
      ) STRICT;
      CREATE INDEX security_event_history_instance_observed
        ON security_event_history(pbx_instance_id, observed_at);
    `,
  },
  {
    version: 9,
    name: 'security_alert_persistence',
    sql: `
      CREATE TABLE security_alert_current (
        pbx_instance_id TEXT NOT NULL REFERENCES pbx_instance(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL CHECK (rule_id IN ('AUTHENTICATION_FAILURE_ANY', 'AUTHENTICATION_FAILURE_THRESHOLD')),
        observed_at TEXT NOT NULL,
        stream_generation INTEGER,
        stream_sequence INTEGER,
        alert_json TEXT NOT NULL CHECK (json_valid(alert_json)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (pbx_instance_id, rule_id)
      ) STRICT;
      CREATE TABLE security_alert_history (
        id INTEGER PRIMARY KEY,
        alert_key TEXT NOT NULL UNIQUE,
        pbx_instance_id TEXT NOT NULL REFERENCES pbx_instance(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL CHECK (rule_id IN ('AUTHENTICATION_FAILURE_ANY', 'AUTHENTICATION_FAILURE_THRESHOLD')),
        observed_at TEXT NOT NULL,
        stream_generation INTEGER,
        stream_sequence INTEGER,
        alert_json TEXT NOT NULL CHECK (json_valid(alert_json))
      ) STRICT;
      CREATE INDEX security_alert_history_instance_observed
        ON security_alert_history(pbx_instance_id, observed_at);
    `,
  },
] as const;
