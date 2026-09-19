export function readConfig(env: NodeJS.ProcessEnv) {
  const portText = env.PORT ?? '3100';
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) {
    let url: URL;
    try { url = new URL(databaseUrl); } catch { throw new Error('Invalid DATABASE_URL'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error('Invalid DATABASE_URL');
    }
  }
  return { port: Number(portText), host: env.HOST ?? '127.0.0.1', databaseUrl };
}
