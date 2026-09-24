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
] as const;
