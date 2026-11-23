/* Evaluate benedance.js top-level statements in a sandboxed VM (per-statement,
   errors tolerated) to materialize the original GameMaker data object, then
   dump its schema. */
const fs = require('fs');
const vm = require('vm');
const acorn = require('acorn');

const SRC = '/home/z/my-project/public/games/chainsaw-dance/html5game/benedance.js';
const src = fs.readFileSync(SRC, 'utf8');

const ast = acorn.parse(src, { ecmaVersion: 'latest', allowReserved: true, allowReturnOutsideFunction: true });
const body = ast.body;
console.log('top-level statements:', body.length);

const sandbox = {
  console, Math, JSON, Number, String, Boolean, Array, Object, Error, Date,
  isNaN, parseFloat, parseInt, RegExp, Uint8Array, Int8Array, Uint16Array,
  Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, ArrayBuffer,
  Uint8ClampedArray, Map, Set, Symbol, Promise, BigInt, DataView,
  window: {}, document: {}, navigator: {}, location: {},
  setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {},
  XMLHttpRequest: function () {}, Image: function () {},
  Audio: function () {}, performance: { now: () => 0 },
  requestAnimationFrame: () => 0, localStorage: { getItem: () => null, setItem: () => {} },
  WebSocket: function () {}, devicePixelRatio: 1,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.top = sandbox;
sandbox.parent = sandbox; sandbox.frames = [];
const ctx = vm.createContext(sandbox);

// pass 1: hoist all function declarations first (mimics script hoisting)
let ok = 0, fail = 0;
const failures = [];
const bigVars = [];
for (const st of body) {
  if (st.type !== 'FunctionDeclaration') continue;
  try { vm.runInContext(src.slice(st.start, st.end), ctx, { timeout: 10000 }); ok++; }
  catch (e) { fail++; if (failures.length < 4) failures.push('fn ' + (st.id && st.id.name) + ' :: ' + e.message.slice(0, 120)); }
}
console.log('pass1 functions OK:', ok, 'fail:', fail);

// pass 2: everything else, in file order
let ok2 = 0, fail2 = 0;
for (const st of body) {
  if (st.type === 'FunctionDeclaration') continue;
  const chunk = src.slice(st.start, st.end);
  const len = st.end - st.start;
  let declared = null;
  if (st.type === 'VariableDeclaration') declared = st.declarations.map(d => d.id.name).join(',');
  try {
    vm.runInContext(chunk, ctx, { timeout: 5000 });
    ok2++;
    if (len > 200000 || (declared && len > 50000)) bigVars.push(declared + ' len=' + len);
  } catch (e) {
    fail2++;
    if (failures.length < 10) failures.push((declared || st.type) + ' len=' + len + ' :: ' + e.message.slice(0, 120));
  }
}
console.log('pass2 OK:', ok2, '| failed:', fail2);
console.log('big data statements:', bigVars.join(' | '));
console.log('first failures:', JSON.stringify(failures, null, 1));

// find the biggest object value in the sandbox
let rootName = null, rootVal = null, rootSize = 0;
for (const [k, v] of Object.entries(sandbox)) {
  if (v && typeof v === 'object') {
    let n = 0;
    try { n = JSON.stringify(v).length; } catch { n = 0; }
    if (n > rootSize) { rootSize = n; rootName = k; rootVal = v; }
  }
}
console.log('biggest sandbox object:', rootName, '~json len', rootSize);
if (rootVal) {
  fs.writeFileSync('/home/z/my-project/scripts/gm_root_dump.json', JSON.stringify(rootVal, null, 1));
  console.log('dumped to scripts/gm_root_dump.json');
}
