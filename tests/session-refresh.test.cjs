const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver, MutationObserver } = require('@tanstack/react-query');

function findElement(node, name) {
  if (!node || typeof node !== 'object') return;
  if (node.type?.name === name) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = findElement(child, name);
    if (found) return found;
  }
}

function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return [node?.props?.children].flat(Infinity).map(textContent).join(' ');
}

function sessionHarness(t, options = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const night = { id: 'night-1', title: 'Session', participantCount: 0, capacity: 10, status: options.status ?? 'PUBLISHED' };
  let participants = [];
  let selected = ['player-2'];
  let current;
  let mutation;
  let rendering;
  const mutations = new Map();
  const api = {
    nights: async () => [{ ...night, participantCount: participants.length }],
    roster: async () => participants.map((participant) => ({ ...participant })),
    register: async () => {
      if (options.registerError) throw options.registerError;
      participants = [{ playerId: 'player-2', displayName: 'Merve', status: 'REGISTERED' }];
    },
    removeRegistration: async (id, playerId) => {
      if (options.removeError) throw options.removeError;
      participants = participants.filter((p) => p.playerId !== playerId);
    },
  };
  client.setQueryData(['nights'], [night]);
  client.setQueryData(['me'], { role: options.role ?? 'ORGANIZER' });
  client.setQueryData(['roster', night.id], []);
  client.setQueryData(['users', ''], [{ id: 'player-2', displayName: 'Merve' }]);
  const observers = [
    new QueryObserver(client, { queryKey: ['nights'], queryFn: api.nights }),
    new QueryObserver(client, { queryKey: ['roster', night.id], queryFn: api.roster }),
  ];
  const subscriptions = observers.map((observer) => observer.subscribe(() => {}));
  t.after(() => { subscriptions.forEach((unsubscribe) => unsubscribe()); client.clear(); });
  const modules = {
    react: {
      useState: (initial) => {
        if (initial === null) return [night.id, () => {}];
        if (Array.isArray(initial)) return [selected, (value) => { selected = typeof value === 'function' ? value(selected) : value; }];
        if (initial?.id === night.id) {
          current ??= initial;
          return [current, (value) => { current = value; }];
        }
        return [initial, () => {}];
      },
      useEffect: (effect) => effect(),
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator' },
    'expo-router': { useRouter: () => ({}) },
    '@tanstack/react-query': {
      useQueryClient: () => client,
      useQuery: (options) => ({
        data: client.getQueryData(options.queryKey),
        isLoading: false,
        isPending: false,
        isError: false,
        refetch: () => observers.find((observer) =>
          JSON.stringify(observer.options.queryKey) === JSON.stringify(options.queryKey)).refetch(),
      }),
      useMutation: (options) => {
        if (!mutations.has(rendering)) mutations.set(rendering, new MutationObserver(client, options));
        mutation = mutations.get(rendering);
        mutation.setOptions(options);
        return { ...mutation.getCurrentResult(), mutate: (variables) => mutation.mutate(variables) };
      },
    },
    '@/src/api': { api },
    '@/src/firebase': {},
    '@/src/styles': { styles: {}, colors: {} },
    '@/src/i18n': { useLanguage: () => ({ t: (key) => key }) },
  };
  const compiled = ts.transpileModule(readFileSync(require.resolve('../app/home.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, require: (name) => {
    assert.ok(name in modules, `Unexpected component dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(`${compiled}\nexports.components = { NightsList, NightDetails, RegistrationManager, ParticipantManager };`, context);
  const { NightsList, NightDetails, RegistrationManager, ParticipantManager } = context.exports.components;
  const render = (component, props) => {
    rendering = component.name;
    return component(props);
  };
  const details = () => {
    const props = NightsList().props;
    NightDetails(props);
    return NightDetails(props);
  };
  return {
    client,
    details,
    registrationUI: () => render(RegistrationManager, findElement(details(), 'RegistrationManager').props),
    async register() {
      render(RegistrationManager, findElement(details(), 'RegistrationManager').props);
      await mutation.mutate();
      await new Promise(setImmediate);
    },
    async remove() {
      render(ParticipantManager, findElement(details(), 'ParticipantManager').props);
      await mutation.mutate('player-2');
      await new Promise(setImmediate);
    },
    participantsUI: () => render(ParticipantManager, findElement(details(), 'ParticipantManager').props),
    participantsText: () => textContent(render(ParticipantManager, findElement(details(), 'ParticipantManager').props)),
  };
}

test('registration refreshes the visible roster and session participant count without leaving details', async (t) => {
  const session = sessionHarness(t);
  assert.doesNotMatch(session.participantsText(), /Merve/);
  await session.register();
  assert.match(session.participantsText(), /Merve/);
  assert.equal(findElement(session.details(), 'NightCard').props.night.participantCount, 1);
});

test('removal refreshes the visible roster and session participant count', async (t) => {
  const session = sessionHarness(t);
  await session.register();
  assert.match(session.participantsText(), /Merve/);
  assert.equal(findElement(session.details(), 'NightCard').props.night.participantCount, 1);
  await session.remove();
  assert.doesNotMatch(session.participantsText(), /Merve/);
  assert.equal(findElement(session.details(), 'NightCard').props.night.participantCount, 0);
});

test('registration failures are visible and preserve the selection for retry', async (t) => {
  const error = new Error('Registration could not be completed; capacity or an existing registration changed');
  const session = sessionHarness(t, { registerError: error });
  await assert.rejects(session.register(), { message: error.message });
  assert.match(textContent(session.registrationUI()), /Registration could not be completed/);
  assert.match(textContent(session.registrationUI()), /✓/);
  assert.equal(findElement(session.details(), 'NightCard').props.night.participantCount, 0);
});

test('removal failures are visible and keep the participant on the roster', async (t) => {
  const session = sessionHarness(t, { removeError: new Error('This participation cannot be cancelled') });
  await session.register();
  await assert.rejects(session.remove(), /This participation cannot be cancelled/);
  assert.match(session.participantsText(), /This participation cannot be cancelled/);
  assert.match(session.participantsText(), /Merve/);
  assert.equal(findElement(session.details(), 'NightCard').props.night.participantCount, 1);
});

test('registered users cannot be selected again but become selectable after removal', async (t) => {
  const session = sessionHarness(t);
  await session.register();
  const row = session.registrationUI().props.children.flat(Infinity).find((node) => node?.key === 'player-2');
  assert.equal(row.props.disabled, true);
  assert.match(textContent(row), /registration.registered/);
  await session.remove();
  const available = session.registrationUI().props.children.flat(Infinity).find((node) => node?.key === 'player-2');
  assert.equal(available.props.disabled, false);
});

test('members cannot remove registrations', (t) => {
  const session = sessionHarness(t, { role: 'MEMBER' });
  session.client.setQueryData(['roster', 'night-1'], [{ playerId: 'player-2', displayName: 'Merve', status: 'REGISTERED' }]);
  assert.doesNotMatch(session.participantsText(), /night.remove/);
});

test('completed sessions do not expose registration management or removal', (t) => {
  const session = sessionHarness(t, { status: 'COMPLETED' });
  session.client.setQueryData(['roster', 'night-1'], [{ playerId: 'player-2', displayName: 'Merve', status: 'ATTENDED' }]);
  assert.equal(findElement(session.details(), 'RegistrationManager'), undefined);
  assert.doesNotMatch(session.participantsText(), /night.remove/);
});
