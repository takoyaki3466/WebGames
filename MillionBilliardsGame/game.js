"use strict";
(() => {
    // MillionBilliardsGame/src/audio.ts
    var AudioOut = class {
        constructor() {
            this.ctx = null;
            this.master = null;
            this.silencedUntil = 0;
            this.muted = false;
            this.volume = 0.7;
        }

        unlock() {
            var _a;
            if (!this.ctx) {
                const Ctor = (_a = window.AudioContext) != null ? _a : window.webkitAudioContext;
                if (!Ctor) return;
                try {
                    this.ctx = new Ctor();
                } catch (err) {
                    console.warn("[audio] unavailable", err);
                    return;
                }
                this.master = this.ctx.createGain();
                this.master.connect(this.ctx.destination);
                this.apply();
            }
            if (this.ctx.state === "suspended") void this.ctx.resume();
        }

        apply() {
            if (!this.ctx || !this.master) return;
            const silent = this.muted || performance.now() < this.silencedUntil;
            this.master.gain.setTargetAtTime(silent ? 0 : this.volume, this.ctx.currentTime, 0.01);
        }

        silence(ms) {
            this.silencedUntil = performance.now() + ms;
            this.apply();
            window.setTimeout(() => this.apply(), ms + 20);
        }

        out() {
            if (!this.ctx || !this.master || performance.now() < this.silencedUntil) return null;
            return {ctx: this.ctx, dest: this.master};
        }
    };

    // MillionBilliardsGame/src/config.ts
    var BALL_COUNT = 1e6;
    var BALL = {
        r: 1, /** centre-to-centre distance in a row; 0.2 of air between neighbours so motion reads clearly */
        spacing: 2.2
    };
    var ROW_STEP = BALL.spacing * Math.sqrt(3) / 2;
    var LATTICE_COLS = 1e3;
    var TILE = 32;
    var MARGIN = 46;
    var CUE_TRACK_INSET = 22;
    var CUE = {
        r: 3, mass: 40, // a normal ball has mass 1
        maxSpeed: 950, chargeSec: 1.1
        // 0 → full power while held
    };
    var PHYS = {
        dt: 1 / 60, // one step per frame at 60 fps; max speeds keep a step below a ball diameter
        maxStepsPerFrame: 2, // more than this and the game runs in slow motion instead of freezing
        restitution: 0.9, cushion: 0.7, rollingDecel: 180, // units/s² — strong felt, so a wave does not leave the board sliding forever
        drag: 0.9, // 1/s
        stopSpeed: 5, maxSpeed: 110, // normal balls: ≤1.9 units per step at dt=1/60, under one diameter (no tunnelling)
        /** Hard cap on simultaneously moving balls. The wave waits for capacity instead of exceeding it. */
        activeCap: 8e4, shotTimeoutSec: 24
    };
    var WAVE = {
        cell: 8, tickSec: 0.024, // time per forward hop → front speed ≈ cell / tickSec ≈ 330 units/s
        maxEnergy: 65e4, // at full power: roughly the number of balls the shot can move unaided
        minPowerEnergy: 25e3, costPerBall: 1, lossFull: 0.996, // per hop through a fully packed cell
        lossEmpty: 0.85, // per hop through an empty cell (gaps, pockets, cleared ground)
        forwardBias: 2.2, // exponent on the cosine weighting toward the travel direction
        isotropic: 0.06, // small sideways leak so the front widens into a fan
        minCellEnergy: 2.5, // below this a cell does not fire
        kickMin: 26, kickGain: 9, // kick speed = kickMin + kickGain·sqrt(energy per ball)
        kickMax: 95, kickJitter: 0.3, // radians of random spread per ball
        maxCellsPerTick: 2600
        // the front never fires more than this per tick (spreads load)
    };
    var POCKETS = {
        edgeR: 18, innerR: 13, innerGrid: 4, // 4×4 pockets sunk into the field
        mult: {edge: 1, inner: 3, core: 5}, goldMult: 10, // one pocket per shot glows gold
        suctionReach: 2.6, // × radius
        suctionAccel: 600
    };
    var BOOSTERS = {
        count: 7, r: 34, gain: 1.9
        // the front's energy is multiplied when it crosses a booster (once per shot each)
    };
    var SCORE = {
        perMoved: 1, perCollided: 1, perPocketed: 100, // × pocket multiplier
        comboMovedThreshold: 1e5, // a shot that moves this many balls keeps the combo alive
        comboStepTenths: 5, // +0.5× per combo
        varietyStepTenths: 2, // +0.2× per extra pocket that swallowed balls this shot
        varietyMaxTenths: 40, shotsPerRun: 10
    };
    var MOMENTS = [{moved: 5e4, id: "wave", label: "大波", sub: "5万球が動いた"}, {
        moved: 2e5, id: "tsunami", label: "津波", sub: "20万球が動いた"
    }, {moved: 5e5, id: "collapse", label: "盤面崩壊", sub: "50万球が動いた"}, {
        moved: 9e5, id: "million", label: "百万動乱", sub: "90万球が動いた"
    }];
    var PALETTE = [[0.98, 0.78, 0.12], // 1 yellow
        [0.12, 0.3, 0.85], // 2 blue
        [0.86, 0.14, 0.12], // 3 red
        [0.45, 0.16, 0.62], // 4 purple
        [0.98, 0.45, 0.08], // 5 orange
        [0.08, 0.55, 0.28], // 6 green
        [0.55, 0.1, 0.12], // 7 maroon
        [0.95, 0.93, 0.86]
        // ivory
    ];
    var CAMERA = {
        fov: 50, minDist: 40, maxDistFactor: 1.35, // × distance that fits the whole field
        smoothing: 2.6
        // 1/s, lower = calmer
    };

    // MillionBilliardsGame/src/field.ts
    var STRIDE = 4;
    var BallField = class {
        constructor(rng2) {
            this.rng = rng2;
            this.n = BALL_COUNT;
            /** x, z, y (height; <0 while falling), time of the last hit (for the glow) */
            this.data = new Float32Array(BALL_COUNT * STRIDE);
            this.color = new Uint8Array(BALL_COUNT * 3);
            this.vx = new Float32Array(BALL_COUNT);
            this.vz = new Float32Array(BALL_COUNT);
            this.state = new Uint8Array(BALL_COUNT);
            // field geometry
            this.cols = LATTICE_COLS;
            // field depth (z)
            /** cushion rectangle */
            this.minX = -MARGIN;
            this.minZ = -MARGIN;
            this.tileOf = new Uint16Array(BALL_COUNT);
            this.dirtyN = 0;
            // spatial hash for collisions (cell = one ball spacing; balls never overlap so a cell holds ~1)
            this.hashCell = BALL.spacing;
            this.next = new Int32Array(BALL_COUNT);
            this.cellOf = new Int32Array(BALL_COUNT);
            this.pockets = [];
            this.boosters = [];
            this.remaining = BALL_COUNT;
            const rowsGuess = Math.ceil(BALL_COUNT / LATTICE_COLS);
            this.w = LATTICE_COLS * BALL.spacing + BALL.spacing / 2;
            let rows = rowsGuess;
            for (; ;) {
                const d = (rows - 1) * ROW_STEP + 2 * BALL.r;
                this.placePockets(this.w, d);
                if (this.countSites(rows) >= BALL_COUNT) break;
                rows += 1;
            }
            this.rows = rows;
            this.d = (rows - 1) * ROW_STEP + 2 * BALL.r;
            this.maxX = this.w + MARGIN;
            this.maxZ = this.d + MARGIN;
            this.placeBoosters();
            const tilesX = Math.ceil(LATTICE_COLS / TILE);
            const tilesZ = Math.ceil(rows / TILE);
            this.tileCount = tilesX * tilesZ;
            this.tileStart = new Int32Array(this.tileCount);
            this.tileLen = new Int32Array(this.tileCount);
            this.tileBox = new Float32Array(this.tileCount * 4);
            this.tileDirty = new Uint8Array(this.tileCount);
            this.dirtyList = new Int32Array(this.tileCount);
            this.hx = Math.ceil((this.maxX - this.minX) / this.hashCell) + 2;
            this.hz = Math.ceil((this.maxZ - this.minZ) / this.hashCell) + 2;
            this.head = new Int32Array(this.hx * this.hz);
            this.wx = Math.ceil((this.maxX - this.minX) / WAVE.cell);
            this.wz = Math.ceil((this.maxZ - this.minZ) / WAVE.cell);
            this.waveCount = new Int32Array(this.wx * this.wz);
            this.fullCount = WAVE.cell * WAVE.cell / (BALL.spacing * ROW_STEP);
            this.pocketAt = new Int16Array(this.wx * this.wz);
            this.boosterAt = new Int16Array(this.wx * this.wz);
            this.indexCoarse();
            this.reset();
        }

        // ---------------------------------------------------------------- layout
        placePockets(w, d) {
            this.pockets.length = 0;
            const g = POCKETS.innerGrid;
            for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
                const core = (i === 1 || i === 2) && (j === 1 || j === 2);
                const kind = core ? "core" : "inner";
                this.pockets.push({
                    x: (i + 0.5) / g * w, z: (j + 0.5) / g * d, r: POCKETS.innerR, kind, mult: POCKETS.mult[kind]
                });
            }
            const ex = [-MARGIN * 0.62, w + MARGIN * 0.62];
            const ez = [-MARGIN * 0.62, d + MARGIN * 0.62];
            for (const x of ex) for (const z of ez) this.pockets.push({
                x, z, r: POCKETS.edgeR, kind: "edge", mult: POCKETS.mult.edge
            });
            for (const f of [0.25, 0.5, 0.75]) {
                for (const z of ez) this.pockets.push({
                    x: f * w, z, r: POCKETS.edgeR, kind: "edge", mult: POCKETS.mult.edge
                });
                for (const x of ex) this.pockets.push({
                    x, z: f * d, r: POCKETS.edgeR, kind: "edge", mult: POCKETS.mult.edge
                });
            }
        }

        placeBoosters() {
            const spots = [[0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75], [0.12, 0.12], [0.88, 0.88], [0.5, 0.5]];
            for (const [fx, fz] of spots.slice(0, BOOSTERS.count)) this.boosters.push({
                x: fx * this.w, z: fz * this.d, r: BOOSTERS.r
            });
        }

        siteX(col, row) {
            return BALL.r + col * BALL.spacing + (row & 1 ? BALL.spacing / 2 : 0);
        }

        siteZ(row) {
            return BALL.r + row * ROW_STEP;
        }

        isHole(x, z) {
            for (const p of this.pockets) {
                if (p.kind === "edge") continue;
                const hr = p.r + BALL.r + 0.6;
                if ((x - p.x) ** 2 + (z - p.z) ** 2 < hr * hr) return true;
            }
            return false;
        }

        countSites(rows) {
            let n = 0;
            for (let row = 0; row < rows; row++) for (let col = 0; col < LATTICE_COLS; col++) if (!this.isHole(this.siteX(col, row), this.siteZ(row))) n++;
            return n;
        }

        /** Puts all BALL_COUNT balls back on the lattice (start of a run, or retry). */
        reset() {
            const total = this.countSites(this.rows);
            const excess = total - BALL_COUNT;
            const tilesX = Math.ceil(LATTICE_COLS / TILE);
            let k = 0;
            let b = 0;
            for (let t = 0; t < this.tileCount; t++) {
                const tx = t % tilesX;
                const tz = Math.floor(t / tilesX);
                this.tileStart[t] = b;
                let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
                for (let lr = 0; lr < TILE; lr++) {
                    const row = tz * TILE + lr;
                    if (row >= this.rows) break;
                    for (let lc = 0; lc < TILE; lc++) {
                        const col = tx * TILE + lc;
                        if (col >= LATTICE_COLS) break;
                        const x = this.siteX(col, row);
                        const z = this.siteZ(row);
                        if (this.isHole(x, z)) continue;
                        const skip = excess > 0 && Math.floor((k + 1) * excess / total) > Math.floor(k * excess / total);
                        k++;
                        if (skip || b >= BALL_COUNT) continue;
                        const o = b * STRIDE;
                        this.data[o] = x;
                        this.data[o + 1] = z;
                        this.data[o + 2] = 0;
                        this.data[o + 3] = -1e6;
                        this.tileOf[b] = t;
                        this.paint(b, x, z);
                        if (x < x0) x0 = x;
                        if (z < z0) z0 = z;
                        if (x > x1) x1 = x;
                        if (z > z1) z1 = z;
                        b++;
                    }
                }
                this.tileLen[t] = b - this.tileStart[t];
                const q = t * 4;
                this.tileBox[q] = x0;
                this.tileBox[q + 1] = z0;
                this.tileBox[q + 2] = x1;
                this.tileBox[q + 3] = z1;
            }
            if (b !== BALL_COUNT) throw new Error(`layout produced ${b} balls instead of ${BALL_COUNT}`);
            this.vx.fill(0);
            this.vz.fill(0);
            this.state.fill(0 /* Rest */);
            this.remaining = BALL_COUNT;
            this.head.fill(-1);
            this.waveCount.fill(0);
            for (let i = 0; i < BALL_COUNT; i++) {
                const c = this.hashOf(this.data[i * STRIDE], this.data[i * STRIDE + 1]);
                this.cellOf[i] = c;
                this.next[i] = this.head[c];
                this.head[c] = i;
                this.waveCount[this.waveOfHash(c)] += 1;
            }
            this.tileDirty.fill(1);
            this.dirtyN = 0;
            for (let t = 0; t < this.tileCount; t++) this.dirtyList[this.dirtyN++] = t;
        }

        /** Colour: large diagonal bands of pool colours (readable from far away) with per-ball variation. */
        paint(i, x, z) {
            const band = Math.floor((x + z * 0.62) / 150);
            const ring = Math.floor(Math.hypot(x - this.w / 2, z - this.d * 0.5) / 260);
            let c = (band * 3 + ring * 5) % PALETTE.length;
            if (c < 0) c += PALETTE.length;
            if (this.rng() < 0.62) c = Math.floor(this.rng() * PALETTE.length);
            const p = PALETTE[c];
            const shade = 0.88 + this.rng() * 0.2;
            const o = i * 3;
            this.color[o] = Math.min(255, p[0] * shade * 255);
            this.color[o + 1] = Math.min(255, p[1] * shade * 255);
            this.color[o + 2] = Math.min(255, p[2] * shade * 255);
        }

        indexCoarse() {
            this.pocketAt.fill(-1);
            this.boosterAt.fill(-1);
            const cs = WAVE.cell;
            for (let cz = 0; cz < this.wz; cz++) for (let cx = 0; cx < this.wx; cx++) {
                const x = this.minX + (cx + 0.5) * cs;
                const z = this.minZ + (cz + 0.5) * cs;
                const c = cz * this.wx + cx;
                this.pockets.forEach((p, k) => {
                    const reach = p.r * POCKETS.suctionReach + cs;
                    if ((x - p.x) ** 2 + (z - p.z) ** 2 < reach * reach) this.pocketAt[c] = k;
                });
                this.boosters.forEach((bo, k) => {
                    if ((x - bo.x) ** 2 + (z - bo.z) ** 2 < bo.r * bo.r) this.boosterAt[c] = k;
                });
            }
        }

        // ---------------------------------------------------------------- grids
        hashOf(x, z) {
            let gx = Math.floor((x - this.minX) / this.hashCell) + 1;
            let gz = Math.floor((z - this.minZ) / this.hashCell) + 1;
            if (gx < 0) gx = 0; else if (gx >= this.hx) gx = this.hx - 1;
            if (gz < 0) gz = 0; else if (gz >= this.hz) gz = this.hz - 1;
            return gz * this.hx + gx;
        }

        waveOf(x, z) {
            let gx = Math.floor((x - this.minX) / WAVE.cell);
            let gz = Math.floor((z - this.minZ) / WAVE.cell);
            if (gx < 0) gx = 0; else if (gx >= this.wx) gx = this.wx - 1;
            if (gz < 0) gz = 0; else if (gz >= this.wz) gz = this.wz - 1;
            return gz * this.wx + gx;
        }

        /** Wave cell of a hash cell (derived from the hash cell, so counts stay exact as balls shift). */
        waveOfHash(c) {
            const gx = c % this.hx;
            const gz = c / this.hx | 0;
            return this.waveOf(this.minX + (gx - 0.5) * this.hashCell, this.minZ + (gz - 0.5) * this.hashCell);
        }

        hashRemove(i) {
            const c = this.cellOf[i];
            let p = this.head[c];
            if (p === i) {
                this.head[c] = this.next[i];
                return;
            }
            while (p >= 0) {
                const nx = this.next[p];
                if (nx === i) {
                    this.next[p] = this.next[i];
                    return;
                }
                p = nx;
            }
        }

        hashInsert(i, c) {
            this.cellOf[i] = c;
            this.next[i] = this.head[c];
            this.head[c] = i;
        }

        /** Records that ball i's render data changed this frame. */
        touch(i, x, z) {
            const t = this.tileOf[i];
            const q = t * 4;
            const box2 = this.tileBox;
            if (x < box2[q]) box2[q] = x;
            if (z < box2[q + 1]) box2[q + 1] = z;
            if (x > box2[q + 2]) box2[q + 2] = x;
            if (z > box2[q + 3]) box2[q + 3] = z;
            if (!this.tileDirty[t]) {
                this.tileDirty[t] = 1;
                this.dirtyList[this.dirtyN++] = t;
            }
        }

        /** Called by the renderer after it uploaded the dirty tiles. */
        clearDirty() {
            for (let k = 0; k < this.dirtyN; k++) this.tileDirty[this.dirtyList[k]] = 0;
            this.dirtyN = 0;
        }

        /** Field centre, handy for cameras. */
        get cx() {
            return this.w / 2;
        }

        get cz() {
            return this.d / 2;
        }
    };

    // MillionBilliardsGame/src/balls-gl.ts
    var VS = `
attribute vec4 aBall;   // x, z, y, lastHitTime
attribute vec3 aColor;
uniform mat4 uViewProj;
uniform float uScale;     // pixels per world unit at distance 1
uniform float uMaxSize;
uniform float uTime;
uniform float uGlow;
uniform vec2 uFog;
varying vec3 vColor;
varying float vGlow;
varying float vFog;
varying float vSize;
void main() {
  if (aBall.z < -500.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vec4 clip = uViewProj * vec4(aBall.x, aBall.z + 1.0, aBall.y, 1.0);
  gl_Position = clip;
  float size = 2.0 * uScale / max(clip.w, 0.001);
  vSize = size;
  gl_PointSize = clamp(size, 1.0, uMaxSize);
  vGlow = uGlow * exp(-(uTime - aBall.w) * 3.0);
  vColor = aColor;
  vFog = clamp((clip.w - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
}`;
    var FS = `
precision mediump float;
uniform vec3 uLightV;   // light direction in view space
uniform vec3 uFogColor;
varying vec3 vColor;
varying float vGlow;
varying float vFog;
varying float vSize;
void main() {
  vec3 col;
  if (vSize > 2.5) {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    p.y = -p.y;
    float d2 = dot(p, p);
    if (d2 > 1.0) discard;
    vec3 n = vec3(p, sqrt(1.0 - d2));
    float diff = max(dot(n, uLightV), 0.0);
    vec3 h = normalize(uLightV + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, h), 0.0), 48.0);
    float rim = smoothstep(0.55, 1.0, d2); // darker edge = contact shadow between neighbours
    col = vColor * (0.22 + 0.85 * diff) * (1.0 - 0.35 * rim) + vec3(spec * 0.75);
  } else {
    col = vColor * 0.78; // distant LOD: average shade, no sphere maths
  }
  col = mix(col, vec3(1.0, 0.86, 0.55), min(vGlow, 1.0) * 0.45) + vGlow * vec3(0.22, 0.14, 0.04);
  gl_FragColor = vec4(mix(col, uFogColor, vFog), 1.0);
}`;
    var BallRenderer = class {
        constructor(gl2, field2) {
            this.gl = gl2;
            this.field = field2;
            /** last frame's numbers (debug HUD / tests) */
            this.stats = {tilesDrawn: 0, ranges: 0, uploadedTiles: 0, uploadedBytes: 0};
            this.planes = new Float32Array(20);
            const sh = (type, src) => {
                const s = gl2.createShader(type);
                gl2.shaderSource(s, src);
                gl2.compileShader(s);
                if (!gl2.getShaderParameter(s, gl2.COMPILE_STATUS)) throw new Error(`ball shader: ${gl2.getShaderInfoLog(s)}`);
                return s;
            };
            const p = gl2.createProgram();
            gl2.attachShader(p, sh(gl2.VERTEX_SHADER, VS));
            gl2.attachShader(p, sh(gl2.FRAGMENT_SHADER, FS));
            gl2.bindAttribLocation(p, 0, "aBall");
            gl2.bindAttribLocation(p, 1, "aColor");
            gl2.linkProgram(p);
            if (!gl2.getProgramParameter(p, gl2.LINK_STATUS)) throw new Error(`ball program: ${gl2.getProgramInfoLog(p)}`);
            this.prog = p;
            this.u = Object.fromEntries(["uViewProj", "uScale", "uMaxSize", "uTime", "uGlow", "uFog", "uLightV", "uFogColor"].map((n) => [n, gl2.getUniformLocation(p, n)]));
            this.buf = gl2.createBuffer();
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.buf);
            gl2.bufferData(gl2.ARRAY_BUFFER, field2.data, gl2.DYNAMIC_DRAW);
            this.cbuf = gl2.createBuffer();
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.cbuf);
            gl2.bufferData(gl2.ARRAY_BUFFER, field2.color, gl2.STATIC_DRAW);
            const range = gl2.getParameter(gl2.ALIASED_POINT_SIZE_RANGE);
            this.maxPoint = Math.max(1, range ? range[1] : 64);
            this.visible = new Int32Array(field2.tileCount);
            this.sortTmp = new Int32Array(field2.tileCount);
            field2.clearDirty();
        }

        /** Full re-upload (after a retry rebuilt the board). */
        uploadAll() {
            const gl2 = this.gl;
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.buf);
            gl2.bufferSubData(gl2.ARRAY_BUFFER, 0, this.field.data);
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.cbuf);
            gl2.bufferSubData(gl2.ARRAY_BUFFER, 0, this.field.color);
            this.field.clearDirty();
        }

        /** Uploads changed tiles, merging neighbours into single bufferSubData calls. */
        upload() {
            const f = this.field;
            const n = f.dirtyN;
            this.stats.uploadedTiles = n;
            this.stats.uploadedBytes = 0;
            if (n === 0) return;
            const gl2 = this.gl;
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.buf);
            const list = this.sortTmp.subarray(0, n);
            list.set(f.dirtyList.subarray(0, n));
            list.sort();
            let k = 0;
            while (k < n) {
                const t02 = list[k];
                let t1 = t02;
                while (k + 1 < n && list[k + 1] === t1 + 1) {
                    k++;
                    t1++;
                }
                const start = f.tileStart[t02];
                const end = f.tileStart[t1] + f.tileLen[t1];
                gl2.bufferSubData(gl2.ARRAY_BUFFER, start * STRIDE * 4, f.data.subarray(start * STRIDE, end * STRIDE));
                this.stats.uploadedBytes += (end - start) * STRIDE * 4;
                k++;
            }
            f.clearDirty();
        }

        draw(cam2, heightPx, time, s) {
            const gl2 = this.gl;
            const f = this.field;
            this.upload();
            const m = cam2.viewProj;
            const planes = this.planes;
            const rows = [[m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]], [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]], [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]], [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]], [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]]];
            for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) planes[i * 4 + j] = rows[i][j];
            let vn = 0;
            const box2 = f.tileBox;
            for (let t = 0; t < f.tileCount; t++) {
                const q = t * 4;
                const x0 = box2[q] - 1, z0 = box2[q + 1] - 1, x1 = box2[q + 2] + 1, z1 = box2[q + 3] + 1;
                let inside = true;
                for (let p = 0; p < 5 && inside; p++) {
                    const a = planes[p * 4], b = planes[p * 4 + 1], c = planes[p * 4 + 2], d = planes[p * 4 + 3];
                    const px = a >= 0 ? x1 : x0;
                    const py = b >= 0 ? 2 : 0;
                    const pz = c >= 0 ? z1 : z0;
                    if (a * px + b * py + c * pz + d < 0) inside = false;
                }
                if (inside) this.visible[vn++] = t;
            }
            this.stats.tilesDrawn = vn;
            gl2.useProgram(this.prog);
            gl2.disable(gl2.BLEND);
            gl2.enable(gl2.DEPTH_TEST);
            gl2.depthMask(true);
            const u = this.u;
            gl2.uniformMatrix4fv(u.uViewProj, false, cam2.viewProj);
            gl2.uniform1f(u.uScale, heightPx / (2 * Math.tan(cam2.fov / 2)));
            gl2.uniform1f(u.uMaxSize, this.maxPoint);
            gl2.uniform1f(u.uTime, time);
            gl2.uniform1f(u.uGlow, s.glow ? 1 : 0);
            gl2.uniform2f(u.uFog, s.fog[0], s.fog[1]);
            gl2.uniform3fv(u.uFogColor, s.fogColor);
            const v = cam2.view;
            const [lx, ly, lz] = s.lightDir;
            const vx = v[0] * lx + v[4] * ly + v[8] * lz;
            const vy = v[1] * lx + v[5] * ly + v[9] * lz;
            const vz = v[2] * lx + v[6] * ly + v[10] * lz;
            const ll = Math.hypot(vx, vy, vz) || 1;
            gl2.uniform3f(u.uLightV, vx / ll, vy / ll, vz / ll);
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.buf);
            gl2.enableVertexAttribArray(0);
            gl2.vertexAttribPointer(0, 4, gl2.FLOAT, false, 0, 0);
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.cbuf);
            gl2.enableVertexAttribArray(1);
            gl2.vertexAttribPointer(1, 3, gl2.UNSIGNED_BYTE, true, 0, 0);
            let ranges = 0;
            let k = 0;
            while (k < vn) {
                const t02 = this.visible[k];
                let t1 = t02;
                while (k + 1 < vn && this.visible[k + 1] === t1 + 1) {
                    k++;
                    t1++;
                }
                const start = f.tileStart[t02];
                const end = f.tileStart[t1] + f.tileLen[t1];
                gl2.drawArrays(gl2.POINTS, start, end - start);
                ranges++;
                k++;
            }
            this.stats.ranges = ranges;
        }

        dispose() {
            this.gl.deleteBuffer(this.buf);
            this.gl.deleteBuffer(this.cbuf);
            this.gl.deleteProgram(this.prog);
        }
    };

    // MillionBilliardsGame/src/camera-rig.ts
    var CameraRig = class {
        constructor(fieldW, fieldD) {
            this.fieldW = fieldW;
            this.fieldD = fieldD;
            this.mode = "overview";
            this.autoFollow = true;
            this.shakeEnabled = true;
            this.want = {tx: 0, tz: 0, dist: 100, yaw: 0, pitch: 0.6};
            /** player adjustments */
            this.zoom = 1;
            this.yawOffset = 0;
            this.pitchOffset = 0;
            this.panX = 0;
            this.panZ = 0;
            this.shake = 0;
            this.aspect = 1;
            const half = CAMERA.fov * Math.PI / 360;
            this.fitDist = Math.max(fieldW, fieldD) * 0.62 / Math.tan(half);
            this.cur = {tx: fieldW / 2, tz: fieldD / 2, dist: this.fitDist * 1.25, yaw: 0, pitch: 1.05};
        }

        setMode(m) {
            if (m === this.mode) return;
            this.mode = m;
            this.panX = 0;
            this.panZ = 0;
            this.yawOffset = 0;
            this.pitchOffset = 0;
            if (m !== "aim") this.zoom = 1;
        }

        addShake(amount) {
            if (this.shakeEnabled) this.shake = Math.min(14, this.shake + amount);
        }

        /** Mode goals. `aim` = cue position + aim direction; `front` = wave centre and spread. */
        update(dt, cam2, aim, front) {
            const w = this.want;
            const W = this.fieldW, D = this.fieldD;
            const aimYaw = Math.atan2(-aim.dx, -aim.dz);
            if (this.autoFollow || this.mode === "aim") {
                switch (this.mode) {
                    case "overview":
                    case "result":
                        w.tx = W / 2;
                        w.tz = D / 2;
                        w.dist = this.fitDist;
                        w.yaw = aimYaw;
                        w.pitch = 0.95;
                        break;
                    case "aim": {
                        const narrow = this.aspect < 1 ? 1 / this.aspect : 1;
                        w.tx = aim.x + aim.dx * 110;
                        w.tz = aim.z + aim.dz * 110;
                        w.dist = 175 * Math.min(2, narrow * 0.9 + 0.1);
                        w.yaw = aimYaw;
                        w.pitch = this.aspect < 1 ? 0.5 : 0.3;
                        break;
                    }
                    case "chain":
                        if (front.active) {
                            w.tx = front.x;
                            w.tz = front.z;
                            w.dist = Math.min(this.fitDist, 260 + front.spread * 1.05);
                        }
                        w.yaw = aimYaw;
                        w.pitch = 0.78;
                        break;
                }
            }
            const k = 1 - Math.exp(-dt * (this.mode === "chain" ? CAMERA.smoothing * 0.8 : CAMERA.smoothing));
            const c = this.cur;
            c.tx += (w.tx + this.panX - c.tx) * k;
            c.tz += (w.tz + this.panZ - c.tz) * k;
            const maxDist = this.fitDist * CAMERA.maxDistFactor;
            const dWant = Math.max(CAMERA.minDist, Math.min(maxDist, w.dist * this.zoom));
            c.dist += (dWant - c.dist) * k;
            let dy = w.yaw + this.yawOffset - c.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            c.yaw += dy * k;
            const pWant = Math.max(0.12, Math.min(1.45, w.pitch + this.pitchOffset));
            c.pitch += (pWant - c.pitch) * k;
            const cp = Math.cos(c.pitch);
            cam2.target = [c.tx, 0, c.tz];
            cam2.eye = [c.tx + Math.sin(c.yaw) * cp * c.dist, Math.sin(c.pitch) * c.dist + 2, c.tz + Math.cos(c.yaw) * cp * c.dist];
            if (this.shake > 0.01) {
                const s = this.shake;
                cam2.eye[0] += (Math.random() - 0.5) * s;
                cam2.eye[1] += (Math.random() - 0.5) * s * 0.6;
                cam2.eye[2] += (Math.random() - 0.5) * s;
                this.shake *= Math.exp(-dt * 7);
            }
            cam2.fov = CAMERA.fov * Math.PI / 180;
            cam2.near = Math.max(0.5, c.dist * 0.01);
            cam2.far = c.dist * 4 + 6e3;
        }

        /** Player input */
        zoomBy(factor) {
            this.zoom = Math.max(0.15, Math.min(8, this.zoom * factor));
        }

        orbit(dyaw, dpitch) {
            this.yawOffset += dyaw;
            this.pitchOffset = Math.max(-1, Math.min(1, this.pitchOffset + dpitch));
        }

        /** Pans along the screen: `right` to the right, `forward` away from the viewer (scaled by distance). */
        pan(right, forward) {
            const s = this.cur.dist * 18e-4;
            const yaw = this.cur.yaw;
            this.panX += (Math.cos(yaw) * right - Math.sin(yaw) * forward) * s;
            this.panZ += (-Math.sin(yaw) * right - Math.cos(yaw) * forward) * s;
        }

        get distance() {
            return this.cur.dist;
        }
    };

    // MillionBilliardsGame/src/commentary.ts
    var COMMENTARY = {
        start: ["本日の盤面、100万球。数え直しましたが100万球でした。", "台の端が見えません。仕様です。", "ご覧ください、100万個の玉が整列しています。整列できるのは今だけです。", "準備完了。玉たちはまだ何も知りません。"],
        aimHint: ["光る輪（BOOST）を通すと、衝撃波が1.9倍になります。", "金色の光の柱が今回のボーナスポケット。×10です。", "玉が密集している方へ打つと、波は遠くまで届きます。", "隙間や穴の多い場所では、波がすぐに弱まります。", "台の外周ならどこからでも打てます。←→で移動。", "中央の×5ポケットは、波をまっすぐ通すと飲み込みが早いです。"],
        charge: ["パワー最大。台が少し身構えました。", "キューがしなっています。気のせいかもしれません。", "満タンです。責任も満タンです。"],
        shotWeak: ["控えめな一打。100万球は少し安心しています。", "そっと打ちました。玉たちは様子見です。", "小手調べですね。"],
        shotStrong: ["渾身の一打！", "打ったー！", "いったー！ 玉の大群に一直線！", "フルパワー！ 台が揺れています！"],
        impact: ["接触！ ここから波が広がります。", "最初の一球が押されました。あとは連鎖です。", "衝突開始。もう誰にも止められません。"],
        booster: ["BOOST通過！ 波が加速！", "ブースター点火！ 衝撃波1.9倍！", "光の輪を抜けた！ まだまだ伸びる！"],
        wave: ["5万球が動きました。これはもう波です。", "大波です！ 盤面がうねっています！"],
        tsunami: ["津波です！ 20万球が一斉に動いています！", "20万球突破！ 実況席まで揺れています！"],
        collapse: ["盤面崩壊！ 50万球が動きました！", "半分です！ 台の半分が動きました！"],
        million: ["百万動乱！ 90万球以上が動きました！", "前代未聞！ ほぼ全部動きました！ ほぼ全部です！"],
        pocketRush: ["ポケットに玉がなだれ込んでいます！", "ポケットが追いつきません！", "飲み込む、飲み込む、まだ飲み込む！"],
        gold: ["金のポケットに入った！ ×10！", "ゴールド・ポケット直撃！", "金色の柱に玉が吸い込まれていきます！"],
        scratch: ["手球もポケットに入りました。手球も玉なので。", "スクラッチ。ペナルティはありません。気持ちの問題です。"],
        miss: ["……当たりませんでした。100万球あるのに。", "空振りです。逆にすごい。", "外周を一周しただけでした。景色は良かったです。"],
        smallEnd: ["静かな一打でした。", "まだ肩慣らしです。", "玉たちが首をかしげています。"],
        bigEnd: ["なんという一打！", "盤面の形が変わりました。", "今の、もう一回見たいですね。", "これが100万球ビリヤードです。"],
        longChain: ["連鎖が台の端まで届きました！", "波が遠くまで旅をしました。", "長い長い連鎖でした。"],
        combo: ["コンボ継続！ 倍率が上がります！", "連続大波！ コンボ倍率アップ！", "まだ続く！ コンボです！"],
        comboBreak: ["コンボが途切れました。10万球動かすと再開です。", "コンボ終了。次の大波に期待しましょう。"],
        record: ["自己ベスト更新！", "記録更新です！ 今の一打は歴史に残ります！", "新記録！ 実況席がざわついています！"],
        lastShot: ["いよいよ最後の一打です。", "ラストショット。悔いのないように。", "残り1球……ではなく残り1打です。"],
        runEnd: ["全ショット終了！ お疲れさまでした！", "ゲームセット！ 盤面は元には戻りません（Rで戻ります）。", "終了です。玉たちは疲れています。"],
        retry: ["盤面リセット！ 100万球、整列し直しました。", "新しい台です。また100万球です。", "もう一度。玉たちは何も覚えていません。"],
        pause: ["一時停止中。玉も一時停止しています。", "タイム。玉たちも休憩中です。"],
        idle: ["……打たないんですか？", "100万球が待っています。", "玉たちがそわそわしています。", "狙いはゆっくりでも大丈夫です。玉は逃げません。"]
    };

    // MillionBilliardsGame/src/errors.ts
    function installErrorOverlay(gameName) {
        const show = (msg) => {
            let box2 = document.getElementById("game-error");
            if (!box2) {
                box2 = document.createElement("div");
                box2.id = "game-error";
                box2.style.cssText = "position:fixed;left:8px;bottom:8px;max-width:70vw;z-index:99999;background:#300;color:#fbb;font:12px monospace;padding:8px;border:1px solid #f66;white-space:pre-wrap";
                box2.title = "クリックで閉じる";
                box2.addEventListener("click", () => box2 == null ? void 0 : box2.remove());
                document.body.appendChild(box2);
            }
            box2.textContent = `[${gameName}] エラー: ${msg}`;
        };
        window.addEventListener("error", (e) => show(e.message));
        window.addEventListener("unhandledrejection", (e) => show(String(e.reason)));
    }

    function debugEnabled() {
        return new URLSearchParams(location.search).get("debug") === "1";
    }

    // MillionBilliardsGame/src/math3d.ts
    var v3 = {
        add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
        sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
        scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
        dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
        len: (a) => Math.hypot(a[0], a[1], a[2]),
        norm: (a) => {
            const l = Math.hypot(a[0], a[1], a[2]) || 1;
            return [a[0] / l, a[1] / l, a[2] / l];
        },
        lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    };

    function m4() {
        const m = new Float32Array(16);
        m[0] = m[5] = m[10] = m[15] = 1;
        return m;
    }

    function perspective(out, fovy, aspect, near, far) {
        const f = 1 / Math.tan(fovy / 2);
        out.fill(0);
        out[0] = f / aspect;
        out[5] = f;
        out[10] = (far + near) / (near - far);
        out[11] = -1;
        out[14] = 2 * far * near / (near - far);
        return out;
    }

    function lookAt(out, eye, target, up) {
        const z = v3.norm(v3.sub(eye, target));
        let x = v3.cross(up, z);
        if (v3.len(x) < 1e-6) x = v3.cross([0, 0, 1], z);
        x = v3.norm(x);
        const y = v3.cross(z, x);
        out[0] = x[0];
        out[1] = y[0];
        out[2] = z[0];
        out[3] = 0;
        out[4] = x[1];
        out[5] = y[1];
        out[6] = z[1];
        out[7] = 0;
        out[8] = x[2];
        out[9] = y[2];
        out[10] = z[2];
        out[11] = 0;
        out[12] = -v3.dot(x, eye);
        out[13] = -v3.dot(y, eye);
        out[14] = -v3.dot(z, eye);
        out[15] = 1;
        return out;
    }

    function mul(out, a, b) {
        const r = new Float32Array(16);
        for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3];
        out.set(r);
        return out;
    }

    function invert(out, m) {
        const a = m;
        const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
        const b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
        const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
        const b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13],
            b11 = a[10] * a[15] - a[11] * a[14];
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (!det) return null;
        det = 1 / det;
        const r = new Float32Array(16);
        r[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
        r[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
        r[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
        r[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
        r[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
        r[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
        r[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
        r[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
        r[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
        r[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
        r[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
        r[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
        r[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
        r[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
        r[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
        r[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
        out.set(r);
        return out;
    }

    function fromTRS(out, t, q, s = [1, 1, 1]) {
        const [x, y, z, w] = q;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2,
            wz = w * z2;
        out[0] = (1 - (yy + zz)) * s[0];
        out[1] = (xy + wz) * s[0];
        out[2] = (xz - wy) * s[0];
        out[3] = 0;
        out[4] = (xy - wz) * s[1];
        out[5] = (1 - (xx + zz)) * s[1];
        out[6] = (yz + wx) * s[1];
        out[7] = 0;
        out[8] = (xz + wy) * s[2];
        out[9] = (yz - wx) * s[2];
        out[10] = (1 - (xx + yy)) * s[2];
        out[11] = 0;
        out[12] = t[0];
        out[13] = t[1];
        out[14] = t[2];
        out[15] = 1;
        return out;
    }

    function normalMatrix(m) {
        var _a;
        const inv = (_a = invert(new Float32Array(16), m)) != null ? _a : m4();
        return new Float32Array([inv[0], inv[4], inv[8], inv[1], inv[5], inv[9], inv[2], inv[6], inv[10]]);
    }

    function transformPoint(m, p) {
        const x = p[0], y = p[1], z = p[2];
        return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
    }

    var quat = {
        identity: () => [0, 0, 0, 1],
        axisAngle: (axis, rad) => {
            const a = v3.norm(axis);
            const s = Math.sin(rad / 2);
            return [a[0] * s, a[1] * s, a[2] * s, Math.cos(rad / 2)];
        },
        mul: (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]],
        euler: (x, y, z) => quat.mul(quat.mul(quat.axisAngle([0, 1, 0], y), quat.axisAngle([1, 0, 0], x)), quat.axisAngle([0, 0, 1], z)),
        rotate: (q, v) => {
            const [x, y, z, w] = q;
            const ix = w * v[0] + y * v[2] - z * v[1];
            const iy = w * v[1] + z * v[0] - x * v[2];
            const iz = w * v[2] + x * v[1] - y * v[0];
            const iw = -x * v[0] - y * v[1] - z * v[2];
            return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
        },
        normalize: (q) => {
            const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
            return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
        },
        slerp: (a, b, t) => {
            let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
            let bb = b;
            if (cos < 0) {
                cos = -cos;
                bb = [-b[0], -b[1], -b[2], -b[3]];
            }
            if (cos > 0.9995) return quat.normalize([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
            const th = Math.acos(cos);
            const s = Math.sin(th);
            const wa = Math.sin((1 - t) * th) / s;
            const wb = Math.sin(t * th) / s;
            return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
        }
    };

    // MillionBilliardsGame/src/gl.ts
    var VS2 = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; attribute vec3 aColor;
attribute vec3 aIPos; attribute vec4 aIQuat; attribute vec3 aIScale; attribute vec4 aIColor;
uniform mat4 uModel; uniform mat4 uViewProj; uniform mat3 uNormalMat;
varying vec3 vN; varying vec3 vW; varying vec2 vUV; varying vec4 vCol;
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 p = aIPos + qrot(aIQuat, aPos * aIScale);
  vec3 n = qrot(aIQuat, aNormal / aIScale);
  vec4 w = uModel * vec4(p, 1.0);
  vW = w.xyz;
  vN = uNormalMat * n;
  vUV = aUV;
  vCol = vec4(aColor, 1.0) * aIColor;
  gl_Position = uViewProj * w;
}`;
    var FS2 = `
precision mediump float;
varying vec3 vN; varying vec3 vW; varying vec2 vUV; varying vec4 vCol;
uniform vec4 uColor; uniform sampler2D uTex; uniform float uUseTex; uniform float uUnlit;
uniform vec3 uLightDir; uniform vec3 uLightColor; uniform vec3 uSky; uniform vec3 uGround;
uniform vec3 uEye; uniform float uSpec; uniform float uShin; uniform vec3 uEmissive; uniform float uToon;
uniform vec3 uFogColor; uniform vec2 uFog;
void main() {
  vec4 base = uColor * vCol;
  if (uUseTex > 0.5) base *= texture2D(uTex, vUV);
  if (base.a < 0.01) discard;
  vec3 col;
  if (uUnlit > 0.5) {
    col = base.rgb;
  } else {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float d = max(dot(n, uLightDir), 0.0);
    if (uToon > 0.5) d = smoothstep(0.0, 0.08, d - 0.2) * 0.55 + smoothstep(0.0, 0.08, d - 0.62) * 0.45;
    vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);
    vec3 v = normalize(uEye - vW);
    vec3 h = normalize(uLightDir + v);
    float s = pow(max(dot(n, h), 0.0), uShin) * uSpec;
    if (uToon > 0.5) s = step(0.5, s) * uSpec;
    col = base.rgb * (amb + uLightColor * d) + s * uLightColor;
  }
  col += uEmissive;
  if (uFog.y > 0.0) {
    float f = clamp((length(vW - uEye) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
    col = mix(col, uFogColor, f);
  }
  gl_FragColor = vec4(col, base.a);
}`;
    var LOC = {aPos: 0, aNormal: 1, aUV: 2, aColor: 3, aIPos: 4, aIQuat: 5, aIScale: 6, aIColor: 7};
    var INST_FLOATS = 14;
    var Mesh = class {
        constructor(r, g, dynamic = false) {
            this.r = r;
            this.dynamic = dynamic;
            const gl2 = r.gl;
            const usage = dynamic ? gl2.DYNAMIC_DRAW : gl2.STATIC_DRAW;
            const mk = (data) => {
                const b = gl2.createBuffer();
                gl2.bindBuffer(gl2.ARRAY_BUFFER, b);
                gl2.bufferData(gl2.ARRAY_BUFFER, data, usage);
                return b;
            };
            this.vbo = mk(new Float32Array(g.pos));
            this.nbo = mk(new Float32Array(g.nrm));
            this.tbo = mk(new Float32Array(g.uv.length ? g.uv : new Array(g.pos.length / 3 * 2).fill(0)));
            this.cbo = g.col ? mk(new Float32Array(g.col)) : null;
            this.ibo = gl2.createBuffer();
            this.vertexCount = g.pos.length / 3;
            this.count = g.idx.length;
            this.indexType = gl2.UNSIGNED_SHORT;
            this.uploadIndices(g.idx);
        }

        uploadIndices(idx) {
            const gl2 = this.r.gl;
            const big = this.vertexCount > 65535;
            if (big && !this.r.uint32) throw new Error("mesh too large for this WebGL implementation");
            gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, this.ibo);
            gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(idx) : new Uint16Array(idx), this.dynamic ? gl2.DYNAMIC_DRAW : gl2.STATIC_DRAW);
            this.indexType = big ? gl2.UNSIGNED_INT : gl2.UNSIGNED_SHORT;
            this.count = idx.length;
        }

        /** Replace all vertex data (dynamic meshes such as cables). Buffers grow as needed. */
        update(g) {
            const gl2 = this.r.gl;
            this.vertexCount = g.vertexCount;
            const put = (b, d) => {
                gl2.bindBuffer(gl2.ARRAY_BUFFER, b);
                gl2.bufferData(gl2.ARRAY_BUFFER, d, gl2.DYNAMIC_DRAW);
            };
            put(this.vbo, g.pos);
            put(this.nbo, g.nrm);
            if (g.uv) put(this.tbo, g.uv); else put(this.tbo, new Float32Array(g.vertexCount * 2));
            if (g.col && this.cbo) put(this.cbo, g.col);
            gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, this.ibo);
            gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, g.idx, gl2.DYNAMIC_DRAW);
            this.indexType = g.idx instanceof Uint32Array ? gl2.UNSIGNED_INT : gl2.UNSIGNED_SHORT;
            this.count = g.indexCount;
        }

        dispose() {
            const gl2 = this.r.gl;
            [this.vbo, this.nbo, this.tbo, this.ibo, this.cbo].forEach((b) => b && gl2.deleteBuffer(b));
        }
    };
    var Instances = class {
        constructor(r, capacity) {
            this.r = r;
            this.capacity = capacity;
            this.count = 0;
            this.data = new Float32Array(capacity * INST_FLOATS);
            this.buffer = r.gl.createBuffer();
        }

        set(i, x, y, z, qx, qy, qz, qw, sx, sy, sz, r, g, b, a) {
            if (i >= this.capacity) this.grow(Math.max(i + 1, this.capacity * 2));
            const o = i * INST_FLOATS;
            const d = this.data;
            d[o] = x;
            d[o + 1] = y;
            d[o + 2] = z;
            d[o + 3] = qx;
            d[o + 4] = qy;
            d[o + 5] = qz;
            d[o + 6] = qw;
            d[o + 7] = sx;
            d[o + 8] = sy;
            d[o + 9] = sz;
            d[o + 10] = r;
            d[o + 11] = g;
            d[o + 12] = b;
            d[o + 13] = a;
        }

        grow(n) {
            const next = new Float32Array(n * INST_FLOATS);
            next.set(this.data);
            this.data = next;
            this.capacity = n;
        }

        upload() {
            const gl2 = this.r.gl;
            gl2.bindBuffer(gl2.ARRAY_BUFFER, this.buffer);
            gl2.bufferData(gl2.ARRAY_BUFFER, this.data.subarray(0, this.count * INST_FLOATS), gl2.DYNAMIC_DRAW);
        }

        dispose() {
            this.r.gl.deleteBuffer(this.buffer);
        }
    };
    var Camera = class {
        constructor() {
            this.eye = [0, 10, 10];
            this.target = [0, 0, 0];
            this.up = [0, 1, 0];
            this.fov = 45 * Math.PI / 180;
            this.near = 1;
            this.far = 5e3;
            this.aspect = 1;
            this.view = m4();
            this.proj = m4();
            this.viewProj = m4();
            this.inv = m4();
        }

        update() {
            lookAt(this.view, this.eye, this.target, this.up);
            perspective(this.proj, this.fov, this.aspect, this.near, this.far);
            mul(this.viewProj, this.proj, this.view);
            invert(this.inv, this.viewProj);
        }

        /** Ray through a CSS-pixel position of a canvas of size w×h. */
        ray(sx, sy, w, h) {
            const nx = sx / w * 2 - 1;
            const ny = 1 - sy / h * 2;
            const a = transformPoint(this.inv, [nx, ny, -1]);
            const b = transformPoint(this.inv, [nx, ny, 1]);
            const p0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
            const p1 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
            return {o: p0, d: v3.norm(v3.sub(p1, p0))};
        }

        /** World → CSS pixels. `behind` is true when the point is behind the camera. */
        project(p, w, h) {
            const c = transformPoint(this.viewProj, p);
            if (c[3] <= 0) return {x: 0, y: 0, behind: true};
            return {x: (c[0] / c[3] * 0.5 + 0.5) * w, y: (1 - (c[1] / c[3] * 0.5 + 0.5)) * h, behind: false};
        }
    };
    var Renderer = class _Renderer {
        constructor(gl2) {
            this.camera = null;
            this.identity = m4();
            this.identityN = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
            this.lost = false;
            this.forceNoInstancing = false;
            this.gl = gl2;
            this.isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl2 instanceof WebGL2RenderingContext;
            if (this.isGL2) {
                const g2 = gl2;
                this.uint32 = true;
                this.inst = {
                    divisor: (l, d) => g2.vertexAttribDivisor(l, d),
                    drawElementsInstanced: (m, c, t, o, n) => g2.drawElementsInstanced(m, c, t, o, n)
                };
            } else {
                this.uint32 = !!gl2.getExtension("OES_element_index_uint");
                const ext = gl2.getExtension("ANGLE_instanced_arrays");
                this.inst = ext ? {
                    divisor: (l, d) => ext.vertexAttribDivisorANGLE(l, d),
                    drawElementsInstanced: (m, c, t, o, n) => ext.drawElementsInstancedANGLE(m, c, t, o, n)
                } : null;
            }
            this.prog = this.compile(VS2, FS2);
            const names = ["uModel", "uViewProj", "uNormalMat", "uColor", "uTex", "uUseTex", "uUnlit", "uLightDir", "uLightColor", "uSky", "uGround", "uEye", "uSpec", "uShin", "uEmissive", "uToon", "uFogColor", "uFog"];
            this.u = Object.fromEntries(names.map((n) => [n, gl2.getUniformLocation(this.prog, n)]));
            gl2.useProgram(this.prog);
            gl2.enable(gl2.DEPTH_TEST);
            gl2.depthFunc(gl2.LEQUAL);
            gl2.enable(gl2.CULL_FACE);
            const tex = gl2.createTexture();
            gl2.bindTexture(gl2.TEXTURE_2D, tex);
            gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA, 1, 1, 0, gl2.RGBA, gl2.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
            this.white = tex;
            gl2.uniform1i(this.u.uTex, 0);
        }

        static create(canvas2, opts = {}) {
            var _a;
            const attrs = {
                antialias: (_a = opts.antialias) != null ? _a : true,
                alpha: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false
            };
            let gl2 = null;
            const forced = opts.forceWebGL1 || new URLSearchParams(location.search).get("webgl") === "1";
            if (!forced) gl2 = canvas2.getContext("webgl2", attrs);
            if (!gl2) gl2 = canvas2.getContext("webgl", attrs) || canvas2.getContext("experimental-webgl", attrs);
            if (!gl2) return null;
            const r = new _Renderer(gl2);
            r.forceNoInstancing = new URLSearchParams(location.search).get("inst") === "0";
            return r;
        }

        get instancing() {
            return !!this.inst && !this.forceNoInstancing;
        }

        compile(vs, fs) {
            const gl2 = this.gl;
            const sh = (type, src) => {
                const s = gl2.createShader(type);
                gl2.shaderSource(s, src);
                gl2.compileShader(s);
                if (!gl2.getShaderParameter(s, gl2.COMPILE_STATUS)) throw new Error(`shader compile failed: ${gl2.getShaderInfoLog(s)}`);
                return s;
            };
            const p = gl2.createProgram();
            gl2.attachShader(p, sh(gl2.VERTEX_SHADER, vs));
            gl2.attachShader(p, sh(gl2.FRAGMENT_SHADER, fs));
            for (const [name, loc] of Object.entries(LOC)) gl2.bindAttribLocation(p, loc, name);
            gl2.linkProgram(p);
            if (!gl2.getProgramParameter(p, gl2.LINK_STATUS)) throw new Error(`program link failed: ${gl2.getProgramInfoLog(p)}`);
            return p;
        }

        resize(canvas2, w, h, dpr) {
            canvas2.width = Math.max(1, Math.round(w * dpr));
            canvas2.height = Math.max(1, Math.round(h * dpr));
            canvas2.style.width = `${w}px`;
            canvas2.style.height = `${h}px`;
            this.gl.viewport(0, 0, canvas2.width, canvas2.height);
        }

        begin(camera, lights, clear) {
            var _a, _b;
            const gl2 = this.gl;
            this.camera = camera;
            gl2.useProgram(this.prog);
            gl2.clearColor(clear[0], clear[1], clear[2], 1);
            gl2.depthMask(true);
            gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);
            const u = this.u;
            gl2.uniformMatrix4fv(u.uViewProj, false, camera.viewProj);
            const ld = v3.norm(lights.dir);
            gl2.uniform3f(u.uLightDir, ld[0], ld[1], ld[2]);
            gl2.uniform3fv(u.uLightColor, lights.color);
            gl2.uniform3fv(u.uSky, lights.sky);
            gl2.uniform3fv(u.uGround, lights.ground);
            gl2.uniform3fv(u.uEye, camera.eye);
            gl2.uniform3fv(u.uFogColor, (_a = lights.fogColor) != null ? _a : [0, 0, 0]);
            gl2.uniform2fv(u.uFog, (_b = lights.fog) != null ? _b : [0, 0]);
        }

        applyOpts(o) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const gl2 = this.gl;
            const u = this.u;
            const model = (_a = o.model) != null ? _a : this.identity;
            gl2.uniformMatrix4fv(u.uModel, false, model);
            gl2.uniformMatrix3fv(u.uNormalMat, false, o.model ? normalMatrix(model) : this.identityN);
            gl2.uniform4fv(u.uColor, (_b = o.color) != null ? _b : [1, 1, 1, 1]);
            gl2.uniform1f(u.uUnlit, o.unlit ? 1 : 0);
            gl2.uniform3fv(u.uEmissive, (_c = o.emissive) != null ? _c : [0, 0, 0]);
            gl2.uniform1f(u.uSpec, (_d = o.spec) != null ? _d : 0.25);
            gl2.uniform1f(u.uShin, (_e = o.shin) != null ? _e : 24);
            gl2.uniform1f(u.uToon, o.toon ? 1 : 0);
            gl2.activeTexture(gl2.TEXTURE0);
            gl2.bindTexture(gl2.TEXTURE_2D, (_f = o.tex) != null ? _f : this.white);
            gl2.uniform1f(u.uUseTex, o.tex ? 1 : 0);
            const blend = (_g = o.blend) != null ? _g : "none";
            if (blend === "none") gl2.disable(gl2.BLEND); else {
                gl2.enable(gl2.BLEND);
                if (blend === "add") gl2.blendFunc(gl2.SRC_ALPHA, gl2.ONE); else gl2.blendFunc(gl2.SRC_ALPHA, gl2.ONE_MINUS_SRC_ALPHA);
            }
            gl2.depthMask((_h = o.depthWrite) != null ? _h : blend === "none");
            if (o.depthTest === false) gl2.disable(gl2.DEPTH_TEST); else gl2.enable(gl2.DEPTH_TEST);
            if (o.cull === false) gl2.disable(gl2.CULL_FACE); else gl2.enable(gl2.CULL_FACE);
        }

        bindMesh(mesh) {
            const gl2 = this.gl;
            const attr = (buf, loc, size) => {
                gl2.bindBuffer(gl2.ARRAY_BUFFER, buf);
                gl2.enableVertexAttribArray(loc);
                gl2.vertexAttribPointer(loc, size, gl2.FLOAT, false, 0, 0);
                if (this.inst) this.inst.divisor(loc, 0);
            };
            attr(mesh.vbo, LOC.aPos, 3);
            attr(mesh.nbo, LOC.aNormal, 3);
            attr(mesh.tbo, LOC.aUV, 2);
            if (mesh.cbo) attr(mesh.cbo, LOC.aColor, 3); else {
                gl2.disableVertexAttribArray(LOC.aColor);
                gl2.vertexAttrib3f(LOC.aColor, 1, 1, 1);
            }
            gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, mesh.ibo);
        }

        constantInstance() {
            const gl2 = this.gl;
            for (const l of [LOC.aIPos, LOC.aIQuat, LOC.aIScale, LOC.aIColor]) gl2.disableVertexAttribArray(l);
            gl2.vertexAttrib3f(LOC.aIPos, 0, 0, 0);
            gl2.vertexAttrib4f(LOC.aIQuat, 0, 0, 0, 1);
            gl2.vertexAttrib3f(LOC.aIScale, 1, 1, 1);
            gl2.vertexAttrib4f(LOC.aIColor, 1, 1, 1, 1);
        }

        draw(mesh, o = {}) {
            if (this.lost || mesh.count === 0) return;
            this.applyOpts(o);
            this.bindMesh(mesh);
            this.constantInstance();
            this.gl.drawElements(this.gl.TRIANGLES, mesh.count, mesh.indexType, 0);
        }

        /** Draws `inst.count` copies. Falls back to one draw call per instance without the extension. */
        drawInstanced(mesh, inst, o = {}) {
            if (this.lost || mesh.count === 0 || inst.count === 0) return;
            const gl2 = this.gl;
            this.applyOpts(o);
            this.bindMesh(mesh);
            if (this.inst && !this.forceNoInstancing) {
                inst.upload();
                gl2.bindBuffer(gl2.ARRAY_BUFFER, inst.buffer);
                const stride = INST_FLOATS * 4;
                const set = (loc, size, off) => {
                    gl2.enableVertexAttribArray(loc);
                    gl2.vertexAttribPointer(loc, size, gl2.FLOAT, false, stride, off * 4);
                    this.inst.divisor(loc, 1);
                };
                set(LOC.aIPos, 3, 0);
                set(LOC.aIQuat, 4, 3);
                set(LOC.aIScale, 3, 7);
                set(LOC.aIColor, 4, 10);
                this.inst.drawElementsInstanced(gl2.TRIANGLES, mesh.count, mesh.indexType, 0, inst.count);
                for (const l of [LOC.aIPos, LOC.aIQuat, LOC.aIScale, LOC.aIColor]) {
                    this.inst.divisor(l, 0);
                    gl2.disableVertexAttribArray(l);
                }
                return;
            }
            for (const l of [LOC.aIPos, LOC.aIQuat, LOC.aIScale, LOC.aIColor]) gl2.disableVertexAttribArray(l);
            const d = inst.data;
            for (let i = 0; i < inst.count; i++) {
                const k = i * INST_FLOATS;
                gl2.vertexAttrib3f(LOC.aIPos, d[k], d[k + 1], d[k + 2]);
                gl2.vertexAttrib4f(LOC.aIQuat, d[k + 3], d[k + 4], d[k + 5], d[k + 6]);
                gl2.vertexAttrib3f(LOC.aIScale, d[k + 7], d[k + 8], d[k + 9]);
                gl2.vertexAttrib4f(LOC.aIColor, d[k + 10], d[k + 11], d[k + 12], d[k + 13]);
                gl2.drawElements(gl2.TRIANGLES, mesh.count, mesh.indexType, 0);
            }
        }

        texture(source, opts = {}) {
            const gl2 = this.gl;
            const t = gl2.createTexture();
            this.updateTexture(t, source, opts);
            return t;
        }

        updateTexture(t, source, opts = {}) {
            const gl2 = this.gl;
            gl2.bindTexture(gl2.TEXTURE_2D, t);
            gl2.pixelStorei(gl2.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA, gl2.RGBA, gl2.UNSIGNED_BYTE, source);
            const pot = (n) => (n & n - 1) === 0;
            const canMip = opts.mipmap && (this.isGL2 || pot(source.width) && pot(source.height));
            const wrap = opts.repeat && (this.isGL2 || pot(source.width) && pot(source.height)) ? gl2.REPEAT : gl2.CLAMP_TO_EDGE;
            gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_S, wrap);
            gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_T, wrap);
            gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.LINEAR);
            if (canMip) {
                gl2.generateMipmap(gl2.TEXTURE_2D);
                gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR_MIPMAP_LINEAR);
            } else gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR);
        }

        deleteTexture(t) {
            if (t) this.gl.deleteTexture(t);
        }

        /** Re-selects the mesh program after a custom program (the ball renderer) drew. */
        use() {
            this.gl.useProgram(this.prog);
        }

        get cameraInUse() {
            return this.camera;
        }
    };

    function paintCanvas(w, h, draw) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        if (!g) throw new Error("2D canvas unavailable");
        draw(g, w, h);
        return c;
    }

    var UI_FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic UI","Meiryo","Noto Sans CJK JP",sans-serif';

    function showNoWebGL(message) {
        const d = document.createElement("div");
        d.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;background:#222;color:#fff;font:16px sans-serif;z-index:99999;line-height:1.8";
        d.innerHTML = message;
        document.body.appendChild(d);
    }

    function watchContextLoss(canvas2, r) {
        canvas2.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            r.lost = true;
            console.warn("[gl] WebGL context lost");
        });
        canvas2.addEventListener("webglcontextrestored", () => location.reload());
    }

    // MillionBilliardsGame/src/lines.ts
    var LinePicker = class {
        constructor(pools, rng2, opts = {}) {
            this.pools = pools;
            this.rng = rng2;
            this.opts = opts;
            this.recent = [];
            this.lastShownAt = -Infinity;
            this.lastPriority = 0;
            this.holdUntil = 0;
            for (const [k, v] of Object.entries(pools)) {
                if (v.length === 0) throw new Error(`line pool "${k}" is empty`);
            }
        }

        /** Picks a line from the pool without rate limiting (used for forced UI text). */
        pickRaw(key) {
            var _a, _b;
            const pool = this.pools[key];
            const recentSize = Math.min((_a = this.opts.recentSize) != null ? _a : 12, Math.max(0, pool.length - 1));
            const avoid = new Set(this.recent.slice(-recentSize));
            const last2 = this.recent[this.recent.length - 1];
            let candidates = pool.filter((l) => !avoid.has(l));
            if (candidates.length === 0) candidates = pool.filter((l) => l !== last2);
            if (candidates.length === 0) candidates = [...pool];
            const text = candidates[Math.floor(this.rng() * candidates.length)];
            this.recent.push(text);
            if (this.recent.length > 64) this.recent.shift();
            (_b = globalThis.__lineLog) == null ? void 0 : _b.push(`${key}	${text}`);
            return text;
        }

        /** Returns a line if it may be shown now, otherwise null. */
        request(key, now, req = {}) {
            var _a, _b, _c, _d;
            const priority = (_a = req.priority) != null ? _a : 1;
            const gap = (_c = (_b = req.minGapMs) != null ? _b : this.opts.baseGapMs) != null ? _c : 1400;
            if (now < this.holdUntil && priority <= this.lastPriority) return null;
            if (priority < 3 && now - this.lastShownAt < gap && priority <= this.lastPriority) return null;
            const text = this.pickRaw(key);
            this.lastShownAt = now;
            this.lastPriority = priority;
            this.holdUntil = priority >= 2 ? now + ((_d = this.opts.holdMs) != null ? _d : 2200) : now;
            return {text, priority, key};
        }

        /** Lets lower priority lines through again (e.g. after the bubble faded). */
        release() {
            this.lastPriority = 0;
            this.holdUntil = 0;
        }

        get history() {
            return this.recent;
        }
    };

    // MillionBilliardsGame/src/rng.ts
    function seededRng(seed2) {
        let a = seed2 >>> 0;
        return () => {
            a = a + 1831565813 >>> 0;
            let t = a;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // MillionBilliardsGame/src/storage.ts
    var MemoryKV = class {
        constructor() {
            this.map = /* @__PURE__ */ new Map();
        }

        getItem(k) {
            return this.map.has(k) ? this.map.get(k) : null;
        }

        setItem(k, v) {
            this.map.set(k, v);
        }

        removeItem(k) {
            this.map.delete(k);
        }
    };

    function detectBackend() {
        try {
            if (typeof localStorage !== "undefined") {
                const probe = "__MillionBilliardsGame_probe__";
                localStorage.setItem(probe, "1");
                const ok = localStorage.getItem(probe) === "1";
                localStorage.removeItem(probe);
                if (ok) return {backend: localStorage, persistent: true};
            }
        } catch (err) {
            console.warn("[save] localStorage is not available; records last until the tab closes", err);
        }
        return {backend: new MemoryKV(), persistent: false};
    }

    var PREFIX = "MillionBilliardsGame.v1:";
    var JsonStore = class {
        constructor(namespace, defaults, backend2) {
            this.defaults = defaults;
            this.backend = backend2;
            this.lastWriteOk = true;
            this.key = PREFIX + namespace;
            this.data = this.read();
        }

        read() {
            const base = this.defaults();
            let raw = null;
            try {
                raw = this.backend.getItem(this.key);
            } catch (err) {
                console.warn("[save] read failed", err);
            }
            if (!raw) return base;
            try {
                return {...base, ...JSON.parse(raw)};
            } catch (err) {
                console.error(`[save] corrupt data under ${this.key}; starting fresh`, err);
                return base;
            }
        }

        get() {
            return this.data;
        }

        update(mutator) {
            const draft = JSON.parse(JSON.stringify(this.data));
            mutator(draft);
            this.data = draft;
            try {
                this.backend.setItem(this.key, JSON.stringify(this.data));
                this.lastWriteOk = true;
            } catch (err) {
                this.lastWriteOk = false;
                console.warn("[save] write failed (quota or privacy mode)", err);
            }
            return this.data;
        }
    };

    // MillionBilliardsGame/src/run.ts
    function scoreShot(stats, pockets, gold, comboBefore) {
        let pocketPts = 0;
        let distinct = 0;
        let goldBalls = 0;
        for (let k = 0; k < pockets.length; k++) {
            const n = stats.pocketedBy[k];
            if (n <= 0) continue;
            distinct++;
            const mult = k === gold ? POCKETS.goldMult : pockets[k].mult;
            if (k === gold) goldBalls += n;
            pocketPts += n * SCORE.perPocketed * mult;
        }
        const base = stats.moved * SCORE.perMoved + stats.collided * SCORE.perCollided + pocketPts;
        const varietyTenths = 10 + Math.min(SCORE.varietyMaxTenths - 10, Math.max(0, distinct - 1) * SCORE.varietyStepTenths);
        const qualifies = stats.moved >= SCORE.comboMovedThreshold;
        const combo = qualifies ? comboBefore + 1 : 0;
        const comboTenths = qualifies ? 10 + (combo - 1) * SCORE.comboStepTenths : 10;
        const points = Math.floor(base * varietyTenths * comboTenths / 100);
        let moment = null;
        for (const m of MOMENTS) if (stats.moved >= m.moved) moment = m.id;
        return {
            moved: stats.moved,
            collided: stats.collided,
            pocketed: stats.pocketed,
            chain: stats.chain,
            boosters: stats.boosters,
            pockets: distinct,
            goldBalls,
            base,
            varietyTenths,
            comboTenths,
            combo,
            points,
            moment
        };
    }

    var Run = class {
        constructor() {
            this.score = 0;
            this.shot = 0;
            // shots taken
            this.combo = 0;
            this.maxCombo = 0;
            this.gold = 0;
            this.results = [];
        }

        get shotsLeft() {
            return SCORE.shotsPerRun - this.shot;
        }

        get over() {
            return this.shot >= SCORE.shotsPerRun;
        }

        record(res) {
            this.shot += 1;
            this.score += res.points;
            this.combo = res.combo;
            this.maxCombo = Math.max(this.maxCombo, res.combo);
            this.results.push(res);
        }

        best(key) {
            return this.results.reduce((m, r) => Math.max(m, r[key]), 0);
        }
    };

    function defaultSave() {
        return {
            bestScore: 0,
            bestShotPoints: 0,
            bestMoved: 0,
            bestPocketed: 0,
            bestChain: 0,
            bestCombo: 0,
            runs: 0,
            totalMoved: 0
        };
    }

    function createMillionStore(backend2) {
        return new JsonStore("million", defaultSave, backend2);
    }

    var RECORD_NAMES = {
        bestScore: "最高スコア",
        bestShotPoints: "1ショット最高得点",
        bestMoved: "1ショット最多移動",
        bestPocketed: "1ショット最多入球",
        bestChain: "最長連鎖",
        bestCombo: "最大コンボ"
    };

    function applyShot(save, res) {
        const broke = [];
        const bump = (k, v) => {
            if (v > save[k]) {
                save[k] = v;
                broke.push(k);
            }
        };
        bump("bestShotPoints", res.points);
        bump("bestMoved", res.moved);
        bump("bestPocketed", res.pocketed);
        bump("bestChain", res.chain);
        bump("bestCombo", res.combo);
        save.totalMoved += res.moved;
        return broke;
    }

    function applyRunEnd(save, run) {
        save.runs += 1;
        if (run.score > save.bestScore) {
            save.bestScore = run.score;
            return ["bestScore"];
        }
        return [];
    }

    // MillionBilliardsGame/src/geometry.ts
    function empty() {
        return {pos: [], nrm: [], uv: [], idx: []};
    }

    function box(w, h, d) {
        const g = empty();
        const x = w / 2, y = h / 2, z = d / 2;
        const faces = [[[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]], [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]], [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]], [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]], [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]], [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]]];
        for (const [n, vs] of faces) quad(g, vs, n);
        return g;
    }

    function quad(g, vs, n) {
        const base = g.pos.length / 3;
        const uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
        vs.forEach((v, i) => {
            g.pos.push(...v);
            g.nrm.push(...n);
            g.uv.push(...uvs[i]);
        });
        g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    function planeXZ(w, d) {
        const g = empty();
        quad(g, [[-w / 2, 0, d / 2], [w / 2, 0, d / 2], [w / 2, 0, -d / 2], [-w / 2, 0, -d / 2]], [0, 1, 0]);
        return g;
    }

    function quadXY(w, h) {
        const g = empty();
        quad(g, [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]], [0, 0, 1]);
        return g;
    }

    function sphere(r, ws = 16, hs = 12) {
        const g = empty();
        for (let y = 0; y <= hs; y++) {
            const v = y / hs;
            const th = v * Math.PI;
            for (let x = 0; x <= ws; x++) {
                const u = x / ws;
                const ph = u * Math.PI * 2;
                const nx = -Math.cos(ph) * Math.sin(th);
                const ny = Math.cos(th);
                const nz = Math.sin(ph) * Math.sin(th);
                g.pos.push(nx * r, ny * r, nz * r);
                g.nrm.push(nx, ny, nz);
                g.uv.push(u, v);
            }
        }
        for (let y = 0; y < hs; y++) for (let x = 0; x < ws; x++) {
            const a = y * (ws + 1) + x;
            const b = a + ws + 1;
            g.idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        return g;
    }

    function cylinder(rTop, rBottom, h, seg = 16, caps = true) {
        const g = empty();
        const slope = (rBottom - rTop) / h;
        for (let i = 0; i <= seg; i++) {
            const a = i / seg * Math.PI * 2;
            const c = Math.cos(a), s = Math.sin(a);
            const n = norm3([c, slope, s]);
            g.pos.push(c * rTop, h / 2, s * rTop, c * rBottom, -h / 2, s * rBottom);
            g.nrm.push(...n, ...n);
            g.uv.push(i / seg, 0, i / seg, 1);
        }
        for (let i = 0; i < seg; i++) {
            const a = i * 2;
            g.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
        if (caps) {
            for (const [y, r, ny] of [[h / 2, rTop, 1], [-h / 2, rBottom, -1]]) {
                if (r <= 0) continue;
                const c0 = g.pos.length / 3;
                g.pos.push(0, y, 0);
                g.nrm.push(0, ny, 0);
                g.uv.push(0.5, 0.5);
                for (let i = 0; i <= seg; i++) {
                    const a = i / seg * Math.PI * 2;
                    g.pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
                    g.nrm.push(0, ny, 0);
                    g.uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2);
                }
                for (let i = 0; i < seg; i++) {
                    if (ny > 0) g.idx.push(c0, c0 + i + 2, c0 + i + 1); else g.idx.push(c0, c0 + i + 1, c0 + i + 2);
                }
            }
        }
        return g;
    }

    function merge(dst, src, t = [0, 0, 0], q = quat.identity(), s = [1, 1, 1], color = [1, 1, 1]) {
        var _a;
        const m = fromTRS(m4(), t, q, s);
        const nm = normalMatrix(m);
        const base = dst.pos.length / 3;
        (_a = dst.col) != null ? _a : dst.col = new Array(dst.pos.length / 3 * 3).fill(1);
        for (let i = 0; i < src.pos.length; i += 3) {
            const x = src.pos[i], y = src.pos[i + 1], z = src.pos[i + 2];
            dst.pos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
            const nx = src.nrm[i], ny = src.nrm[i + 1], nz = src.nrm[i + 2];
            const n = norm3([nm[0] * nx + nm[3] * ny + nm[6] * nz, nm[1] * nx + nm[4] * ny + nm[7] * nz, nm[2] * nx + nm[5] * ny + nm[8] * nz]);
            dst.nrm.push(...n);
            const c = src.col ? [src.col[i] * color[0], src.col[i + 1] * color[1], src.col[i + 2] * color[2]] : color;
            dst.col.push(...c);
        }
        dst.uv.push(...src.uv.length ? src.uv : new Array(src.pos.length / 3 * 2).fill(0));
        for (const k of src.idx) dst.idx.push(k + base);
        return dst;
    }

    function norm3(a) {
        const l = Math.hypot(a[0], a[1], a[2]) || 1;
        return [a[0] / l, a[1] / l, a[2] / l];
    }

    // MillionBilliardsGame/src/scene.ts
    function annulus(ri, seg = 64) {
        const g = empty();
        for (let i = 0; i <= seg; i++) {
            const a = i / seg * Math.PI * 2;
            const c = Math.cos(a), s = Math.sin(a);
            g.pos.push(c, 0, s, c * ri, 0, s * ri);
            g.nrm.push(0, 1, 0, 0, 1, 0);
            g.uv.push(i / seg, 0, i / seg, 1);
        }
        for (let i = 0; i < seg; i++) {
            const a = i * 2;
            g.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        return g;
    }

    var MAX_SPARKS = 700;
    var TableScene = class {
        constructor(r, f) {
            this.r = r;
            this.f = f;
            this.labels = [];
            this.sparks = [];
            this.rings = [];
            this.mtx = m4();
            this.effects = true;
            const W = f.maxX - f.minX;
            const D = f.maxZ - f.minZ;
            const fg = planeXZ(W + 60, D + 60);
            for (let i = 0; i < fg.uv.length; i++) fg.uv[i] = fg.uv[i] * (i % 2 === 0 ? (W + 60) / 64 : (D + 60) / 64);
            this.felt = new Mesh(r, fg);
            this.feltTex = r.texture(paintCanvas(128, 128, (g, w, h) => {
                g.fillStyle = "#0d5a3a";
                g.fillRect(0, 0, w, h);
                for (let i = 0; i < 1400; i++) {
                    g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.045)";
                    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
                }
                g.strokeStyle = "rgba(255,255,255,0.05)";
                g.strokeRect(0.5, 0.5, w - 1, h - 1);
            }), {repeat: true, mipmap: true});
            const rg = empty();
            const cx = (f.minX + f.maxX) / 2;
            const cz = (f.minZ + f.maxZ) / 2;
            const wood = [0.42, 0.22, 0.1];
            const cush = [0.06, 0.38, 0.24];
            const railW = 34;
            merge(rg, box(W + railW * 2, 7, railW), [cx, 3.5, f.minZ - railW / 2], void 0, void 0, wood);
            merge(rg, box(W + railW * 2, 7, railW), [cx, 3.5, f.maxZ + railW / 2], void 0, void 0, wood);
            merge(rg, box(railW, 7, D), [f.minX - railW / 2, 3.5, cz], void 0, void 0, wood);
            merge(rg, box(railW, 7, D), [f.maxX + railW / 2, 3.5, cz], void 0, void 0, wood);
            merge(rg, box(W, 3, 3), [cx, 1.5, f.minZ - 1.5], void 0, void 0, cush);
            merge(rg, box(W, 3, 3), [cx, 1.5, f.maxZ + 1.5], void 0, void 0, cush);
            merge(rg, box(3, 3, D), [f.minX - 1.5, 1.5, cz], void 0, void 0, cush);
            merge(rg, box(3, 3, D), [f.maxX + 1.5, 1.5, cz], void 0, void 0, cush);
            for (let k = 1; k < 16; k++) {
                const x = f.minX + W * k / 16;
                const z = f.minZ + D * k / 16;
                merge(rg, box(4, 0.6, 2), [x, 7.2, f.minZ - railW / 2], void 0, void 0, [0.95, 0.92, 0.8]);
                merge(rg, box(4, 0.6, 2), [x, 7.2, f.maxZ + railW / 2], void 0, void 0, [0.95, 0.92, 0.8]);
                merge(rg, box(2, 0.6, 4), [f.minX - railW / 2, 7.2, z], void 0, void 0, [0.95, 0.92, 0.8]);
                merge(rg, box(2, 0.6, 4), [f.maxX + railW / 2, 7.2, z], void 0, void 0, [0.95, 0.92, 0.8]);
            }
            this.rails = new Mesh(r, rg);
            this.pocketHole = new Mesh(r, cylinder(1, 1, 1, 32, true));
            this.pocketRim = new Mesh(r, cylinder(1, 1, 1, 32, false));
            this.ring = new Mesh(r, annulus(0.82));
            this.unitSphere = new Mesh(r, sphere(1, 24, 16));
            const cs = empty();
            merge(cs, cylinder(0.55, 1.05, 70, 12, true), [0, 35, 0], void 0, void 0, [0.86, 0.7, 0.45]);
            merge(cs, cylinder(1.05, 1.15, 26, 12, true), [0, 83, 0], void 0, void 0, [0.18, 0.08, 0.05]);
            merge(cs, cylinder(0.6, 0.55, 1.2, 12, true), [0, -0.6, 0], void 0, void 0, [0.25, 0.45, 0.9]);
            this.cueStick = new Mesh(r, cs);
            this.labelQuad = new Mesh(r, quadXY(1, 1));
            this.beam = new Mesh(r, cylinder(1, 1, 1, 24, false));
            const tg = empty();
            const ins = MARGIN * 0.48;
            const tw = f.w + ins * 2, td = f.d + ins * 2;
            merge(tg, box(tw, 0.2, 0.8), [f.w / 2, 0.15, -ins]);
            merge(tg, box(tw, 0.2, 0.8), [f.w / 2, 0.15, f.d + ins]);
            merge(tg, box(0.8, 0.2, td), [-ins, 0.15, f.d / 2]);
            merge(tg, box(0.8, 0.2, td), [f.w + ins, 0.15, f.d / 2]);
            this.track = new Mesh(r, tg);
            this.dot = new Mesh(r, cylinder(1, 1, 0.2, 10, true));
            this.dots = new Instances(r, 64);
            this.sparkInst = new Instances(r, MAX_SPARKS);
            for (const text of ["×1", "×3", "×5", "×10"]) {
                this.labels.push(r.texture(paintCanvas(256, 128, (g, w, h) => {
                    g.fillStyle = text === "×10" ? "rgba(255,200,0,0.95)" : "rgba(10,10,20,0.82)";
                    g.beginPath();
                    g.roundRect(4, 4, w - 8, h - 8, 26);
                    g.fill();
                    g.lineWidth = 6;
                    g.strokeStyle = text === "×10" ? "#fff6c0" : text === "×5" ? "#ff4fd8" : text === "×3" ? "#3cf0ff" : "#cfd8dc";
                    g.stroke();
                    g.fillStyle = text === "×10" ? "#3a1d00" : g.strokeStyle;
                    g.font = `900 84px ${UI_FONT}`;
                    g.textAlign = "center";
                    g.textBaseline = "middle";
                    g.fillText(text, w / 2, h / 2 + 4);
                })));
            }
            this.boostTex = r.texture(paintCanvas(256, 96, (g, w, h) => {
                g.fillStyle = "rgba(0,0,0,0.7)";
                g.fillRect(0, 0, w, h);
                g.strokeStyle = "#7dff6b";
                g.lineWidth = 5;
                g.strokeRect(3, 3, w - 6, h - 6);
                g.fillStyle = "#b8ff9e";
                g.font = `900 40px ${UI_FONT}`;
                g.textAlign = "center";
                g.textBaseline = "middle";
                g.fillText(`BOOST ×${BOOSTERS.gain}`, w / 2, h / 2 + 3, w - 16);
            }));
            this.boosterFlash = new Float32Array(f.boosters.length);
            this.pocketFlash = new Float32Array(f.pockets.length);
        }

        model(x, y, z, sx, sy, sz, q = quat.identity()) {
            return fromTRS(this.mtx, [x, y, z], q, [sx, sy, sz]);
        }

        // ---------------------------------------------------------------- effects
        impact(x, z, strength) {
            if (!this.effects) return;
            this.rings.push({x, z, t: 0, life: 1.4, size: 60 + strength * 260, color: [1, 0.85, 0.5]});
            this.rings.push({x, z, t: -0.15, life: 1.8, size: 120 + strength * 420, color: [1, 0.55, 0.2]});
            this.burst(x, 2, z, 60, [1, 0.9, 0.6], 60);
        }

        boosterHit(k) {
            this.boosterFlash[k] = 1;
            const b = this.f.boosters[k];
            if (!this.effects) return;
            this.rings.push({x: b.x, z: b.z, t: 0, life: 1.1, size: b.r * 4, color: [0.5, 1, 0.4]});
            this.burst(b.x, 3, b.z, 40, [0.6, 1, 0.5], 45);
        }

        pocketHit(k, count) {
            this.pocketFlash[k] = Math.min(1, this.pocketFlash[k] + 0.2 + count * 0.01);
            const p = this.f.pockets[k];
            if (!this.effects) return;
            this.burst(p.x, 1, p.z, Math.min(10, 2 + count / 5), [1, 1, 1], 30);
        }

        burst(x, y, z, n, c, speed) {
            for (let i = 0; i < n && this.sparks.length < MAX_SPARKS; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = speed * (0.3 + Math.random());
                this.sparks.push({
                    x,
                    y,
                    z,
                    vx: Math.cos(a) * s,
                    vy: 20 + Math.random() * 50,
                    vz: Math.sin(a) * s,
                    t: 0,
                    life: 0.5 + Math.random() * 0.6,
                    c
                });
            }
        }

        update(dt) {
            for (let i = this.rings.length - 1; i >= 0; i--) {
                const rr = this.rings[i];
                rr.t += dt;
                if (rr.t > rr.life) this.rings.splice(i, 1);
            }
            for (let i = this.sparks.length - 1; i >= 0; i--) {
                const s = this.sparks[i];
                s.t += dt;
                s.vy -= 160 * dt;
                s.x += s.vx * dt;
                s.y = Math.max(0.3, s.y + s.vy * dt);
                s.z += s.vz * dt;
                if (s.t > s.life) {
                    this.sparks[i] = this.sparks[this.sparks.length - 1];
                    this.sparks.pop();
                }
            }
            for (let k = 0; k < this.boosterFlash.length; k++) this.boosterFlash[k] = Math.max(0, this.boosterFlash[k] - dt * 0.8);
            for (let k = 0; k < this.pocketFlash.length; k++) this.pocketFlash[k] = Math.max(0, this.pocketFlash[k] - dt * 1.5);
        }

        // ---------------------------------------------------------------- drawing
        /** Opaque parts: draw before the balls. */
        drawOpaque(cam2, cue) {
            const r = this.r;
            const f = this.f;
            r.draw(this.felt, {
                model: this.model((f.minX + f.maxX) / 2, 0, (f.minZ + f.maxZ) / 2, 1, 1, 1),
                tex: this.feltTex,
                spec: 0.03
            });
            r.draw(this.rails, {spec: 0.35, shin: 30});
            for (const p of f.pockets) {
                r.draw(this.pocketRim, {
                    model: this.model(p.x, -6, p.z, p.r + 1.2, 6.6, p.r + 1.2),
                    color: p.kind === "edge" ? [0.12, 0.1, 0.08, 1] : [0.72, 0.55, 0.2, 1],
                    spec: 0.6,
                    cull: false
                });
                r.draw(this.pocketHole, {
                    model: this.model(p.x, -0.4, p.z, p.r, 0.6, p.r), color: [0.01, 0.01, 0.015, 1], unlit: true
                });
            }
            if (cue.visible) {
                r.draw(this.unitSphere, {
                    model: this.model(cue.x, CUE.r, cue.z, CUE.r, CUE.r, CUE.r),
                    color: [0.98, 0.97, 0.93, 1],
                    spec: 0.9,
                    shin: 60
                });
            }
            void cam2;
        }

        /** Cue stick + aim guide (aiming only). `pull` 0..1 is the charge. */
        drawAim(cue, dx, dz, pull, time) {
            const r = this.r;
            const yaw = Math.atan2(dx, dz);
            const back = CUE.r + 2 + pull * 26;
            const q = quat.mul(quat.axisAngle([0, 1, 0], yaw), quat.axisAngle([1, 0, 0], -Math.PI / 2 + 0.09));
            r.draw(this.cueStick, {
                model: this.model(cue.x - dx * back, CUE.r + 0.6, cue.z - dz * back, 1, 1, 1, q), spec: 0.5, shin: 40
            });
            const n = 26;
            const len = 60 + pull * 260;
            this.dots.count = 0;
            for (let i = 0; i < n; i++) {
                const t = (i + time * 2 % 1) / n * len + CUE.r + 4;
                const a = 1 - i / n;
                this.dots.set(this.dots.count++, cue.x + dx * t, 0.3, cue.z + dz * t, 0, 0, 0, 1, 1.1, 1, 1.1, 1, 0.95, 0.6, a * 0.9);
            }
            r.drawInstanced(this.dot, this.dots, {unlit: true, blend: "add", depthWrite: false});
        }

        /** Transparent / glowing parts: draw after the balls. */
        drawGlow(cam2, time, gold, trackAlpha) {
            const r = this.r;
            const f = this.f;
            if (trackAlpha > 0) r.draw(this.track, {
                color: [0.6, 0.9, 1, trackAlpha], unlit: true, blend: "add", depthWrite: false
            });
            f.boosters.forEach((b, k) => {
                const pulse = 0.55 + 0.25 * Math.sin(time * 3 + k) + this.boosterFlash[k] * 0.8;
                r.draw(this.ring, {
                    model: this.model(b.x, 2.6, b.z, b.r, 1, b.r),
                    color: [0.45, 1, 0.35, Math.min(1, pulse)],
                    unlit: true,
                    blend: "add",
                    depthWrite: false,
                    cull: false
                });
                r.draw(this.ring, {
                    model: this.model(b.x, 2.6, b.z, b.r * 0.55, 1, b.r * 0.55),
                    color: [0.45, 1, 0.35, Math.min(1, pulse * 0.6)],
                    unlit: true,
                    blend: "add",
                    depthWrite: false,
                    cull: false
                });
                this.billboard(cam2, this.boostTex, b.x, 16, b.z, 34, 12.75, 0.9);
            });
            f.pockets.forEach((p, k) => {
                const isGold = k === gold;
                const m = isGold ? POCKETS.goldMult : p.mult;
                const tex = this.labels[m === 10 ? 3 : m === 5 ? 2 : m === 3 ? 1 : 0];
                const s = p.kind === "edge" ? 22 : 26;
                this.billboard(cam2, tex, p.x, p.r + 14 + this.pocketFlash[k] * 6, p.z, s, s / 2, 0.95);
                if (isGold) {
                    const a = 0.25 + 0.1 * Math.sin(time * 4);
                    r.draw(this.beam, {
                        model: this.model(p.x, 0, p.z, p.r * 0.9, 260, p.r * 0.9),
                        color: [1, 0.8, 0.2, a],
                        unlit: true,
                        blend: "add",
                        depthWrite: false,
                        cull: false
                    });
                }
                if (this.pocketFlash[k] > 0.01) {
                    r.draw(this.ring, {
                        model: this.model(p.x, 0.5, p.z, p.r * (1.3 + this.pocketFlash[k]), 1, p.r * (1.3 + this.pocketFlash[k])),
                        color: [1, 1, 1, this.pocketFlash[k]],
                        unlit: true,
                        blend: "add",
                        depthWrite: false,
                        cull: false
                    });
                }
            });
            for (const rr of this.rings) {
                if (rr.t < 0) continue;
                const k = rr.t / rr.life;
                const s = rr.size * (0.1 + 0.9 * Math.sqrt(k));
                r.draw(this.ring, {
                    model: this.model(rr.x, 3, rr.z, s, 1, s),
                    color: [rr.color[0], rr.color[1], rr.color[2], (1 - k) * 0.9],
                    unlit: true,
                    blend: "add",
                    depthWrite: false,
                    cull: false
                });
            }
            this.sparkInst.count = 0;
            for (const s of this.sparks) {
                const a = 1 - s.t / s.life;
                this.sparkInst.set(this.sparkInst.count++, s.x, s.y, s.z, 0, 0, 0, 1, 0.5, 0.5, 0.5, s.c[0], s.c[1], s.c[2], a);
            }
            if (this.sparkInst.count) r.drawInstanced(this.unitSphere, this.sparkInst, {
                unlit: true, blend: "add", depthWrite: false
            });
            void BALL;
        }

        billboard(cam2, tex, x, y, z, w, h, alpha) {
            const yaw = Math.atan2(cam2.eye[0] - x, cam2.eye[2] - z);
            const pitch = Math.atan2(cam2.eye[1] - y, Math.hypot(cam2.eye[0] - x, cam2.eye[2] - z));
            const q = quat.mul(quat.axisAngle([0, 1, 0], yaw), quat.axisAngle([1, 0, 0], -pitch * 0.85));
            const dist = Math.hypot(cam2.eye[0] - x, cam2.eye[1] - y, cam2.eye[2] - z);
            alpha *= Math.max(0, Math.min(1, (dist - 120) / 220));
            if (alpha <= 0.01) return;
            this.r.draw(this.labelQuad, {
                model: this.model(x, y, z, w, h, 1, q),
                tex,
                color: [1, 1, 1, alpha],
                unlit: true,
                blend: "alpha",
                depthWrite: false,
                cull: false
            });
        }
    };

    // MillionBilliardsGame/src/sim.ts
    var MOVE_EPS = 0.35;
    var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2]];
    var Cue = class {
        constructor() {
            this.x = 0;
            this.z = 0;
            this.vx = 0;
            this.vz = 0;
            this.live = false;
            // rolling on the table
            this.falling = 0;
        }

        // >0 while dropping into a pocket
    };
    var Sim = class {
        constructor(rng2, rand = rng2) {
            this.rand = rand;
            this.time = 0;
            this.cue = new Cue();
            this.activeN = 0;
            this.fallN = 0;
            // per-shot stamps (so each ball is counted once per shot)
            this.shot = 1;
            this.frontN = 0;
            this.nextN = 0;
            this.contactSeeded = false;
            this.pendingEnergy = 0;
            this.launchSpeed = 1;
            /** energy-weighted centre of the cells fired in the last tick (the camera follows it) */
            this.frontCentre = {x: 0, z: 0, w: 0, spread: 0};
            this.events = [];
            this.shotTime = 0;
            this.running = false;
            this.weights = new Float32Array(8);
            this.nbCell = new Int32Array(8);
            this.f = new BallField(rng2);
            const n = this.f.n;
            this.act = new Int32Array(PHYS.activeCap);
            this.travel = new Float32Array(PHYS.activeCap);
            this.slot = new Int32Array(n).fill(-1);
            this.fall = new Int32Array(n);
            this.fallPocket = new Int16Array(n);
            this.movedStamp = new Uint16Array(n);
            this.hitStamp = new Uint16Array(n);
            this.kickStamp = new Uint16Array(n);
            const cells = this.f.wx * this.f.wz;
            this.wE = new Float32Array(cells);
            this.wDx = new Float32Array(cells);
            this.wDz = new Float32Array(cells);
            this.wHop = new Uint16Array(cells);
            this.wFired = new Uint16Array(cells);
            this.wQueued = new Uint16Array(cells);
            this.wArrive = new Float32Array(cells);
            this.front = new Int32Array(cells);
            this.nextFront = new Int32Array(cells);
            this.boosterUsed = new Uint16Array(this.f.boosters.length);
            this.pocketTally = new Int32Array(this.f.pockets.length);
            this.stats = this.freshStats();
        }

        freshStats() {
            return {
                moved: 0,
                collided: 0,
                pocketed: 0,
                pocketedBy: new Int32Array(this.f.pockets.length),
                chain: 0,
                cellsFired: 0,
                boosters: 0,
                scratch: false
            };
        }

        /** Back to a full, untouched board. */
        resetBoard() {
            for (let k = 0; k < this.activeN; k++) this.slot[this.act[k]] = -1;
            this.activeN = 0;
            this.fallN = 0;
            this.f.reset();
            this.frontN = 0;
            this.nextN = 0;
            this.wE.fill(0);
            this.running = false;
            this.cue.live = false;
            this.stats = this.freshStats();
        }

        // ---------------------------------------------------------------- shot lifecycle
        /** Fires the cue ball from (x,z) in direction (dx,dz) with power 0..1. */
        shoot(x, z, dx, dz, power) {
            this.shot += 1;
            if (this.shot >= 65535) {
                this.movedStamp.fill(0);
                this.hitStamp.fill(0);
                this.kickStamp.fill(0);
                this.wFired.fill(0);
                this.wQueued.fill(0);
                this.boosterUsed.fill(0);
                this.shot = 1;
            }
            this.stats = this.freshStats();
            const len = Math.hypot(dx, dz) || 1;
            const p = Math.max(0.05, Math.min(1, power));
            const c = this.cue;
            c.x = x;
            c.z = z;
            c.vx = dx / len * CUE.maxSpeed * (0.25 + 0.75 * p);
            c.vz = dz / len * CUE.maxSpeed * (0.25 + 0.75 * p);
            c.live = true;
            c.falling = 0;
            this.launchSpeed = Math.sqrt(c.vx * c.vx + c.vz * c.vz);
            this.pendingEnergy = WAVE.minPowerEnergy + (WAVE.maxEnergy - WAVE.minPowerEnergy) * p ** 1.4;
            this.contactSeeded = false;
            this.frontN = 0;
            this.nextN = 0;
            this.shotTime = 0;
            this.running = true;
        }

        /** True once nothing moves any more: wave finished, every ball asleep, cue stopped. */
        get settled() {
            return !this.cue.live && this.cue.falling <= 0 && this.activeN === 0 && this.frontN === 0 && this.nextN === 0 && this.fallN === 0;
        }

        get waveRunning() {
            return this.frontN + this.nextN > 0;
        }

        /** One fixed physics step. */
        step(dt) {
            this.time += dt;
            if (this.running) this.shotTime += dt;
            this.stepCue(dt);
            this.waveTick();
            this.stepBalls(dt);
            this.stepFalling(dt);
            if (this.running && this.shotTime > PHYS.shotTimeoutSec) this.forceSettle();
            if (this.running && this.settled) this.running = false;
        }

        /** Safety net: a shot never runs forever. Remaining motion is stopped where it is. */
        forceSettle() {
            for (let k = 0; k < this.activeN; k++) {
                const i = this.act[k];
                this.f.vx[i] = 0;
                this.f.vz[i] = 0;
                this.f.state[i] = 0 /* Rest */;
                this.slot[i] = -1;
            }
            this.activeN = 0;
            this.frontN = 0;
            this.nextN = 0;
            this.cue.live = false;
        }

        // ---------------------------------------------------------------- moving balls
        wake(i) {
            if (this.slot[i] >= 0) return true;
            if (this.activeN >= PHYS.activeCap) return false;
            const s = this.activeN++;
            this.act[s] = i;
            this.travel[s] = 0;
            this.slot[i] = s;
            this.f.state[i] = 1 /* Moving */;
            return true;
        }

        sleep(s) {
            const i = this.act[s];
            const last2 = this.act[--this.activeN];
            this.act[s] = last2;
            this.travel[s] = this.travel[this.activeN];
            this.slot[last2] = s;
            this.slot[i] = -1;
            this.f.vx[i] = 0;
            this.f.vz[i] = 0;
            if (this.f.state[i] === 1 /* Moving */) this.f.state[i] = 0 /* Rest */;
        }

        /** Moves ball i to (x,z), keeping the hash, density grid and render bounds in sync. */
        relocate(i, x, z) {
            const f = this.f;
            const o = i * STRIDE;
            f.data[o] = x;
            f.data[o + 1] = z;
            const c = f.hashOf(x, z);
            const old = f.cellOf[i];
            if (c !== old) {
                f.hashRemove(i);
                f.hashInsert(i, c);
                const wo = f.waveOfHash(old);
                const wn = f.waveOfHash(c);
                if (wo !== wn) {
                    f.waveCount[wo] -= 1;
                    f.waveCount[wn] += 1;
                }
            }
            f.touch(i, x, z);
        }

        markHit(i) {
            if (this.hitStamp[i] !== this.shot) {
                this.hitStamp[i] = this.shot;
                this.stats.collided += 1;
            }
        }

        stepBalls(dt) {
            const f = this.f;
            const d = f.data;
            const st = f.state;
            const VX = f.vx;
            const VZ = f.vz;
            const head = f.head;
            const next = f.next;
            const hx = f.hx;
            const hz = f.hz;
            const cell = f.hashCell;
            const minX = f.minX, minZ = f.minZ;
            const loX = f.minX + BALL.r, hiX = f.maxX - BALL.r, loZ = f.minZ + BALL.r, hiZ = f.maxZ - BALL.r;
            const pocketAt = f.pocketAt;
            const r2 = 2 * BALL.r;
            const r2sq = r2 * r2;
            const e = PHYS.restitution;
            const decel = PHYS.rollingDecel * dt;
            const dragK = 1 - PHYS.drag * dt;
            const vmax = PHYS.maxSpeed;
            const cushion = PHYS.cushion;
            const act = this.act;
            const travel = this.travel;
            const shot = this.shot;
            const moving = 1 /* Moving */;
            for (let s = 0; s < this.activeN; s++) {
                const i = act[s];
                if (st[i] !== moving) continue;
                let vx = VX[i];
                let vz = VZ[i];
                const o = i * STRIDE;
                let x = d[o];
                let z = d[o + 1];
                const sp0 = Math.sqrt(vx * vx + vz * vz);
                let sp = 0;
                if (sp0 > 0) {
                    sp = (sp0 > decel ? sp0 - decel : 0) * dragK;
                    if (sp > vmax) sp = vmax;
                    const k = sp / sp0;
                    vx *= k;
                    vz *= k;
                }
                const pk = pocketAt[f.waveOf(x, z)];
                if (pk >= 0) {
                    const p = f.pockets[pk];
                    const dx = p.x - x;
                    const dz = p.z - z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < p.r - BALL.r * 0.3) {
                        this.capture(i, pk);
                        continue;
                    }
                    if (dist < p.r * POCKETS.suctionReach) {
                        const a = POCKETS.suctionAccel * dt / (dist || 1);
                        vx += dx * a;
                        vz += dz * a;
                    }
                }
                x += vx * dt;
                z += vz * dt;
                if (x < loX) {
                    x = loX;
                    vx = -vx * cushion;
                } else if (x > hiX) {
                    x = hiX;
                    vx = -vx * cushion;
                }
                if (z < loZ) {
                    z = loZ;
                    vz = -vz * cushion;
                } else if (z > hiZ) {
                    z = hiZ;
                    vz = -vz * cushion;
                }
                const gx = Math.floor((x - minX) / cell) + 1;
                const gz = Math.floor((z - minZ) / cell) + 1;
                const zA = gz > 0 ? gz - 1 : 0, zB = gz < hz - 1 ? gz + 1 : hz - 1;
                const xA = gx > 0 ? gx - 1 : 0, xB = gx < hx - 1 ? gx + 1 : hx - 1;
                for (let rz = zA; rz <= zB; rz++) {
                    const row = rz * hx;
                    for (let rx = xA; rx <= xB; rx++) {
                        let j = head[row + rx];
                        while (j >= 0) {
                            const nj = next[j];
                            if (j !== i) {
                                const jo = j * STRIDE;
                                const ddx = x - d[jo];
                                const ddz = z - d[jo + 1];
                                const dsq = ddx * ddx + ddz * ddz;
                                if (dsq < r2sq && dsq > 1e-12 && !(st[j] === moving && j < i)) {
                                    const dist = Math.sqrt(dsq);
                                    const nx = ddx / dist;
                                    const nz = ddz / dist;
                                    const movable = this.wake(j);
                                    const vjx = VX[j];
                                    const vjz = VZ[j];
                                    const rel = (vx - vjx) * nx + (vz - vjz) * nz;
                                    const overlap = r2 - dist;
                                    if (movable) {
                                        if (rel < 0) {
                                            const imp = -(1 + e) * rel * 0.5;
                                            vx += imp * nx;
                                            vz += imp * nz;
                                            VX[j] = vjx - imp * nx;
                                            VZ[j] = vjz - imp * nz;
                                        }
                                        x += nx * overlap * 0.5;
                                        z += nz * overlap * 0.5;
                                        d[jo] = d[jo] - nx * overlap * 0.5;
                                        d[jo + 1] = d[jo + 1] - nz * overlap * 0.5;
                                    } else {
                                        if (rel < 0) {
                                            vx -= (1 + e) * rel * nx;
                                            vz -= (1 + e) * rel * nz;
                                        }
                                        x += nx * overlap;
                                        z += nz * overlap;
                                    }
                                    this.markHit(i);
                                    this.markHit(j);
                                }
                            }
                            j = nj;
                        }
                    }
                }
                this.relocate(i, x, z);
                VX[i] = vx;
                VZ[i] = vz;
                const tr = travel[s] = travel[s] + sp * dt;
                if (tr >= MOVE_EPS && this.movedStamp[i] !== shot) {
                    this.movedStamp[i] = shot;
                    this.stats.moved += 1;
                }
            }
            const stop = PHYS.stopSpeed;
            for (let s = this.activeN - 1; s >= 0; s--) {
                const i = act[s];
                if (st[i] !== moving) {
                    this.sleep(s);
                    continue;
                }
                const a = VX[i], b = VZ[i];
                if ((a < 0 ? -a : a) + (b < 0 ? -b : b) < stop) this.sleep(s);
            }
        }

        capture(i, pk) {
            const f = this.f;
            f.hashRemove(i);
            f.waveCount[f.waveOfHash(f.cellOf[i])] -= 1;
            f.state[i] = 2 /* Falling */;
            f.remaining -= 1;
            if (this.movedStamp[i] !== this.shot) {
                this.movedStamp[i] = this.shot;
                this.stats.moved += 1;
            }
            this.stats.pocketed += 1;
            this.stats.pocketedBy[pk] += 1;
            this.pocketTally[pk] += 1;
            this.fall[this.fallN] = i;
            this.fallPocket[this.fallN] = pk;
            this.fallN += 1;
            f.vx[i] = 0;
        }

        stepFalling(dt) {
            const f = this.f;
            const d = f.data;
            for (let k = this.fallN - 1; k >= 0; k--) {
                const i = this.fall[k];
                const p = f.pockets[this.fallPocket[k]];
                const o = i * STRIDE;
                const t = f.vx[i] += dt;
                d[o] += (p.x - d[o]) * Math.min(1, dt * 10);
                d[o + 1] += (p.z - d[o + 1]) * Math.min(1, dt * 10);
                d[o + 2] = -t * t * 60;
                if (t > 0.45) {
                    f.state[i] = 3 /* Gone */;
                    d[o + 2] = -1e3;
                    f.vx[i] = 0;
                    this.fall[k] = this.fall[--this.fallN];
                    this.fallPocket[k] = this.fallPocket[this.fallN];
                }
                f.touch(i, d[o], d[o + 1]);
            }
            for (let pk = 0; pk < this.pocketTally.length; pk++) {
                if (this.pocketTally[pk] > 0) {
                    this.events.push({type: "pocket", index: pk, count: this.pocketTally[pk]});
                    this.pocketTally[pk] = 0;
                }
            }
        }

        // ---------------------------------------------------------------- the cue ball
        stepCue(dt) {
            const c = this.cue;
            const f = this.f;
            if (c.falling > 0) {
                c.falling -= dt;
                return;
            }
            if (!c.live) return;
            let sp = Math.sqrt(c.vx * c.vx + c.vz * c.vz);
            const ns = Math.max(0, sp - PHYS.rollingDecel * 0.6 * dt);
            if (sp > 0) {
                c.vx *= ns / sp;
                c.vz *= ns / sp;
            }
            sp = ns;
            const sub = Math.max(1, Math.ceil(sp * dt / (BALL.r * 0.8)));
            const h = dt / sub;
            const R = CUE.r + BALL.r;
            for (let s = 0; s < sub; s++) {
                c.x += c.vx * h;
                c.z += c.vz * h;
                if (c.x < f.minX + CUE.r || c.x > f.maxX - CUE.r) {
                    c.x = Math.max(f.minX + CUE.r, Math.min(f.maxX - CUE.r, c.x));
                    this.events.push({type: "cushion", speed: Math.abs(c.vx)});
                    c.vx = -c.vx * PHYS.cushion;
                }
                if (c.z < f.minZ + CUE.r || c.z > f.maxZ - CUE.r) {
                    c.z = Math.max(f.minZ + CUE.r, Math.min(f.maxZ - CUE.r, c.z));
                    this.events.push({type: "cushion", speed: Math.abs(c.vz)});
                    c.vz = -c.vz * PHYS.cushion;
                }
                const g = f.hashOf(c.x, c.z);
                const gx = g % f.hx;
                const gz = g / f.hx | 0;
                for (let oz = -2; oz <= 2; oz++) {
                    const rz = gz + oz;
                    if (rz < 0 || rz >= f.hz) continue;
                    for (let ox = -2; ox <= 2; ox++) {
                        const rx = gx + ox;
                        if (rx < 0 || rx >= f.hx) continue;
                        let j = f.head[rz * f.hx + rx];
                        while (j >= 0) {
                            const nj = f.next[j];
                            const jo = j * STRIDE;
                            const dx = c.x - f.data[jo];
                            const dz = c.z - f.data[jo + 1];
                            const dsq = dx * dx + dz * dz;
                            if (dsq < R * R && dsq > 1e-12) {
                                const dist = Math.sqrt(dsq);
                                const nx = dx / dist;
                                const nz = dz / dist;
                                if (!this.contactSeeded) this.seedWave(f.data[jo], f.data[jo + 1]);
                                const movable = this.wake(j);
                                const rel = (c.vx - f.vx[j]) * nx + (c.vz - f.vz[j]) * nz;
                                if (rel < 0) {
                                    if (movable) {
                                        const imp = -(1 + PHYS.restitution) * rel / (1 / CUE.mass + 1);
                                        c.vx += imp / CUE.mass * nx;
                                        c.vz += imp / CUE.mass * nz;
                                        f.vx[j] = f.vx[j] - imp * nx;
                                        f.vz[j] = f.vz[j] - imp * nz;
                                    } else {
                                        c.vx -= (1 + PHYS.restitution) * rel * nx;
                                        c.vz -= (1 + PHYS.restitution) * rel * nz;
                                    }
                                }
                                const overlap = R - dist;
                                if (movable) this.relocate(j, f.data[jo] - nx * overlap, f.data[jo + 1] - nz * overlap); else {
                                    c.x += nx * overlap;
                                    c.z += nz * overlap;
                                }
                                this.markHit(j);
                                f.data[jo + 3] = this.time;
                            }
                            j = nj;
                        }
                    }
                }
            }
            for (const p of f.pockets) {
                if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < (p.r - 1) ** 2) {
                    c.live = false;
                    c.falling = 0.5;
                    this.stats.scratch = true;
                    this.events.push({type: "scratch"});
                    return;
                }
            }
            if (Math.hypot(c.vx, c.vz) < PHYS.stopSpeed) {
                c.live = false;
                c.vx = 0;
                c.vz = 0;
            }
        }

        // ---------------------------------------------------------------- the shock wave
        seedWave(x, z) {
            this.contactSeeded = true;
            const c = this.f.waveOf(x, z);
            const sp = Math.hypot(this.cue.vx, this.cue.vz) || 1;
            const keep = Math.min(1, (sp / this.launchSpeed) ** 1.5);
            const energy = this.pendingEnergy * keep;
            this.wE[c] = energy;
            this.wDx[c] = this.cue.vx / sp;
            this.wDz[c] = this.cue.vz / sp;
            this.wHop[c] = 0;
            this.wQueued[c] = this.shot;
            this.wArrive[c] = this.time;
            this.nextFront[this.nextN++] = c;
            this.events.push({type: "impact", x, z, energy});
        }

        waveTick() {
            if (this.frontN === 0 && this.nextN === 0) return;
            if (this.nextN > 0) {
                for (let k2 = 0; k2 < this.nextN; k2++) this.front[this.frontN++] = this.nextFront[k2];
                this.nextN = 0;
            }
            const f = this.f;
            const fc = this.frontCentre;
            let sx = 0, sz = 0, sw = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            let processed = 0;
            let k = 0;
            for (; k < this.frontN && processed < WAVE.maxCellsPerTick; k++) {
                const c = this.front[k];
                if (this.wFired[c] === this.shot) continue;
                if (this.wArrive[c] > this.time) continue;
                if (this.activeN > PHYS.activeCap - 600) break;
                processed++;
                let E = this.wE[c];
                this.wE[c] = 0;
                this.wFired[c] = this.shot;
                if (E < WAVE.minCellEnergy) continue;
                let dx = this.wDx[c];
                let dz = this.wDz[c];
                const dl = Math.hypot(dx, dz) || 1;
                dx /= dl;
                dz /= dl;
                const bo = f.boosterAt[c];
                if (bo >= 0 && this.boosterUsed[bo] !== this.shot) {
                    this.boosterUsed[bo] = this.shot;
                    this.stats.boosters += 1;
                    E *= BOOSTERS.gain;
                    this.events.push({type: "booster", index: bo});
                }
                const n = f.waveCount[c];
                const fill = Math.min(1, n / (f.fullCount * 0.7));
                const consume = n * WAVE.costPerBall;
                if (n > 0) this.kickCell(c, E, n, dx, dz);
                this.stats.cellsFired += 1;
                const hop = this.wHop[c];
                if (hop > this.stats.chain) this.stats.chain = hop;
                const cx = c % f.wx;
                const cz = c / f.wx | 0;
                const wx = f.minX + (cx + 0.5) * WAVE.cell;
                const wz = f.minZ + (cz + 0.5) * WAVE.cell;
                sx += wx * E;
                sz += wz * E;
                sw += E;
                if (wx < minX) minX = wx;
                if (wx > maxX) maxX = wx;
                if (wz < minZ) minZ = wz;
                if (wz > maxZ) maxZ = wz;
                const out = Math.max(0, E - consume) * (hop === 0 ? 1 : WAVE.lossEmpty + (WAVE.lossFull - WAVE.lossEmpty) * fill);
                if (out < WAVE.minCellEnergy) continue;
                let wsum = 0;
                const ws = this.weights;
                const nb = this.nbCell;
                for (let q = 0; q < 8; q++) {
                    const u = DIRS[q];
                    const nx = cx + Math.round(u[0] * 1.2);
                    const nz = cz + Math.round(u[1] * 1.2);
                    const nc = nz * f.wx + nx;
                    if (nx < 0 || nz < 0 || nx >= f.wx || nz >= f.wz || this.wFired[nc] === this.shot) {
                        ws[q] = 0;
                        continue;
                    }
                    nb[q] = nc;
                    const dot = u[0] * dx + u[1] * dz;
                    const nfill = Math.min(1, f.waveCount[nc] / (f.fullCount * 0.7));
                    ws[q] = ((dot > 0 ? dot ** WAVE.forwardBias : 0) + WAVE.isotropic) * (0.06 + 0.94 * nfill);
                    wsum += ws[q];
                }
                if (wsum <= 0) continue;
                for (let q = 0; q < 8; q++) {
                    if (ws[q] === 0) continue;
                    const u = DIRS[q];
                    const nc = nb[q];
                    const share = out * ws[q] / wsum;
                    const dot = u[0] * dx + u[1] * dz;
                    const stepLen = q < 4 ? 1 : Math.SQRT2;
                    const arrive = this.wArrive[c] + WAVE.tickSec * stepLen * (0.8 + 0.4 * this.rand()) / (0.35 + 0.65 * (dot > 0 ? dot : 0));
                    this.wE[nc] += share;
                    this.wDx[nc] += u[0] * share;
                    this.wDz[nc] += u[1] * share;
                    if (this.wQueued[nc] !== this.shot) {
                        this.wQueued[nc] = this.shot;
                        this.wHop[nc] = hop + 1;
                        this.wDx[nc] = u[0] * share;
                        this.wDz[nc] = u[1] * share;
                        this.wE[nc] = share;
                        this.wArrive[nc] = arrive;
                        this.nextFront[this.nextN++] = nc;
                    } else if (arrive < this.wArrive[nc]) this.wArrive[nc] = arrive;
                }
            }
            let keep = 0;
            for (let q = 0; q < this.frontN; q++) {
                const c = this.front[q];
                if (this.wFired[c] !== this.shot) this.front[keep++] = c;
            }
            this.frontN = keep;
            if (sw > 0) {
                fc.x = sx / sw;
                fc.z = sz / sw;
                fc.w = sw;
                fc.spread = Math.max(maxX - minX, maxZ - minZ);
            }
        }

        /** Gives every ball in wave cell c a real push along the front direction. */
        kickCell(c, E, n, dx, dz) {
            const f = this.f;
            const consume = n * WAVE.costPerBall;
            const share = Math.min(1, E / consume);
            const perBall = E / n;
            const speed = Math.min(WAVE.kickMax, WAVE.kickMin + WAVE.kickGain * Math.sqrt(perBall));
            const cx = c % f.wx;
            const cz = c / f.wx | 0;
            const x0 = f.minX + cx * WAVE.cell;
            const z0 = f.minZ + cz * WAVE.cell;
            const h0 = f.hashOf(x0, z0);
            const h1 = f.hashOf(x0 + WAVE.cell - 1e-3, z0 + WAVE.cell - 1e-3);
            const gx0 = h0 % f.hx, gz0 = h0 / f.hx | 0, gx1 = h1 % f.hx, gz1 = h1 / f.hx | 0;
            const now = this.time;
            for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
                let j = f.head[gz * f.hx + gx];
                while (j >= 0) {
                    const nj = f.next[j];
                    const o = j * STRIDE;
                    if (this.kickStamp[j] !== this.shot && f.waveOfHash(f.cellOf[j]) === c && (share >= 1 || this.rand() < share)) {
                        if (!this.wake(j)) return;
                        this.kickStamp[j] = this.shot;
                        const a = (this.rand() - 0.5) * 2 * WAVE.kickJitter;
                        const ca = Math.cos(a), sa = Math.sin(a);
                        const s = speed * (0.85 + this.rand() * 0.3);
                        f.vx[j] = f.vx[j] + (dx * ca - dz * sa) * s;
                        f.vz[j] = f.vz[j] + (dx * sa + dz * ca) * s;
                        f.data[o + 3] = now;
                        f.touch(j, f.data[o], f.data[o + 1]);
                    }
                    j = nj;
                }
            }
        }
    };

    // MillionBilliardsGame/src/sound.ts
    var MillionSound = class {
        constructor(audio2) {
            this.audio = audio2;
            this.rumble = null;
            this.charge = null;
            this.lastClack = 0;
        }

        tone(freq, dur, type, gain, delay = 0, slideTo) {
            const o = this.audio.out();
            if (!o) return;
            const {ctx, dest} = o;
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
            const g = ctx.createGain();
            g.gain.setValueAtTime(gain, t);
            g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
            osc.connect(g).connect(dest);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        }

        noiseBuffer(ctx, sec) {
            const len = Math.floor(ctx.sampleRate * sec);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = buf.getChannelData(0);
            let last2 = 0;
            for (let i = 0; i < len; i++) {
                last2 = (last2 + (Math.random() * 2 - 1) * 0.08) * 0.995;
                d[i] = last2 * 6;
            }
            return buf;
        }

        clack(freq, gain) {
            const o = this.audio.out();
            if (!o) return;
            const {ctx, dest} = o;
            const len = Math.floor(ctx.sampleRate * 0.035);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 7));
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const f = ctx.createBiquadFilter();
            f.type = "bandpass";
            f.frequency.value = freq;
            f.Q.value = 7;
            const g = ctx.createGain();
            g.gain.value = gain;
            src.connect(f).connect(g).connect(dest);
            src.start();
        }

        /** 0..1: how loud the rolling crowd is (called every frame). */
        setRumble(level) {
            const o = this.audio.out();
            if (!o) return;
            const {ctx, dest} = o;
            if (!this.rumble) {
                const src = ctx.createBufferSource();
                src.buffer = this.noiseBuffer(ctx, 2);
                src.loop = true;
                const filter = ctx.createBiquadFilter();
                filter.type = "lowpass";
                filter.frequency.value = 400;
                const gain = ctx.createGain();
                gain.gain.value = 0;
                src.connect(filter).connect(gain).connect(dest);
                src.start();
                this.rumble = {src, gain, filter};
            }
            const l = Math.max(0, Math.min(1, level));
            this.rumble.gain.gain.setTargetAtTime(l * 0.55, ctx.currentTime, 0.08);
            this.rumble.filter.frequency.setTargetAtTime(250 + l * 1600, ctx.currentTime, 0.1);
            const now = performance.now();
            if (l > 0.02 && now - this.lastClack > 40 - l * 30) {
                this.lastClack = now;
                this.clack(2200 + Math.random() * 1500, 0.15 + l * 0.35);
            }
        }

        chargeLevel(p) {
            const o = this.audio.out();
            if (!o) return;
            const {ctx, dest} = o;
            if (p === null) {
                if (this.charge) {
                    this.charge.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
                    const c = this.charge;
                    window.setTimeout(() => c.osc.stop(), 200);
                    this.charge = null;
                }
                return;
            }
            if (!this.charge) {
                const osc = ctx.createOscillator();
                osc.type = "sawtooth";
                const gain = ctx.createGain();
                gain.gain.value = 0;
                osc.connect(gain).connect(dest);
                osc.start();
                this.charge = {osc, gain};
            }
            this.charge.osc.frequency.setTargetAtTime(80 + p * 260, ctx.currentTime, 0.03);
            this.charge.gain.gain.setTargetAtTime(0.03 + p * 0.05, ctx.currentTime, 0.03);
        }

        shot(power) {
            this.clack(1800, 1 + power);
            this.tone(90, 0.25, "sine", 0.4 * power + 0.1, 0, 40);
        }

        impact(strength) {
            this.tone(70, 0.9, "sine", 0.5 * strength + 0.15, 0, 30);
            this.clack(900, 0.8);
        }

        booster() {
            [660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.12, i * 0.06));
        }

        pocket(count) {
            this.clack(600 + Math.random() * 200, Math.min(0.8, 0.2 + count * 0.01));
        }

        moment(level) {
            const base = [392, 440, 523, 659][Math.min(3, level)];
            [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.3, "square", 0.06, i * 0.09));
        }

        record() {
            [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.1, i * 0.08));
        }

        end() {
            [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i === 3 ? 0.6 : 0.16, "square", 0.07, i * 0.14));
        }

        stopAll() {
            this.setRumble(0);
            this.chargeLevel(null);
        }
    };

    // MillionBilliardsGame/src/main.ts
    installErrorOverlay("100万球ビリヤード");
    var $ = (id) => document.getElementById(id);
    var fmt = (n) => Math.round(n).toLocaleString("ja-JP");
    var canvas = $("gl");
    var renderer = Renderer.create(canvas, {antialias: false});
    if (!renderer) {
        showNoWebGL("このブラウザではWebGL（3D表示）が使えないため、100万球の盤面を表示できません。<br>ハードウェアアクセラレーション（GPU）を有効にした Chrome / Edge / Firefox / Safari でお試しください。");
        throw new Error("WebGL unavailable");
    }
    watchContextLoss(canvas, renderer);
    var gl = renderer.gl;
    var {backend, persistent} = detectBackend();
    var store = createMillionStore(backend);
    var prefs = new JsonStore("prefs3d", () => ({
        muted: false, shake: true, effects: true, autoCam: true, lowRes: false
    }), backend);
    var params = new URLSearchParams(location.search);
    var seed = Number(params.get("seed")) || Date.now() & 4294967295;
    var rng = seededRng(seed);
    var t0 = performance.now();
    var sim = new Sim(rng);
    var field = sim.f;
    var initMs = performance.now() - t0;
    var balls = new BallRenderer(gl, field);
    var scene = new TableScene(renderer, field);
    var cam = new Camera();
    var rig = new CameraRig(field.w, field.d);
    var audio = new AudioOut();
    var sound = new MillionSound(audio);
    var picker = new LinePicker(COMMENTARY, rng, {baseGapMs: 1600, holdMs: 2200, recentSize: 10});

    function applyPrefs() {
        const p = prefs.get();
        audio.muted = p.muted;
        audio.apply();
        rig.shakeEnabled = p.shake;
        rig.autoFollow = p.autoCam;
        scene.effects = p.effects;
        $("btn-mute").textContent = p.muted ? "🔇" : "🔊";
    }

    applyPrefs();
    if (!persistent) {
        const w = $("save-warn");
        w.classList.remove("hidden");
        w.textContent = "⚠ この環境では記録を保存できません（閉じると消えます）";
    }
    var TRACK = {
        x0: -CUE_TRACK_INSET, z0: -CUE_TRACK_INSET, x1: field.w + CUE_TRACK_INSET, z1: field.d + CUE_TRACK_INSET
    };
    var TW = TRACK.x1 - TRACK.x0;
    var TD = TRACK.z1 - TRACK.z0;
    var PERIM = 2 * (TW + TD);

    function trackPoint(t) {
        let u = (t % PERIM + PERIM) % PERIM;
        if (u < TW) return {x: TRACK.x0 + u, z: TRACK.z0};
        u -= TW;
        if (u < TD) return {x: TRACK.x1, z: TRACK.z0 + u};
        u -= TD;
        if (u < TW) return {x: TRACK.x1 - u, z: TRACK.z1};
        u -= TW;
        return {x: TRACK.x0, z: TRACK.z1 - u};
    }

    function nearestTrackT(x, z) {
        const cands = [[Math.max(0, Math.min(TW, x - TRACK.x0)), Math.abs(z - TRACK.z0)], [TW + Math.max(0, Math.min(TD, z - TRACK.z0)), Math.abs(x - TRACK.x1)], [TW + TD + Math.max(0, Math.min(TW, TRACK.x1 - x)), Math.abs(z - TRACK.z1)], [2 * TW + TD + Math.max(0, Math.min(TD, TRACK.z1 - z)), Math.abs(x - TRACK.x0)]];
        cands.sort((a, b) => a[1] - b[1]);
        return cands[0][0];
    }

    var G = {
        phase: "aim",
        paused: false,
        run: new Run(),
        trackT: TW / 2,
        aimX: 0,
        aimZ: 1,
        charging: false,
        chargeT: 0,
        power: 0,
        shotPower: 0,
        resultT: 0,
        lastResult: null,
        newRecords: [],
        momentsHit: 0,
        goldAnnounced: false,
        rushAnnounced: false,
        impactSeen: false,
        idleT: 0,
        view: "aim",
        intro: 2.2
        // seconds of the opening overview before the camera swoops to the cue
    };

    function cuePos() {
        return trackPoint(G.trackT);
    }

    function aimAtCentre() {
        const c = cuePos();
        const dx = field.cx - c.x;
        const dz = field.cz - c.z;
        const l = Math.hypot(dx, dz) || 1;
        G.aimX = dx / l;
        G.aimZ = dz / l;
    }

    aimAtCentre();

    function pickGold() {
        let g = Math.floor(rng() * field.pockets.length);
        if (g === G.run.gold) g = (g + 1) % field.pockets.length;
        G.run.gold = g;
    }

    pickGold();
    var tickerTimer = 0;

    function say(key, priority = 1) {
        const line = picker.request(key, performance.now(), {priority});
        if (!line) return;
        const el = $("ticker-text");
        el.textContent = line.text;
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
        window.clearTimeout(tickerTimer);
        tickerTimer = window.setTimeout(() => picker.release(), 2600);
    }

    var shown = {score: 0, moved: 0, hit: 0, pocket: 0};

    function updateHud(dt) {
        const run = G.run;
        const ease = (cur, target) => Math.abs(target - cur) < 1 ? target : cur + (target - cur) * Math.min(1, dt * 7);
        shown.score = ease(shown.score, run.score);
        $("score").textContent = fmt(shown.score);
        $("combo").textContent = run.combo > 0 ? `COMBO ×${(10 + (run.combo - 1) * SCORE.comboStepTenths) / 10}` : "";
        $("remaining").textContent = fmt(field.remaining);
        $("shots").textContent = `${Math.min(SCORE.shotsPerRun, run.shot + 1)} / ${SCORE.shotsPerRun}`;
        const live = G.phase === "shot";
        $("live").classList.toggle("hidden", !live);
        if (live) {
            const s = sim.stats;
            shown.moved = ease(shown.moved, s.moved);
            shown.hit = ease(shown.hit, s.collided);
            shown.pocket = ease(shown.pocket, s.pocketed);
            $("live-moved").textContent = fmt(shown.moved);
            $("live-hit").textContent = fmt(shown.hit);
            $("live-pocket").textContent = fmt(shown.pocket);
            $("live-chain").textContent = String(s.chain);
            $("live-boost").textContent = String(s.boosters);
        }
        $("power").classList.toggle("hidden", !G.charging);
        $("power-fill").style.width = `${G.power * 100}%`;
    }

    function showMoment(title, sub) {
        const m = $("moment");
        $("moment-title").textContent = title;
        $("moment-sub").textContent = sub;
        m.classList.remove("hidden");
        m.style.animation = "none";
        void m.offsetWidth;
        m.style.animation = "";
    }

    function toast(text) {
        const t = $("toast");
        t.textContent = text;
        t.classList.remove("hidden");
        t.style.animation = "none";
        void t.offsetWidth;
        t.style.animation = "";
    }

    function showResult(res, broke) {
        $("r-no").textContent = `${G.run.shot} / ${SCORE.shotsPerRun}`;
        $("r-points").textContent = fmt(res.points);
        const tag = (k) => broke.includes(k) ? '<span class="new">NEW</span>' : "";
        const rows = [[`動いた玉${tag("bestMoved")}`, fmt(res.moved)], ["衝突した玉", fmt(res.collided)], [`ポケット${tag("bestPocketed")}`, `${fmt(res.pocketed)}（${res.pockets}か所）`], [`連鎖${tag("bestChain")}`, `${res.chain} 段`], ["BOOST通過", String(res.boosters)], ["基本点", fmt(res.base)], ["ポケット数ボーナス", `×${(res.varietyTenths / 10).toFixed(1)}`], [`コンボ${tag("bestCombo")}`, res.combo > 0 ? `${res.combo}連 ×${(res.comboTenths / 10).toFixed(1)}` : "―"]];
        if (res.goldBalls > 0) rows.splice(3, 0, ["金ポケット（×10）", fmt(res.goldBalls)]);
        $("r-table").innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
        $("result").classList.remove("hidden");
    }

    function recordsHtml() {
        const s = store.get();
        const rows = [[RECORD_NAMES.bestScore, s.bestScore], [RECORD_NAMES.bestShotPoints, s.bestShotPoints], [RECORD_NAMES.bestMoved, s.bestMoved], [RECORD_NAMES.bestPocketed, s.bestPocketed], [RECORD_NAMES.bestChain, s.bestChain], [RECORD_NAMES.bestCombo, s.bestCombo], ["累計で動かした玉", s.totalMoved], ["プレイ回数", s.runs]];
        return rows.map(([k, v]) => `<div><span>${k}</span><b>${fmt(v)}</b></div>`).join("");
    }

    function fire() {
        if (G.phase !== "aim" || G.paused) return;
        G.charging = false;
        sound.chargeLevel(null);
        const p = Math.max(0.04, G.power);
        const c = cuePos();
        sim.shoot(c.x, c.z, G.aimX, G.aimZ, p);
        G.shotPower = p;
        G.phase = "shot";
        G.momentsHit = 0;
        G.goldAnnounced = false;
        G.rushAnnounced = false;
        G.impactSeen = false;
        G.idleT = 0;
        shown.moved = shown.hit = shown.pocket = 0;
        sound.shot(p);
        rig.addShake(2 + p * 4);
        say(p > 0.7 ? "shotStrong" : "shotWeak", 2);
        if (G.view === "aim") rig.setMode("chain");
    }

    function endShot() {
        const res = scoreShot(sim.stats, field.pockets, G.run.gold, G.run.combo);
        const comboBefore = G.run.combo;
        G.run.record(res);
        let broke = [];
        const before = store.get();
        const hadRecords = before.bestMoved > 0;
        store.update((s) => {
            broke = applyShot(s, res);
        });
        G.lastResult = res;
        G.newRecords = broke;
        showResult(res, broke);
        G.phase = "result";
        G.resultT = 0;
        rig.setMode("result");
        if (!sim.stats.cellsFired && res.moved === 0) say("miss", 2); else if (res.moved >= 2e5) say("bigEnd", 2); else if (res.chain >= 160) say("longChain", 2); else say("smallEnd", 1);
        if (res.combo >= 2) say("combo", 3); else if (comboBefore >= 1 && res.combo === 0) say("comboBreak", 2);
        if (hadRecords && broke.length) {
            sound.record();
            toast(`記録更新！ ${broke.map((k) => RECORD_NAMES[k]).join("・")}`);
            say("record", 3);
        }
    }

    function nextShot() {
        $("result").classList.add("hidden");
        if (G.run.over) {
            finishRun();
            return;
        }
        G.phase = "aim";
        pickGold();
        G.view = "aim";
        rig.setMode("aim");
        if (G.run.shotsLeft === 1) say("lastShot", 3);
    }

    function finishRun() {
        G.phase = "end";
        let broke = [];
        store.update((s2) => {
            broke = applyRunEnd(s2, G.run);
        });
        sound.end();
        say("runEnd", 3);
        rig.setMode("overview");
        $("e-score").textContent = fmt(G.run.score);
        const max = Math.max(1, ...G.run.results.map((r) => r.moved));
        $("e-bars").innerHTML = G.run.results.map((r) => `<i style="height:${Math.max(3, r.moved / max * 100)}%"><span>${r.moved >= 1e4 ? `${Math.round(r.moved / 1e3)}k` : r.moved}</span></i>`).join("");
        const s = store.get();
        const rows = [["動かした玉（合計）", fmt(G.run.results.reduce((a, r) => a + r.moved, 0))], ["ポケットに入れた玉", fmt(BALL_COUNT - field.remaining)], ["1ショット最多移動", fmt(G.run.best("moved"))], ["最長連鎖", `${G.run.best("chain")} 段`], ["最大コンボ", String(G.run.maxCombo)], [`自己ベスト${broke.includes("bestScore") ? '<span class="new">NEW</span>' : ""}`, fmt(s.bestScore)]];
        $("e-table").innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
        $("end").classList.remove("hidden");
        if (broke.includes("bestScore") && s.runs > 1) toast("最高スコア更新！");
    }

    function retry() {
        $("end").classList.add("hidden");
        $("result").classList.add("hidden");
        setPaused(false);
        sim.resetBoard();
        balls.uploadAll();
        G.run = new Run();
        G.phase = "aim";
        G.charging = false;
        G.power = 0;
        shown.score = 0;
        sound.stopAll();
        pickGold();
        aimAtCentre();
        G.view = "aim";
        rig.setMode("aim");
        say("retry", 3);
    }

    function setPaused(on) {
        G.paused = on;
        $("pause").classList.toggle("hidden", !on);
        if (on) {
            G.charging = false;
            sound.stopAll();
            const p = prefs.get();
            $("s-shake").checked = p.shake;
            $("s-effects").checked = p.effects;
            $("s-autocam").checked = p.autoCam;
            $("s-lowres").checked = p.lowRes;
            $("s-sound").checked = !p.muted;
            $("p-records").innerHTML = recordsHtml();
            const note = $("p-save");
            note.textContent = !persistent ? "この環境ではブラウザの保存領域が使えないため、記録はページを閉じると消えます。" : store.lastWriteOk ? "記録と設定はこのブラウザに保存されています。" : "記録の保存に失敗しました（容量不足など）。";
            note.classList.toggle("warn", !persistent || !store.lastWriteOk);
            say("pause", 1);
        }
    }

    var settingIds = ["s-shake", "s-effects", "s-autocam", "s-lowres", "s-sound"];
    for (const id of settingIds) {
        $(id).addEventListener("change", () => {
            const lowBefore = prefs.get().lowRes;
            prefs.update((p) => {
                p.shake = $("s-shake").checked;
                p.effects = $("s-effects").checked;
                p.autoCam = $("s-autocam").checked;
                p.lowRes = $("s-lowres").checked;
                p.muted = !$("s-sound").checked;
            });
            applyPrefs();
            if (prefs.get().lowRes !== lowBefore) fit();
        });
    }
    $("p-resume").addEventListener("click", () => setPaused(false));
    $("p-retry").addEventListener("click", () => retry());
    $("e-again").addEventListener("click", () => retry());
    $("btn-retry").addEventListener("click", () => retry());
    $("btn-pause").addEventListener("click", () => setPaused(!G.paused));
    $("btn-view").addEventListener("click", () => toggleView());
    $("btn-mute").addEventListener("click", () => {
        audio.unlock();
        prefs.update((p) => {
            p.muted = !p.muted;
        });
        applyPrefs();
    });
    $("result").addEventListener("pointerdown", () => {
        if (G.phase === "result" && G.resultT > 0.4) nextShot();
    });

    function toggleView() {
        G.view = G.view === "aim" ? "overview" : "aim";
        if (G.phase === "aim") rig.setMode(G.view === "aim" ? "aim" : "overview"); else rig.setMode(G.view === "aim" ? "chain" : "overview");
    }

    var keys = /* @__PURE__ */ new Set();
    var viewW = 1;
    var viewH = 1;
    var BALLY = 1;

    function groundPoint(sx, sy) {
        const ray = cam.ray(sx, sy, viewW, viewH);
        if (ray.d[1] >= -1e-4) return null;
        const t = (BALLY - ray.o[1]) / ray.d[1];
        return {x: ray.o[0] + ray.d[0] * t, z: ray.o[2] + ray.d[2] * t};
    }

    function aimAt(sx, sy) {
        const p = groundPoint(sx, sy);
        if (!p) return;
        const c = cuePos();
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const l = Math.hypot(dx, dz);
        if (l < 4) return;
        G.aimX = dx / l;
        G.aimZ = dz / l;
    }

    function nearCue(sx, sy) {
        const c = cuePos();
        const p = cam.project([c.x, CUE.r, c.z], viewW, viewH);
        return !p.behind && Math.hypot(p.x - sx, p.y - sy) < 36;
    }

    var pointers = /* @__PURE__ */ new Map();
    var drag = null;
    var pinch = null;

    function startCharge() {
        if (G.phase !== "aim" || G.paused || G.charging) return;
        G.charging = true;
        G.chargeT = 0;
        G.power = 0;
    }

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
        audio.unlock();
        canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, {x: e.clientX, y: e.clientY, type: e.pointerType});
        if (G.phase === "result" && G.resultT > 0.4) {
            nextShot();
            return;
        }
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
            drag = null;
            return;
        }
        const x = e.clientX, y = e.clientY;
        if (e.button === 2) drag = {
            kind: "orbit", x, y
        }; else if (e.button === 1 || e.button === 0 && e.shiftKey) drag = {
            kind: "pan", x, y
        }; else if (G.phase === "aim" && nearCue(x, y)) drag = {
            kind: "cue", x, y
        }; else if (e.pointerType === "touch") {
            drag = {kind: "aimTouch", x, y};
            if (G.phase === "aim") aimAt(x, y);
        } else {
            drag = {kind: "charge", x, y};
            if (G.phase === "aim") {
                aimAt(x, y);
                startCharge();
            }
        }
    });
    canvas.addEventListener("pointermove", (e) => {
        const p = pointers.get(e.pointerId);
        if (p) {
            p.x = e.clientX;
            p.y = e.clientY;
        }
        if (pinch && pointers.size >= 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if (pinch.d > 0) rig.zoomBy(pinch.d / Math.max(1, d));
            rig.pan(-(mx - pinch.mx), my - pinch.my);
            pinch = {d, mx, my};
            return;
        }
        const x = e.clientX, y = e.clientY;
        if (drag) {
            const dx = x - drag.x, dy = y - drag.y;
            drag.x = x;
            drag.y = y;
            if (drag.kind === "orbit") rig.orbit(-dx * 6e-3, dy * 4e-3); else if (drag.kind === "pan") rig.pan(-dx, dy); else if (drag.kind === "cue") {
                const g = groundPoint(x, y);
                if (g) G.trackT = nearestTrackT(g.x, g.z);
            } else if (G.phase === "aim") aimAt(x, y);
            return;
        }
        if (e.pointerType === "mouse" && G.phase === "aim" && !G.paused) aimAt(x, y);
        canvas.style.cursor = G.phase === "aim" && nearCue(x, y) ? "grab" : "crosshair";
    });

    function pointerEnd(e) {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if ((drag == null ? void 0 : drag.kind) === "charge" && G.charging) fire();
        if (pointers.size === 0) drag = null;
    }

    canvas.addEventListener("pointerup", pointerEnd);
    canvas.addEventListener("pointercancel", pointerEnd);
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        rig.zoomBy(Math.exp(e.deltaY * 12e-4));
    }, {passive: false});
    var holdBtn = (id, down, up) => {
        const el = $(id);
        el.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            audio.unlock();
            el.setPointerCapture(e.pointerId);
            down();
        });
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
    };
    holdBtn("t-shot", () => G.phase === "result" ? nextShot() : startCharge(), () => G.charging && fire());
    holdBtn("t-left", () => keys.add("ArrowLeft"), () => keys.delete("ArrowLeft"));
    holdBtn("t-right", () => keys.add("ArrowRight"), () => keys.delete("ArrowRight"));
    if (matchMedia("(pointer: coarse)").matches) $("touch-ui").classList.remove("hidden");
    window.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT") return;
        audio.unlock();
        const k = e.key;
        if (k === "Tab") {
            e.preventDefault();
            toggleView();
            return;
        }
        if (k === "p" || k === "P" || k === "Escape") {
            setPaused(!G.paused);
            return;
        }
        if (k === "r" || k === "R") {
            retry();
            return;
        }
        if (k === "m" || k === "M") {
            $("btn-mute").click();
            return;
        }
        if (k === "c" || k === "C") {
            prefs.update((p) => {
                p.autoCam = !p.autoCam;
            });
            applyPrefs();
            toast(prefs.get().autoCam ? "カメラ自動追従：オン" : "カメラ自動追従：オフ");
            return;
        }
        if (k === " " || k === "Enter") {
            e.preventDefault();
            if (G.phase === "result" && G.resultT > 0.4) nextShot(); else if (k === " " && !e.repeat) startCharge();
            return;
        }
        keys.add(k.length === 1 ? k.toLowerCase() : k);
    });
    window.addEventListener("keyup", (e) => {
        const k = e.key;
        if (k === " " && G.charging) fire();
        keys.delete(k.length === 1 ? k.toLowerCase() : k);
    });
    window.addEventListener("blur", () => keys.clear());

    function handleHeldKeys(dt) {
        if (G.phase === "aim" && !G.paused) {
            const mv = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
            if (mv) G.trackT += mv * dt * 260;
            const rot = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
            if (rot) {
                const a = Math.atan2(G.aimZ, G.aimX) + rot * dt * 0.6;
                G.aimX = Math.cos(a);
                G.aimZ = Math.sin(a);
            }
        }
        const px = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
        const pz = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
        if (px || pz) rig.pan(px * dt * 700, pz * dt * 700);
        const ry = (keys.has("e") ? 1 : 0) - (keys.has("q") ? 1 : 0);
        if (ry) rig.orbit(ry * dt * 1.4, 0);
        if (keys.has("+") || keys.has("=")) rig.zoomBy(Math.exp(-dt * 1.5));
        if (keys.has("-")) rig.zoomBy(Math.exp(dt * 1.5));
    }

    function fit() {
        viewW = Math.max(1, window.innerWidth);
        viewH = Math.max(1, window.innerHeight);
        const dpr = prefs.get().lowRes ? Math.min(1, window.devicePixelRatio || 1) * 0.7 : Math.min(1.75, window.devicePixelRatio || 1);
        renderer.resize(canvas, viewW, viewH, dpr);
        cam.aspect = viewW / viewH;
        rig.aspect = cam.aspect;
    }

    window.addEventListener("resize", fit);
    fit();
    var last = performance.now();
    var acc = 0;
    var simMs = 0;
    var frameMs = 0;
    var fps = 60;
    document.addEventListener("visibilitychange", () => {
        last = performance.now();
        if (document.hidden) {
            G.charging = false;
            sound.stopAll();
        }
    });

    function processEvents() {
        for (const ev of sim.events) {
            switch (ev.type) {
                case "impact": {
                    const s = Math.min(1, ev.energy / WAVE.maxEnergy);
                    scene.impact(ev.x, ev.z, s);
                    sound.impact(s);
                    rig.addShake(4 + s * 8);
                    if (!G.impactSeen) {
                        G.impactSeen = true;
                        say("impact", 2);
                    }
                    break;
                }
                case "booster":
                    scene.boosterHit(ev.index);
                    sound.booster();
                    rig.addShake(3);
                    say("booster", 3);
                    break;
                case "pocket":
                    scene.pocketHit(ev.index, ev.count);
                    sound.pocket(ev.count);
                    if (ev.index === G.run.gold && !G.goldAnnounced) {
                        G.goldAnnounced = true;
                        say("gold", 3);
                    }
                    break;
                case "scratch":
                    say("scratch", 2);
                    break;
                case "cushion":
                    break;
            }
        }
        sim.events.length = 0;
        if (G.phase === "shot") {
            while (G.momentsHit < MOMENTS.length && sim.stats.moved >= MOMENTS[G.momentsHit].moved) {
                const m = MOMENTS[G.momentsHit];
                showMoment(m.label, m.sub);
                sound.moment(G.momentsHit);
                rig.addShake(5 + G.momentsHit * 3);
                say(m.id, 3);
                G.momentsHit += 1;
            }
            if (!G.rushAnnounced && sim.stats.pocketed >= 1e3) {
                G.rushAnnounced = true;
                say("pocketRush", 2);
            }
        }
    }

    function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden) return;
        const realDt = Math.max(0, (now - last) / 1e3);
        const dt = Math.min(0.1, realDt);
        last = now;
        fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
        const fStart = performance.now();
        handleHeldKeys(dt);
        if (!G.paused) {
            if (G.charging) {
                G.chargeT += Math.min(realDt, 0.25);
                G.power = Math.min(1, G.chargeT / CUE.chargeSec);
                sound.chargeLevel(G.power);
                if (G.power >= 1 && G.chargeT - dt < CUE.chargeSec) say("charge", 1);
            }
            const s0 = performance.now();
            acc += dt;
            let steps = 0;
            while (acc >= PHYS.dt && steps < PHYS.maxStepsPerFrame) {
                sim.step(PHYS.dt);
                acc -= PHYS.dt;
                steps++;
            }
            if (steps >= PHYS.maxStepsPerFrame) acc = 0;
            simMs = performance.now() - s0;
            processEvents();
            if (G.phase === "shot" && !sim.running) endShot();
            if (G.phase === "result") {
                G.resultT += dt;
                if (G.resultT > 4.5) nextShot();
            }
            if (G.phase === "aim") {
                G.idleT += dt;
                if (G.idleT > 14) {
                    G.idleT = 0;
                    say(rng() < 0.5 ? "idle" : "aimHint", 0);
                }
            }
            scene.update(dt);
            sound.setRumble(G.phase === "shot" ? Math.min(1, sim.activeN / 5e4) : 0);
        }
        if (G.intro > 0) {
            G.intro -= Math.min(realDt, 0.25);
            if (G.intro <= 0 && G.phase === "aim" && G.view === "aim") rig.setMode("aim");
        }
        if (G.phase === "shot" && G.view === "aim" && rig.mode === "chain" && !sim.waveRunning && sim.activeN < 2e3 && sim.stats.cellsFired > 0) rig.setMode("overview");
        const c = G.phase === "shot" ? {x: sim.cue.x, z: sim.cue.z} : cuePos();
        const fc = sim.frontCentre;
        rig.update(dt, cam, {x: c.x, z: c.z, dx: G.aimX, dz: G.aimZ}, {
            x: fc.x, z: fc.z, spread: fc.spread, active: sim.waveRunning
        });
        cam.update();
        const dist = rig.distance;
        const fogColor = [0.035, 0.03, 0.055];
        renderer.begin(cam, {
            dir: [-0.35, 0.9, 0.25],
            color: [1, 0.95, 0.85],
            sky: [0.35, 0.36, 0.45],
            ground: [0.08, 0.06, 0.05],
            fogColor,
            fog: [dist * 1.6, dist * 4.5]
        }, fogColor);
        const cueVisible = G.phase !== "shot" || sim.cue.live || sim.cue.falling > 0;
        scene.drawOpaque(cam, {x: c.x, z: c.z, visible: cueVisible && sim.cue.falling <= 0});
        balls.draw(cam, canvas.height, sim.time, {
            glow: prefs.get().effects, fogColor, fog: [dist * 1.6, dist * 4.5], lightDir: [-0.35, 0.9, 0.25]
        });
        renderer.use();
        if (G.phase === "aim" && !G.paused) scene.drawAim(c, G.aimX, G.aimZ, G.charging ? G.power : 0, performance.now() / 1e3);
        scene.drawGlow(cam, performance.now() / 1e3, G.run.gold, G.phase === "aim" ? 0.35 : 0);
        updateHud(dt);
        frameMs = performance.now() - fStart;
        if (debugEnabled()) {
            const st = balls.stats;
            $("perf").textContent = `fps ${fps.toFixed(0)}  frame ${frameMs.toFixed(1)}ms  sim ${simMs.toFixed(1)}ms
active ${sim.activeN}  tiles ${st.tilesDrawn}/${field.tileCount} (${st.ranges} draws)
upload ${st.uploadedTiles} tiles ${(st.uploadedBytes / 1024).toFixed(0)}KB  init ${initMs.toFixed(0)}ms`;
        }
    }

    if (debugEnabled()) {
        $("perf").classList.remove("hidden");
        Object.assign(window, {
            __m: {
                sim, field, G, rig, balls, store, /** test hook: shoot from track position t toward angle a (radians) */
                shoot: (power, t, a) => {
                    if (t !== void 0) G.trackT = t;
                    if (a !== void 0) {
                        G.aimX = Math.cos(a);
                        G.aimZ = Math.sin(a);
                    }
                    G.power = power;
                    fire();
                }, next: () => nextShot(), retry, trackPoint
            }
        });
    }
    say("start", 3);
    window.setTimeout(() => say("aimHint", 1), 4500);
    requestAnimationFrame(frame);
})();

