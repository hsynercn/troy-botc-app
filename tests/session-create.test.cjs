const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, MutationObserver } = require('@tanstack/react-query');

function load(file, modules, extra = '', globals = {}) {
  const compiled = ts.transpileModule(readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, ...globals, require: (name) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(compiled + extra, context);
  return context.exports;
}

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

const validForm = { title: ' Friday game ', startsAt: '2030-01-01T18:00:00+03:00', endsAt: '', venueName: ' Club ', venueAddress: '', notes: '', capacity: '15' };

function harness(t, options = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  t.after(() => client.clear());
  client.setQueryData(['nights'], []);
  client.setQueryData(['me'], { role: options.role ?? 'ORGANIZER' });
  const state = new Map();
  const mutations = new Map();
  const calls = [];
  let component;
  let slot;
  let observer;
  const created = { id: 'new-night', createdBy: 'organizer', ...validForm, title: 'Friday game', startsAt: '2030-01-01T15:00:00.000Z', endsAt: null, venueName: 'Club', venueAddress: null, notes: null, capacity: 15, participantCount: 0, status: 'DRAFT' };
  const api = {
    nights: async () => [],
    me: async () => ({ role: options.role ?? 'ORGANIZER' }),
    createNight: async (input) => {
      calls.push(input);
      if (options.error) throw options.error;
      return created;
    },
    updateNight: async (id, input) => { calls.push(input); return { ...created, ...input }; },
  };
  const components = load('../app/home.tsx', {
    react: {
      useState: (initial) => {
        const key = `${component}:${slot++}`;
        if (!state.has(key)) state.set(key, typeof initial === 'function' ? initial() : initial);
        return [state.get(key), (value) => state.set(key, typeof value === 'function' ? value(state.get(key)) : value)];
      },
      useEffect: () => {},
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator' },
    'expo-router': {},
    '@tanstack/react-query': {
      useQueryClient: () => client,
      useQuery: ({ queryKey }) => ({ data: client.getQueryData(queryKey), isError: false, isLoading: false }),
      useMutation: (config) => {
        if (!mutations.has(component)) mutations.set(component, new MutationObserver(client, config));
        observer = mutations.get(component);
        observer.setOptions(config);
        return { ...observer.getCurrentResult(), mutate: () => observer.mutate() };
      },
    },
    '@/src/api': { api },
    '@/src/firebase': {},
    '@/src/styles': { colors: {}, styles: {} },
    '@/src/i18n': { useLanguage: () => ({ t: (key) => key }) },
  }, '\nexports.components = { NightsList, SessionCreator, SessionEditor };').components;
  const render = (name, props) => {
    component = name;
    slot = 0;
    return components[name](props);
  };
  const list = () => render('NightsList');
  const open = () => {
    nodes(list()).find((node) => node.type === 'Pressable').props.onPress();
    return list().props;
  };
  const fill = (props, values = validForm) => {
    const ui = render('SessionCreator', props);
    const inputs = nodes(ui).filter((node) => node.type === 'TextInput');
    ['title', 'startsAt', 'endsAt', 'venueName', 'venueAddress', 'capacity', 'notes'].forEach((key, index) => inputs[index].props.onChangeText(values[key]));
    return render('SessionCreator', props);
  };
  return { list, open, fill, calls, created, client, render, submit: () => observer.mutate() };
}

test('organizers and admins can create a session from an empty list; members cannot', (t) => {
  for (const role of ['ORGANIZER', 'ADMIN', 'MEMBER']) {
    const session = harness(t, { role });
    const buttons = nodes(session.list()).filter((node) => node.type === 'Pressable');
    assert.equal(buttons.length, role === 'MEMBER' ? 0 : 1);
  }
});

test('the creation form defaults to now and four hours later without resetting edits on rerender', (t) => {
  const session = harness(t);
  const before = Date.now();
  const props = session.open();
  const ui = session.render('SessionCreator', props);
  const after = Date.now();
  const inputs = nodes(ui).filter((node) => node.type === 'TextInput');
  const start = Date.parse(inputs[1].props.value);
  const end = Date.parse(inputs[2].props.value);
  assert.ok(start >= before && start <= after);
  assert.equal(end - start, 4 * 60 * 60 * 1000);
  assert.match(inputs[1].props.value, /Z$/);
  assert.match(inputs[2].props.value, /Z$/);
  inputs[1].props.onChangeText('2030-01-01T18:00:00+03:00');
  inputs[2].props.onChangeText('');
  const rerendered = nodes(session.render('SessionCreator', props)).filter((node) => node.type === 'TextInput');
  assert.equal(rerendered[1].props.value, '2030-01-01T18:00:00+03:00');
  assert.equal(rerendered[2].props.value, '');
});

test('default times pass creation validation without manual date entry', async (t) => {
  const session = harness(t);
  const props = session.open();
  const inputs = nodes(session.render('SessionCreator', props)).filter((node) => node.type === 'TextInput');
  inputs[0].props.onChangeText('Friday game');
  inputs[3].props.onChangeText('Club');
  session.render('SessionCreator', props);
  await session.submit();
  assert.equal(session.calls[0].startsAt, inputs[1].props.value);
  assert.equal(session.calls[0].endsAt, inputs[2].props.value);
});

test('creation normalizes fields, caches the draft, refreshes the list and opens details', async (t) => {
  const session = harness(t);
  const props = session.open();
  session.fill(props);
  await session.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(session.calls[0])), {
    title: 'Friday game', startsAt: '2030-01-01T15:00:00.000Z', endsAt: null,
    venueName: 'Club', venueAddress: null, notes: null, capacity: 15,
  });
  assert.equal(session.list().type.name, 'NightDetails');
  assert.equal(session.list().props.night.id, 'new-night');
  assert.equal(session.client.getQueryState(['nights']).isInvalidated, true);
});

test('cancel returns to the list without creating a session', (t) => {
  const session = harness(t);
  session.open().onCancel();
  assert.equal(nodes(session.list()).filter((node) => node.type === 'Pressable').length, 1);
  assert.equal(session.calls.length, 0);
});

test('a stale post-create list response does not discard the confirmed draft details', async (t) => {
  const session = harness(t);
  session.fill(session.open());
  await session.submit();
  session.client.setQueryData(['nights'], []);
  assert.equal(session.list().type.name, 'NightDetails');
  assert.equal(session.list().props.night.id, session.created.id);
  session.list().props.onBack();
  assert.equal(nodes(session.list()).filter((node) => node.type === 'Pressable').length, 1);
});

test('new drafts with optional fields can be opened and saved in the existing editor', async (t) => {
  const session = harness(t);
  const ui = session.render('SessionEditor', { night: session.created, onSaved: () => {} });
  const inputs = nodes(ui).filter((node) => node.type === 'TextInput');
  assert.equal(inputs[2].props.value, '');
  assert.equal(inputs[4].props.value, '');
  assert.equal(inputs[6].props.value, '');
  await session.submit();
  assert.equal(session.calls[0].endsAt, null);
});

test('the editor visibly rejects clearing an existing end time instead of silently retaining it', async (t) => {
  const session = harness(t);
  const props = { night: { ...session.created, endsAt: '2030-01-01T20:00:00Z' }, onSaved: () => {} };
  const ui = session.render('SessionEditor', props);
  nodes(ui).filter((node) => node.type === 'TextInput')[2].props.onChangeText('');
  session.render('SessionEditor', props);
  await assert.rejects(session.submit(), /night.cannotClearEnd/);
  const errorUI = session.render('SessionEditor', props);
  assert.equal(nodes(errorUI).find((node) => node.props.accessibilityRole === 'alert').props.children, 'night.cannotClearEnd');
  assert.equal(session.calls.length, 0);
});

test('invalid details, timezone-less/invalid dates, reversed times and capacity are rejected before the API call', async (t) => {
  for (const update of [
    { title: ' ' }, { title: 'x'.repeat(121) }, { venueName: '' }, { venueName: 'x'.repeat(201) },
    { startsAt: '2030-01-01T18:00:00' }, { startsAt: '2030-02-30T18:00:00Z' },
    { startsAt: '2030-01-01T24:00:00Z' }, { startsAt: 'not-a-date' },
    { endsAt: '2030-01-01T15:00:00Z' }, { endsAt: '2029-01-01T15:00:00Z' },
    { capacity: '0' }, { capacity: '501' }, { capacity: '1.5' }, { capacity: '' },
  ]) {
    const session = harness(t);
    session.fill(session.open(), { ...validForm, ...update });
    await assert.rejects(session.submit());
    assert.equal(session.calls.length, 0, JSON.stringify(update));
  }
});

test('both capacity boundaries and an optional later end time are accepted', async (t) => {
  for (const capacity of ['1', '500']) {
    const session = harness(t);
    session.fill(session.open(), { ...validForm, capacity, endsAt: '2030-01-01T20:00:00+03:00' });
    await session.submit();
    assert.equal(session.calls[0].capacity, Number(capacity));
    assert.equal(session.calls[0].endsAt, '2030-01-01T17:00:00.000Z');
  }
});

test('API errors remain visible and retain the form for retry', async (t) => {
  const session = harness(t, { error: new Error('Only organizers can create sessions') });
  const props = session.open();
  session.fill(props);
  await assert.rejects(session.submit(), /Only organizers/);
  const ui = session.render('SessionCreator', props);
  assert.equal(nodes(ui).find((node) => node.props.accessibilityRole === 'alert').props.children, 'Only organizers can create sessions');
  assert.equal(nodes(ui).find((node) => node.type === 'TextInput').props.value, validForm.title);
  assert.equal(session.client.getQueryData(['nights']).length, 0);
});

test('pending creation disables inputs, submit and cancel', async (t) => {
  const session = harness(t);
  const props = session.open();
  session.fill(props);
  const pending = session.submit();
  const ui = session.render('SessionCreator', props);
  assert.ok(nodes(ui).filter((node) => node.type === 'TextInput').every((node) => node.props.editable === false));
  assert.ok(nodes(ui).filter((node) => node.type === 'Pressable').every((node) => node.props.disabled === true));
  await pending;
});

test('createNight sends POST JSON through the configured API URL and Firebase bearer auth', async () => {
  let captured;
  const { api } = load('../src/api.ts', { './firebase': { getIdToken: async () => 'firebase-test-token' } }, '', {
    process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.test/dev' } },
    fetch: async (url, options) => { captured = { url, options }; return { ok: true, status: 201, json: async () => ({ id: 'created' }) }; },
  });
  assert.equal((await api.createNight({ title: 'Game', capacity: 15 })).id, 'created');
  assert.equal(captured.url, 'https://api.example.test/dev/v1/game-nights');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers.Authorization, 'Bearer firebase-test-token');
  assert.deepEqual(JSON.parse(captured.options.body), { title: 'Game', capacity: 15 });
});

test('demo creation persists a draft with an isolated empty roster', async () => {
  const { api } = load('../src/api.ts', { './firebase': {} }, '', {
    process: { env: { EXPO_PUBLIC_DEMO_MODE: 'true' } }, setTimeout: (callback) => callback(),
  });
  const created = await api.createNight({ ...validForm, capacity: 15, endsAt: null, notes: null, venueAddress: null });
  assert.equal(created.status, 'DRAFT');
  assert.equal(created.participantCount, 0);
  assert.ok((await api.nights()).some((night) => night.id === created.id));
  assert.equal((await api.roster(created.id)).length, 0);
  await api.register(created.id, ['player-2']);
  assert.equal((await api.roster(created.id)).length, 1);
  assert.equal((await api.night(created.id)).participantCount, 1);
  assert.equal((await api.roster('night-1'))[0].playerId, 'player-1');
  await api.removeRegistration(created.id, 'player-2');
  assert.equal((await api.night(created.id)).participantCount, 0);
});
