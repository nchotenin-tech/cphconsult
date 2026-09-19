import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createDatabase } from './database.js';

try {
  const config = readConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const server = createApp(database.probe).listen(config.port, config.host, () => {
    console.log('api_listening');
  });
  server.on('error', () => { console.error('api_listen_failed'); process.exitCode = 1; void database.close(); });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.close(() => { void database.close().finally(() => { clearTimeout(deadline); }); });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch {
  console.error('api_configuration_invalid');
  process.exitCode = 1;
}
