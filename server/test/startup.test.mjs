import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('occupied port exits without falsely reporting a listening API', { timeout: 10000 }, async t => {
  const occupied = createServer().listen(0, '127.0.0.1');
  await once(occupied, 'listening');
  t.after(() => new Promise(resolve => occupied.close(resolve)));
  const port = occupied.address().port;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../dist/main.js', import.meta.url))], {
    env: { ...process.env, DATABASE_URL: '', HOST: '127.0.0.1', PORT: String(port), APP_ORIGIN: `http://127.0.0.1:${port}`, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const [code] = await once(child, 'close');
  assert.equal(code, 1);
  assert.doesNotMatch(output, /api_listening/);
  assert.match(output, /api_listen_failed: EADDRINUSE/);
});
