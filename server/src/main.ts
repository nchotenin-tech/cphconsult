import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createDatabase } from './database.js';
import { createAuthRouter } from './auth.js';
import { createServer } from 'node:http';

try {
  const config = readConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const auth = database.authStore ? await createAuthRouter(database.authStore, config.origin) : undefined;
  const server = createServer(createApp(database.probe, auth));
  server.once('listening', () => {
    console.log('api_listening');
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    const code = ['EADDRINUSE', 'EACCES', 'EADDRNOTAVAIL'].includes(error.code ?? '') ? error.code : 'UNKNOWN';
    console.error(`api_listen_failed: ${code}`);
    process.exitCode = 1;
    void database.close();
  });
  server.listen(config.port, config.host);
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
