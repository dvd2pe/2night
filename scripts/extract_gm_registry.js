/* Extract the ORIGINAL GameMaker asset registry from benedance.js.
   Field semantics verified empirically against atlas pixels:
   - rect: page=_I4, content box x,y + _Y1/_Z1 (disjoint, in-bounds), sprite box _G4/_H4, trim offset _C4/_D4
   - sprite: name=_W, width/height (fallback rect sprite box), origin=_81/_91, speed=_d1/_a1, frames=_e1 (rect indices)
   - audio: name=_W, file base=_Z, volume, preload, group=_11
   - objects: name=_W, sprite=_32, parent
   - room r_game: instances _c4 (x,y,index->object,...)
   Output: scripts/gm_raw_registry.json */
const fs = require('fs');
const vm = require('vm');
const acorn = require('acorn');

const SRC = '/home/z/my-project/public/games/chainsaw-dance/html5game/benedance.js';
const src = fs.readFileSync(SRC, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', allowReserved: true, allowReturnOutsideFunction: true });

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

for (const st of ast.body) {
  if (st.type !== 'FunctionDeclaration') continue;
  try { vm.runInContext(src.slice(st.start, st.end), ctx, { timeout: 10000 }); } catch (e) { /* runner init, ignora */ }
}
let data = null;
for (const st of ast.body) {
  if (st.type === 'FunctionDeclaration') continue;
  try { vm.runInContext(src.slice(st.start, st.end), ctx, { timeout: 5000 }); } catch (e) { /* browser-only */ }
}
data = sandbox._M;
if (!data) { console.error('root _M non trovato'); process.exit(1); }

const rects = data._B4;
const sprites = data._41;
const audio = data._V;
const objects = data._22;
const fonts = data._O1;
const seqs = [...(data._L3 || []), ...(data._T3 || [])];
const shaders = data._K1 || [];
const rooms = data._04 || [];
const scriptNames = data._Fs || [];
const texNames = data._J4;
const texGroups = data._L4;

const rectInfo = (i) => {
  const r = rects[i] || {};
  return {
    rectIndex: i,
    page: r._I4 ?? null,
    x: r.x ?? null, y: r.y ?? null,
    w: r._Y1 ?? null, h: r._Z1 ?? null,
    spriteW: r._G4 ?? null, spriteH: r._H4 ?? null,
    trimX: r._C4 ?? 0, trimY: r._D4 ?? 0,
  };
};

// shared-region map: rectIndex -> users
const rectUsers = new Map();
sprites.forEach((s, si) => {
  (s._e1 || []).forEach((fi, k) => {
    const arr = rectUsers.get(fi) || [];
    arr.push({ sprite: s._W, spriteIndex: si, frame: k });
    rectUsers.set(fi, arr);
  });
});

const out = {
  game: 'chainsaw-dance',
  engine: 'gamemaker-studio-2-html5',
  source: 'html5game/benedance.js',
  extractedFrom: 'variabile _M (registro asset originale compilato)',
  textures: (texNames || []).map((n, i) => ({ index: i, file: 'html5game/' + n, name: n })),
  textureGroups: (texGroups || []).map(g => ({ name: g._W, pages: g._M4, spriteCount: (g._N4 || []).length })),
  sprites: sprites.map((s, i) => {
    const frames = (s._e1 || []).map(rectInfo);
    const first = frames[0] || {};
    return {
      index: i,
      name: s._W,
      width: s.width ?? first.spriteW ?? null,
      height: s.height ?? first.spriteH ?? null,
      originX: s._81 ?? 0,
      originY: s._91 ?? 0,
      speedFps: s._d1 ?? null,
      speedType: s._a1 ?? null,
      frameCount: frames.length,
      frames,
    };
  }),
  audio: audio.map((a, i) => ({
    index: i,
    name: a._W,
    file: 'html5game/' + a._Z + '.ogg',
    volume: a.volume ?? null,
    preload: !!a.preload,
    group: a._11 ?? 0,
    durationSec: a.duration || null,
  })),
  objects: objects.map((o, i) => ({
    index: i,
    name: o._W,
    spriteIndex: (o._32 !== undefined && o._32 >= 0) ? o._32 : null,
    parent: o.parent ?? null,
  })),
  rooms: rooms.map(r => ({
    name: r._W,
    width: r.width, height: r.height,
    instances: (r._c4 || []).map(ins => ({
      id: ins.id,
      objectIndex: ins.index,
      objectName: objects[ins.index] ? objects[ins.index]._W : null,
      x: ins.x, y: ins.y,
      scaleX: ins.scaleX ?? 1, scaleY: ins.scaleY ?? 1,
      rotation: ins.rotation ?? 0,
      imageIndex: ins.imageIndex ?? 0,
    })),
    backgrounds: (r._64 || []).map(b => JSON.parse(JSON.stringify(b))),
  })),
  fonts: fonts.map(f => ({
    name: f._W,
    family: f._S1,
    size: f.size,
    bold: !!f.bold,
    italic: !!f._P1,
    firstChar: f.first,
    glyphCount: (f._V1 || []).length,
    glyphs: (f._V1 || []).map(g => ({
      char: g._X1, unicode: g._W1, x: g.x, y: g.y, w: g._Y1, h: g._Z1, shift: g.shift, offset: g.offset,
    })),
  })),
  sequences: seqs.map(q => ({
    name: q._W,
    length: q.length ?? null,
    fps: q._h1 ?? null,
    frameSize: q._j1 != null ? [q._j1, q._k1] : null,
  })),
  shaders: shaders.map(s => s.name),
  scriptNames,
  sharedRegions: [...rectUsers.entries()]
    .filter(([, users]) => users.length > 1)
    .map(([ri, users]) => ({ rectIndex: ri, users })),
};

// objectName su sprites/audio references già risolti a runtime nel registry output
fs.writeFileSync('/home/z/my-project/scripts/gm_raw_registry.json', JSON.stringify(out, null, 1));
console.log('OK sprites:', out.sprites.length, 'audio:', out.audio.length, 'objects:', out.objects.length,
  'fonts:', out.fonts.length, 'sequences:', out.sequences.length, 'sharedRegions:', out.sharedRegions.length);
