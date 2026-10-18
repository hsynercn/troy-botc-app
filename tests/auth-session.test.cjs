const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./routing-helpers.cjs');

function harness() {
  const state = [], effects = [];
  let slot = 0, initialized = false, onAuth, clearCount = 0, failSignOut = false;
  const Provider = load('../src/auth-session.tsx', {
    react: {
      createContext: () => ({ Provider: 'AuthProvider' }), useContext: () => {},
      useState: (initial) => {
        const key = slot++;
        if (!(key in state)) state[key] = initial;
        return [state[key], (value) => { state[key] = value; }];
      },
      useEffect: (fn) => { if (!initialized) effects.push(fn); },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@tanstack/react-query': { useQueryClient: () => ({ clear: () => { clearCount++; } }) },
    './firebase': {
      auth: {},
      onAuthStateChanged: (_, callback) => { onAuth = callback; return () => {}; },
      signOut: async () => { if (failSignOut) throw new Error('offline'); onAuth(null); },
    },
  }).AuthSessionProvider;
  const render = () => {
    slot = 0;
    const element = Provider({ children: null });
    effects.splice(0).forEach((fn) => fn());
    initialized = true;
    return element.props.value;
  };
  return { render, emit: (user) => onAuth(user), clears: () => clearCount, fail: () => { failSignOut = true; } };
}

test('shared auth waits for Firebase initial state and clears private queries on account changes', () => {
  const h = harness();
  assert.equal(h.render().ready, false);
  h.emit(null); assert.equal(h.render().ready, true); assert.equal(h.clears(), 0);
  h.emit({ uid: 'member-1' }); assert.equal(h.render().user.uid, 'member-1'); assert.equal(h.clears(), 1);
  h.emit({ uid: 'member-1' }); assert.equal(h.clears(), 1, 'Same account does not lose cached data');
  h.emit({ uid: 'member-2' }); assert.equal(h.clears(), 2);
});

test('explicit logout marks the transition and clears private data; failed logout remains recoverable', async () => {
  const h = harness(); h.render(); h.emit({ uid: 'member-1' });
  const logout = h.render().logout();
  assert.equal(h.render().signingOut, true);
  await logout;
  assert.equal(h.render().user, null);
  assert.ok(h.clears() >= 1);
  h.emit({ uid: 'member-1' }); assert.equal(h.render().signingOut, false);
  h.fail();
  await assert.rejects(h.render().logout(), /offline/);
  assert.equal(h.render().signingOut, false);
  assert.equal(h.render().user.uid, 'member-1');
});
