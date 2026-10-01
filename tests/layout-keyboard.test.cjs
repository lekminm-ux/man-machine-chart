const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

// Mount the actual component's keyboard effect with a small hook/store boundary.
// No browser clipboard is used: Browser Use intercepts Ctrl+C/V before keydown.
function keyboardFixture(lockedAt = null) {
  const calls = [];
  const listeners = new Map();
  const file = { id: 'chart', lockedAt, header: { processName: '' }, layoutDiagram: {
    elements: [{ id: 'a', type: 'rack', label: 'Rack', x: 10, y: 10, width: 80, height: 40 }], connections: [],
  } };
  const state = new Proxy({
    activeFile: () => file,
    layoutHistory: {},
    undoLayout: () => { calls.push(['undo']); return true; },
    redoLayout: () => { calls.push(['redo']); return true; },
    layoutClipboard: { elements: file.layoutDiagram.elements },
    copyLayoutSelection: ids => { calls.push(['copy', [...ids]]); return true; },
    pasteLayoutClipboard: () => { calls.push(['paste']); return ['pasted']; },
    duplicateLayoutSelection: ids => { calls.push(['duplicate', [...ids]]); return ['duplicate']; },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  let hookIndex = 0;
  const react = {
    ...require('react'),
    useState: initial => [hookIndex++ === 0 ? ['a'] : initial, () => {}],
    useRef: initial => ({ current: initial }),
    useCallback: fn => fn,
    useEffect: fn => { fn(); },
  };
  function load(relative) {
    const filename = path.resolve(__dirname, '..', relative);
    const mod = { exports: {} };
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(output, {
      exports: mod.exports, module: mod,
      window: { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name), getSelection: () => ({ toString: () => '' }) },
      require: id => {
        if (id === 'react') return react;
        if (id === '@/store/useChartStore') return { useChartStore: selector => selector(state) };
        if (id === '@/lib/layout-utils') return load('src/lib/layout-utils.ts');
        if (id === '@/lib/layout-history') return load('src/lib/layout-history.ts');
        return require(id);
      },
    }, { filename });
    return mod.exports;
  }
  load('src/components/layout-diagram/LayoutDiagram.tsx').default();
  return { calls, key: (key, target = { tagName: 'BUTTON' }, modifiers = {}) => {
    let prevented = false;
    listeners.get('keydown')({ key, target, ctrlKey: true, ...modifiers, preventDefault: () => { prevented = true; } });
    return prevented;
  } };
}

test('actual Layout keydown effect dispatches Copy/Paste/Duplicate and leaves text editing alone', () => {
  const { key, calls } = keyboardFixture();
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
    assert.equal(key('c', target), false);
    assert.equal(key('v', target), false);
    assert.equal(key('d', target), false);
  }
  assert.equal(calls.length, 0);
  assert.equal(key('c'), true);
  assert.equal(key('v'), true);
  assert.equal(key('d'), true);
  assert.deepEqual(calls, [['copy', ['a']], ['paste'], ['duplicate', ['a']]]);
});

test('actual Layout keydown effect allows readonly Copy but blocks Paste/Duplicate on a locked chart', () => {
  const { key, calls } = keyboardFixture('2026-10-01T00:00:00Z');
  assert.equal(key('c'), true);
  assert.equal(key('v'), false);
  assert.equal(key('d'), false);
  assert.deepEqual(calls, [['copy', ['a']]]);
});

test('actual Layout shortcuts dispatch undo/redo and preserve native field undo', () => {
  const { key, calls } = keyboardFixture();
  assert.equal(key('z'), true);
  assert.equal(key('y'), true);
  assert.equal(key('Z', { tagName: 'BUTTON' }, { shiftKey: true }), true);
  assert.equal(key('z', { tagName: 'INPUT' }), false);
  assert.equal(key('y', { tagName: 'DIV', isContentEditable: true }), false);
  assert.deepEqual(calls, [['undo'], ['redo'], ['redo']]);
  const locked = keyboardFixture('closed');
  assert.equal(locked.key('z'), false); assert.equal(locked.calls.length, 0);
});
