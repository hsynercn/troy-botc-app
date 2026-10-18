const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./routing-helpers.cjs');

function harness(platform = 'web') {
  const events = {}, listeners = {}, refs = [], effects = [], dispatched = [], dialogs = [], entries = [];
  let slot = 0, preventRemove, answer = false, focused = true;
  const history = {
    state: { id: 'router-id' },
    pushState(state, _, url) { this.state = state; entries.push(['push', state, url]); },
    replaceState(state, _, url) { this.state = state; entries.push(['replace', state, url]); },
    go(delta) { entries.push(['go', delta]); },
  };
  const window = {
    history, confirm: () => answer,
    addEventListener: (type, callback) => { events[type] = callback; },
    removeEventListener: (type) => { delete events[type]; },
  };
  const navigation = {
    isFocused: () => focused,
    dispatch: (action) => dispatched.push(action),
    addListener: (type, callback) => { listeners[type] = callback; return () => { delete listeners[type]; }; },
  };
  const module = load('../src/navigation.ts', {
    react: {
      useRef: (value) => { const index = slot++; refs[index] ??= { current: value }; return refs[index]; },
      useEffect: (fn) => effects.push(fn),
    },
    'react-native': { Platform: { OS: platform }, Alert: { alert: (...args) => dialogs.push(args) }, BackHandler: {
      addEventListener: (type, callback) => { events[type] = callback; return { remove: () => { delete events[type]; } }; },
      exitApp: () => dispatched.push('exit'),
    } },
    'expo-router': { useNavigation: () => navigation },
    '@react-navigation/native': { usePreventRemove: (enabled, callback) => { preventRemove = { enabled, callback }; } },
  }, { window });
  const render = (form, reset = () => {}) => {
    slot = 0;
    const saved = module.useUnsavedChanges(form, reset);
    effects.splice(0).forEach((fn) => fn());
    return saved;
  };
  return {
    ...module, events, listeners, dispatched, entries, history, render, dialogs,
    get preventRemove() { return preventRemove; },
    setAnswer: (value) => { answer = value; }, setFocused: (value) => { focused = value; },
  };
}

test('only changed forms guard navigation; reverting or saving removes the guard', () => {
  const h = harness();
  let navigated = 0;
  h.render({ title: 'Original' });
  h.confirmDiscard(() => navigated++); assert.equal(navigated, 1);
  h.render({ title: 'Changed' });
  h.confirmDiscard(() => navigated++); assert.equal(navigated, 1);
  h.render({ title: 'Original' });
  h.confirmDiscard(() => navigated++); assert.equal(navigated, 2);
  h.render({ title: 'Changed' })();
  h.confirmDiscard(() => navigated++); assert.equal(navigated, 3);
});

test('changed forms protect refresh and restore the browser position when Back is cancelled', () => {
  const h = harness();
  h.installWebNavigationGuard();
  h.history.pushState({ id: 'list' }, '', '/game-nights');
  h.history.pushState({ id: 'profile' }, '', '/profile');
  assert.equal(h.history.state.id, 'profile', 'Router history state must be preserved');
  h.render({ title: 'Original' }); h.render({ title: 'Changed' });
  const unload = { preventDefault: () => { unload.prevented = true; } };
  h.events.beforeunload(unload); assert.equal(unload.prevented, true);
  assert.equal(unload.returnValue, '');
  const pop = { state: { troyPosition: 1 }, stopImmediatePropagation: () => { pop.stopped = true; } };
  h.events.popstate(pop);
  assert.equal(pop.stopped, true);
  assert.deepEqual(h.entries.at(-1), ['go', 1]);
  const restore = { state: { troyPosition: 2 }, stopImmediatePropagation: () => { restore.stopped = true; } };
  h.events.popstate(restore); assert.equal(restore.stopped, true);
  h.setAnswer(true);
  const accepted = { state: { troyPosition: 1 }, stopImmediatePropagation: () => { accepted.stopped = true; } };
  h.events.popstate(accepted);
  assert.equal(accepted.stopped, undefined, 'Accepted browser Back is left to Router/browser');
});

test('native remove prevention shows a discard confirmation, and blur discards unsaved values', () => {
  const h = harness('ios');
  let reset;
  h.render({ title: 'Original' }, (value) => { reset = value; });
  assert.equal(h.preventRemove.enabled, false);
  h.render({ title: 'Changed' }, (value) => { reset = value; });
  assert.equal(h.preventRemove.enabled, true);
  const action = { type: 'GO_BACK' };
  h.preventRemove.callback({ data: { action } });
  assert.equal(h.dispatched.length, 0);
  const buttons = h.dialogs[0][2];
  assert.equal(buttons[0].style, 'cancel');
  buttons[1].onPress(); assert.equal(h.dispatched[0], action);
  h.listeners.blur(); assert.equal(reset.title, 'Original');
});

test('Android hardware Back warns even at the root, and does not leave on cancel', () => {
  const h = harness('android');
  h.render({ title: 'Original' }); h.render({ title: 'Changed' });
  assert.equal(h.events.hardwareBackPress(), true);
  assert.equal(h.dispatched.length, 0);
  assert.equal(h.dialogs[0][2][0].style, 'cancel');
});
