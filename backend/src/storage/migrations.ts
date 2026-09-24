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
] as const;
