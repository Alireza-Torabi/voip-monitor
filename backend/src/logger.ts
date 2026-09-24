type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const priority: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
let minimumLevel: LogLevel = 'info';
const sensitiveField = /password|secret|token|key|authorization/i;

export function setLogLevel(level: LogLevel): void {
  minimumLevel = level;
}

/** Redact sensitive field values before structured details reach JSON output. */
export function redactLogDetails(
  details: Record<string, string | number>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(details).map(([field, value]) => [
      field,
      sensitiveField.test(field) ? '[REDACTED]' : value,
    ]),
  );
}

export function log(
  level: LogLevel,
  message: string,
  details: Record<string, string | number> = {},
): void {
  if (priority[level] < priority[minimumLevel]) return;
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redactLogDetails(details),
    }) + '\n',
  );
}
