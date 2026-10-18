const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, routing, homeModules, nodes, text } = require('./routing-helpers.cjs');

const uuid = '12345678-1234-1234-1234-123456789abc';
const native = { View: 'View', SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', useWindowDimensions: () => ({ width: 900 }) };

function homeHarness(options = {}) {
  const calls = [], queries = [], effects = [];
  const state = { routes: [{ name: 'game-nights/index' }, { name: 'game-nights/[id]' }], index: 1 };
  const router = { push: (path) => calls.push(['push', path]), replace: (path) => calls.push(['replace', path]), back: () => calls.push(['back']), canGoBack: () => true };
  const session = options.session ?? { ready: true, user: { uid: 'test-user' }, signingOut: false, logout: async () => {} };
  const client = { refetchQueries: () => calls.push(['retry']), invalidateQueries: (key) => { calls.push(['invalidate', key]); return Promise.resolve(); } };
  const modules = {
    ...homeModules,
    react: { useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect: (fn) => effects.push(fn) },
    'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    '@react-navigation/native': { useIsFocused: () => options.focused !== false },
    'expo-router': { useRouter: () => router, usePathname: () => options.path ?? '/home', useNavigation: () => ({ getState: () => state }) },
    '@tanstack/react-query': {
      useQueryClient: () => client,
      useQuery: (query) => {
        queries.push(query);
        if (query.queryKey[0] === 'night') return { data: options.night ?? { id: uuid, status: 'PUBLISHED' }, isError: Boolean(options.error), error: options.error };
        return { data: { id: 'owner', role: 'ORGANIZER' } };
      },
    },
    '@/src/api': { api: { night: async (id) => { calls.push(['fetch-night', id]); return { id }; }, me: async () => ({}) }, DEMO_MODE: options.demo === true, ApiError: class extends Error { constructor(status, message) { super(message); this.status = status; } } },
    '@/src/auth-session': { useAuthSession: () => session },
    '@/src/styles': { styles: {}, colors: {} },
    '@/src/i18n': { useLanguage: () => ({ t: (key) => key }), LanguageSwitcher: () => null },
  };
  const components = load('../app/home.tsx', modules, {}, '\nexports.components = { NightRoute, ErrorState, Overview };');
  return { ...components, calls, queries, state, effects, session, render: (props) => components.default(props), runEffects: () => effects.splice(0).forEach((fn) => fn()) };
}

test('return destinations allow only canonical product paths, never arbitrary URLs or nested auth redirects', () => {
  for (const path of ['/home', '/game-nights', `/game-nights/${uuid}`, '/game-nights/night-1', '/leaderboard', '/profile']) {
    assert.equal(routing.safeDestination(path), path);
    assert.equal(routing.loginDestination(path).params.returnTo, path);
  }
  for (const path of [undefined, null, ['/home'], '/', '/login', '/home/login', '//evil.test/home', 'https://evil.test', '\\evil.test', '/game-nights/a%2fb', '/game-nights/../login', '/profile?next=https://evil.test', '/home#fragment', '/home/', '/game-nights/a/b', '/game-nights/evil\n']) {
    assert.equal(routing.safeDestination(path), null, String(path));
    assert.equal(routing.loginDestination(path), '/login');
  }
});

test('product guard waits for initial auth, never renders private sections, and retains a signed-out destination', () => {
  const session = { ready: false, user: null };
  const h = homeHarness({ path: `/game-nights/${uuid}`, session });
  let page = h.render({ section: 'nights', nightId: uuid }); h.runEffects();
  assert.equal(h.calls.length, 0);
  assert.equal(nodes(page).some((node) => node.type?.name === 'NightRoute'), false);
  session.ready = true;
  page = h.render({ section: 'nights', nightId: uuid }); h.runEffects();
  assert.equal(h.calls[0][0], 'replace');
  assert.equal(h.calls[0][1].pathname, '/login');
  assert.equal(h.calls[0][1].params.returnTo, `/game-nights/${uuid}`);
  assert.equal(nodes(page).some((node) => node.type?.name === 'NightRoute'), false);
});

test('demo is an explicit true bypass, inactive screens do not redirect, and pending sign-out does not navigate', () => {
  const session = { ready: true, user: null, signingOut: false };
  const demo = homeHarness({ session, demo: true });
  assert.ok(nodes(demo.render()).some((node) => node.type === 'ScrollView'));
  demo.runEffects(); assert.equal(demo.calls.length, 0);
  const inactive = homeHarness({ session, focused: false, path: '/login' });
  inactive.render(); inactive.runEffects(); assert.equal(inactive.calls.length, 0);
  const explicit = homeHarness({ session: { ...session, signingOut: true }, path: '/profile' });
  explicit.render(); explicit.runEffects(); assert.deepEqual(explicit.calls, []);
});

test('visual tabs push canonical sections and the selected section is a no-op', () => {
  const h = homeHarness();
  const tabs = nodes(h.render()).filter((node) => node.props?.accessibilityRole === 'tab');
  tabs.forEach((node) => node.props.onPress());
  assert.deepEqual(h.calls, [['push', '/game-nights'], ['push', '/leaderboard'], ['push', '/profile']]);
});

test('detail uses the existing direct API lookup, independently of list data', async () => {
  const h = homeHarness();
  const detail = h.components.NightRoute({ id: uuid });
  assert.equal(detail.type.name, 'NightDetails');
  assert.equal(detail.props.night.id, uuid);
  assert.equal(h.queries[0].queryKey[0], 'night');
  assert.equal(h.queries[0].enabled, true);
  await h.queries[0].queryFn();
  assert.deepEqual(h.calls, [['fetch-night', uuid]]);
  assert.equal(h.queries.some((q) => q.queryKey[0] === 'nights'), false);
  await detail.props.onRefresh();
  assert.equal(h.calls.filter((c) => c[0] === 'invalidate').length, 5);
});

test('detail Back pops only to a preceding list, otherwise navigates to the list without leaving the app', () => {
  const h = homeHarness();
  h.components.NightRoute({ id: uuid }).props.onBack();
  assert.deepEqual(h.calls.pop(), ['back']);
  h.state.routes[0].name = 'home';
  h.components.NightRoute({ id: uuid }).props.onBack();
  assert.deepEqual(h.calls.pop(), ['push', '/game-nights']);
  h.state.index = 0;
  h.components.NightRoute({ id: uuid }).props.onBack();
  assert.deepEqual(h.calls.pop(), ['push', '/game-nights']);
});

test('malformed real IDs do not hit the UUID API, while existing demo IDs remain supported', () => {
  const h = homeHarness();
  const ui = h.components.NightRoute({ id: 'not-a-uuid' });
  assert.equal(ui.type.name, 'ErrorState');
  assert.equal(ui.props.error.status, 404);
  assert.equal(h.queries.every((q) => q.enabled === false), true);
  assert.equal(homeHarness({ demo: true }).components.NightRoute({ id: 'night-1' }).type.name, 'NightDetails');
});

test('only explicit 403 shows access-denied; missing/private nights show not-found and server failures retry in place', () => {
  for (const [status, label] of [[403, 'route.denied'], [404, 'route.missing'], [500, 'error.load'], [0, 'error.load']]) {
    const error = Object.assign(new Error('Backend message'), { status });
    const h = homeHarness({ error });
    const route = h.components.NightRoute({ id: uuid });
    const ui = h.components.ErrorState(route.props);
    assert.match(text(ui), new RegExp(label));
    const buttons = nodes(ui).filter((n) => n.type === 'Pressable');
    assert.equal(buttons.length, status === 0 || status === 500 ? 3 : 2);
    assert.equal(h.calls.length, 0, 'Errors must not silently redirect');
  }
  const h = homeHarness();
  nodes(h.components.ErrorState({ error: new Error('offline') })).find((n) => n.type === 'Pressable').props.onPress();
  assert.deepEqual(h.calls, [['retry']]);
});

function loginHarness(returnTo, options = {}) {
  const effects = [], routes = [], authCalls = [], state = [];
  let slot = 0;
  const session = { ready: options.ready !== false, user: options.user ?? null, signingOut: false };
  const modules = {
    react: {
      useState: (initial) => { const key = slot++; state[key] ??= initial; return [state[key], (value) => { state[key] = value; }]; },
      useEffect: (fn) => effects.push(fn),
    },
    'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'expo-router': { useRouter: () => ({ replace: (path) => routes.push(path) }), useLocalSearchParams: () => ({ returnTo, reauthenticate: options.reauthenticate }) },
    '@/src/styles': { styles: {}, colors: {} },
    '@/src/i18n': { useLanguage: () => ({ t: (key) => key }), LanguageSwitcher: () => null },
    '@/src/routing': routing,
    '@/src/auth-session': { useAuthSession: () => session },
    '@/src/firebase': {
      auth: {}, googleProvider: {},
      signInWithEmailAndPassword: async (_, email, password) => { authCalls.push(['email', email, password]); session.user = { uid: 'email' }; },
      signInWithPopup: async () => { authCalls.push(['google']); session.user = { uid: 'google' }; },
    },
  };
  const SignIn = load('../app/login.tsx', modules, { process: { env: {} } }).default;
  const render = () => { slot = 0; const ui = SignIn(); effects.splice(0).forEach((fn) => fn()); return ui; };
  return { render, routes, authCalls, session };
}

test('both email/password and Google consume the same safe return destination only after Firebase auth succeeds', async () => {
  for (const provider of ['email', 'google']) {
    const h = loginHarness(`/game-nights/${uuid}`);
    const first = h.render();
    assert.match(text(first), /route.loginRequired/);
    assert.equal(h.routes.length, 0);
    const inputs = nodes(first).filter((n) => n.type === 'TextInput');
    inputs[0].props.onChangeText(' member@example.test '); inputs[1].props.onChangeText('password');
    const ui = h.render();
    const button = nodes(ui).find((n) => n.type === 'Pressable' && text(n).includes(provider === 'email' ? 'login.signIn' : 'login.google'));
    await button.props.onPress();
    assert.equal(h.routes.length, 0, 'Auth listener, not competing handlers, owns success navigation');
    h.render();
    assert.deepEqual(h.routes, [`/game-nights/${uuid}`]);
    assert.equal(h.routes[0].includes('returnTo'), false, 'Replacement consumes the login URL');
    assert.equal(h.authCalls[0][0], provider);
  }
});

test('login refresh retains a safe URL destination; invalid/multiple destinations fall back to Home without auth flash', () => {
  const refreshed = loginHarness('/profile', { user: { uid: 'restored' }, ready: false });
  assert.equal(nodes(refreshed.render()).some((n) => n.type === 'TextInput'), false);
  assert.equal(refreshed.routes.length, 0);
  refreshed.session.ready = true; refreshed.render();
  assert.deepEqual(refreshed.routes, ['/profile']);
  for (const destination of ['https://evil.test', ['/profile', '/home'], undefined]) {
    const h = loginHarness(destination, { user: { uid: 'restored' } }); h.render();
    assert.deepEqual(h.routes, ['/home']);
  }
});

test('root is auth-aware and waits for initial auth before replacing', () => {
  const session = { ready: false, user: null };
  const Index = load('../app/index.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'expo-router': { Redirect: 'Redirect' }, '@/src/auth-session': { useAuthSession: () => session },
    '@/src/api': { DEMO_MODE: false }, '@/src/styles': { styles: {}, colors: {} },
  }).default;
  assert.equal(Index().type, 'SafeAreaView');
  session.ready = true; assert.equal(Index().props.href, '/login');
  session.user = { uid: 'test' }; assert.equal(Index().props.href, '/home');
});

test('legacy nested login resolves to canonical Login and preserves only a safe return', () => {
  for (const [returnTo, expected] of [['/profile', '/profile'], ['//evil.test', undefined]]) {
    const LegacyLogin = load('../app/home/login.tsx', {
      'react/jsx-runtime': require('react/jsx-runtime'),
      'expo-router': { Redirect: 'Redirect', useLocalSearchParams: () => ({ returnTo }) },
      '@/src/routing': routing,
    }).default;
    const href = LegacyLogin().props.href;
    assert.equal(typeof href === 'string' ? href : href.pathname, '/login');
    assert.equal(typeof href === 'string' ? undefined : href.params.returnTo, expected);
  }
});

test('backend 401 reauthentication does not bounce a still-signed-in Firebase user back before sign-in', async () => {
  const h = homeHarness({ path: '/profile' });
  const error = Object.assign(new Error('Authentication required'), { status: 401 });
  const ui = h.components.ErrorState({ error });
  nodes(ui).find((n) => n.type === 'Pressable').props.onPress();
  const redirect = h.calls[0][1];
  assert.equal(redirect.params.reauthenticate, 'true');
  assert.equal(redirect.params.returnTo, '/profile');
  const login = loginHarness('/profile', { user: { uid: 'stale-session' }, reauthenticate: 'true' });
  const form = login.render();
  assert.equal(login.routes.length, 0);
  await nodes(form).find((n) => n.type === 'Pressable' && text(n).includes('login.google')).props.onPress();
  login.render();
  assert.deepEqual(login.routes, ['/profile']);
});
