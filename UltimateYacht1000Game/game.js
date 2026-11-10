"use strict";
(() => {
    // UltimateYacht1000Game/src/audio.ts
    const AudioOut = class {
        constructor() {
            this.ctx = null;
            this.master = null;
            this.silencedUntil = 0;
            this.muted = false;
            this.volume = 0.7;
        }

        unlock() {
            let _a;
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

    // UltimateYacht1000Game/src/math3d.ts
    const v3 = {
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

    function rayPlaneY(r, y) {
        if (Math.abs(r.d[1]) < 1e-6) return null;
        const t = (y - r.o[1]) / r.d[1];
        if (t < 0) return null;
        return [r.o[0] + r.d[0] * t, y, r.o[2] + r.d[2] * t];
    }

    function raySphere(r, c, radius) {
        const oc = v3.sub(r.o, c);
        const b = v3.dot(oc, r.d);
        const cc = v3.dot(oc, oc) - radius * radius;
        const h = b * b - cc;
        if (h < 0) return -1;
        const t = -b - Math.sqrt(h);
        return t >= 0 ? t : -1;
    }

    var clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    var ease = {
        out: (t) => 1 - Math.pow(1 - t, 3),
        inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        back: (t) => {
            const c1 = 1.70158, c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        },
        bounce: (t) => {
            const n1 = 7.5625, d1 = 2.75;
            if (t < 1 / d1) return n1 * t * t;
            if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
            if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    };

    // UltimateYacht1000Game/src/gl.ts
    const VS = `
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
    const FS = `
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
            const gl = r.gl;
            const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
            const mk = (data) => {
                const b = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, data, usage);
                return b;
            };
            this.vbo = mk(new Float32Array(g.pos));
            this.nbo = mk(new Float32Array(g.nrm));
            this.tbo = mk(new Float32Array(g.uv.length ? g.uv : new Array(g.pos.length / 3 * 2).fill(0)));
            this.cbo = g.col ? mk(new Float32Array(g.col)) : null;
            this.ibo = gl.createBuffer();
            this.vertexCount = g.pos.length / 3;
            this.count = g.idx.length;
            this.indexType = gl.UNSIGNED_SHORT;
            this.uploadIndices(g.idx);
        }

        uploadIndices(idx) {
            const gl = this.r.gl;
            const big = this.vertexCount > 65535;
            if (big && !this.r.uint32) throw new Error("mesh too large for this WebGL implementation");
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(idx) : new Uint16Array(idx), this.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
            this.indexType = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            this.count = idx.length;
        }

        /** Replace all vertex data (dynamic meshes such as cables). Buffers grow as needed. */
        update(g) {
            const gl = this.r.gl;
            this.vertexCount = g.vertexCount;
            const put = (b, d) => {
                gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
            };
            put(this.vbo, g.pos);
            put(this.nbo, g.nrm);
            if (g.uv) put(this.tbo, g.uv); else put(this.tbo, new Float32Array(g.vertexCount * 2));
            if (g.col && this.cbo) put(this.cbo, g.col);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.DYNAMIC_DRAW);
            this.indexType = g.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            this.count = g.indexCount;
        }

        dispose() {
            const gl = this.r.gl;
            [this.vbo, this.nbo, this.tbo, this.ibo, this.cbo].forEach((b) => b && gl.deleteBuffer(b));
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
            const gl = this.r.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.count * INST_FLOATS), gl.DYNAMIC_DRAW);
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
        constructor(gl) {
            this.camera = null;
            this.identity = m4();
            this.identityN = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
            this.lost = false;
            this.forceNoInstancing = false;
            this.gl = gl;
            this.isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
            if (this.isGL2) {
                const g2 = gl;
                this.uint32 = true;
                this.inst = {
                    divisor: (l, d) => g2.vertexAttribDivisor(l, d),
                    drawElementsInstanced: (m, c, t, o, n) => g2.drawElementsInstanced(m, c, t, o, n)
                };
            } else {
                this.uint32 = !!gl.getExtension("OES_element_index_uint");
                const ext = gl.getExtension("ANGLE_instanced_arrays");
                this.inst = ext ? {
                    divisor: (l, d) => ext.vertexAttribDivisorANGLE(l, d),
                    drawElementsInstanced: (m, c, t, o, n) => ext.drawElementsInstancedANGLE(m, c, t, o, n)
                } : null;
            }
            this.prog = this.compile(VS, FS);
            const names = ["uModel", "uViewProj", "uNormalMat", "uColor", "uTex", "uUseTex", "uUnlit", "uLightDir", "uLightColor", "uSky", "uGround", "uEye", "uSpec", "uShin", "uEmissive", "uToon", "uFogColor", "uFog"];
            this.u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(this.prog, n)]));
            gl.useProgram(this.prog);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.enable(gl.CULL_FACE);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
            this.white = tex;
            gl.uniform1i(this.u.uTex, 0);
        }

        static create(canvas2, opts = {}) {
            var _a;
            const attrs = {
                antialias: (_a = opts.antialias) != null ? _a : true,
                alpha: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false
            };
            let gl = null;
            const forced = opts.forceWebGL1 || new URLSearchParams(location.search).get("webgl") === "1";
            if (!forced) gl = canvas2.getContext("webgl2", attrs);
            if (!gl) gl = canvas2.getContext("webgl", attrs) || canvas2.getContext("experimental-webgl", attrs);
            if (!gl) return null;
            const r = new _Renderer(gl);
            r.forceNoInstancing = new URLSearchParams(location.search).get("inst") === "0";
            return r;
        }

        get instancing() {
            return !!this.inst && !this.forceNoInstancing;
        }

        compile(vs, fs) {
            const gl = this.gl;
            const sh = (type, src) => {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader compile failed: ${gl.getShaderInfoLog(s)}`);
                return s;
            };
            const p = gl.createProgram();
            gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
            gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
            for (const [name, loc] of Object.entries(LOC)) gl.bindAttribLocation(p, loc, name);
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program link failed: ${gl.getProgramInfoLog(p)}`);
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
            const gl = this.gl;
            this.camera = camera;
            gl.clearColor(clear[0], clear[1], clear[2], 1);
            gl.depthMask(true);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            const u = this.u;
            gl.uniformMatrix4fv(u.uViewProj, false, camera.viewProj);
            const ld = v3.norm(lights.dir);
            gl.uniform3f(u.uLightDir, ld[0], ld[1], ld[2]);
            gl.uniform3fv(u.uLightColor, lights.color);
            gl.uniform3fv(u.uSky, lights.sky);
            gl.uniform3fv(u.uGround, lights.ground);
            gl.uniform3fv(u.uEye, camera.eye);
            gl.uniform3fv(u.uFogColor, (_a = lights.fogColor) != null ? _a : [0, 0, 0]);
            gl.uniform2fv(u.uFog, (_b = lights.fog) != null ? _b : [0, 0]);
        }

        applyOpts(o) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const gl = this.gl;
            const u = this.u;
            const model = (_a = o.model) != null ? _a : this.identity;
            gl.uniformMatrix4fv(u.uModel, false, model);
            gl.uniformMatrix3fv(u.uNormalMat, false, o.model ? normalMatrix(model) : this.identityN);
            gl.uniform4fv(u.uColor, (_b = o.color) != null ? _b : [1, 1, 1, 1]);
            gl.uniform1f(u.uUnlit, o.unlit ? 1 : 0);
            gl.uniform3fv(u.uEmissive, (_c = o.emissive) != null ? _c : [0, 0, 0]);
            gl.uniform1f(u.uSpec, (_d = o.spec) != null ? _d : 0.25);
            gl.uniform1f(u.uShin, (_e = o.shin) != null ? _e : 24);
            gl.uniform1f(u.uToon, o.toon ? 1 : 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, (_f = o.tex) != null ? _f : this.white);
            gl.uniform1f(u.uUseTex, o.tex ? 1 : 0);
            const blend = (_g = o.blend) != null ? _g : "none";
            if (blend === "none") gl.disable(gl.BLEND); else {
                gl.enable(gl.BLEND);
                if (blend === "add") gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            gl.depthMask((_h = o.depthWrite) != null ? _h : blend === "none");
            if (o.depthTest === false) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
            if (o.cull === false) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
        }

        bindMesh(mesh) {
            const gl = this.gl;
            const attr = (buf, loc, size) => {
                gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
                if (this.inst) this.inst.divisor(loc, 0);
            };
            attr(mesh.vbo, LOC.aPos, 3);
            attr(mesh.nbo, LOC.aNormal, 3);
            attr(mesh.tbo, LOC.aUV, 2);
            if (mesh.cbo) attr(mesh.cbo, LOC.aColor, 3); else {
                gl.disableVertexAttribArray(LOC.aColor);
                gl.vertexAttrib3f(LOC.aColor, 1, 1, 1);
            }
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
        }

        constantInstance() {
            const gl = this.gl;
            for (const l of [LOC.aIPos, LOC.aIQuat, LOC.aIScale, LOC.aIColor]) gl.disableVertexAttribArray(l);
            gl.vertexAttrib3f(LOC.aIPos, 0, 0, 0);
            gl.vertexAttrib4f(LOC.aIQuat, 0, 0, 0, 1);
            gl.vertexAttrib3f(LOC.aIScale, 1, 1, 1);
            gl.vertexAttrib4f(LOC.aIColor, 1, 1, 1, 1);
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
            const gl = this.gl;
            this.applyOpts(o);
            this.bindMesh(mesh);
            if (this.inst && !this.forceNoInstancing) {
                inst.upload();
                gl.bindBuffer(gl.ARRAY_BUFFER, inst.buffer);
                const stride = INST_FLOATS * 4;
                const set = (loc, size, off) => {
                    gl.enableVertexAttribArray(loc);
                    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
                    this.inst.divisor(loc, 1);
                };
                set(LOC.aIPos, 3, 0);
                set(LOC.aIQuat, 4, 3);
                set(LOC.aIScale, 3, 7);
                set(LOC.aIColor, 4, 10);
                this.inst.drawElementsInstanced(gl.TRIANGLES, mesh.count, mesh.indexType, 0, inst.count);
                for (const l of [LOC.aIPos, LOC.aIQuat, LOC.aIScale, LOC.aIColor]) {
                    this.inst.divisor(l, 0);
                    gl.disableVertexAttribArray(l);
                }
                return;
            }
            for (const l of [LOC.aIPos, LOC.aIQuat, LOC.aIScale, LOC.aIColor]) gl.disableVertexAttribArray(l);
            const d = inst.data;
            for (let i = 0; i < inst.count; i++) {
                const k = i * INST_FLOATS;
                gl.vertexAttrib3f(LOC.aIPos, d[k], d[k + 1], d[k + 2]);
                gl.vertexAttrib4f(LOC.aIQuat, d[k + 3], d[k + 4], d[k + 5], d[k + 6]);
                gl.vertexAttrib3f(LOC.aIScale, d[k + 7], d[k + 8], d[k + 9]);
                gl.vertexAttrib4f(LOC.aIColor, d[k + 10], d[k + 11], d[k + 12], d[k + 13]);
                gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
            }
        }

        texture(source, opts = {}) {
            const gl = this.gl;
            const t = gl.createTexture();
            this.updateTexture(t, source, opts);
            return t;
        }

        updateTexture(t, source, opts = {}) {
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            const pot = (n) => (n & n - 1) === 0;
            const canMip = opts.mipmap && (this.isGL2 || pot(source.width) && pot(source.height));
            const wrap = opts.repeat && (this.isGL2 || pot(source.width) && pot(source.height)) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            if (canMip) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }

        deleteTexture(t) {
            if (t) this.gl.deleteTexture(t);
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

    // UltimateYacht1000Game/src/geometry.ts
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

    function atlasCube(size, faceOrder) {
        const g = box(size, size, size);
        for (let f = 0; f < 6; f++) {
            const cell = (faceOrder[f] - 1) / 6;
            for (let k = 0; k < 4; k++) {
                const i = (f * 4 + k) * 2;
                g.uv[i] = cell + g.uv[i] / 6;
            }
        }
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

    function hex(h) {
        const n = parseInt(h.replace("#", ""), 16);
        return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    }

    function norm3(a) {
        const l = Math.hypot(a[0], a[1], a[2]) || 1;
        return [a[0] / l, a[1] / l, a[2] / l];
    }

    // UltimateYacht1000Game/src/errors.ts
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

    // UltimateYacht1000Game/src/rng.ts
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

    // UltimateYacht1000Game/src/storage.ts
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
                const probe = "__UltimateYacht1000Game_probe__";
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

    var PREFIX = "UltimateYacht1000Game.v1:";
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
    // UltimateYacht1000Game/src/lines.ts
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
    // ===== rules.js — 役・得点・狙い方の唯一の定義元（判定とUI表示はここだけを参照する） =====
    var DICE = 1e3;
    var THROWS_PER_ROUND = 3;      // 1回目 + 振り直し2回
    var START_TOKENS = 1;
    var MAX_TOKENS = 3;
    var UPPER_BONUS_AT = 15e3;
    var UPPER_BONUS = 3e3;
    var COMBO_STEP = 0.1;          // コンボ1段につき +10%
    var COMBO_MAX = 5;             // 最大 +50%
    var UPPER_QUOTA = 300;         // 上段の「達成」ライン（コンボ判定用）
    var TIERS = {
        basic: {name: "基本", mark: "★", cls: "t-basic"},
        mid: {name: "中級", mark: "★★", cls: "t-mid"},
        hard: {name: "高難度", mark: "★★★", cls: "t-hard"},
        special: {name: "特殊", mark: "◆", cls: "t-special"}
    };
    var FACE_NAME = ["", "1", "2", "3", "4", "5", "6"];
    var F = [1, 2, 3, 4, 5, 6];
    var sumPips = (c) => c.reduce((s, n, f) => s + n * f, 0);
    var argmax = (c) => {
        let b = 6;
        for (let f = 6; f >= 1; f--) if (c[f] > c[b]) b = f;
        return b;
    };
    var argmin = (c) => {
        let b = 1;
        for (let f = 1; f <= 6; f++) if (c[f] < c[b]) b = f;
        return b;
    };
    var sortedFaces = (c) => [...F].sort((a, b) => c[b] - c[a] || b - a);
    var zero7 = () => [0, 0, 0, 0, 0, 0, 0];
    var onlyFaces = (c, fs) => {
        const h = zero7();
        for (const f of fs) h[f] = c[f];
        return h;
    };
    var pickTop = (c, ctx) => {
        const m = argmax(c), w = ctx && ctx.wind;
        return w && c[w] >= c[m] - 20 ? w : m;
    };
    var spread = (c) => Math.max(...c.slice(1, 7)) - Math.min(...c.slice(1, 7));

    /** 目標の個数ベクトル t に近づくよう、残す個数を決める（振り直した分は各目に1/6ずつ入る想定） */
    function sculpt(c, t) {
        let need = 0;
        for (const f of F) need = Math.max(need, t[f] - c[f]);
        const e = 6 * Math.max(0, need);
        const h = zero7();
        for (const f of F) h[f] = Math.max(0, Math.min(c[f], Math.round(t[f] - e / 6)));
        return h;
    }

    function stairDir(c) {
        let up = 0;
        for (const f of F) up += (f - 3.5) * c[f];
        return up >= 0 ? 1 : -1;
    }

    function stairTarget(dir, step) {
        const t = zero7();
        for (const f of F) t[f] = DICE / 6 + (f - 3.5) * step * dir;
        return t;
    }

    function minStep(c) {
        const v = c.slice(1, 7);
        const up = v.every((n, i) => i === 0 || n > v[i - 1]);
        const down = v.every((n, i) => i === 0 || n < v[i - 1]);
        if (!up && !down) return 0;
        let m = Infinity;
        for (let i = 1; i < 6; i++) m = Math.min(m, Math.abs(v[i] - v[i - 1]));
        return m;
    }

    function upperRole(f) {
        return {
            id: `u${f}`,
            name: `${f}の目`,
            tier: "basic",
            upper: true,
            cond: `${f}の個数 × ${f}点（${UPPER_QUOTA}個以上で達成）`,
            target: `${f}の目のサイコロ`,
            aim: `${f}の目を全部残して、残りを振り直す`,
            windable: true,
            score: (c) => c[f] * f,
            achieved: (c) => c[f] >= UPPER_QUOTA,
            used: (c) => onlyFaces(c, [f]),
            plan: (c) => onlyFaces(c, [f]),
            progress: (c) => ({text: `${f}の目 ${c[f]} / ${UPPER_QUOTA}個`, ratio: c[f] / UPPER_QUOTA})
        };
    }

    /** ctx.goal = { face, n } … 目標カウントのお題（対局ごとに決まる） */
    var ROLE_LIST = [upperRole(1), upperRole(2), upperRole(3), upperRole(4), upperRole(5), upperRole(6), {
        id: "chance",
        name: "チャンス",
        tier: "basic",
        cond: "全1000個の目の合計 ÷ 2（合計4400以上で達成）",
        target: "全1000個",
        aim: "4・5・6を残し、1〜3を振り直す",
        score: (c) => Math.floor(sumPips(c) / 2),
        achieved: (c) => sumPips(c) >= 4400,
        used: (c) => onlyFaces(c, F),
        plan: (c) => onlyFaces(c, [4, 5, 6]),
        progress: (c) => ({
            text: `合計 ${sumPips(c).toLocaleString()} / 4,400`, ratio: (sumPips(c) - 3500) / 900
        })
    }, {
        id: "gather",
        name: "大集合",
        tier: "basic",
        cond: "最も多い目が380個以上：その個数 × 8点",
        target: "最も多い目",
        aim: "いちばん多い目（追い風の目が近ければそちら）を全部残す",
        windable: true,
        score: (c) => c[argmax(c)] >= 380 ? c[argmax(c)] * 8 : 0,
        achieved: (c) => c[argmax(c)] >= 380,
        used: (c) => onlyFaces(c, [argmax(c)]),
        plan: (c, ctx) => onlyFaces(c, [pickTop(c, ctx)]),
        progress: (c) => ({text: `最多 ${argmax(c)}の目 ${c[argmax(c)]} / 380個`, ratio: c[argmax(c)] / 380})
    }, {
        id: "factions",
        name: "二大派閥",
        tier: "mid",
        cond: "上位2種類の目がどちらも340個以上：2種類の合計 × 6点",
        target: "多い順に上位2種類の目",
        aim: "多い目を2種類とも全部残す",
        windable: true,
        score: (c) => {
            const [a, b] = sortedFaces(c);
            return c[b] >= 340 ? (c[a] + c[b]) * 6 : 0;
        },
        achieved: (c) => c[sortedFaces(c)[1]] >= 340,
        used: (c) => onlyFaces(c, sortedFaces(c).slice(0, 2)),
        plan: (c, ctx) => {
            const t = sortedFaces(c).slice(0, 2);
            const w = ctx && ctx.wind;
            if (w && !t.includes(w) && c[w] >= c[t[1]] - 20) t[1] = w;
            return onlyFaces(c, t);
        },
        progress: (c) => {
            const [a, b] = sortedFaces(c);
            return {text: `${a}の目 ${c[a]}・${b}の目 ${c[b]} / 340個`, ratio: c[b] / 340};
        }
    }, {
        id: "stairs",
        name: "大階段",
        tier: "mid",
        cond: "1→6の順に個数が増える（または減る）。段差が大きいほど高得点：最小段差1〜：3000／30〜：5500／40〜：9000",
        target: "6種類すべての個数の並び",
        aim: "階段の形になるよう、多すぎる目を少しずつ振り直す",
        score: (c) => {
            const m = minStep(c);
            return m >= 40 ? 9e3 : m >= 30 ? 5500 : m >= 1 ? 3e3 : 0;
        },
        achieved: (c) => minStep(c) >= 1,
        used: (c) => onlyFaces(c, F),
        plan: (c, ctx) => sculpt(c, stairTarget(stairDir(c), 42)),
        progress: (c) => {
            const v = c.slice(1, 7);
            return {text: `個数：${v.join(" / ")}`, ratio: minStep(c) / 40};
        }
    }, {
        id: "peace",
        name: "平和な議会",
        tier: "mid",
        cond: "最多と最少の個数の差が小さいほど高得点：差10以下：2500／5以下：5000／2以下：9000",
        target: "最多の目と最少の目",
        aim: "最少の目に合わせて、多い目の余りだけ振り直す",
        score: (c) => {
            const d = spread(c);
            return d <= 2 ? 9e3 : d <= 5 ? 5e3 : d <= 10 ? 2500 : 0;
        },
        achieved: (c) => spread(c) <= 10,
        used: (c) => onlyFaces(c, [argmax(c), argmin(c)]),
        plan: (c) => sculpt(c, [0, ...F.map(() => DICE / 6)]),
        progress: (c) => ({
            text: `差 ${spread(c)}（最多${c[argmax(c)]}・最少${c[argmin(c)]}）`, ratio: 10 / Math.max(1, spread(c))
        })
    }, {
        id: "extinct",
        name: "絶滅危惧",
        tier: "hard",
        cond: "どれかの目が3個以下：3000＋(3−個数)×1000点。0個なら「完全絶滅」12000点",
        target: "最も少ない目",
        aim: "最も少ない目だけを振り直し続ける",
        windable: true,
        score: (c) => {
            const n = c[argmin(c)];
            return n === 0 ? 12e3 : n <= 3 ? 3e3 + (3 - n) * 1e3 : 0;
        },
        achieved: (c) => c[argmin(c)] <= 3,
        used: (c) => onlyFaces(c, [argmin(c)]),
        plan: (c, ctx) => {
            const h = onlyFaces(c, F);
            const w = ctx && ctx.wind;
            h[w && c[w] <= c[argmin(c)] + 20 ? w : argmin(c)] = 0;
            return h;
        },
        progress: (c) => ({
            text: `最少 ${argmin(c)}の目 ${c[argmin(c)]}個 / 3個以下`, ratio: 3 / Math.max(1, c[argmin(c)])
        })
    }, {
        id: "ultimate",
        name: "究極ヨット",
        tier: "hard",
        cond: "同じ目が540個以上：12000点＋540を超えた1個ごとに+40点",
        target: "最も多い目",
        aim: "最多の目を全部残す。追い振り券で4投目を振ると届きやすい",
        windable: true,
        score: (c) => {
            const n = c[argmax(c)];
            return n >= 540 ? 12e3 + (n - 540) * 40 : 0;
        },
        achieved: (c) => c[argmax(c)] >= 540,
        used: (c) => onlyFaces(c, [argmax(c)]),
        plan: (c, ctx) => onlyFaces(c, [pickTop(c, ctx)]),
        progress: (c) => ({text: `最多 ${argmax(c)}の目 ${c[argmax(c)]} / 540個`, ratio: c[argmax(c)] / 540})
    }, {
        id: "goal",
        name: "ぴったり指令",
        tier: "special",
        cond: "お題の目をお題の個数ぴったりに：誤差0：8000／2以内：4000／5以内：2000（5以内で達成）",
        target: "お題の目",
        aim: "多すぎたら余りを、少なければ他の目を必要な分だけ振り直す",
        windable: true,
        score: (c, ctx) => {
            const d = Math.abs(c[ctx.goal.face] - ctx.goal.n);
            return d === 0 ? 8e3 : d <= 2 ? 4e3 : d <= 5 ? 2e3 : 0;
        },
        achieved: (c, ctx) => Math.abs(c[ctx.goal.face] - ctx.goal.n) <= 5,
        used: (c, ctx) => onlyFaces(c, [ctx.goal.face]),
        plan: (c, ctx) => {
            const g = ctx.goal.face, n = ctx.goal.n;
            const h = onlyFaces(c, F);
            if (c[g] > n) {
                h[g] = n;
                return h;
            }        // 余りを振り直す（そこから1/6がまたお題の目になる）
            const deficit = n - c[g];
            let r = Math.min(DICE - c[g], Math.round(deficit * 6));
            for (const f of sortedFaces(c)) {            // 多い目から順に振り直し分を確保
                if (f === g || r <= 0) continue;
                const take = Math.min(h[f], r);
                h[f] -= take;
                r -= take;
            }
            return h;
        },
        progress: (c, ctx) => ({
            text: `${ctx.goal.face}の目 ${c[ctx.goal.face]} / お題 ${ctx.goal.n}個（誤差${Math.abs(c[ctx.goal.face] - ctx.goal.n)}）`,
            ratio: 5 / Math.max(1, Math.abs(c[ctx.goal.face] - ctx.goal.n))
        })
    }];
    var ROLES = Object.fromEntries(ROLE_LIST.map((r) => [r.id, r]));
    var ROLE_IDS = ROLE_LIST.map((r) => r.id);
    var ROUNDS = ROLE_IDS.length;
    var HIDDEN_ROLES = {
        mirror: {name: "鏡の議会", points: 7777, test: (c) => c[1] === c[6] && c[2] === c[5] && c[3] === c[4]},
        lucky777: {name: "スリーセブン", points: 7770, test: (c) => c.slice(1, 7).includes(777)},
        answer42: {name: "究極の答え", points: 4242, test: (c) => c.slice(1, 7).includes(42)},
        pi: {name: "円周率", points: 3141, test: (c) => c.slice(1, 7).includes(314)},
        sameTail: {
            name: "揃い踏み", points: 3e3, test: (c) => new Set(c.slice(1, 7).map((n) => n % 10)).size === 1
        },
        thousand: {name: "超究極ヨット", points: 1e6, test: (c) => c.slice(1, 7).includes(DICE)}
    };

    function makeGoal(rng) {
        return {face: 1 + Math.floor(rng() * 6), n: 200 + Math.floor(rng() * 21) * 5};
    }

    function countFaces(faces) {
        const c = zero7();
        for (let i = 0; i < faces.length; i++) c[faces[i]] += 1;
        return c;
    }

    function clampHold(h, c) {
        const out = zero7();
        for (const f of F) out[f] = Math.max(0, Math.min(c[f], Math.round(h[f] || 0)));
        return out;
    }

    // ---- モンテカルロ（ゲームの乱数列は使わない） ----
    function binom(n, p, rnd) {
        if (n <= 0) return 0;
        if (n < 40) {
            let k = 0;
            for (let i = 0; i < n; i++) if (rnd() < p) k++;
            return k;
        }
        const m = n * p, sd = Math.sqrt(n * p * (1 - p));
        let u = 0;
        while (u === 0) u = rnd();
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
        return Math.max(0, Math.min(n, Math.round(m + sd * z)));
    }

    function rerollCounts(hold, rnd) {
        const c = hold.slice();
        let n = DICE - hold.reduce((s, v) => s + v, 0);
        for (let f = 1; f <= 5; f++) {
            const k = binom(n, 1 / (7 - f), rnd);
            c[f] += k;
            n -= k;
        }
        c[6] += n;
        return c;
    }

    /** 「今の残し方で次を振り、その後もこの役の狙い方で振り切った」ときの成立率と平均点 */
    function forecast(role, c, holdNow, throwsLeft, ctx, sims = 160, rnd = Math.random, scoreFn = null) {
        const sc = scoreFn || ((cc) => role.score(cc, ctx));
        if (throwsLeft <= 0) return {p: role.achieved(c, ctx) ? 1 : 0, ev: sc(c)};
        let hit = 0, ev = 0;
        for (let s = 0; s < sims; s++) {
            let cc = rerollCounts(holdNow, rnd);
            for (let k = throwsLeft - 1; k > 0; k--) cc = rerollCounts(clampHold(role.plan(cc, {
                ...ctx, throwsLeft: k
            }), cc), rnd);
            if (role.achieved(cc, ctx)) hit++;
            ev += sc(cc);
        }
        return {p: hit / sims, ev: ev / sims};
    }

    var WIND_MULT = 1.5;

    /** 役の最終得点（追い風・コンボ込み）。判定・表示・確定のすべてがこれを使う */
    function evaluateRole(id, c, ctx, streak) {
        const role = ROLES[id];
        const base = role.score(c, ctx);
        const achieved = role.achieved(c, ctx);
        const usedFaces = F.filter((f) => role.used(c, ctx)[f] > 0);
        const wind = !!role.windable && base > 0 && usedFaces.length <= 2 && usedFaces.includes(ctx.wind);
        const comboLevel = achieved ? Math.min(COMBO_MAX, streak) : 0;
        const points = Math.round(base * (wind ? WIND_MULT : 1) * (1 + COMBO_STEP * comboLevel));
        return {id, base, achieved, wind, comboLevel, points};
    }

    // ===== game.js — 対局の状態（描画から完全に独立） =====
    var YachtGame = class {
        constructor(rng) {
            this.rng = rng;
            this.faces = new Uint8Array(DICE);
            for (let i = 0; i < DICE; i++) this.faces[i] = 1 + Math.floor(rng() * 6);
            this.heldMask = new Uint8Array(DICE);
            this.hold = zero7();
            this.round = 1;
            this.throwsUsed = 0;
            this.extraThrows = 0;
            this.tokens = START_TOKENS;
            this.tokensUsed = 0;
            this.scores = {};
            this.streak = 0;
            this.bestStreak = 0;
            this.goal = makeGoal(rng);
            this.wind = 1 + Math.floor(rng() * 6);
            this.hiddenFound = new Set();
            this.hiddenPoints = 0;
            this.totalThrows = 0;
            this.maxSame = 0;
            this.achievedCount = 0;
        }

        get ctx() {
            return {goal: this.goal, wind: this.wind, throwsLeft: this.throwsLeft};
        }

        get counts() {
            return countFaces(this.faces);
        }

        get throwsLeft() {
            return THROWS_PER_ROUND + this.extraThrows - this.throwsUsed;
        }

        get hasRolled() {
            return this.throwsUsed > 0;
        }

        get over() {
            return this.round > ROUNDS;
        }

        get canThrow() {
            return !this.over && this.throwsLeft > 0;
        }

        get canUseToken() {
            return !this.over && this.hasRolled && this.throwsLeft === 0 && this.tokens > 0;
        }

        get open() {
            return ROLE_IDS.filter((id) => !this.scores[id]);
        }

        get heldTotal() {
            return this.hold.reduce((s, n) => s + n, 0);
        }

        get upperSubtotal() {
            return ROLE_LIST.filter((r) => r.upper).reduce((s, r) => s + (this.scores[r.id] ? this.scores[r.id].points : 0), 0);
        }

        get upperBonus() {
            return this.upperSubtotal >= UPPER_BONUS_AT ? UPPER_BONUS : 0;
        }

        get totalScore() {
            return Object.values(this.scores).reduce((s, v) => s + v.points, 0) + this.upperBonus + this.hiddenPoints;
        }

        setHold(f, n) {
            if (!this.hasRolled || this.throwsLeft <= 0 && !this.canUseToken) return;
            this.hold[f] = Math.max(0, Math.min(this.counts[f], Math.round(n)));
            this.computeHeldMask();
        }

        setHolds(h) {
            if (!this.hasRolled) return;
            this.hold = clampHold(h, this.counts);
            this.computeHeldMask();
        }

        clearHolds() {
            this.hold = zero7();
            this.computeHeldMask();
        }

        computeHeldMask() {
            const left = [...this.hold];
            for (let i = 0; i < DICE; i++) {
                const f = this.faces[i];
                if (this.hasRolled && left[f] > 0) {
                    this.heldMask[i] = 1;
                    left[f]--;
                } else this.heldMask[i] = 0;
            }
        }

        /** 残していないサイコロの出目を決める。戻り値は振ったサイコロの番号 */
        throwDice() {
            if (!this.canThrow) throw new Error("no throws left");
            if (!this.hasRolled) this.hold = zero7();
            this.computeHeldMask();
            const rolled = [];
            for (let i = 0; i < DICE; i++) {
                if (this.heldMask[i]) continue;
                this.faces[i] = 1 + Math.floor(this.rng() * 6);
                rolled.push(i);
            }
            this.throwsUsed++;
            this.totalThrows++;
            const c = this.counts;
            this.hold = clampHold(this.hold, c);
            this.maxSame = Math.max(this.maxSame, ...c.slice(1));
            this.computeHeldMask();
            return rolled;
        }

        useToken() {
            if (!this.canUseToken) throw new Error("cannot use token");
            this.tokens--;
            this.tokensUsed++;
            this.extraThrows++;
        }

        evaluate(id) {
            return evaluateRole(id, this.counts, this.ctx, this.streak);
        }

        evaluateAll() {
            return Object.fromEntries(ROLE_IDS.map((id) => [id, this.evaluate(id)]));
        }

        commit(id) {
            if (!this.hasRolled) throw new Error("roll first");
            if (this.scores[id]) throw new Error(`${id} already scored`);
            const c = this.counts;
            const ev = this.evaluate(id);
            const bonusBefore = this.upperBonus;
            this.scores[id] = {...ev, round: this.round, counts: c.slice()};
            if (ev.achieved) {
                this.streak++;
                this.achievedCount++;
            } else this.streak = 0;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            const hidden = [];
            let hiddenPoints = 0;
            for (const [hid, h] of Object.entries(HIDDEN_ROLES)) {
                if (!this.hiddenFound.has(hid) && h.test(c)) {
                    this.hiddenFound.add(hid);
                    hidden.push(hid);
                    hiddenPoints += h.points;
                }
            }
            this.hiddenPoints += hiddenPoints;
            const tier = ROLES[id].tier;
            const tokenGained = (ev.achieved && (tier === "hard" || tier === "special") || hidden.length > 0) && this.tokens < MAX_TOKENS;
            if (tokenGained) this.tokens++;
            const upperBonusNow = !bonusBefore && this.upperBonus > 0;
            this.round++;
            this.throwsUsed = 0;
            this.extraThrows = 0;
            this.hold = zero7();
            this.heldMask.fill(0);
            this.wind = 1 + Math.floor(this.rng() * 6);
            return {
                ...ev, hidden, hiddenPoints, tokenGained, streak: this.streak, upperBonusNow, gameOver: this.over
            };
        }
    };
    // ===== physics.js — 巨大おぼんと1000個のサイコロの簡易剛体物理 =====
    // サイコロは「回転する球」として衝突させ、止まった瞬間にゲームが決めた出目の姿勢へ“コトン”と収める。
    var TRAY_R = 270;           // おぼん内径
    var RIM_H = 30;
    var DIE = 10;               // 一辺
    var HALF = DIE / 2;
    var COL_R = 5.6;            // 衝突半径
    var GRAV = 2400;
    var CELL = 12;
    var GRID_N = Math.ceil(TRAY_R * 2 / CELL) + 2;
    var SUB_DT = 1 / 120;
    var DCELL = 30;
    var DN = Math.ceil(TRAY_R * 2 / DCELL) + 2;
    var FACE_ORDER = [3, 4, 1, 6, 2, 5];

    function faceUpQuat(f) {
        switch (f) {
            case 1:
                return quat.identity();
            case 6:
                return quat.axisAngle([1, 0, 0], Math.PI);
            case 3:
                return quat.axisAngle([0, 0, 1], Math.PI / 2);
            case 4:
                return quat.axisAngle([0, 0, 1], -Math.PI / 2);
            case 2:
                return quat.axisAngle([1, 0, 0], -Math.PI / 2);
            case 5:
                return quat.axisAngle([1, 0, 0], Math.PI / 2);
        }
        throw new Error(`bad face ${f}`);
    }

    var FACE_Q = [null, 1, 2, 3, 4, 5, 6].map((f) => f && faceUpQuat(f));

    function yawOf(q) {
        // 姿勢 q の「前方向」の水平角
        const fwd = quat.rotate(q, [0, 0, 1]);
        const side = quat.rotate(q, [1, 0, 0]);
        const v = Math.abs(fwd[1]) < 0.8 ? fwd : side;
        return Math.atan2(v[0], v[2]);
    }

    var TrayPhysics = class {
        constructor(n) {
            this.n = n;
            const f32 = () => new Float32Array(n);
            this.px = f32();
            this.py = f32();
            this.pz = f32();
            this.vx = f32();
            this.vy = f32();
            this.vz = f32();
            this.wx = f32();
            this.wy = f32();
            this.wz = f32();
            this.q = new Float32Array(n * 4);
            this.q0 = new Float32Array(n * 4);
            this.q1 = new Float32Array(n * 4);
            this.still = f32();
            this.snapT = f32();          // <0: 未スナップ, 0..1: スナップ中, 1: 完了
            this.state = new Uint8Array(n); // 0=動作中 1=静止 2=固定(保持)
            this.target = new Uint8Array(n);
            this.head = new Int32Array(GRID_N * GRID_N);
            this.dens = new Float32Array(DN * DN);
            this.next = new Int32Array(n);
            this.time = 0;
            this.shake = null;
            this.drag = [0, 0];
            this.dragSm = [0, 0];
            this.acc = 0;
            this.events = {clacks: 0, clackPower: 0, rim: [], airborne: 0};
            this.trayQ = quat.identity();
            this.trayPos = [0, 0, 0];
            this.trayAcc = [0, 0, 0];
            this.scatter();
        }

        /** 初期配置：おぼん全体にばらまく（六角格子＋ゆらぎ） */
        scatter(faces) {
            const spots = [];
            const s = COL_R * 2 + 0.6;
            for (let row = -40; row <= 40; row++) for (let col = -40; col <= 40; col++) {
                const x = (col + (row & 1) * 0.5) * s, z = row * s * 0.866;
                if (Math.hypot(x, z) < TRAY_R - 9) spots.push([x, z]);
            }
            for (let i = spots.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [spots[i], spots[j]] = [spots[j], spots[i]];
            }
            for (let i = 0; i < this.n; i++) {
                const [x, z] = spots[i % spots.length];
                this.px[i] = x + (Math.random() - 0.5) * 0.8;
                this.pz[i] = z + (Math.random() - 0.5) * 0.8;
                this.py[i] = HALF + (i >= spots.length ? DIE : 0);
                this.vx[i] = this.vy[i] = this.vz[i] = 0;
                const f = faces ? faces[i] : 1 + i % 6;
                const qq = quat.mul(quat.axisAngle([0, 1, 0], Math.random() * Math.PI * 2), FACE_Q[f]);
                this.q.set(qq, i * 4);
                this.state[i] = 1;
                this.snapT[i] = 1;
                this.target[i] = f;
            }
        }

        /** 振る：dir=[x,z]（単位ベクトル）, strength 0.3〜1.3 */
        startThrow(rolled, faces, heldMask, dir, strength, opts) {
            const fast = !!opts.fast;
            const T = fast ? 0.75 : 1.35;
            this.shake = {
                t0: this.time,
                dir,
                s: strength,
                T,
                tau: fast ? 0.26 : 0.42,
                omega: (2 * Math.PI) / (fast ? 0.32 : 0.42),
                forceAt: this.time + T + (fast ? 0.55 : 1.4),
                endAt: this.time + T + (fast ? 1.1 : 2.4)
            };
            for (let i = 0; i < this.n; i++) {
                this.state[i] = heldMask[i] ? 2 : 1;
                this.target[i] = faces[i];
            }
            for (const i of rolled) {
                this.state[i] = 0;
                this.snapT[i] = -1;
                this.still[i] = 0;
                const k = strength * (0.6 + Math.random() * 0.8);
                this.vy[i] = 180 + Math.random() * 420 * k;
                this.vx[i] += (Math.random() - 0.5) * 160 * k - dir[0] * 120 * k;
                this.vz[i] += (Math.random() - 0.5) * 160 * k - dir[1] * 120 * k;
                const a = v3.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
                const w = 14 + Math.random() * 26;
                this.wx[i] = a[0] * w;
                this.wy[i] = a[1] * w;
                this.wz[i] = a[2] * w;
            }
        }

        /** 早送り：すぐに静止へ向かわせる */
        hurry() {
            if (!this.shake) return;
            const t = this.time;
            this.shake.forceAt = Math.min(this.shake.forceAt, t);
            this.shake.endAt = Math.min(this.shake.endAt, t + 0.35);
            this.shake.T = Math.min(this.shake.T, t - this.shake.t0);
        }

        get rolling() {
            return !!this.shake;
        }

        /** おぼんの姿勢（位置・傾き）を時刻 t で求める */
        pose(t) {
            let ox = 0, oy = 0, oz = 0, tilt = 0, side = 0;
            const sh = this.shake;
            let dir = [1, 0];
            if (sh) {
                const u = t - sh.t0;
                if (u >= 0 && u < sh.T + 0.6) {
                    dir = sh.dir;
                    const env = Math.exp(-u / sh.tau) * Math.min(1, u / 0.06);
                    const fade = u > sh.T ? Math.max(0, 1 - (u - sh.T) / 0.6) : 1;
                    const a = 72 * sh.s * env * fade;
                    const main = Math.sin(sh.omega * u) * a;
                    const perp = Math.sin(sh.omega * 1.37 * u + 1.1) * a * 0.38;
                    ox = dir[0] * main - dir[1] * perp;
                    oz = dir[1] * main + dir[0] * perp;
                    oy = Math.max(0, Math.sin(sh.omega * 1.9 * u)) * 16 * sh.s * env * fade;
                    tilt = Math.cos(sh.omega * u) * 0.11 * sh.s * env * fade;
                    side = Math.cos(sh.omega * 1.37 * u + 1.1) * 0.05 * sh.s * env * fade;
                }
            }
            return {ox, oy, oz, tilt, side, dir};
        }

        trayQuat(p) {
            const d = p.dir;
            const dx = this.dragSm[0], dz = this.dragSm[1];
            let q = quat.axisAngle([d[1], 0, -d[0]], p.tilt);
            q = quat.mul(quat.axisAngle([d[0], 0, d[1]], p.side), q);
            // ドラッグ中のプレビュー傾き
            q = quat.mul(quat.axisAngle([1, 0, 0], dz * 0.0009), quat.mul(quat.axisAngle([0, 0, 1], -dx * 0.0009), q));
            return q;
        }

        update(dt) {
            this.events = {clacks: 0, clackPower: 0, rim: [], airborne: 0};
            const k = Math.min(1, dt * 12);
            this.dragSm[0] += (this.drag[0] - this.dragSm[0]) * k;
            this.dragSm[1] += (this.drag[1] - this.dragSm[1]) * k;
            this.acc = Math.min(this.acc + dt, 0.12);
            while (this.acc >= SUB_DT) {
                this.step(SUB_DT);
                this.acc -= SUB_DT;
            }
            const p = this.pose(this.time);
            this.trayPos = [p.ox, p.oy, p.oz];
            this.trayQ = this.trayQuat(p);
        }

        step(dt) {
            this.time += dt;
            const t = this.time, h = 1 / 240;
            const pm = this.pose(t - h), p0 = this.pose(t), pp = this.pose(t + h);
            const ax = (pp.ox - 2 * p0.ox + pm.ox) / (h * h), ay = (pp.oy - 2 * p0.oy + pm.oy) / (h * h),
                az = (pp.oz - 2 * p0.oz + pm.oz) / (h * h);
            this.trayAcc = [ax, ay, az];
            const tq = this.trayQuat(p0);
            const inv = [-tq[0], -tq[1], -tq[2], tq[3]];
            const g = quat.rotate(inv, [-ax, -GRAV - ay, -az]);   // おぼん座標での見かけの加速度
            const gN = Math.max(0, -g[1]);
            const sh = this.shake;
            const shaking = sh && t - sh.t0 < sh.T;
            const forcing = sh && t > sh.forceAt;
            const n = this.n;
            const {px, py, pz, vx, vy, vz, wx, wy, wz, q, state} = this;
            const lim = TRAY_R - 6.5;
            // 粒の圧力：混んでいる所から空いている所へ広がる（振り終わり〜静止前）
            const spreadOn = sh && t - sh.t0 > sh.T * 0.55 && t < sh.forceAt + 0.3;
            const dens = this.dens;
            if (spreadOn) {
                dens.fill(0);
                const o2 = TRAY_R + DCELL;
                for (let i = 0; i < n; i++) {
                    const cx = Math.floor((px[i] + o2) / DCELL), cz = Math.floor((pz[i] + o2) / DCELL);
                    dens[cx * DN + cz] += 1;
                }
            }
            for (let i = 0; i < n; i++) {
                if (state[i] !== 0) continue;
                if (spreadOn && py[i] < HALF + 6) {
                    const o2 = TRAY_R + DCELL;
                    const fx = (px[i] + o2) / DCELL - 0.5, fz = (pz[i] + o2) / DCELL - 0.5;
                    const cx = Math.max(1, Math.min(DN - 2, Math.round(fx))),
                        cz = Math.max(1, Math.min(DN - 2, Math.round(fz)));
                    // 縁の外は「満員」とみなして内側へ押し返す
                    const at = (x, z) => {
                        const wx2 = (x + 0.5) * DCELL - o2, wz2 = (z + 0.5) * DCELL - o2;
                        return Math.hypot(wx2, wz2) > TRAY_R - 8 ? 9 : dens[x * DN + z];
                    };
                    const gx = at(cx + 1, cz) - at(cx - 1, cz), gz = at(cx, cz + 1) - at(cx, cz - 1);
                    vx[i] -= gx * 95 * dt;
                    vz[i] -= gz * 95 * dt;
                }
                vx[i] += g[0] * dt;
                vy[i] += g[1] * dt;
                vz[i] += g[2] * dt;
                if (forcing) {
                    const d = Math.exp(-7 * dt);
                    vx[i] *= d;
                    vz[i] *= d;
                    wx[i] *= d;
                    wy[i] *= d;
                    wz[i] *= d;
                }
                px[i] += vx[i] * dt;
                py[i] += vy[i] * dt;
                pz[i] += vz[i] * dt;
                let floor = false;
                if (py[i] <= HALF) {
                    py[i] = HALF;
                    if (vy[i] < 0) {
                        if (vy[i] < -90) {
                            vy[i] = -vy[i] * 0.32;
                            this.events.clacks++;
                            this.events.clackPower += 0.3;
                        } else vy[i] = 0;
                    }
                    floor = true;
                }
                if (floor) {
                    const sp = Math.hypot(vx[i], vz[i]);
                    const dec = 0.3 * gN * dt;
                    if (sp <= dec) {
                        vx[i] = 0;
                        vz[i] = 0;
                    } else {
                        const f = (sp - dec) / sp;
                        vx[i] *= f;
                        vz[i] *= f;
                    }
                    // 床を転がる：進行方向に回転
                    const s2 = Math.hypot(vx[i], vz[i]);
                    const blend = Math.min(1, dt * 10);
                    const rate = s2 / HALF * 0.55;
                    const ux = s2 > 1e-3 ? vz[i] / s2 : 0, uz = s2 > 1e-3 ? -vx[i] / s2 : 0;
                    wx[i] += (ux * rate - wx[i]) * blend;
                    wy[i] *= 1 - blend * 0.5;
                    wz[i] += (uz * rate - wz[i]) * blend;
                } else this.events.airborne++;
                // 縁
                const rr = Math.hypot(px[i], pz[i]);
                if (rr > lim) {
                    const nx = px[i] / rr, nz = pz[i] / rr;
                    px[i] = nx * lim;
                    pz[i] = nz * lim;
                    const vn = vx[i] * nx + vz[i] * nz;
                    if (vn > 0) {
                        vx[i] -= 1.4 * vn * nx;
                        vz[i] -= 1.4 * vn * nz;
                        if (vn > 140) {
                            vy[i] += vn * (0.15 + Math.random() * 0.3);
                            wx[i] += (Math.random() - 0.5) * vn * 0.08;
                            wz[i] += (Math.random() - 0.5) * vn * 0.08;
                            if (this.events.rim.length < 24 && Math.random() < 0.25) this.events.rim.push([px[i], py[i], pz[i], vn]);
                        }
                    }
                }
                if (py[i] > 260) {
                    py[i] = 260;
                    if (vy[i] > 0) vy[i] = 0;
                }
                // 姿勢の積分
                const o = i * 4;
                const qx = q[o], qy = q[o + 1], qz = q[o + 2], qw = q[o + 3];
                const hx = wx[i] * dt * 0.5, hy = wy[i] * dt * 0.5, hz = wz[i] * dt * 0.5;
                let nx = qx + (hx * qw + hy * qz - hz * qy), ny = qy + (hy * qw + hz * qx - hx * qz),
                    nz = qz + (hz * qw + hx * qy - hy * qx), nw = qw - (hx * qx + hy * qy + hz * qz);
                const l = Math.hypot(nx, ny, nz, nw) || 1;
                q[o] = nx / l;
                q[o + 1] = ny / l;
                q[o + 2] = nz / l;
                q[o + 3] = nw / l;
                // 静止判定
                if (!shaking && floor && vx[i] * vx[i] + vz[i] * vz[i] < 400 && Math.abs(vy[i]) < 30) {
                    this.still[i] += dt;
                    if (this.still[i] > 0.1) this.sleep(i);
                } else this.still[i] = 0;
                if (sh && t > sh.endAt) this.sleep(i);
            }
            this.collide(dt);
            this.collide(dt);
            for (let i = 0; i < n; i++) {
                if (state[i] === 2) continue;
                const rr = Math.hypot(px[i], pz[i]);
                if (rr > lim) {
                    px[i] *= lim / rr;
                    pz[i] *= lim / rr;
                }
            }
            // スナップ（出目の確定姿勢へ）
            for (let i = 0; i < n; i++) {
                const s = this.snapT[i];
                if (s < 0 || s >= 1) continue;
                const ns = Math.min(1, s + dt / 0.17);
                this.snapT[i] = ns;
                const e = ease.out(ns);
                const r = quat.slerp([this.q0[i * 4], this.q0[i * 4 + 1], this.q0[i * 4 + 2], this.q0[i * 4 + 3]], [this.q1[i * 4], this.q1[i * 4 + 1], this.q1[i * 4 + 2], this.q1[i * 4 + 3]], e);
                this.q.set(r, i * 4);
                this.py[i] = HALF + Math.sin(ns * Math.PI) * 2.2;
                if (ns >= 1) {
                    this.py[i] = HALF;
                    this.events.clacks++;
                    this.events.clackPower += 0.05;
                }
            }
            if (sh && t > sh.endAt) {
                let all = true;
                for (let i = 0; i < n; i++) if (state[i] === 0 || this.snapT[i] >= 0 && this.snapT[i] < 1) {
                    all = false;
                    break;
                }
                if (all) this.shake = null;
            }
        }

        sleep(i) {
            if (this.state[i] !== 0) return;
            this.state[i] = 1;
            this.vx[i] = this.vy[i] = this.vz[i] = 0;
            this.wx[i] = this.wy[i] = this.wz[i] = 0;
            const o = i * 4;
            const cur = [this.q[o], this.q[o + 1], this.q[o + 2], this.q[o + 3]];
            const target = quat.mul(quat.axisAngle([0, 1, 0], yawOf(cur)), FACE_Q[this.target[i]]);
            this.q0.set(cur, o);
            this.q1.set(target, o);
            this.snapT[i] = 0;
        }

        collide(dt) {
            const {px, py, pz, vx, vy, vz, state, head, next} = this;
            head.fill(-1);
            const off = TRAY_R + CELL;
            const cellOf = (x) => Math.max(0, Math.min(GRID_N - 1, Math.floor((x + off) / CELL)));
            for (let i = 0; i < this.n; i++) {
                const c = cellOf(px[i]) * GRID_N + cellOf(pz[i]);
                next[i] = head[c];
                head[c] = i;
            }
            const D2 = (COL_R * 2) ** 2, D = COL_R * 2;
            for (let i = 0; i < this.n; i++) {
                const si = state[i];
                const cx = cellOf(px[i]), cz = cellOf(pz[i]);
                for (let gx = cx - 1; gx <= cx + 1; gx++) {
                    if (gx < 0 || gx >= GRID_N) continue;
                    for (let gz = cz - 1; gz <= cz + 1; gz++) {
                        if (gz < 0 || gz >= GRID_N) continue;
                        for (let j = head[gx * GRID_N + gz]; j >= 0; j = next[j]) {
                            if (j <= i) continue;
                            const sj = state[j];
                            if (si !== 0 && sj !== 0) continue;
                            const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
                            const d2 = dx * dx + dy * dy + dz * dz;
                            if (d2 >= D2 || d2 < 1e-8) continue;
                            const d = Math.sqrt(d2);
                            const nx = dx / d, ny = dy / d, nz = dz / d;
                            const ov = D - d;
                            // 質量の扱い：固定(2)は動かない、静止(1)は重い
                            const mi = si === 0 ? 1 : si === 1 ? 0.25 : 0;
                            const mj = sj === 0 ? 1 : sj === 1 ? 0.25 : 0;
                            const ms = mi + mj;
                            if (ms <= 0) continue;
                            const ai = mi / ms, aj = mj / ms;
                            px[i] -= nx * ov * ai;
                            py[i] -= ny * ov * ai;
                            pz[i] -= nz * ov * ai;
                            px[j] += nx * ov * aj;
                            py[j] += ny * ov * aj;
                            pz[j] += nz * ov * aj;
                            if (py[i] < HALF) py[i] = HALF;
                            if (py[j] < HALF) py[j] = HALF;
                            const rel = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
                            if (rel < 0) {
                                const imp = -1.18 * rel;
                                if (si === 0) {
                                    vx[i] -= nx * imp * ai;
                                    vy[i] -= ny * imp * ai;
                                    vz[i] -= nz * imp * ai;
                                }
                                if (sj === 0) {
                                    vx[j] += nx * imp * aj;
                                    vy[j] += ny * imp * aj;
                                    vz[j] += nz * imp * aj;
                                }
                                if (-rel > 160) {
                                    this.events.clacks++;
                                    this.events.clackPower += Math.min(1, -rel / 900);
                                }
                            }
                            // 静止中のサイコロが強く押されたら起こす（出目は変えない：再スナップする）
                            if (si === 1 && ov * ai > 1.6 && this.shake) this.wake(i);
                            if (sj === 1 && ov * aj > 1.6 && this.shake) this.wake(j);
                        }
                    }
                }
            }
        }

        wake(i) {
            if (this.snapT[i] >= 0 && this.snapT[i] < 1) return;
            this.state[i] = 0;
            this.still[i] = 0;
            this.snapT[i] = -1;
        }

        /** 画面の点から当たったサイコロ（おぼん座標の床面で最寄り） */
        pickLocal(lx, lz) {
            let best = -1, bd = 8 * 8;
            for (let i = 0; i < this.n; i++) {
                const dx = this.px[i] - lx, dz = this.pz[i] - lz;
                const d = dx * dx + dz * dz;
                if (d < bd) {
                    bd = d;
                    best = i;
                }
            }
            return best;
        }
    };
    // ===== view.js — おぼん・サイコロ・演出の描画 =====
    var SKINS = {
        classic: {name: "普通のサイコロ", unlock: "最初から", body: "#fbfaf5", pip: "#1b1b1b", edge: "#c9c3b2"},
        wood: {name: "木のサイコロ", unlock: "3回対局する", body: "#d9a86c", pip: "#3b2412", edge: "#8a5a2b"},
        gold: {name: "金のサイコロ", unlock: "90000点以上", body: "#f3cf55", pip: "#5a3d00", edge: "#a07800"},
        tofu: {name: "豆腐", unlock: "「完全絶滅」を出す", body: "#ffffff", pip: "#d8d8d8", edge: "#e2e2e2"},
        pixel: {name: "ドット絵", unlock: "隠し役を3種類発見", body: "#7cf", pip: "#003", edge: "#038"}
    };
    var FACE_TINT = ["", "#e8443a", "#3a7be0", "#38a852", "#e0a02a", "#8a4fd0", "#3c3c3c"];
    var FACE_RGB = FACE_TINT.map((c) => c ? hex(c) : [1, 1, 1]);
    var PIPS = {
        1: [[0.5, 0.5]],
        2: [[0.27, 0.27], [0.73, 0.73]],
        3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
        4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
        5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
        6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]]
    };

    function paintAtlas(skin) {
        const S2 = 128, s = SKINS[skin];
        return paintCanvas(S2 * 6, S2, (g) => {
            for (let f = 1; f <= 6; f++) {
                const ox = (f - 1) * S2;
                g.fillStyle = s.edge;
                g.fillRect(ox, 0, S2, S2);
                const grad = g.createLinearGradient(ox, 0, ox + S2, S2);
                grad.addColorStop(0, "#ffffff");
                grad.addColorStop(0.3, s.body);
                grad.addColorStop(1, s.body);
                g.fillStyle = grad;
                g.beginPath();
                const m = 6, r = 24;
                g.moveTo(ox + m + r, m);
                g.arcTo(ox + S2 - m, m, ox + S2 - m, S2 - m, r);
                g.arcTo(ox + S2 - m, S2 - m, ox + m, S2 - m, r);
                g.arcTo(ox + m, S2 - m, ox + m, m, r);
                g.arcTo(ox + m, m, ox + S2 - m, m, r);
                g.fill();
                g.fillStyle = f === 1 && skin === "classic" ? "#d22" : s.pip;
                for (const [u, v] of PIPS[f]) {
                    const pr = f === 1 ? 19 : 12.5;
                    if (skin === "pixel") g.fillRect(ox + u * S2 - pr, v * S2 - pr, pr * 2, pr * 2); else {
                        g.beginPath();
                        g.arc(ox + u * S2, v * S2, pr, 0, Math.PI * 2);
                        g.fill();
                    }
                }
            }
        });
    }

    /** 回転体：profile = [[半径, 高さ, 色], ...] */
    function lathe(profile, seg) {
        const g = {pos: [], nrm: [], uv: [], idx: [], col: []};
        const P = profile.length;
        for (let s = 0; s <= seg; s++) {
            const a = s / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            for (let k = 0; k < P; k++) {
                const [r, y, col] = profile[k];
                const prev = profile[Math.max(0, k - 1)], nxt = profile[Math.min(P - 1, k + 1)];
                const tr = nxt[0] - prev[0], ty = nxt[1] - prev[1];
                const l = Math.hypot(tr, ty) || 1;
                const nr = -ty / l, ny = tr / l;
                g.pos.push(ca * r, y, sa * r);
                g.nrm.push(ca * nr, ny, sa * nr);
                g.uv.push(s / seg, k / (P - 1));
                g.col.push(...col);
            }
        }
        for (let s = 0; s < seg; s++) for (let k = 0; k < P - 1; k++) {
            const a = s * P + k, b = (s + 1) * P + k;
            g.idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        return g;
    }

    function disk(r, seg) {
        const g = {pos: [0, 0, 0], nrm: [0, 1, 0], uv: [0.5, 0.5], idx: []};
        for (let s = 0; s <= seg; s++) {
            const a = s / seg * Math.PI * 2;
            g.pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
            g.nrm.push(0, 1, 0);
            g.uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2);
        }
        for (let s = 0; s < seg; s++) g.idx.push(0, s + 2, s + 1);
        return g;
    }

    var TrayView = class {
        constructor(r) {
            this.r = r;
            this.camera = new Camera();
            this.w = 1;
            this.h = 1;
            this.time = 0;
            this.shakeAmt = 0;
            this.zoomKick = 0;
            this.flash = 0;
            this.flashColor = [1, 0.85, 0.4];
            this.skin = null;
            this.atlas = null;
            this.cube = new Mesh(r, atlasCube(DIE, FACE_ORDER));
            this.inst = new Instances(r, DICE + 4);
            this.shadowInst = new Instances(r, 400);
            this.sparkInst = new Instances(r, 260);
            this.sparks = [];
            this.camTarget = [0, 0, 0];
            // ---- おぼん ----
            const red = hex("#b3261e"), deep = hex("#7d1712"), gold = hex("#e0b25a"), dark = hex("#4a0e0b");
            const R = TRAY_R;
            this.rim = new Mesh(r, lathe([[R - 0.5, -0.5, deep], [R, 4, deep], [R, RIM_H - 6, red], [R + 2, RIM_H - 1, red], [R + 6, RIM_H + 2.2, gold], [R + 11, RIM_H + 3, gold], [R + 16, RIM_H + 2, gold], [R + 20, RIM_H - 2, red], [R + 22, RIM_H - 10, red], [R + 24, -4, deep], [R + 20, -12, dark], [R + 4, -13, dark]], 120));
            this.floor = new Mesh(r, disk(R + 1, 120));
            this.floorTex = r.texture(paintCanvas(1024, 1024, (g, W) => {
                const c = W / 2;
                const bg = g.createRadialGradient(c, c * 0.85, 40, c, c, c);
                bg.addColorStop(0, "#6d1a13");
                bg.addColorStop(0.65, "#4b100c");
                bg.addColorStop(1, "#2c0806");
                g.fillStyle = bg;
                g.fillRect(0, 0, W, W);
                // 木目のような同心円
                for (let i = 0; i < 160; i++) {
                    g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.07})`;
                    g.lineWidth = 1 + Math.random() * 2;
                    g.beginPath();
                    g.ellipse(c + (Math.random() - 0.5) * 6, c + (Math.random() - 0.5) * 6, i * 3.2, i * 3.2 * (0.98 + Math.random() * 0.04), 0, 0, Math.PI * 2);
                    g.stroke();
                }
                // 金の青海波（控えめ）
                g.strokeStyle = "rgba(230,180,90,0.10)";
                g.lineWidth = 3;
                const sz = 64;
                for (let y = 0; y < W + sz; y += sz / 2) for (let x = 0; x < W + sz; x += sz) {
                    const xx = x + (y / (sz / 2) % 2 ? sz / 2 : 0);
                    for (let k = 1; k <= 3; k++) {
                        g.beginPath();
                        g.arc(xx, y, sz / 2 * k / 3, Math.PI, 0);
                        g.stroke();
                    }
                }
                g.globalCompositeOperation = "destination-in";
                const m = g.createRadialGradient(c, c, 0, c, c, c);
                m.addColorStop(0, "rgba(0,0,0,1)");
                m.addColorStop(1, "rgba(0,0,0,1)");
                g.globalCompositeOperation = "source-over";
                // 金線の内周
                g.strokeStyle = "rgba(224,178,90,0.55)";
                g.lineWidth = 6;
                g.beginPath();
                g.arc(c, c, c - 14, 0, Math.PI * 2);
                g.stroke();
                g.fillStyle = "rgba(224,178,90,0.14)";
                g.font = "900 120px serif";
                g.textAlign = "center";
                g.textBaseline = "middle";
                g.fillText("超究極", c, c);
                // 漆のハイライト
                const hl = g.createRadialGradient(c * 0.7, c * 0.6, 10, c * 0.7, c * 0.6, c * 0.9);
                hl.addColorStop(0, "rgba(255,220,200,0.12)");
                hl.addColorStop(1, "rgba(255,220,200,0)");
                g.fillStyle = hl;
                g.fillRect(0, 0, W, W);
            }), {mipmap: true});
            // テーブル
            this.table = new Mesh(r, planeXZ(4200, 4200));
            this.tableTex = r.texture(paintCanvas(512, 512, (g) => {
                g.fillStyle = "#3b2618";
                g.fillRect(0, 0, 512, 512);
                for (let i = 0; i < 90; i++) {
                    g.strokeStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 15},5,${0.25 + Math.random() * 0.3})`;
                    g.lineWidth = 1 + Math.random() * 3;
                    const y = Math.random() * 512;
                    g.beginPath();
                    g.moveTo(0, y);
                    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 6);
                    g.stroke();
                }
                const v = g.createRadialGradient(256, 256, 30, 256, 256, 300);
                v.addColorStop(0, "rgba(255,200,140,0.10)");
                v.addColorStop(1, "rgba(0,0,0,0.55)");
                g.fillStyle = v;
                g.fillRect(0, 0, 512, 512);
            }), {mipmap: true});
            this.blobTex = r.texture(paintCanvas(64, 64, (g) => {
                const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
                gr.addColorStop(0, "rgba(0,0,0,0.55)");
                gr.addColorStop(1, "rgba(0,0,0,0)");
                g.fillStyle = gr;
                g.fillRect(0, 0, 64, 64);
            }));
            this.sparkTex = r.texture(paintCanvas(64, 64, (g) => {
                const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
                gr.addColorStop(0, "rgba(255,255,230,1)");
                gr.addColorStop(0.3, "rgba(255,210,120,0.8)");
                gr.addColorStop(1, "rgba(255,160,60,0)");
                g.fillStyle = gr;
                g.fillRect(0, 0, 64, 64);
            }));
            this.quad = new Mesh(r, planeXZ(1, 1));
            this.ringMesh = new Mesh(r, lathe([[TRAY_R - 20, 0.6, [1, 1, 1]], [TRAY_R - 4, 0.6, [1, 1, 1]]], 96));
        }

        setSkin(skin) {
            if (skin === this.skin) return;
            this.skin = skin;
            this.r.deleteTexture(this.atlas);
            this.atlas = this.r.texture(paintAtlas(skin), {mipmap: true});
        }

        resize(w, h) {
            this.w = w;
            this.h = h;
            this.camera.aspect = w / h;
        }

        trayModel(phys) {
            return fromTRS(new Float32Array(16), phys.trayPos, phys.trayQ);
        }

        /** 画面座標 → おぼん座標の床面 */
        screenToLocal(phys, sx, sy) {
            const ray = this.camera.ray(sx, sy, this.w, this.h);
            const m = this.trayModel(phys);
            const inv = invert(new Float32Array(16), m);
            const o = transformPoint(inv, ray.o), e = transformPoint(inv, v3.add(ray.o, ray.d));
            const d = v3.sub([e[0], e[1], e[2]], [o[0], o[1], o[2]]);
            if (Math.abs(d[1]) < 1e-6) return null;
            const t = (HALF - o[1]) / d[1];
            if (t < 0) return null;
            return [o[0] + d[0] * t, o[2] + d[2] * t];
        }

        projectLocal(phys, p) {
            const w = transformPoint(this.trayModel(phys), p);
            return this.camera.project([w[0], w[1], w[2]], this.w, this.h);
        }

        kick(amount) {
            this.shakeAmt = Math.min(1.4, this.shakeAmt + amount);
        }

        spawnSparks(list, scale = 1) {
            for (const [x, y, z, e] of list) {
                const n = 2 + Math.floor(Math.min(4, e / 250) * scale);
                for (let k = 0; k < n && this.sparks.length < 250; k++) {
                    const a = Math.random() * Math.PI * 2;
                    const s = 60 + Math.random() * 160;
                    this.sparks.push({
                        x,
                        y: y + 4,
                        z,
                        vx: Math.cos(a) * s,
                        vy: 80 + Math.random() * 180,
                        vz: Math.sin(a) * s,
                        life: 0.35 + Math.random() * 0.3,
                        t: 0,
                        size: 3 + Math.random() * 4
                    });
                }
            }
        }

        burst(n, color) {
            for (let k = 0; k < n && this.sparks.length < 250; k++) {
                const a = Math.random() * Math.PI * 2, rr = Math.random() * TRAY_R * 0.8;
                this.sparks.push({
                    x: Math.cos(a) * rr,
                    y: 10,
                    z: Math.sin(a) * rr,
                    vx: (Math.random() - 0.5) * 80,
                    vy: 260 + Math.random() * 380,
                    vz: (Math.random() - 0.5) * 80,
                    life: 0.8 + Math.random() * 0.7,
                    t: 0,
                    size: 5 + Math.random() * 7,
                    color
                });
            }
        }

        updateCamera(dt, phys, settings) {
            const cam = this.camera;
            cam.fov = 40 * Math.PI / 180;
            const tp = phys.trayPos;
            const k = Math.min(1, dt * 4);
            this.camTarget = v3.lerp(this.camTarget, [tp[0] * 0.45, 0, tp[2] * 0.45], k);
            const vfov = cam.fov, hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
            const fit = Math.min(vfov, hfov * 0.98);
            const radius = TRAY_R + 30;
            const dist = radius / Math.tan(fit / 2) * 1.13 * (1 - this.zoomKick * 0.1);
            const pitch = 1.02 - this.zoomKick * 0.05;
            const sh = settings.shake ? this.shakeAmt * 5 : 0;
            const jx = (Math.random() - 0.5) * sh, jz = (Math.random() - 0.5) * sh;
            const tgt = [this.camTarget[0] + jx, 0, this.camTarget[2] + 34 + jz];
            cam.target = tgt;
            cam.eye = [tgt[0], Math.sin(pitch) * dist, tgt[2] + Math.cos(pitch) * dist];
            cam.near = 10;
            cam.far = 9000;
            cam.update();
            this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3);
            this.zoomKick = Math.max(0, this.zoomKick - dt * 1.6);
        }

        /** vis: { faces, heldMask, highlight(Uint8Array|null), colorFaces, settled } */
        draw(phys, vis, dt, settings) {
            this.time += dt;
            this.updateCamera(dt, phys, settings);
            const r = this.r;
            const fl = this.flash;
            this.flash = Math.max(0, this.flash - dt * 2.2);
            const lights = {
                dir: [-0.4, 1, 0.55],
                color: [0.92 + fl * 0.3, 0.86 + fl * 0.25, 0.76 + fl * 0.1],
                sky: [0.55, 0.55, 0.62],
                ground: [0.3, 0.24, 0.2],
                fogColor: [0.12, 0.08, 0.06],
                fog: [1400, 4200]
            };
            r.begin(this.camera, lights, [0.12, 0.08, 0.06]);
            r.draw(this.table, {tex: this.tableTex, spec: 0.05, model: translate([0, -14, 0])});
            // おぼんの影
            const tp = phys.trayPos;
            const sS = (TRAY_R + 60) * 2 * (1 + tp[1] / 200);
            const sm = fromTRS(new Float32Array(16), [tp[0] + 10, -13.5, tp[2] + 14], quat.identity(), [sS, 1, sS]);
            r.draw(this.quad, {tex: this.blobTex, blend: "alpha", unlit: true, model: sm, color: [1, 1, 1, 0.9]});
            const model = this.trayModel(phys);
            r.draw(this.floor, {tex: this.floorTex, spec: 0.55, shin: 60, model});
            r.draw(this.rim, {spec: 0.8, shin: 70, model});
            if (vis.highlight) r.draw(this.ringMesh, {
                model, unlit: true, blend: "add", color: [1, 0.8, 0.3, 0.1 + 0.06 * Math.sin(this.time * 5)]
            });
            // ---- サイコロ ----
            const inst = this.inst;
            inst.count = DICE;
            const q = phys.q;
            const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
            for (let i = 0; i < DICE; i++) {
                const settledDie = phys.state[i] !== 0 && phys.snapT[i] >= 1;
                const f = phys.target[i];
                let cr = 1, cg = 1, cb = 1;
                if (vis.colorFaces && settledDie) {
                    const t = FACE_RGB[f];
                    cr = 0.8 + t[0] * 0.22;
                    cg = 0.8 + t[1] * 0.22;
                    cb = 0.8 + t[2] * 0.22;
                }
                let y = phys.py[i];
                if (vis.heldMask[i]) {
                    cr = 1.3;
                    cg = 1.08;
                    cb = 0.42;
                    y += phys.state[i] === 2 ? 0 : 0;
                }
                if (vis.highlight && settledDie) {
                    if (vis.highlight[i]) {
                        const b = 1.06 + pulse * 0.18;
                        cr *= b;
                        cg *= b;
                        cb *= b;
                        y += 1.2;
                    } else {
                        cr *= 0.5;
                        cg *= 0.5;
                        cb *= 0.54;
                    }
                }
                const o = i * 4;
                inst.set(i, phys.px[i], y, phys.pz[i], q[o], q[o + 1], q[o + 2], q[o + 3], 1, 1, 1, cr, cg, cb, 1);
            }
            r.drawInstanced(this.cube, inst, {tex: this.atlas, spec: 0.35, shin: 40, model});
            // 空中のサイコロの影
            const sh = this.shadowInst;
            let n = 0;
            for (let i = 0; i < DICE && n < 400; i++) {
                const hgt = phys.py[i] - HALF;
                if (hgt < 3) continue;
                const s = DIE * (1.5 + hgt / 90);
                sh.set(n++, phys.px[i], 0.5, phys.pz[i], 0, 0, 0, 1, s, 1, s, 1, 1, 1, clamp(1 - hgt / 220) * 0.8);
            }
            sh.count = n;
            if (n) r.drawInstanced(this.quad, sh, {tex: this.blobTex, blend: "alpha", unlit: true, model});
            // 火花
            const sp = this.sparkInst;
            let m = 0;
            const right = [this.camera.view[0], this.camera.view[4], this.camera.view[8]];
            void right;
            this.sparks = this.sparks.filter((p) => (p.t += dt) < p.life);
            for (const p of this.sparks) {
                p.vy -= 900 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.z += p.vz * dt;
                if (p.y < 1) {
                    p.y = 1;
                    p.vy *= -0.3;
                }
                const a = 1 - p.t / p.life;
                const c = p.color || [1, 0.85, 0.45];
                sp.set(m++, p.x, p.y, p.z, 0, 0, 0, 1, p.size * a + 1, 1, p.size * a + 1, c[0], c[1], c[2], a);
            }
            sp.count = m;
            if (m) r.drawInstanced(this.quad, sp, {
                tex: this.sparkTex, blend: "add", unlit: true, model, depthTest: false, cull: false
            });
        }
    };

    function translate(t) {
        const m = new Float32Array(16);
        m[0] = m[5] = m[10] = m[15] = 1;
        m[12] = t[0];
        m[13] = t[1];
        m[14] = t[2];
        return m;
    }

    // ===== sound.js — WebAudioで合成（外部音声ファイルなし） =====
    var YachtSound = class {
        constructor(audio) {
            this.audio = audio;
            this.noiseBuf = null;
            this.lastClack = 0;
        }

        noise(ctx) {
            if (!this.noiseBuf) {
                const len = ctx.sampleRate * 1.5;
                this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
                const d = this.noiseBuf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            }
            return this.noiseBuf;
        }

        clack(delay, gain, freq) {
            const o = this.audio.out();
            if (!o) return;
            const {ctx, dest} = o;
            const src = ctx.createBufferSource();
            src.buffer = this.noise(ctx);
            const f = ctx.createBiquadFilter();
            f.type = "bandpass";
            f.frequency.value = freq;
            f.Q.value = 6;
            const g = ctx.createGain();
            const t = ctx.currentTime + delay;
            g.gain.setValueAtTime(gain, t);
            g.gain.exponentialRampToValueAtTime(1e-4, t + 0.035);
            src.connect(f).connect(g).connect(dest);
            src.start(t, Math.random());
            src.stop(t + 0.05);
        }

        tone(freq, dur, type, gain, delay = 0, slide = 0) {
            const o = this.audio.out();
            if (!o) return;
            const {ctx, dest} = o;
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
            const g = ctx.createGain();
            g.gain.setValueAtTime(gain, t);
            g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
            osc.connect(g).connect(dest);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        }

        /** おぼんを振る風切り音 */
        whoosh(strength) {
            const o = this.audio.out();
            if (!o) return;
            const {ctx, dest} = o;
            const src = ctx.createBufferSource();
            src.buffer = this.noise(ctx);
            const f = ctx.createBiquadFilter();
            f.type = "lowpass";
            f.Q.value = 2;
            const t = ctx.currentTime;
            f.frequency.setValueAtTime(300, t);
            f.frequency.exponentialRampToValueAtTime(1800 + strength * 1500, t + 0.18);
            f.frequency.exponentialRampToValueAtTime(250, t + 0.9);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.35 * strength, t + 0.12);
            g.gain.exponentialRampToValueAtTime(1e-4, t + 1);
            src.connect(f).connect(g).connect(dest);
            src.start(t);
            src.stop(t + 1.05);
            this.tone(70, 0.35, "sine", 0.25 * strength, 0.02, 0.6);
        }

        /** 物理イベントから音を出す（1フレームに数発まで） */
        physics(ev, now) {
            if (ev.clacks <= 0) return;
            const n = Math.min(5, Math.ceil(ev.clacks / 25));
            const power = Math.min(1, ev.clackPower / Math.max(1, ev.clacks) * 2 + 0.15);
            for (let i = 0; i < n; i++) this.clack(Math.random() * 0.016, 0.06 + power * 0.18, 1800 + Math.random() * 3400);
            if (ev.rim.length) this.tone(110 + Math.random() * 30, 0.12, "triangle", Math.min(0.25, 0.05 * ev.rim.length), 0, 0.5);
        }

        tick(pitch = 1) {
            this.tone(1400 * pitch, 0.025, "square", 0.025);
        }

        select() {
            this.tone(660, 0.06, "triangle", 0.08);
            this.tone(990, 0.08, "triangle", 0.06, 0.04);
        }

        hold(on) {
            this.tone(on ? 880 : 520, 0.06, "triangle", 0.08);
        }

        pen() {
            for (let i = 0; i < 5; i++) this.clack(i * 0.03, 0.1, 6000);
        }

        stamp() {
            this.tone(90, 0.18, "sine", 0.4);
            this.clack(0, 0.5, 500);
        }

        countTick(i) {
            this.tone(900 + (i % 12) * 60, 0.03, "square", 0.025);
        }

        chime() {
            [784, 1046, 1318].forEach((f, i) => this.tone(f, 0.4, "triangle", 0.1, i * 0.09));
        }

        fanfare(level) {
            const seq = level >= 3 ? [523, 659, 784, 1046, 784, 1046, 1318, 1568] : level === 2 ? [523, 659, 784, 1046, 1318] : [659, 880, 1046];
            seq.forEach((f, i) => this.tone(f, 0.28, "triangle", 0.11, i * 0.11));
            if (level >= 3) seq.forEach((f, i) => this.tone(f / 2, 0.3, "sawtooth", 0.03, i * 0.11));
        }

        sad() {
            [392, 349, 311].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.08, i * 0.14));
        }

        ticket() {
            [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.12, "square", 0.04, i * 0.05));
        }
    };
    // ===== main.js — 画面・操作・演出のつなぎ込み =====
    installErrorOverlay("超究極ヨット1000");
    var $ = (id) => document.getElementById(id);
    var fmt = (n) => Math.round(n).toLocaleString();
    var audio = new AudioOut();
    var sound = new YachtSound(audio);
    var {backend, persistent} = detectBackend();
    var store = new JsonStore("yacht2", () => ({
        highScore: 0,
        games: 0,
        history: [],
        roleBest: {},
        roleCounts: {},
        hiddenFound: [],
        bestCombo: 0,
        skin: "classic",
        jackpots: []
    }), backend);
    var prefs = new JsonStore("prefs2", () => ({
        muted: false, shake: "on", effects: "full", speed: "normal", colorFaces: "on", hints: "on"
    }), backend);
    audio.muted = prefs.get().muted;
    var P = () => prefs.get();
    var seed = Number(new URLSearchParams(location.search).get("seed")) || (Date.now() & 4294967295);
    var rng = seededRng(seed);
    var LINES = {
        start: ["1000個、おぼんに全員集合しました。", "おぼんは重いです。腰に気をつけて。", "本日のおぼんは特大サイズです。"],
        big: ["おぼんが悲鳴を上げています。", "1000個が一斉に宙を舞いました。", "床に落ちなかったのは奇跡です。"],
        soft: ["そっと振りました。サイコロも少し物足りなさそうです。"],
        settle: ["全員、着席しました。", "集計完了。数え間違いはありません。", "1000個の運命が決まりました。"],
        wind: ["追い風の目が吹いています。", "今日の風は気まぐれです。"],
        zero: ["0点です。記入するのは少し寂しいです。", "空欄よりはましです。たぶん。"],
        great: ["確率の担当者が席を外しました。", "これは運なのか、戦略なのか。", "おぼんが誇らしげです。"],
        combo: ["コンボ継続中。サイコロたちが調子に乗っています。", "連続成立！ 集計係が拍手しています。"],
        last: ["最終ラウンドです。", "残る役はひとつです。"]
    };
    var picker = new LinePicker(LINES, Math.random, {baseGapMs: 900, holdMs: 2000, recentSize: 6});
    var sayTimer = 0;

    function say(key, pr = 1) {
        const l = picker.request(key, performance.now(), {priority: pr});
        if (!l) return;
        const el = $("say");
        el.textContent = l.text;
        el.classList.add("show");
        clearTimeout(sayTimer);
        sayTimer = setTimeout(() => {
            el.classList.remove("show");
            picker.release();
        }, 2600);
    }

    var toastTimer = 0;

    function toast(text) {
        const t = $("toast");
        t.textContent = text;
        t.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
    }

    var dieHTML = (f, sm = false) => {
        const cells = {
            1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
        }[f];
        let s = "";
        for (let k = 1; k <= 9; k++) s += cells.includes(k) ? "<i></i>" : "<span></span>";
        return `<span class="die${sm ? " sm" : ""}" style="--fc:var(--f${f})" aria-label="${f}の目">${s}</span>`;
    };

    // ---- 3D ----
    var canvas = $("gl");
    var renderer = Renderer.create(canvas, {antialias: true});
    if (!renderer) {
        showNoWebGL("このブラウザではWebGL（3D表示）が使えないため、超究極ヨット1000を表示できません。<br>Chrome / Edge / Firefox / Safari の最新版でお試しください。");
        throw new Error("WebGL unavailable");
    }
    watchContextLoss(canvas, renderer);
    var phys = new TrayPhysics(DICE);
    var view = new TrayView(renderer);

    function fit() {
        const b = $("stage").getBoundingClientRect();
        const w = Math.max(100, b.width), h = Math.max(100, b.height);
        renderer.resize(canvas, w, h, Math.min(2, window.devicePixelRatio || 1));
        view.resize(w, h);
    }

    window.addEventListener("resize", fit);

    // ---- 役ごとの基準値（「おすすめ」の判断に使う：その役の平均的な得点） ----
    var BASELINE = (() => {
        const out = {};
        const r = seededRng(12345);
        for (const role of ROLE_LIST) {
            let s = 0;
            const N = 24;
            for (let k = 0; k < N; k++) {
                const c = rerollCounts(zero7(), r);
                const ctx = {goal: makeGoal(r), wind: 0, throwsLeft: 2};
                s += forecast(role, c, clampHold(role.plan(c, ctx), c), 2, ctx, 24, r).ev;
            }
            out[role.id] = s / N;
        }
        return out;
    })();

    // ---- 対局状態 ----
    var S = null;

    function startGame() {
        S = {
            game: new YachtGame(rng),
            phase: "ready",
            sel: null,
            aim: null,
            fc: {},
            rec: null,
            banner: null,
            shownScore: 0,
            comboShown: 0
        };
        if (debugEnabled()) Object.assign(window, {__S: S, __phys: phys, __view: view});
        phys.scatter(S.game.faces);
        phys.shake = null;
        ["title", "result"].forEach((id) => $(id).classList.add("hidden"));
        $("play").classList.remove("hidden");
        fit();
        buildHolds();
        buildRoles();
        refresh();
        say("start", 2);
    }

    var phaseRolling = () => S && S.phase === "rolling";

    function canEditHolds() {
        const g = S && S.game;
        return !!g && S.phase === "decide" && g.hasRolled && (g.throwsLeft > 0 || g.canUseToken);
    }

    function canShake() {
        const g = S && S.game;
        return !!g && (S.phase === "ready" || S.phase === "decide") && g.canThrow;
    }

    // ---- 振る ----
    function doThrow(dir, strength) {
        if (!canShake()) return false;
        audio.unlock();
        const g = S.game;
        const rolled = g.throwDice();
        const fast = P().speed === "fast";
        phys.startThrow(rolled, g.faces, g.heldMask, dir, strength, {fast});
        S.phase = "rolling";
        S.fc = {};
        sound.whoosh(Math.min(1.2, strength));
        view.zoomKick = Math.min(1, 0.4 + strength * 0.5);
        if (P().shake === "on") view.kick(0.3 * strength);
        if (strength > 1.05) say("big", 1); else if (strength < 0.5) say("soft", 1);
        refresh();
        return true;
    }

    function shakeButton() {
        const a = Math.random() * Math.PI * 2;
        doThrow([Math.cos(a), Math.sin(a) * 0.6 + 0.4 * Math.sign(Math.sin(a) || 1)].map((v, i, arr) => v / Math.hypot(arr[0], arr[1])), 1);
    }

    function onSettled() {
        const g = S.game;
        S.phase = "decide";
        if (S.aim && !g.scores[S.aim] && (g.throwsLeft > 0 || g.canUseToken)) applyAim(S.aim, true);
        computeForecasts();
        say(g.throwsUsed === 1 && g.counts[g.wind] > 175 ? "wind" : "settle", 0);
        refresh();
    }

    function computeForecasts() {
        const g = S.game;
        const c = g.counts;
        const ctx = g.ctx;
        S.fc = {};
        const tl = g.throwsLeft;
        let best = null, bv = -Infinity;
        for (const id of g.open) {
            const role = ROLES[id];
            const scoreFn = (cc) => evaluateRole(id, cc, ctx, 0).points;
            const holdNow = clampHold(role.plan(c, {...ctx, throwsLeft: tl - 1}), c);
            const f = tl > 0 ? forecast(role, c, holdNow, tl, ctx, 110, Math.random, scoreFn) : {
                p: role.achieved(c, ctx) ? 1 : 0, ev: scoreFn(c)
            };
            S.fc[id] = f;
            const v = f.ev - BASELINE[id] * (role.windable ? 1.12 : 1);
            if (v > bv) {
                bv = v;
                best = id;
            }
        }
        S.rec = best;
    }

    // ---- 役の選択・狙い・記入 ----
    function selectRole(id) {
        if (!S || S.game.scores[id]) return;
        S.sel = S.sel === id ? null : id;
        sound.select();
        refresh();
    }

    function planFor(id) {
        const g = S.game;
        return clampHold(ROLES[id].plan(g.counts, {...g.ctx, throwsLeft: Math.max(0, g.throwsLeft - 1)}), g.counts);
    }

    function describeHold(h, c) {
        const parts = F.filter((f) => h[f] > 0).map((f) => h[f] === c[f] ? `${f}の目を全部(${h[f]}個)` : `${f}の目を${h[f]}個`);
        const reroll = DICE - h.reduce((s, v) => s + v, 0);
        return `${parts.length ? parts.join("・") + "を残し、" : "何も残さず、"}${reroll}個を振り直す`;
    }

    function applyAim(id, auto = false) {
        const g = S.game;
        if (!g.hasRolled || g.scores[id]) return;
        S.aim = id;
        S.sel = id;
        if (g.throwsLeft > 0 || g.canUseToken) {
            g.setHolds(planFor(id));
            if (!auto) sound.hold(true); else toast(`🎯 ${ROLES[id].name}：${describeHold(g.hold, g.counts)}`);
        }
        refresh();
    }

    function commitRole(id) {
        if (!S || S.phase !== "decide") return;
        const g = S.game;
        if (!g.hasRolled || g.scores[id] || g.over) return;
        audio.unlock();
        const counts = g.counts;
        const usedMask = maskFor(ROLES[id].used(counts, g.ctx));
        const res = g.commit(id);
        S.sel = null;
        S.aim = null;
        S.fc = {};
        S.phase = "banner";
        sound.pen();
        setTimeout(() => sound.stamp(), 160);
        store.update((d) => {
            if (res.points > 0) d.roleCounts[id] = (d.roleCounts[id] || 0) + (res.achieved ? 1 : 0);
            d.roleBest[id] = Math.max(d.roleBest[id] || 0, res.points);
            if (id === "extinct" && res.base >= 12e3 && !d.jackpots.includes("extinct0")) d.jackpots.push("extinct0");
            for (const h of res.hidden) if (!d.hiddenFound.includes(h)) d.hiddenFound.push(h);
        });
        showBanner(id, res, usedMask);
        if (res.hidden.length) setTimeout(() => {
            sound.chime();
            toast(`隠し役「${res.hidden.map((h) => HIDDEN_ROLES[h].name).join("・")}」成立！ +${fmt(res.hiddenPoints)}`);
        }, 700); else if (res.tokenGained) setTimeout(() => {
            sound.ticket();
            toast("🎟 追い振り券を獲得しました（+1投に使えます）");
        }, 700);
        if (res.upperBonusNow) setTimeout(() => {
            sound.chime();
            toast(`上段ボーナス達成！ +${fmt(UPPER_BONUS)}`);
        }, 1300);
        refresh();
    }

    function maskFor(used) {
        const m = new Uint8Array(DICE);
        const left = [...used];
        const fc = S.game.faces;
        for (let i = 0; i < DICE; i++) if (left[fc[i]] > 0) {
            m[i] = 1;
            left[fc[i]]--;
        }
        return m;
    }

    // ---- 結果バナー ----
    function showBanner(id, res, usedMask) {
        const role = ROLES[id];
        const fast = P().speed === "fast";
        const fx = P().effects;
        const level = res.points === 0 ? 0 : (role.tier === "hard" || role.tier === "special") && res.achieved ? 3 : role.tier === "mid" && res.achieved ? 2 : 1;
        const b = $("banner");
        const mods = [];
        if (res.wind) mods.push(`<span class="w">🎏 追い風 ×${WIND_MULT}</span>`);
        if (res.comboLevel > 0) mods.push(`<span class="c">🔥 コンボ${res.comboLevel + 1}連 +${Math.round(res.comboLevel * COMBO_STEP * 100)}%</span>`);
        if (res.tokenGained) mods.push(`<span class="t">🎟 追い振り券 +1</span>`);
        const title = res.points === 0 ? "不成立…" : res.achieved ? "成立！" : "記入";
        b.innerHTML = `<div class="card ${TIERS[role.tier].cls} ${res.points === 0 ? "zero" : ""}">
      <div class="tierline"><span class="tierb ${TIERS[role.tier].cls}">${TIERS[role.tier].mark} ${TIERS[role.tier].name}</span> ${title}</div>
      <div class="rname">${role.name}</div>
      <div class="pts" id="bn-pts">0</div>
      <div class="mods">${mods.join("")}</div>
      <div class="skip">クリックで次へ</div></div>`;
        b.classList.remove("hidden");
        S.banner = {usedMask, until: performance.now() + (fast ? 900 : level >= 3 ? 2300 : 1700)};
        // 得点のカウントアップ
        const dur = fast ? 350 : level >= 2 ? 900 : 650;
        const t0 = performance.now();
        let ticks = 0;
        const el = $("bn-pts");
        const step = () => {
            if (!S || !S.banner) return;
            const k = Math.min(1, (performance.now() - t0) / dur);
            el.textContent = fmt(res.points * ease.out(k));
            if (k < 1) {
                if (ticks++ % 3 === 0) sound.countTick(ticks);
                requestAnimationFrame(step);
            }
        };
        step();
        if (level === 0) sound.sad(); else setTimeout(() => sound.fanfare(level), 220);
        if (fx !== "off" && level >= 2) {
            view.burst(fx === "lite" ? 20 : level >= 3 ? 140 : 60, level >= 3 ? [1, 0.6, 0.9] : [1, 0.85, 0.45]);
            view.flash = level >= 3 ? 1 : 0.5;
            if (level >= 3) {
                const f = $("flash");
                f.classList.remove("go");
                void f.offsetWidth;
                f.classList.add("go");
            }
        }
        if (P().shake === "on" && level >= 3) view.kick(0.8);
        if (level >= 2) say(S.game.streak >= 3 ? "combo" : "great", 1); else if (level === 0) say("zero", 1);
        b.querySelector(".card").addEventListener("click", closeBanner);
    }

    function closeBanner() {
        if (!S || !S.banner) return;
        S.banner = null;
        $("banner").classList.add("hidden");
        const g = S.game;
        if (g.over) {
            S.phase = "over";
            finish();
            return;
        }
        S.phase = "ready";
        if (g.round === ROUNDS) say("last", 2);
        refresh();
    }

    // ---- 残すサイコロのパネル ----
    function buildHolds() {
        const box = $("hgrid");
        box.innerHTML = "";
        for (const f of F) {
            const d = document.createElement("div");
            d.className = "hcell";
            d.id = `hc${f}`;
            d.style.setProperty("--fc", `var(--f${f})`);
            d.innerHTML = `${dieHTML(f)} <div class="cnt" id="hn${f}">-</div>
        <div class="meter"><i id="hm${f}"></i><i class="h" id="hh${f}"></i></div>
        <div class="keep">残す <b id="hk${f}">0</b></div>
        <div class="row"><button data-f="${f}" data-d="-1" aria-label="${f}の目の残しを1個減らす">−1</button><button data-f="${f}" data-d="1" aria-label="1個増やす">+1</button><button data-f="${f}" data-d="-10" aria-label="10個減らす">−10</button><button data-f="${f}" data-d="10" aria-label="10個増やす">+10</button></div>
        <button class="toggle" data-f="${f}" data-t="1" title="キー ${f}">全部残す</button>`;
            box.appendChild(d);
        }
        box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
            const f = Number(b.dataset.f);
            if (b.dataset.t) toggleFace(f); else editHold(f, S.game.hold[f] + Number(b.dataset.d));
        }));
    }

    function editHold(f, n) {
        if (!canEditHolds()) return;
        S.game.setHold(f, n);
        if (S.aim) {
            S.aim = null;
            toast("手動で残し方を変えたので「狙い」を解除しました");
        }
        sound.tick(1 + f * 0.05);
        refresh();
    }

    function toggleFace(f) {
        if (!canEditHolds()) return;
        const g = S.game;
        const all = g.hold[f] >= g.counts[f] && g.counts[f] > 0;
        sound.hold(!all);
        editHold(f, all ? 0 : g.counts[f]);
    }

    // ---- スコア表 ----
    function buildRoles() {
        const tb = $("roles");
        tb.innerHTML = "";
        const grp = (t) => {
            const tr = document.createElement("tr");
            tr.className = "grp";
            tr.innerHTML = `<td colspan="5">${t}</td>`;
            tb.appendChild(tr);
        };
        grp("上段　1〜6の目（基本役）");
        for (const r of ROLE_LIST) {
            if (!r.upper && !$("upper-sub")) {
                const sub = document.createElement("tr");
                sub.className = "sub";
                sub.id = "upper-sub";
                sub.innerHTML = `<td colspan="5"><div style="display:flex;justify-content:space-between"><b>上段小計</b><span id="upper-text"></span></div><div class="bonusbar"><i id="upper-bar"></i></div></td>`;
                tb.appendChild(sub);
                grp("下段　役（★基本 ★★中級 ★★★高難度 ◆特殊）");
            }
            const tr = document.createElement("tr");
            tr.className = `role ${TIERS[r.tier].cls}`;
            tr.id = `r-${r.id}`;
            tr.innerHTML = `<td class="name"><span class="tierb">${TIERS[r.tier].mark}</span><b>${r.name}</b><small class="cond"></small></td><td class="stc"></td><td class="now"></td><td class="p"></td><td class="fin"></td>`;
            tr.addEventListener("click", () => selectRole(r.id));
            tb.appendChild(tr);
        }
        const hid = document.createElement("tr");
        hid.className = "sub";
        hid.innerHTML = `<td colspan="5"><div style="display:flex;justify-content:space-between"><b>隠し役</b><span id="hidden-text">―</span></div></td>`;
        tb.appendChild(hid);
        tb.addEventListener("click", (e) => {
            const b = e.target.closest("button.commit");
            if (b) {
                e.stopPropagation();
                commitRole(b.dataset.id);
            }
        }, true);
    }

    function condText(r) {
        return r.id === "goal" ? `お題：<b>${S.game.goal.face}の目をぴったり${S.game.goal.n}個</b>　${r.cond}` : r.cond;
    }

    function statusOf(id) {
        const g = S.game;
        if (g.scores[id]) return {cls: "done", text: "✔ 確定"};
        if (!g.hasRolled || S.phase === "rolling") return {cls: "no", text: "― 未投擲"};
        const ev = g.evaluate(id);
        if (ev.achieved) return {cls: "ok", text: "● 成立"};
        if (ev.base > 0) return {cls: "part", text: "△ 得点のみ"};
        const fc = S.fc[id];
        if ((g.throwsLeft > 0 || g.canUseToken) && fc && fc.p >= 0.1) return {cls: "can", text: "◐ 狙える"};
        if ((g.throwsLeft > 0 || g.canUseToken) && !fc) return {cls: "can", text: "◐ 計算中"};
        return {cls: "no", text: "○ 未成立"};
    }

    // ---- 画面更新 ----
    function refresh() {
        if (!S) return;
        const g = S.game;
        const decide = S.phase === "decide";
        const hints = P().hints === "on";
        // ヘッダー・HUD
        $("h-round").textContent = g.over ? "終了" : `${g.round}/${ROUNDS}`;
        $("s-round").textContent = String(Math.min(g.round, ROUNDS));
        $("s-roundmax").textContent = ` / ${ROUNDS}`;
        $("h-tokens").textContent = String(g.tokens);
        $("h-best").textContent = fmt(store.get().highScore);
        $("h-score").textContent = fmt(g.totalScore);
        $("sheet-total").textContent = fmt(g.totalScore);
        $("s-winddie").innerHTML = dieHTML(g.wind, true);
        const total = THROWS_PER_ROUND + g.extraThrows;
        $("s-pips").innerHTML = Array.from({length: total}, (_, i) => `<i class="${i < g.throwsLeft ? "on" : ""} ${i >= THROWS_PER_ROUND ? "extra" : ""}"></i>`).join("") + ` <b>残り${Math.max(0, g.throwsLeft)}</b>`;
        const cb = $("s-combo");
        cb.classList.toggle("hidden", g.streak < 2);
        cb.textContent = `🔥 ${g.streak}連続成立  次は+${Math.round(Math.min(COMBO_MAX, g.streak) * COMBO_STEP * 100)}%`;
        if (g.streak !== S.comboShown) {
            S.comboShown = g.streak;
            cb.classList.remove("bump");
            void cb.offsetWidth;
            cb.classList.add("bump");
        }
        $("rolling-tag").classList.toggle("hidden", S.phase !== "rolling");
        // 振るボタン
        const sh = $("shake");
        const can = canShake();
        sh.disabled = !can;
        sh.classList.toggle("ready", can && S.phase === "ready");
        sh.firstChild.textContent = S.phase === "rolling" ? "転がり中…" : !g.hasRolled ? "おぼんを振る！" : `振り直す！（${DICE - g.heldTotal}個）`;
        $("shake-sub").textContent = can ? "ドラッグで方向と強さ ／ Space" : "";
        let why = "";
        if (S.phase === "rolling") why = "サイコロが止まるまで待ってください（F で早送り）"; else if (S.phase === "banner") why = "得点を記入しました"; else if (!g.canThrow && g.hasRolled) why = g.canUseToken ? "このラウンドの投げは使い切りました。追い振り券で+1投できます" : "このラウンドの投げは使い切りました。役を記入してください";
        $("why").textContent = why;
        const tk = $("b-token");
        tk.disabled = !(decide && g.canUseToken);
        tk.title = g.tokens <= 0 ? "追い振り券がありません（高難度・特殊役の成立でもらえる）" : !g.canUseToken ? "3投を使い切った後に使えます" : "このラウンドで1回多く振れます";
        $("b-clear").disabled = !canEditHolds() || g.heldTotal === 0;
        // コーチ
        let coach = "";
        if (S.phase === "ready") coach = !g.hasRolled && g.round === 1 ? "おぼんを <span class='k'>ドラッグ</span> して振ろう！ ボタンや <span class='k'>Space</span> でもOK" : "新しいラウンド！ おぼんを振ろう"; else if (S.phase === "rolling") coach = "ガラガラガラ…"; else if (decide) {
            if (g.throwsLeft > 0) coach = S.aim ? `🎯 ${ROLES[S.aim].name}狙い：金色を残して振り直そう（残り${g.throwsLeft}投）` : `役を選んで「狙う」か、そのまま記入（残り${g.throwsLeft}投）`; else coach = g.canUseToken ? "投げ終了！ 役を記入するか、🎟追い振り券でもう1投" : "投げ終了！ 右の表で役を選んで記入しよう";
        }
        $("coach").innerHTML = coach;
        $("coach").classList.toggle("hidden", !coach);
        // 残すパネル
        const c = g.counts;
        const showC = g.hasRolled && S.phase !== "rolling";
        const edit = canEditHolds();
        for (const f of F) {
            $(`hn${f}`).textContent = showC ? String(c[f]) : "?";
            $(`hm${f}`).style.width = `${showC ? c[f] / 450 * 100 : 0}%`;
            $(`hh${f}`).style.width = `${showC ? g.hold[f] / 450 * 100 : 0}%`;
            $(`hk${f}`).textContent = String(g.hold[f]);
            const cell = $(`hc${f}`);
            cell.classList.toggle("held", g.hold[f] > 0);
            cell.classList.toggle("wind", f === g.wind);
            cell.querySelectorAll("button").forEach((b) => b.disabled = !edit);
            cell.querySelector(".toggle").textContent = g.hold[f] >= c[f] && c[f] > 0 ? "✓ 全部残す中" : "全部残す";
        }
        $("hold-sum").innerHTML = edit ? `残す <b>${g.heldTotal}</b>個 ／ 振り直し <b>${DICE - g.heldTotal}</b>個` : g.hasRolled ? "振り直しはできません" : "1投目はすべて振ります";
        // スコア表
        for (const r of ROLE_LIST) {
            const tr = $(`r-${r.id}`);
            const done = g.scores[r.id];
            tr.classList.toggle("done", !!done);
            tr.classList.toggle("sel", S.sel === r.id);
            tr.querySelector(".cond").innerHTML = r.upper ? `${r.id.slice(1)}の個数×${r.id.slice(1)}` : r.id === "goal" ? `お題 ${g.goal.face}の目 ぴったり${g.goal.n}個` : shortCond(r);
            const st = statusOf(r.id);
            tr.querySelector(".stc").innerHTML = `<span class="st ${st.cls}">${st.text}</span>`;
            const now = tr.querySelector(".now"), p = tr.querySelector(".p"), fin = tr.querySelector(".fin");
            if (done) {
                now.textContent = "";
                p.textContent = "";
                const m = [done.wind ? "風×1.5" : "", done.comboLevel ? `コンボ+${done.comboLevel * 10}%` : ""].filter(Boolean).join(" ");
                fin.innerHTML = `<span class="v">${fmt(done.points)}${m ? `<small>${m}</small>` : ""}</span>`;
            } else if (decide) {
                const ev = g.evaluate(r.id);
                now.innerHTML = `${fmt(ev.points)}${ev.wind ? '<span class="w">🎏追い風×1.5</span>' : ""}`;
                const fc = S.fc[r.id];
                p.innerHTML = hints && fc && g.throwsLeft > 0 ? `${Math.round(fc.p * 100)}%${S.rec === r.id ? '<span class="rec">★おすすめ</span>' : ""}` : hints && S.rec === r.id ? '<span class="rec">★おすすめ</span>' : "";
                fin.innerHTML = `<button class="commit ${ev.points === 0 ? "zero" : ""}" data-id="${r.id}" title="今の出目でこの役に記入">${ev.points === 0 ? "0点で記入" : "記入"}</button>`;
            } else {
                now.textContent = "";
                p.textContent = "";
                fin.textContent = "";
            }
        }
        const ut = g.upperSubtotal;
        $("upper-text").innerHTML = `${fmt(ut)} / ${fmt(UPPER_BONUS_AT)}　${g.upperBonus ? `<b style="color:var(--ok)">ボーナス +${fmt(UPPER_BONUS)} 獲得！</b>` : `達成で +${fmt(UPPER_BONUS)}`}`;
        $("upper-bar").style.width = `${Math.min(100, ut / UPPER_BONUS_AT * 100)}%`;
        $("hidden-text").textContent = g.hiddenFound.size ? `${[...g.hiddenFound].map((h) => HIDDEN_ROLES[h].name).join("・")}（+${fmt(g.hiddenPoints)}）` : "どこかに条件があります";
        renderDetail();
    }

    function shortCond(r) {
        return {
            chance: "全部の目の合計÷2",
            gather: "最多の目380個以上",
            factions: "上位2種が各340個以上",
            stairs: "個数が1→6で階段状",
            peace: "最多と最少の差10以内",
            extinct: "どれかの目が3個以下",
            ultimate: "同じ目540個以上"
        }[r.id] || "";
    }

    function renderDetail() {
        const box = $("detail");
        const g = S.game;
        const id = S.sel;
        if (!id || g.scores[id]) {
            const tips = !g.hasRolled ? "まずはおぼんを振りましょう。止まったら、右の表から狙う役を選びます。" : S.phase === "decide" ? `表の役をタップすると、条件・今の得点・狙い方が表示されます。${P().hints === "on" && S.rec ? `<br>今のおすすめ：<b>${ROLES[S.rec].name}</b>` : ""}` : "";
            box.innerHTML = `<div class="dh"><span class="dn">選択中の役</span></div><div class="empty">${tips || "―"}</div>`;
            return;
        }
        const r = ROLES[id];
        const c = g.counts;
        const decide = S.phase === "decide" && g.hasRolled;
        const ev = decide ? g.evaluate(id) : null;
        const pr = decide ? r.progress(c, g.ctx) : null;
        const st = statusOf(id);
        const fc = S.fc[id];
        const canAim = decide && (g.throwsLeft > 0 || g.canUseToken);
        const plan = canAim ? planFor(id) : null;
        box.innerHTML = `<div class="dh ${TIERS[r.tier].cls}"><span class="tierb">${TIERS[r.tier].mark} ${TIERS[r.tier].name}</span><span class="dn">${r.name}</span><span class="st ${st.cls}">${st.text}</span></div>
      <div class="cond">${condText(r)}</div>
      <div class="meta">判定対象：${r.target}${r.windable ? "　／　追い風の目なら×1.5" : ""}</div>
      ${pr ? `<div class="prog ${ev.achieved ? "full" : ""}"><i style="width:${Math.max(3, Math.min(100, pr.ratio * 100))}%"></i></div><div class="ptext">${pr.text}　→　今なら <b>${fmt(ev.points)}点</b>${ev.comboLevel ? `（コンボ+${ev.comboLevel * 10}%込み）` : ""}</div>` : ""}
      ${fc && g.throwsLeft > 0 ? `<div class="meta">この役を狙って振り切った場合：成立見込み <b>${Math.round(fc.p * 100)}%</b>・平均 <b>${fmt(fc.ev)}点</b>（コンボ除く）</div>` : ""}
      ${plan ? `<div class="plan">🎯 狙い方：${r.aim}<br>→ <b>${describeHold(plan, c)}</b></div>` : ""}
      <div class="btns"><button id="aim" class="${S.aim === id ? "on" : ""}" ${canAim ? "" : "disabled"} title="${canAim ? "残すサイコロを自動でセット（A）" : "振り直しが残っていないため狙えません"}">${S.aim === id ? "🎯 狙い中" : "🎯 この役を狙う"}</button>
      <button id="commitSel" ${decide ? "" : "disabled"} title="Enter">${decide ? `記入する（${fmt(ev.points)}点）` : "振ってから記入"}</button></div>`;
        $("aim").onclick = () => applyAim(id);
        $("commitSel").onclick = () => commitRole(id);
    }

    // ---- ステージの操作（ドラッグで振る／クリックで目を残す） ----
    var drag = null;
    var stage = $("stage");
    stage.addEventListener("pointerdown", (e) => {
        if (!S || e.button !== 0) return;
        audio.unlock();
        drag = {x: e.clientX, y: e.clientY, id: e.pointerId, moved: false};
        stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 10) drag.moved = true;
        if (canShake()) {
            phys.drag = [Math.max(-160, Math.min(160, dx)), Math.max(-160, Math.min(160, dy))];
            stage.classList.add("dragging");
        }
    });
    const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        const dist = Math.hypot(dx, dy);
        const moved = drag.moved;
        drag = null;
        phys.drag = [0, 0];
        stage.classList.remove("dragging");
        if (e.type === "pointercancel") return;
        if (moved && dist > 28) {
            if (canShake()) doThrow([dx / dist, dy / dist], Math.max(0.35, Math.min(1.3, dist / 230)));
            return;
        }
        if (S && S.banner) {
            closeBanner();
            return;
        }
        const r = stage.getBoundingClientRect();
        const local = view.screenToLocal(phys, e.clientX - r.left, e.clientY - r.top);
        if (!local) return;
        const i = phys.pickLocal(local[0], local[1]);
        if (i >= 0 && canEditHolds()) toggleFace(S.game.faces[i]); else if (i >= 0 && S.phase === "decide") toast(`${S.game.faces[i]}の目（今は振り直しできません）`);
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    $("shake").addEventListener("click", shakeButton);
    $("b-fast").addEventListener("click", () => phys.hurry());
    $("b-token").addEventListener("click", () => {
        if (!S || S.phase !== "decide" || !S.game.canUseToken) return;
        S.game.useToken();
        sound.ticket();
        toast("🎟 追い振り券を使いました：このラウンドあと1投！");
        if (S.aim) applyAim(S.aim, true);
        computeForecasts();
        refresh();
    });
    $("b-clear").addEventListener("click", () => {
        if (canEditHolds()) {
            S.game.clearHolds();
            S.aim = null;
            sound.hold(false);
            refresh();
        }
    });
    document.addEventListener("keydown", (e) => {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        if (e.key === "Escape") {
            ["help", "settings"].forEach((id) => $(id).classList.add("hidden"));
            return;
        }
        if (!S || !$("help").classList.contains("hidden") || !$("settings").classList.contains("hidden")) return;
        if (e.key === " " || e.code === "Space") {
            e.preventDefault();
            if (S.banner) closeBanner(); else if (canShake()) shakeButton();
            return;
        }
        if (e.key === "f" || e.key === "F") {
            phys.hurry();
            return;
        }
        if (e.key === "t" || e.key === "T") {
            $("b-token").click();
            return;
        }
        if (e.key === "h" || e.key === "H") {
            openHelp();
            return;
        }
        if (e.key >= "1" && e.key <= "6") {
            toggleFace(Number(e.key));
            return;
        }
        if (e.key === "0") {
            $("b-clear").click();
            return;
        }
        if ((e.key === "a" || e.key === "A") && S.sel) {
            applyAim(S.sel);
            return;
        }
        if (e.key === "Enter") {
            if (S.banner) closeBanner(); else if (S.sel) commitRole(S.sel);
        }
    });

    // ---- 終局・記録 ----
    function rankOf(score) {
        if (score >= 110000) return "超究極ヨット王";
        if (score >= 95000) return "おぼんの達人";
        if (score >= 80000) return "千個使い";
        if (score >= 60000) return "一人前の振り手";
        if (score >= 40000) return "見習い振り手";
        return "おぼん初心者";
    }

    function finish() {
        const g = S.game;
        const before = store.get();
        const isBest = g.totalScore > before.highScore;
        store.update((d) => {
            d.games += 1;
            d.highScore = Math.max(d.highScore, g.totalScore);
            d.bestCombo = Math.max(d.bestCombo || 0, g.bestStreak);
            d.history = [{score: g.totalScore, at: Date.now()}, ...(d.history || [])].slice(0, 10);
        });
        if (!store.lastWriteOk) toast("記録を保存できませんでした（ブラウザの保存領域）");
        sound.fanfare(isBest ? 3 : 2);
        const rows = ROLE_LIST.map((r) => {
            const v = g.scores[r.id];
            return `<tr><td><span class="tierb ${TIERS[r.tier].cls}">${TIERS[r.tier].mark}</span>${r.name}</td><td style="text-align:right">${v ? fmt(v.points) : "-"}</td><td>${v && v.achieved ? "● 成立" : "○"}${v && v.wind ? " 🎏" : ""}${v && v.comboLevel ? ` 🔥+${v.comboLevel * 10}%` : ""}</td></tr>`;
        }).join("");
        const hist = store.get().history.map((h) => fmt(h.score)).join(" / ");
        $("result-body").innerHTML = `<h2 style="text-align:center;margin:0">対局結果</h2>
      <div class="cert-score">${fmt(g.totalScore)}<small>点</small></div>
      <div class="rank">称号：${rankOf(g.totalScore)}</div>
      ${isBest ? '<div class="newrec">自己ベスト更新！</div>' : `<div class="stats">最高記録 ${fmt(store.get().highScore)}点</div>`}
      <table class="rtable" style="margin-top:10px">${rows}
        <tr><td>上段ボーナス</td><td style="text-align:right">${fmt(g.upperBonus)}</td><td>${fmt(g.upperSubtotal)} / ${fmt(UPPER_BONUS_AT)}</td></tr>
        <tr><td>隠し役</td><td style="text-align:right">${fmt(g.hiddenPoints)}</td><td>${[...g.hiddenFound].map((h) => HIDDEN_ROLES[h].name).join("・")}</td></tr></table>
      <p class="stats">成立 ${g.achievedCount}/${ROUNDS} ／ 最大コンボ ${g.bestStreak}連 ／ 総投擲 ${g.totalThrows}回 ／ 追い振り券 ${g.tokensUsed}枚使用 ／ 最大同一出目 ${g.maxSame}個</p>
      <p class="stats" style="font-size:12px">最近の得点：${hist}</p>
      <div class="btnrow"><button class="bigbtn" id="b-again">もう一局</button><button class="ghost" id="b-totitle">タイトルへ</button></div>`;
        $("b-again").onclick = () => startGame();
        $("b-totitle").onclick = toTitle;
        setTimeout(() => $("result").classList.remove("hidden"), 500);
    }

    function toTitle() {
        S = null;
        ["result", "play"].forEach((id) => $(id).classList.add("hidden"));
        renderTitle();
        $("title").classList.remove("hidden");
    }

    function unlockedSkins(s) {
        const out = ["classic"];
        if (s.games >= 3) out.push("wood");
        if (s.highScore >= 9e4) out.push("gold");
        if ((s.jackpots || []).includes("extinct0")) out.push("tofu");
        if (s.hiddenFound.length >= 3) out.push("pixel");
        return out;
    }

    function renderTitle() {
        const s = store.get();
        $("t-stats").innerHTML = `最高得点 <b>${fmt(s.highScore)}</b> ／ 対局 <b>${s.games}</b>回 ／ 最大コンボ <b>${s.bestCombo || 0}</b>連` + (persistent ? "<br><small>記録はこのブラウザに保存されます</small>" : '<br><small style="color:var(--red)">この環境では記録を保存できません（閉じると消えます）</small>');
        $("t-roles").innerHTML = ROLE_LIST.map((r) => `<span class="${s.roleCounts[r.id] ? "got" : ""}">${r.name}${s.roleCounts[r.id] ? `×${s.roleCounts[r.id]}` : ""}${s.roleBest[r.id] ? ` 最高${fmt(s.roleBest[r.id])}` : ""}</span>`).join("");
        $("t-hidden").innerHTML = Object.keys(HIDDEN_ROLES).map((h) => `<span class="${s.hiddenFound.includes(h) ? "got" : ""}">${s.hiddenFound.includes(h) ? HIDDEN_ROLES[h].name : "？？？"}</span>`).join("");
        const box = $("t-skins");
        box.innerHTML = "";
        const ok = unlockedSkins(s);
        Object.keys(SKINS).forEach((k) => {
            const b = document.createElement("button");
            const has = ok.includes(k);
            b.textContent = has ? SKINS[k].name : `🔒 ${SKINS[k].unlock}`;
            b.disabled = !has;
            b.className = s.skin === k ? "sel" : "";
            b.onclick = () => {
                store.update((d) => {
                    d.skin = k;
                });
                renderTitle();
            };
            box.appendChild(b);
        });
        const art = $("title-dice");
        if (!art.childNodes.length) {
            let svg = "";
            for (let i = 0; i < 70; i++) {
                const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
                const x = 110 + Math.cos(a) * rr * 82, y = 66 + Math.sin(a) * rr * 27;
                svg += `<rect x="${x - 3.5}" y="${y - 3}" width="7" height="6" rx="1.5" fill="#fbfaf5" stroke="#bbb" stroke-width=".5" transform="rotate(${Math.random() * 40 - 20} ${x} ${y})"/>`;
            }
            art.innerHTML = svg;
        }
    }

    function openHelp() {
        const rows = ROLE_LIST.map((r) => `<tr class="${TIERS[r.tier].cls}"><td><span class="tierb">${TIERS[r.tier].mark} ${TIERS[r.tier].name}</span><br>${r.name}</td><td>${r.id === "goal" ? r.cond + "（お題の目と個数は対局ごとに変わる）" : r.cond}<br><small style="color:var(--muted)">判定対象：${r.target}／狙い方：${r.aim}</small></td></tr>`).join("");
        $("help-body").innerHTML = `<h2 style="margin-top:0">遊び方</h2>
      <ul style="font-size:14px;line-height:1.75;padding-left:20px">
        <li>全${ROUNDS}ラウンド。1ラウンドに<b>最大${THROWS_PER_ROUND}投</b>。2投目からは<b>金色に光る「残す」サイコロ</b>以外を振り直します。</li>
        <li>振り方：「おぼんを振る」ボタン／Space／<b>おぼんをドラッグして離す</b>（向きと長さで振る方向・強さが変わる）。出目は公平な乱数で決まり、振り方で有利不利はありません。</li>
        <li>残す：サイコロをクリックすると、その目を全部「残す」に切り替え。下のパネルで個数を細かく調整できます（キー 1〜6）。</li>
        <li>役を選ぶ：表の行をタップ → 「🎯この役を狙う」で、その役に最適な残し方を自動セット。以後の投げでも自動で更新します。</li>
        <li>記入：毎ラウンド1つの役に記入（0点でも可）。14ラウンドで全部埋まると終局。</li>
        <li><b>🎏 追い風</b>：ラウンドごとに1つの目が「追い風」。その目が判定対象になる役は得点×${WIND_MULT}。</li>
        <li><b>🔥 コンボ</b>：役を「成立（達成）」させて記入し続けると、次の成立に +${COMBO_STEP * 100}%ずつ（最大+${COMBO_MAX * COMBO_STEP * 100}%）。上段は${UPPER_QUOTA}個以上で達成。成立しない記入でリセット。</li>
        <li><b>🎟 追い振り券</b>：最初に${START_TOKENS}枚。高難度・特殊役を成立させるか隠し役で+1（最大${MAX_TOKENS}枚）。3投を使い切った後に使うと、もう1投できます。</li>
        <li>上段（1〜6の目）の小計が${fmt(UPPER_BONUS_AT)}点以上で <b>+${fmt(UPPER_BONUS)}点</b>。</li>
      </ul>
      <h3>役の一覧</h3><table class="rtable">${rows}</table>
      <p style="font-size:12px;color:var(--muted)">「見込み」は、その役を狙って最後まで振った場合の成立確率をその場でシミュレーションした目安です。<br>操作キー：Space 振る ／ F 早送り ／ 1〜6 残す切替 ／ 0 全解除 ／ A 狙う ／ Enter 記入 ／ T 追い振り券 ／ H 遊び方</p>`;
        $("help").classList.remove("hidden");
    }

    $("b-help").onclick = openHelp;
    $("b-help2").onclick = openHelp;
    $("b-settings").onclick = () => {
        syncSettings();
        $("settings").classList.remove("hidden");
    };
    document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $(b.dataset.close).classList.add("hidden")));
    ["help", "settings"].forEach((id) => $(id).addEventListener("click", (e) => {
        if (e.target.id === id) $(id).classList.add("hidden");
    }));

    function syncSettings() {
        document.querySelectorAll(".seg[data-pref]").forEach((seg) => {
            const k = seg.dataset.pref;
            seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", P()[k] === b.dataset.v));
        });
    }

    document.querySelectorAll(".seg[data-pref]").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        prefs.update((d) => {
            d[seg.dataset.pref] = b.dataset.v;
        });
        syncSettings();
        refresh();
    })));
    $("b-mute").textContent = audio.muted ? "🔇" : "🔊";
    $("b-mute").onclick = () => {
        audio.unlock();
        audio.muted = !audio.muted;
        audio.apply();
        prefs.update((d) => {
            d.muted = audio.muted;
        });
        $("b-mute").textContent = audio.muted ? "🔇" : "🔊";
    };
    $("b-quit").onclick = () => {
        if (S && confirm("対局を中断してタイトルに戻りますか？（この対局の得点は記録されません）")) toTitle();
    };
    $("b-start").onclick = () => {
        audio.unlock();
        startGame();
    };

    // ---- メインループ ----
    var last = performance.now();
    var hl = new Uint8Array(DICE);
    var perf = {frames: 0, acc: 0, fps: 60};

    function frame(nowMs) {
        requestAnimationFrame(frame);
        const dt = Math.min(0.05, (nowMs - last) / 1e3);
        last = nowMs;
        perf.frames++;
        perf.acc += dt;
        if (perf.acc >= 1) {
            perf.fps = perf.frames / perf.acc;
            perf.frames = 0;
            perf.acc = 0;
        }
        if (!S || document.hidden) return;
        phys.update(Math.min(0.1, (nowMs - (frame.prev || nowMs)) / 1e3) || dt);
        frame.prev = nowMs;
        const ev = phys.events;
        const fx = P().effects;
        if (S.phase === "rolling") {
            sound.physics(ev, nowMs);
            if (fx !== "off" && ev.rim.length) view.spawnSparks(ev.rim, fx === "lite" ? 0.3 : 1);
            if (P().shake === "on" && ev.rim.length > 3) view.kick(Math.min(0.25, ev.rim.length * 0.015));
            if (!phys.rolling) onSettled();
        }
        if (S.banner && nowMs > S.banner.until) closeBanner();
        // 強調表示：バナー中は役に使ったサイコロ、選択中は判定対象
        let highlight = null;
        const g = S.game;
        if (S.banner) highlight = S.banner.usedMask; else if (S.sel && S.phase === "decide" && !g.scores[S.sel]) {
            const used = ROLES[S.sel].used(g.counts, g.ctx);
            const left = [...used];
            for (let i = 0; i < DICE; i++) {
                const f = g.faces[i];
                if (left[f] > 0) {
                    hl[i] = 1;
                    left[f]--;
                } else hl[i] = 0;
            }
            highlight = hl;
        }
        view.setSkin(store.get().skin);
        view.draw(phys, {
            heldMask: g.heldMask, highlight, colorFaces: P().colorFaces === "on"
        }, dt, {shake: P().shake === "on"});
    }

    if (debugEnabled()) Object.assign(window, {__perf: perf, __phys: phys, __startGame: startGame});
    renderTitle();
    requestAnimationFrame(frame);
})();
