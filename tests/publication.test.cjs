const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadApi(modules, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(require.resolve('../src/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    exports: {},
    ...globals,
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

test('publishing uses the authenticated publish route and returns the published game night', async () => {
  let captured;
  const published = { id: 'night-1', status: 'PUBLISHED' };
  const { api } = loadApi({
    './firebase': { getIdToken: async () => 'test-token' },
  }, {
    process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.test/dev' } },
    fetch: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, json: async () => published };
    },
  });

  assert.deepEqual(await api.publishNight('night-1'), published);
  assert.equal(captured.url, 'https://api.example.test/dev/v1/game-nights/night-1/publish');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.body, undefined);
  assert.ok(captured.options.headers.Authorization.startsWith('Bearer '));
});

test('demo mode publishes a draft and rejects publishing it a second time', async () => {
  const { api } = loadApi({ './firebase': {} }, {
    process: { env: { EXPO_PUBLIC_DEMO_MODE: 'true' } },
    setTimeout: (callback) => callback(),
  });

  assert.equal((await api.night('night-3')).status, 'DRAFT');
  assert.equal((await api.publishNight('night-3')).status, 'PUBLISHED');
  assert.equal((await api.night('night-3')).status, 'PUBLISHED');
  await assert.rejects(api.publishNight('night-3'), { status: 409 });
});
