const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createExportServer } = require('../scripts/serve-web-export.cjs');

test('production fallback serves arbitrary details and unknown pages, never missing assets', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'troy-export-'));
  writeFileSync(path.join(directory, 'index.html'), '<html>SPA</html>');
  writeFileSync(path.join(directory, 'existing.js'), '/* asset */');
  const server = createExportServer(directory).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); rmSync(directory, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/home', '/game-nights', '/game-nights/arbitrary-future-id', '/leaderboard', '/profile', '/login?returnTo=%2Fprofile', '/unknown-page']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(await response.text(), '<html>SPA</html>');
  }
  for (const route of ['/_expo/missing', '/assets/missing', '/_expo/static/js/web/missing.js', '/missing.css', '/missing.png', '/missing.json', '/missing.woff2']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 404, route);
    assert.doesNotMatch(response.headers.get('content-type'), /text\/html/);
  }
  const asset = await fetch(base + '/existing.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
});
