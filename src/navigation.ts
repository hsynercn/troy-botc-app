import { useEffect, useRef } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';

const warning = 'Discard your changed game night form? Unsaved changes will be lost.';
const dirtyForms = new Set<symbol>();

// Expo Router 4 resets navigation on browser popstate. beforeRemove alone can
// prevent the React state change but cannot put the browser URL back. Track a
// private history position (preserving Router's state) and intercept only
// changed-form pops, before Router's bubble listener sees them.
export function installWebNavigationGuard() {
  if (Platform.OS !== 'web') return () => {};
  const history = window.history;
  const push = history.pushState;
  const replace = history.replaceState;
  let position = Number(history.state?.troyPosition ?? 0);
  let restoring = false;
  replace.call(history, { ...history.state, troyPosition: position }, '');
  history.pushState = function (state, unused, url) {
    position += 1;
    push.call(history, { ...state, troyPosition: position }, unused, url);
  };
  history.replaceState = function (state, unused, url) {
    replace.call(history, { ...state, troyPosition: position }, unused, url);
  };
  const pop = (event: PopStateEvent) => {
    if (restoring) {
      restoring = false;
      event.stopImmediatePropagation();
      return;
    }
    const next = Number(event.state?.troyPosition ?? 0);
    if (dirtyForms.size && next !== position && !window.confirm(warning)) {
      event.stopImmediatePropagation();
      restoring = true;
      history.go(position - next);
      return;
    }
    dirtyForms.clear();
    position = next;
  };
  window.addEventListener('popstate', pop, true);
  return () => {
    history.pushState = push;
    history.replaceState = replace;
    window.removeEventListener('popstate', pop, true);
  };
}

export function confirmDiscard(action: () => void) {
  if (!dirtyForms.size) { action(); return; }
  if (Platform.OS === 'web') {
    if (window.confirm(warning)) { dirtyForms.clear(); action(); }
  } else {
    Alert.alert('Unsaved changes', warning, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { dirtyForms.clear(); action(); } },
    ]);
  }
}

export function useUnsavedChanges<T extends object>(form: T, reset: (value: T) => void) {
  const initial = useRef(JSON.stringify(form));
  const token = useRef(Symbol('form'));
  const navigation = useNavigation();
  const resetRef = useRef(reset);
  resetRef.current = reset;
  const dirty = JSON.stringify(form) !== initial.current;
  useEffect(() => {
    const key = token.current;
    if (dirty && navigation.isFocused()) dirtyForms.add(key);
    else dirtyForms.delete(key);
    return () => { dirtyForms.delete(key); };
  }, [dirty, form]);
  usePreventRemove(Platform.OS !== 'web' && dirty, ({ data }) => {
    if (!dirtyForms.has(token.current)) { navigation.dispatch(data.action); return; }
    confirmDiscard(() => navigation.dispatch(data.action));
  });
  useEffect(() => navigation.addListener('blur', () => {
    dirtyForms.delete(token.current);
    resetRef.current(JSON.parse(initial.current) as T);
  }), [navigation]);
  useEffect(() => {
    if (Platform.OS !== 'android' || !dirty) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused() || !dirtyForms.has(token.current)) return false;
      confirmDiscard(() => navigation.canGoBack() ? navigation.goBack() : BackHandler.exitApp());
      return true;
    });
    return () => subscription.remove();
  }, [dirty, navigation]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyForms.has(token.current)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    if (Platform.OS === 'web') window.addEventListener('beforeunload', beforeUnload);
    return () => {
      if (Platform.OS === 'web') window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [dirty, navigation]);
  return () => { initial.current = JSON.stringify(form); dirtyForms.delete(token.current); };
}
