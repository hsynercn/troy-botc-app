const assert = require('node:assert/strict');
const { test } = require('node:test');
const { QueryClient, MutationObserver } = require('@tanstack/react-query');
const { load, homeModules, nodes, text } = require('./routing-helpers.cjs');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(setImmediate);

// Preserve hook state and effect dependencies across deferred-operation rerenders.
function hooks() {
  const components = new Map();
  let current, slot;
  const effects = [];
  const cell = (initial) => {
    const key = slot++;
    if (!current.has(key)) current.set(key, initial());
    return current.get(key);
  };
  return {
    react: {
      useState(initial) {
        const state = cell(() => ({ value: typeof initial === 'function' ? initial() : initial }));
        return [state.value, (value) => { state.value = typeof value === 'function' ? value(state.value) : value; }];
      },
      useRef: (initial) => cell(() => ({ current: initial })),
      useEffect(effect, deps) {
        const state = cell(() => ({}));
        if (!state.deps || !deps || deps.some((dep, index) => dep !== state.deps[index])) {
          state.deps = deps;
          effects.push(() => { state.cleanup?.(); state.cleanup = effect(); });
        }
      },
    },
    render(name, component) {
      if (!components.has(name)) components.set(name, new Map());
      current = components.get(name); slot = 0;
      const result = component();
      effects.splice(0).forEach((effect) => effect());
      return result;
    },
    unmount(name) {
      for (const state of components.get(name)?.values() ?? []) state.cleanup?.();
      components.delete(name);
    },
    dispose() { for (const component of components.values()) for (const state of component.values()) state.cleanup?.(); },
  };
}

function editorHarness(t) {
  const h = hooks();
  const client = new QueryClient();
  const operation = deferred();
  const requests = [], saved = [];
  let mutation, warnings = 0;
  const navigation = { isFocused: () => true, addListener: () => () => {} };
  const guard = load('../src/navigation.ts', {
    react: h.react,
    'react-native': { Platform: { OS: 'web' } },
    'expo-router': { useNavigation: () => navigation },
    '@react-navigation/native': { usePreventRemove: () => {} },
  }, { window: { confirm: () => { warnings++; return false; }, addEventListener: () => {}, removeEventListener: () => {} } });
  const night = { id: 'night-1', title: 'Original', startsAt: '2030-01-01T18:00:00Z', endsAt: null, venueName: 'Club', capacity: 15 };
  const SessionEditor = load('../app/home.tsx', {
    ...homeModules, react: h.react, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable' },
    'expo-router': {},
    '@tanstack/react-query': {
      useMutation(options) {
        mutation ??= new MutationObserver(client, options);
        mutation.setOptions(options);
        return { ...mutation.getCurrentResult(), mutate: () => mutation.mutate() };
      },
    },
    '@/src/api': { api: { updateNight: async (id, input) => { requests.push({ id, input }); return operation.promise; } } },
    '@/src/navigation': guard, '@/src/styles': { styles: {}, colors: {} },
    '@/src/i18n': { useLanguage: () => ({ t: (key) => key }) },
  }, {}, '\nexports.SessionEditor = SessionEditor;').SessionEditor;
  t.after(() => { h.dispose(); client.clear(); });
  const render = () => h.render('editor', () => SessionEditor({ night, onSaved: (updated) => saved.push(updated) }));
  const fields = (ui) => nodes(ui).filter((node) => node.type === 'TextInput');
  const submit = (ui) => nodes(ui).find((node) => node.type === 'Pressable').props.onPress();
  return { render, fields, submit, operation, requests, saved, guard, warnings: () => warnings, night };
}

test('deferred editor PATCH cannot mark a later unsaved visible edit as persisted', async (t) => {
  const h = editorHarness(t);
  h.fields(h.render())[0].props.onChangeText('Submitted');
  const pending = h.submit(h.render());
  await tick();
  assert.equal(h.requests[0].input.title, 'Submitted');
  const pendingFields = h.fields(h.render());
  // Model a real TextInput: edits are possible only while editable.
  if (pendingFields[0].props.editable !== false) pendingFields[0].props.onChangeText('Edited while saving');
  else {
    // Also ignore a late change callback delivered while the input is locked.
    pendingFields[0].props.onChangeText('Queued edit while saving');
    assert.equal(h.fields(h.render())[0].props.value, 'Submitted');
  }
  h.render();
  let left = false;
  h.guard.confirmDiscard(() => { left = true; });
  assert.equal(left, false, 'Pending changes must still be guarded');
  const beforeSuccess = h.warnings();
  h.operation.resolve({ ...h.night, title: 'Submitted' });
  await pending;
  const title = h.fields(h.render())[0].props.value;
  h.guard.confirmDiscard(() => { left = true; });
  if (title !== 'Submitted') {
    assert.equal(h.warnings(), beforeSuccess + 1, 'A later unsaved visible edit must still warn after PATCH success');
    assert.equal(left, false);
  } else {
    assert.equal(h.warnings(), beforeSuccess, 'Persisted visible values should not warn');
    assert.equal(left, true);
  }
  assert.ok(pendingFields.every((field) => field.props.editable === false), 'All editor inputs lock during PATCH');
  assert.equal(h.saved[0].title, 'Submitted');
});

test('deferred rejected editor PATCH re-enables inputs and retains dirty values for retry', async (t) => {
  const h = editorHarness(t);
  h.fields(h.render())[0].props.onChangeText('Submitted');
  const pending = h.submit(h.render());
  await tick();
  assert.ok(h.fields(h.render()).every((field) => field.props.editable === false));
  const rejection = assert.rejects(pending, /Save unavailable/);
  h.operation.reject(new Error('Save unavailable'));
  await rejection;
  const ui = h.render();
  assert.equal(h.fields(ui)[0].props.value, 'Submitted');
  assert.ok(h.fields(ui).every((field) => field.props.editable === true));
  assert.match(text(ui), /Save unavailable/);
  let left = false;
  h.guard.confirmDiscard(() => { left = true; });
  assert.equal(left, false);
  assert.equal(h.saved.length, 0);
});

function logoutHarness(t) {
  const h = hooks();
  const client = new QueryClient();
  const operation = deferred(), routes = [];
  const detail = '/game-nights/12345678-1234-1234-1234-123456789abc';
  let pathname = detail, session, authCallback, clears = 0;
  const clear = client.clear.bind(client);
  client.clear = () => { clears++; clear(); };
  client.setQueryData(['me'], { id: 'member-1' });
  const Provider = load('../src/auth-session.tsx', {
    react: { ...h.react, createContext: () => ({ Provider: 'AuthProvider' }), useContext: () => session },
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@tanstack/react-query': { useQueryClient: () => client },
    './firebase': {
      auth: {}, onAuthStateChanged: (_, callback) => { authCallback = callback; return () => {}; },
      signOut: () => operation.promise.then(() => authCallback(null)),
    },
  }).AuthSessionProvider;
  const router = { replace: (path) => {
    const next = typeof path === 'string' ? path : path.pathname;
    routes.push(path);
    if (next !== pathname) h.unmount(pathname === '/login' ? 'login' : 'home');
    pathname = next;
  } };
  const modules = {
    ...homeModules, react: h.react, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { SafeAreaView: 'SafeAreaView', View: 'View', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', useWindowDimensions: () => ({ width: 900 }) },
    'expo-router': { useRouter: () => router, usePathname: () => pathname, useLocalSearchParams: () => ({}) },
    '@/src/auth-session': { useAuthSession: () => session },
    '@tanstack/react-query': {}, '@/src/api': { DEMO_MODE: false },
    '@/src/styles': { styles: {}, colors: {} },
    '@/src/i18n': { useLanguage: () => ({ t: (key) => key }), LanguageSwitcher: () => null },
    '@/src/firebase': {},
  };
  const Home = load('../app/home.tsx', modules).default;
  const Login = load('../app/login.tsx', modules, { process: { env: {} } }).default;
  const render = () => {
    for (let count = 0; count < 5; count++) {
      session = h.render('provider', () => Provider({ children: null })).props.value;
      const before = pathname;
      const ui = pathname === '/login'
        ? h.render('login', () => Login())
        : h.render('home', () => Home(pathname === detail ? { section: 'nights', nightId: detail.split('/').pop() } : {}));
      if (pathname === before) return ui;
    }
    throw new Error('Redirect loop');
  };
  t.after(() => { h.dispose(); client.clear(); });
  render(); authCallback({ uid: 'member-1' }); render();
  return {
    render, operation, routes, client, detail, pathname: () => pathname, clears: () => clears,
    emitSignedOut: () => authCallback(null),
    logout: () => nodes(render()).find((node) => node.type === 'Pressable' && text(node).includes('nav.logout')).props.onPress(),
  };
}

test('delayed rejected Firebase logout keeps the detail route and shows the failure on that screen', async (t) => {
  const h = logoutHarness(t);
  h.logout();
  await tick();
  h.render();
  const pendingPath = h.pathname();
  h.operation.reject(new Error('Sign-out unavailable'));
  await tick();
  const ui = h.render();
  assert.equal(h.pathname(), h.detail, 'Rejected sign-out must preserve the original detail route');
  assert.equal(pendingPath, h.detail, 'Pending sign-out must not navigate away from the detail route');
  assert.equal(h.routes.length, 0);
  assert.match(text(ui), /route.logoutFailed/);
  assert.equal(h.client.getQueryData(['me']).id, 'member-1');
  assert.equal(h.clears(), 0, 'Rejected sign-out must not clear the still-signed-in account');
});

test('delayed successful logout hides private content and clears cache before plain Login replacement', async (t) => {
  const h = logoutHarness(t);
  h.logout();
  const pending = h.render();
  assert.equal(h.pathname(), h.detail);
  assert.equal(nodes(pending).some((node) => node.type?.name === 'NightRoute'), false);
  h.emitSignedOut();
  assert.equal(nodes(h.render()).some((node) => node.type?.name === 'NightRoute'), false);
  assert.equal(h.pathname(), h.detail, 'Wait for Firebase signOut success even if auth callback arrives first');
  h.operation.resolve();
  await tick();
  h.render();
  assert.equal(h.pathname(), '/login');
  assert.deepEqual(h.routes, ['/login']);
  assert.equal(h.client.getQueryData(['me']), undefined);
  assert.ok(h.clears() > 0);
});
