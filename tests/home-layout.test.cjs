const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

test('the authenticated shell bounds the scrolling content while keeping navigation outside it', () => {
  const modules = {
    react: { useEffect: () => {}, useState: (initial) => [typeof initial === 'boolean' ? true : initial, () => {}] },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { SafeAreaView: 'SafeAreaView', View: 'View', ScrollView: 'ScrollView', Text: 'Text', Pressable: 'Pressable', useWindowDimensions: () => ({ width: 390 }) },
    'expo-router': { useRouter: () => ({}) },
    '@tanstack/react-query': {},
    '@/src/api': {},
    '@/src/firebase': {},
    '@/src/styles': { styles: {}, colors: {} },
    '@/src/i18n': { LanguageSwitcher: () => null, useLanguage: () => ({ t: (key) => key }) },
  };
  const compiled = ts.transpileModule(readFileSync(require.resolve('../app/home.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, require: (name) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(compiled, context);
  const page = context.exports.default();
  const shell = page.props.children;
  const shellStyle = Object.assign({}, ...shell.props.style);
  assert.equal(shellStyle.flex, 1, 'The shell must fit its viewport-sized parent instead of growing with the content');
  assert.equal(shellStyle.minHeight, 0, 'The shell must be allowed to shrink on web');
  const children = shell.props.children;
  assert.equal(children[1].type, 'ScrollView');
  assert.equal(children[2].type, 'View', 'Tab navigation must remain outside the scrolling content');
  assert.equal(children[2].props.children.length, 4);
});
