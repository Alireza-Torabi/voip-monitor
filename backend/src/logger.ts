type LogLevel = 'info' | 'error';

export function log(
  level: LogLevel,
  message: string,
  details: Record<string, string | number> = {},
): void {
  process.stdout.write(
    JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details }) + '\n',
  );
}
