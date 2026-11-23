/* Locate and evaluate the big GameMaker data object inside benedance.js,
   then dump a structural summary to discover the exact schema. */
const fs = require('fs');
const acorn = require('acorn');

const SRC = '/home/z/my-project/public/games/chainsaw-dance/html5game/benedance.js';
const src = fs.readFileSync(SRC, 'utf8');

console.log('parsing...');
let ast;
try {
  ast = acorn.parse(src, { ecmaVersion: 'latest', allowReserved: true, allowReturnOutsideFunction: true });
  console.log('strict parse OK');
} catch (e) {
  ast = acorn.parse(src, { ecmaVersion: 'latest', allowReserved: true, allowReturnOutsideFunction: true, onComment: () => {} });
  console.log('strict parse OK 2nd');
}

// explicit-stack walk: find the largest ObjectExpression
const stack = [ast];
let best = null, bestLen = 0, objCount = 0;
while (stack.length) {
  const n = stack.pop();
  if (!n || typeof n !== 'object') continue;
  if (n.type === 'ObjectExpression') {
    objCount++;
    const len = n.end - n.start;
    if (len > bestLen) { bestLen = len; best = n; }
  }
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') stack.push(c); }
    else if (v && typeof v === 'object' && typeof v.type === 'string') stack.push(v);
  }
}
console.log('object literals:', objCount, '| largest:', bestLen, 'chars at', best && best.start);

const literal = src.slice(best.start, best.end);
let data = null;
try {
  data = new Function('return (' + literal + ')')();
  console.log('evaluation OK, top-level type:', typeof data);
} catch (e) {
  console.log('evaluation FAILED:', e.message);
  process.exit(1);
}

function describe(v, depth = 0) {
  if (Array.isArray(v)) return 'Array(' + v.length + ')';
  if (v === null) return 'null';
  if (typeof v === 'object') return 'Object{' + Object.keys(v).slice(0, 12).join(',') + (Object.keys(v).length > 12 ? ',...' : '') + '}';
  return typeof v + ':' + JSON.stringify(v).slice(0, 60);
}

console.log('\n=== ROOT KEYS ===');
for (const [k, v] of Object.entries(data)) {
  console.log(k, '->', describe(v));
}

// dump first entry of every top-level array (truncated) to learn the schema
console.log('\n=== FIRST ENTRIES OF TOP-LEVEL ARRAYS ===');
for (const [k, v] of Object.entries(data)) {
  if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
    let s = JSON.stringify(v[0]);
    console.log('---', k, '(' + v.length + ' items) ---');
    console.log(s.slice(0, 1400));
  }
}

fs.writeFileSync('/home/z/my-project/scripts/gm_root_sample.json', JSON.stringify(data, null, 1).slice(0, 400000));
console.log('\nsample written to scripts/gm_root_sample.json');
