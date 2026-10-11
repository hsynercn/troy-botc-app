const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { MutationObserver, QueryClient } = require('@tanstack/react-query');

function load(file, modules, globals = {}, extra = '') {
  const compiled = ts.transpileModule(readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = {
    exports: {},
    ...globals,
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(compiled + extra, context);
  return context.exports;
}

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return [node?.props?.children].flat(Infinity).map(textContent).join(' ');
}

function harness(t, options = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  t.after(() => client.clear());
  const night = {
    id: 'night-1',
    createdBy: 'organizer-1',
    status: options.status ?? 'PUBLISHED',
  };
  const actor = options.actor ?? { id: 'organizer-1', role: 'ORGANIZER' };
  let participants = (options.participants ?? [
    { playerId: 'player-1', displayName: 'Merve', status: 'REGISTERED' },
    { playerId: 'player-2', displayName: 'Can', status: 'RSVPED' },
  ]).map((participant) => ({ ...participant }));
  const calls = [];
  let refreshes = 0;
  let pending;
  let observer;
  let hookIndex = 0;
  const hookState = [];
  client.setQueryData(['roster', night.id], participants);
  const api = {
    roster: async () => participants.map((participant) => ({ ...participant })),
    recordAttendance: async (id, decisions) => {
      calls.push({ id, decisions: decisions.map((decision) => ({ ...decision })) });
      if (options.error) throw options.error;
      decisions.forEach(({ playerId, status }) => {
        const participant = participants.find((item) => item.playerId === playerId);
        if (participant) participant.status = status;
      });
      if (night.status === 'PUBLISHED') night.status = 'COMPLETED';
    },
  };
  const components = load('../app/home.tsx', {
    react: {
      useState: (initial) => {
        const index = hookIndex++;
        if (!(index in hookState)) hookState[index] = typeof initial === 'function' ? initial() : initial;
        return [hookState[index], (value) => {
          hookState[index] = typeof value === 'function' ? value(hookState[index]) : value;
        }];
      },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator' },
    'expo-router': {},
    '@tanstack/react-query': {
      useQuery: ({ queryKey }) => ({
        data: client.getQueryData(queryKey),
        isLoading: false,
        isError: false,
        error: null,
      }),
      useMutation: (config) => {
        if (!observer) observer = new MutationObserver(client, config);
        observer.setOptions(config);
        return {
          ...observer.getCurrentResult(),
          mutate: (...args) => { pending = observer.mutate(...args); },
        };
      },
    },
    '@/src/api': { api },
    '@/src/firebase': {},
    '@/src/styles': { styles: {}, colors: {} },
    '@/src/i18n': { useLanguage: () => ({ t: (key) => key }) },
  }, {}, '\nexports.components = { AttendanceManager };');

  const render = () => {
    hookIndex = 0;
    return components.components.AttendanceManager({
      night,
      actor,
      onRefresh: async () => {
        refreshes++;
        client.setQueryData(['roster', night.id], participants.map((participant) => ({ ...participant })));
      },
    });
  };
  return { actor, calls, client, night, participants, refreshes: () => refreshes, render, submit: async () => pending };
}

function action(ui, label) {
  return nodes(ui).find((node) => node.type === 'Pressable' && textContent(node).includes(label));
}

test('attendance requires explicit decisions for each eligible participant and submits once', async (t) => {
  const session = harness(t, {
    participants: [
      { playerId: 'player-1', displayName: 'Merve', status: 'REGISTERED' },
      { playerId: 'player-2', displayName: 'Can', status: 'RSVPED' },
      { playerId: 'player-3', displayName: 'Cancelled', status: 'CANCELLED' },
    ],
  });
  let ui = session.render();
  let submit = action(ui, 'attendance.complete');
  assert.equal(submit.props.disabled, true);
  const radios = nodes(ui).filter((node) => node.props?.accessibilityRole === 'radio');
  assert.equal(radios.length, 4);
  radios[0].props.onPress();
  ui = session.render();
  submit = action(ui, 'attendance.complete');
  assert.equal(submit.props.disabled, true);
  nodes(ui).filter((node) => node.props?.accessibilityRole === 'radio')[3].props.onPress();
  ui = session.render();
  submit = action(ui, 'attendance.complete');
  assert.equal(submit.props.disabled, false);
  submit.props.onPress();
  await session.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(session.calls[0])), {
    id: 'night-1',
    decisions: [
      { playerId: 'player-1', status: 'ATTENDED' },
      { playerId: 'player-2', status: 'NO_SHOW' },
    ],
  });
  assert.equal(session.night.status, 'COMPLETED');
  assert.equal(session.refreshes(), 1);
});

test('an empty eligible roster can be completed', async (t) => {
  const session = harness(t, { participants: [] });
  const submit = action(session.render(), 'attendance.complete');
  assert.equal(submit.props.disabled, false);
  submit.props.onPress();
  await session.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(session.calls[0])), { id: 'night-1', decisions: [] });
  assert.equal(session.night.status, 'COMPLETED');
});

test('only the owner organiser can complete a published game night', (t) => {
  const session = harness(t, { actor: { id: 'organizer-2', role: 'ORGANIZER' } });
  assert.equal(session.render(), null);
});

test('admins can edit completed attendance while the game night remains completed', async (t) => {
  const session = harness(t, {
    status: 'COMPLETED',
    actor: { id: 'admin-1', role: 'ADMIN' },
    participants: [
      { playerId: 'player-1', displayName: 'Merve', status: 'ATTENDED' },
      { playerId: 'player-2', displayName: 'Can', status: 'NO_SHOW' },
    ],
  });
  let ui = session.render();
  assert.ok(action(ui, 'attendance.saveCorrections'));
  const noShow = nodes(ui).find((node) => node.props?.accessibilityRole === 'radio' && textContent(node) === 'attendance.noShow');
  noShow.props.onPress();
  ui = session.render();
  action(ui, 'attendance.saveCorrections').props.onPress();
  await session.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(session.calls[0].decisions)), [
    { playerId: 'player-1', status: 'NO_SHOW' },
    { playerId: 'player-2', status: 'NO_SHOW' },
  ]);
  assert.equal(session.night.status, 'COMPLETED');
});

test('failed attendance submission shows the API error and preserves choices', async (t) => {
  const error = new Error('Attendance must include every registered participant exactly once');
  const session = harness(t, {
    error,
    participants: [{ playerId: 'player-1', displayName: 'Merve', status: 'REGISTERED' }],
  });
  let ui = session.render();
  nodes(ui).find((node) => node.props?.accessibilityRole === 'radio').props.onPress();
  ui = session.render();
  action(ui, 'attendance.complete').props.onPress();
  await assert.rejects(session.submit(), { message: error.message });
  ui = session.render();
  assert.match(textContent(ui), /Attendance must include every registered participant exactly once/);
  assert.equal(nodes(ui).find((node) => node.props?.accessibilityRole === 'radio').props.accessibilityState.checked, true);
  assert.equal(session.refreshes(), 1);
});

test('attendance request uses the existing authenticated API route and body', async () => {
  let captured;
  const { api } = load('../src/api.ts', {
    './firebase': { getIdToken: async () => 'firebase-test-token' },
  }, {
    process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.test/dev' } },
    fetch: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 204, json: async () => ({}) };
    },
  });
  const decisions = [{ playerId: 'player-1', status: 'ATTENDED' }];
  assert.equal(await api.recordAttendance('night-1', decisions), undefined);
  assert.equal(captured.url, 'https://api.example.test/dev/v1/game-nights/night-1/attendance');
  assert.equal(captured.options.method, 'POST');
  assert.deepEqual(JSON.parse(captured.options.body), decisions);
  assert.equal(captured.options.headers.Authorization, 'Bearer firebase-test-token');
});

test('demo attendance updates the count once and reflects finalized status', async () => {
  const { api } = load('../src/api.ts', {
    './firebase': {},
  }, {
    process: { env: { EXPO_PUBLIC_DEMO_MODE: 'true' } },
    setTimeout: (callback) => callback(),
  });
  const player = await api.me();
  const seededNight = (await api.nights()).find((night) => night.id === 'night-1');
  assert.equal(seededNight.createdBy, player.id);
  const before = player.rank.attendedGameCount;
  const decisions = [{ playerId: 'player-1', status: 'ATTENDED' }];
  await api.recordAttendance('night-1', decisions);
  await api.recordAttendance('night-1', decisions);
  assert.equal((await api.night('night-1')).status, 'COMPLETED');
  assert.equal((await api.roster('night-1'))[0].status, 'ATTENDED');
  assert.equal((await api.me()).rank.attendedGameCount, before + 1);
});
