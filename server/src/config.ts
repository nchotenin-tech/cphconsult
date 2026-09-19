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
  const originText = env.APP_ORIGIN ?? `http://127.0.0.1:${portText}`;
  let origin: URL;
  try { origin = new URL(originText); } catch { throw new Error('Invalid APP_ORIGIN'); }
  if (origin.origin !== originText || origin.username || origin.password
    || !['http:', 'https:'].includes(origin.protocol)
    || (origin.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(origin.hostname))
    || (env.NODE_ENV === 'production' && origin.protocol !== 'https:')) throw new Error('Invalid APP_ORIGIN');
  return { port: Number(portText), host: env.HOST ?? '127.0.0.1', databaseUrl, origin: originText };
}
