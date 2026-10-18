const { readFileSync } = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, modules = {}, globals = {}, extra = '') {
  const compiled = ts.transpileModule(readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, ...globals, require: (name) => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(compiled + extra, context);
  return context.exports;
}

const routing = load('../src/routing.ts');
const homeModules = {
  '@react-navigation/native': { useIsFocused: () => true },
  '@/src/routing': routing,
  '@/src/auth-session': { useAuthSession: () => ({ ready: true, user: { uid: 'test-user' }, signingOut: false, logout: async () => {} }) },
  '@/src/navigation': { confirmDiscard: (action) => action(), useUnsavedChanges: () => () => {} },
};

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return [node.props?.children].flat(Infinity).map(text).join(' ');
}
module.exports = { load, routing, homeModules, nodes, text };
