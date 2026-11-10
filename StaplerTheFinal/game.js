import * as THREE from 'three';

/* =====================================================================
調整用パラメータ（ここをいじって難易度調整）
===================================================================== */
const CONFIG = {
    STAPLER_SPEED: 7.2,        // 位置決め：ホッチキスの左右移動速度（単位/秒）
    STAPLER_RANGE: 5.4,        // 左右移動の振れ幅（中心からの距離）
    STAPLER_Z_WOBBLE: 0.35,    // 前後方向のゆらぎ幅（0で完全に一直線）
    STAPLER_HOVER_Y: 2.8,      // ホッチキスの浮いている高さ
    GAUGE_SPEED: 1.25,         // パワーゲージ速度（1.0 = 1秒で下→上）
    ZONE_WEAK: 0.45,           // 弱すぎゾーンの幅（0〜1、下から）
    ZONE_JUST: 0.14,           // ちょうどいいゾーンの幅（強すぎゾーンは残り全部）
    TARGET_RADIUS: 0.6,        // 正解エリアの半径
    FAIL_SCORE: 50,            // これ未満の点数は「場所が違う」で失敗
    SPEEDUP_PER_PLAY: 0.05,    // プレイ1回ごとの速度上昇率
    SPEEDUP_MAX: 1.8,          // 速度倍率の上限
    STAPLER_SPEEDUP_RATIO: 0.5,// ゲージの速度上昇のうちホッチキス移動にも適用する割合
    EXACT_EPS: 0.015,          // ゲージ最大/最小「ピッタリ」判定の許容幅
    INPUT_GUARD: 0.25,         // 各フェーズ開始直後に入力を無視する秒数
};

/* =====================================================================
セリフ集・称号リスト
===================================================================== */
const LINES = {
    catch: ['綴じろ、運命を。', '芯は1本、地球も1個。', '全米が綴じた。', 'このホッチキスに、人類の未来がかかっている（かかってない）', 'レポート提出締切まで あと3秒', 'ガシャコンの向こう側へ', '単位、ほしいか？'],
    aim: ['どこに止める？　どこに止める？', '左上だよ……左上だよ……', 'ウィーン（移動音を口で言っている）', '早く決めて、腕がつらい', 'おれ、本当はパンチになりたかった'],
    power: {
        weak: ['ふにゃ', 'そよ風', '赤ちゃんの握力', 'やる気ゼロ'],
        just: ['ジャスト', 'プロの技', '職人', 'これだ'],
        strong: ['破壊', 'ゴリラ', '国家予算級', 'ビッグバン'],
    },
    hit: {
        weak: ['カスッ……', '芯、迷子', '芯が帰宅しました', 'ホッチキスの心が折れた', '針、遠慮する'],
        just: ['ガシャコン！！', '完璧な綴じ', '美しい……', '紙と芯が結ばれた', '綴じ、極まれり'],
        strong: ['ビリビリビリィ！！', '紙が細胞レベルに', 'レポートが紙吹雪になった', '机も泣いている', 'やりすぎ選手権優勝'],
        place: ['そこは綴じる所じゃない', '真ん中に打つ人いる？', '机に芯が刺さった', '床にも刺さった'],
    },
    judging: ['…………', 'ふむ……', 'ほほう……', 'メガネを拭かせてくれ', '（ペラ……ペラ……）', 'これは……'],
    success: ['素晴らしいホッチキスだ', '君、ホッチキス学部に来ないか', '受理！！！！！', '先生、泣いてもいいかな', 'この綴じ方、教科書に載せよう', '内容は読んでないけど満点', 'ホッチキスの声が聞こえる……'],
    fail: {
        weak: ['綴じてないなら、それはただの紙の束だ！！', '芯がどこにも見当たらんぞォォ！！', 'バラバラになったら誰が拾うと思っとるんだ！！', 'ホッチキスをなめるなァ！！'],
        strong: ['これはレポートじゃない、紙吹雪だ！！', '何をどうしたらこうなるんだァァ！！', '先生の30年の教師人生でも初めてだ！！', 'これを読めというのかァ！！パズルか！！'],
        place: ['なぜ真ん中を綴じた！！', '左上だろうが！！常識だろうが！！', '机を綴じてどうする！！', '表紙の顔に芯を打つなァ！！'],
        common: ['なんじゃこりゃああああ！！！', '単位は……ない！！地球も……ない！！', 'もう全部終わりだァァァ！！'],
    },
    earth: ['〜地球は滅亡しました〜', '原因：ホッチキス', '人類最後の記録：レポート（未受理）', '宇宙歴0年、先生だけが残った', 'この星はホッチキスによって終わった', 'なお、レポートの内容は誰も読んでいない'],
};

const TITLES = {
    success: {
        s100: ['綴じの神', 'ホッチキス界の宇宙飛行士', '人間国宝（綴じ部門）'],
        s90: ['ガシャコン名人', '伝説の綴じ師', '芯に愛された者'],
        s70: ['ホッチキス有段者', 'そこそこ綴じる人', '普通にえらい'],
        s50: ['ギリギリ受理', '先生のお情け', '綴じたことは綴じた'],
    }, fail: {
        weak: ['握力の無い者', 'そよ風の綴じ手', 'ホッチキス恐怖症', '芯の保護者'],
        strong: ['紙の破壊神', 'ゴリラ代表', 'シュレッダーの化身', '力こそパワー'],
        place: ['方向音痴', '机を綴じた男', '左上を知らない者', '芯の迷い人'],
    }, // 特殊称号（配列の順番＝優先度）
    special: [{id: 'galaxy', name: '銀河指名手配犯', cond: '累計100個爆破'}, {
        id: 'planet', name: '惑星クラッシャー', cond: '累計10個爆破'
    }, {id: 'enemy', name: '地球の敵', cond: '3回連続で地球を爆破'}, {
        id: 'soulmate', name: 'ホッチキスと心が通じた者', cond: '3回連続成功'
    }, {id: 'genius', name: '天才綴じ少年', cond: '最初のプレイで成功'}, {
        id: 'limit', name: '限界突破バカ', cond: 'パワーゲージの最大値ピッタリ'
    }, {id: 'mu', name: '無', cond: 'パワーゲージの最小値ピッタリ'},],
};

const REPORT_TOPICS = ['ホッチキスの歴史について', '左上とは何かについて', 'カレーの辛さと人生について', 'なぜ地球は丸いのかについて', '宇宙と私について', '先生の髪の行方について', '〇〇について'];
const REASON_LABEL = {weak: '芯が刺さってない', strong: '破れてる', place: '場所が違う'};

/* =====================================================================
ユーティリティ
===================================================================== */
const $ = s => document.querySelector(s);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const Ease = {
    inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t,
    back: t => {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
};
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const deco = (text, cls = '') => `<span class="deco ${cls}" data-t="${esc(text)}"><span class="fg">${esc(text)}</span></span>`;

// 同じセリフが2回連続で出ないランダム選択（キーごとに直前の値を覚える）
const lastPicked = {};

function pick(key, arr) {
    if (!arr || !arr.length) return '';
    if (arr.length === 1) return (lastPicked[key] = arr[0]);
    let v;
    do {
        v = arr[Math.floor(Math.random() * arr.length)];
    } while (v === lastPicked[key]);
    return (lastPicked[key] = v);
}

/* ---------- セーブデータ（localStorage） ---------- */
const SAVE_KEY = 'hotchkiss_the_final_v1';
const save = Object.assign({
    best: 0, earths: 0, plays: 0, titles: [], failStreak: 0, successStreak: 0, light: false, mute: false
}, (() => {
    try {
        return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    } catch (e) {
        return {};
    }
})());

function writeSave() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
    }
}

const speedMult = () => Math.min(CONFIG.SPEEDUP_MAX, 1 + save.plays * CONFIG.SPEEDUP_PER_PLAY);

/* =====================================================================
効果音（Web Audio API で全部合成）
===================================================================== */
const SFX = {
    ctx: null, out: null, nb: null, hum: null, init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            this.ctx = new AC();
        } catch (e) {
            return;
        }
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 5;
        this.out = this.ctx.createGain();
        this.out.gain.value = save.mute ? 0 : 0.55;
        this.out.connect(comp);
        comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2;
        this.nb = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.nb.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }, setMute(m) {
        if (this.out) this.out.gain.value = m ? 0 : 0.55;
    }, tone(type, f0, f1, dur, vol = 0.3, delay = 0, attack = 0.004) {
        const c = this.ctx;
        if (!c) return;
        const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + Math.min(attack, dur * 0.9));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(this.out);
        o.start(t);
        o.stop(t + dur + 0.05);
    }, noise(dur, vol = 0.3, delay = 0, ftype = 'bandpass', f0 = 1000, f1 = f0, q = 1, attack = 0.003) {
        const c = this.ctx;
        if (!c) return;
        const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = this.nb;
        s.loop = true;
        f.type = ftype;
        f.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
        f.Q.value = q;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + Math.min(attack, dur * 0.9));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f);
        f.connect(g);
        g.connect(this.out);
        s.start(t, Math.random() * 1.5);
        s.stop(t + dur + 0.05);
    }, click() {
        this.tone('square', 880, 660, 0.06, 0.15);
    }, start() {
        this.tone('square', 523, 523, 0.08, 0.2);
        this.tone('square', 784, 784, 0.1, 0.2, 0.08);
        this.tone('square', 1047, 1047, 0.25, 0.2, 0.16);
    }, boing() {
        this.tone('sine', 200, 520, 0.16, 0.12);
    }, mumble() {
        for (let i = 0; i < 3; i++) this.tone('square', rand(420, 700), rand(350, 500), 0.07, 0.05, i * 0.09);
    }, stop() {
        this.tone('triangle', 1500, 900, 0.05, 0.3);
        this.tone('sine', 400, 900, 0.12, 0.25, 0.03);
    }, humStart() {
        const c = this.ctx;
        if (!c) return;
        this.humStop();
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = 180;
        g.gain.value = 0.0001;
        g.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 0.1);
        o.connect(g);
        g.connect(this.out);
        o.start();
        this.hum = {o, g};
    }, humSet(f) {
        if (this.hum) this.hum.o.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.02);
    }, humStop() {
        if (!this.hum) return;
        const {o, g} = this.hum, t = this.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.stop(t + 0.1);
        this.hum = null;
    }, whoosh(big = false) {
        this.noise(big ? 1.6 : 0.9, big ? 0.7 : 0.45, 0, 'bandpass', 250, 2600, 1.1, big ? 0.8 : 0.4);
    }, gashan() { // ガシャ…コン！
        this.noise(0.09, 0.9, 0, 'highpass', 2500, 2500, 0.7);
        this.tone('square', 1800, 1400, 0.16, 0.18);
        this.tone('square', 2650, 2400, 0.12, 0.12);
        this.tone('sine', 140, 45, 0.22, 0.9);
        this.noise(0.25, 0.4, 0, 'bandpass', 900, 600, 2);
        this.tone('triangle', 700, 320, 0.12, 0.45, 0.08);
        this.noise(0.05, 0.5, 0.08, 'highpass', 3000);
    }, thud() {
        this.tone('sine', 90, 40, 0.25, 0.8, 0.02);
        this.noise(0.15, 0.5, 0.02, 'lowpass', 500, 200);
    }, kasu() {
        this.noise(0.07, 0.22, 0, 'highpass', 3500);
        this.tone('sine', 760, 180, 0.7, 0.2, 0.18);
        this.tone('sine', 380, 90, 0.7, 0.08, 0.2);
    }, biri() {
        for (let i = 0; i < 16; i++) this.noise(rand(0.04, 0.09), rand(0.5, 0.95), i * 0.045, 'bandpass', rand(1400, 4200), rand(1000, 3000), 1.4);
        this.noise(0.8, 0.3, 0, 'highpass', 1800, 4000, 0.7);
        this.tone('sine', 110, 40, 0.4, 0.8);
    }, crack() {
        this.noise(0.14, 1.0, 0, 'highpass', 1500);
        this.tone('square', 220, 55, 0.22, 0.3);
        for (let i = 0; i < 6; i++) this.noise(0.03, 0.5, 0.05 + i * 0.04, 'bandpass', rand(800, 2500), rand(800, 2500), 3);
    }, dokan(huge = false) {
        const d = huge ? 3.8 : 2.0;
        this.noise(d, 1.3, 0, 'lowpass', huge ? 1600 : 1200, 60, 0.8, 0.01);
        this.tone('sine', huge ? 80 : 70, 22, d * 0.9, 1.1);
        this.tone('sawtooth', 55, 20, d * 0.6, 0.35);
        this.noise(0.4, 0.8, 0, 'highpass', 2000, 600, 0.7);
    }, don() {
        this.tone('sine', 95, 34, 0.7, 1.3);
        this.noise(0.35, 1.0, 0, 'lowpass', 700, 120, 0.8);
        this.tone('square', 170, 70, 0.12, 0.25);
    }, pon() {
        this.tone('sine', 420, 980, 0.13, 0.4);
    }, buzzer(delay = 0) {
        this.tone('square', 160, 150, 0.22, 0.2, delay);
        this.tone('square', 160, 150, 0.35, 0.2, delay + 0.26);
    }, kirin() {
        this.tone('sine', 2400, 3300, 0.3, 0.12);
        this.tone('sine', 3600, 4200, 0.25, 0.08, 0.06);
    }, drumroll(dur) {
        for (let t = 0; t < dur; t += 0.042) {
            const k = t / dur;
            this.noise(0.05, 0.1 + 0.55 * k * k, t, 'bandpass', 2000, 2000, 0.8);
            this.tone('sine', 110, 80, 0.05, 0.06 + 0.2 * k, t);
        }
    }, crash() {
        this.noise(1.4, 0.55, 0, 'highpass', 4500, 3000, 0.6);
    }, fanfare() {
        const n = [523, 659, 784, 1047], d = [0, .12, .24, .36];
        n.forEach((f, i) => {
            this.tone('square', f, f, i === 3 ? 0.9 : 0.11, 0.16, d[i]);
            this.tone('triangle', f / 2, f / 2, i === 3 ? 0.9 : 0.11, 0.18, d[i]);
        });
        [1047, 1319, 1568].forEach(f => this.tone('sawtooth', f, f, 0.9, 0.05, 0.36));
        this.crash();
    }, rumble(dur) {
        this.noise(dur, 0.9, 0, 'lowpass', 110, 220, 1, dur * 0.85);
        this.tone('sawtooth', 48, 60, dur, 0.18, 0, dur * 0.8);
    }, angry() {
        for (let i = 0; i < 10; i++) this.tone('square', rand(80, 130), rand(60, 90), 0.12, 0.06, i * 0.22);
    }, scream(dur = 1.6) {
        const c = this.ctx;
        if (!c) return;
        const t = c.currentTime;
        [[1, 1100], [1.5, 2400]].forEach(([mul, ff], i) => {
            const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter(),
                g = c.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(250 * mul, t);
            o.frequency.linearRampToValueAtTime(540 * mul, t + dur * 0.6);
            o.frequency.linearRampToValueAtTime(420 * mul, t + dur);
            l.frequency.value = 9;
            lg.gain.value = 26 * mul;
            l.connect(lg);
            lg.connect(o.frequency);
            f.type = 'bandpass';
            f.frequency.value = ff;
            f.Q.value = 2.5;
            const v = i === 0 ? 0.55 : 0.25;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.08);
            g.gain.setValueAtTime(v, t + dur * 0.8);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(f);
            f.connect(g);
            g.connect(this.out);
            o.start(t);
            l.start(t);
            o.stop(t + dur + 0.05);
            l.stop(t + dur + 0.05);
        });
    }, gameover() {
        [392, 370, 349, 330].forEach((f, i) => this.tone('square', f, f * 0.98, i === 3 ? 1.2 : 0.3, 0.15, i * 0.32));
    },
};

/* =====================================================================
レンダラー・共通素材
===================================================================== */
const canvasEl = $('#c');
let renderer;
try {
    renderer = new THREE.WebGLRenderer({canvas: canvasEl, antialias: true, powerPreference: 'high-performance'});
} catch (e) {
    $('#err').style.display = 'flex';
    throw e;
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);

const POP = '"Mochiy Pop One","Hiragino Maru Gothic ProN","Meiryo",sans-serif';
const HAND = '"Yusei Magic","Hiragino Maru Gothic ProN","Meiryo",sans-serif';

// トゥーン用の3段階グラデーション
const gradTex = new THREE.DataTexture(new Uint8Array([95, 95, 95, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
gradTex.needsUpdate = true;
const toon = (color, extra = {}) => new THREE.MeshToonMaterial(Object.assign({color, gradientMap: gradTex}, extra));
const flatGeo = g => {
    const n = g.index ? g.toNonIndexed() : g;
    n.computeVertexNormals();
    return n;
};

// 太い輪郭線（背面拡大法）：ジオメトリのバウンディングボックスから絶対厚みで拡大
const outlineMat = new THREE.MeshBasicMaterial({color: 0x1b0f2a, side: THREE.BackSide});
let outlines = [];

function outline(mesh, t = 0.05) {
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const s = new THREE.Vector3();
    g.boundingBox.getSize(s);
    const o = new THREE.Mesh(g, outlineMat);
    o.scale.set((s.x + 2 * t) / Math.max(s.x, 1e-4), (s.y + 2 * t) / Math.max(s.y, 1e-4), (s.z + 2 * t) / Math.max(s.z, 1e-4));
    o.raycast = () => {
    };
    o.visible = !save.light;
    o.userData.isOutline = true;
    mesh.add(o);
    outlines.push(o);
    return mesh;
}

function box(w, h, d, color, {outlineT = 0.05, mat = null, cast = true, receive = false} = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || toon(color));
    m.castShadow = cast;
    m.receiveShadow = receive;
    if (outlineT) outline(m, outlineT);
    return m;
}

function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.userData.canvas = c;
    t.userData.ctx = g;
    return t;
}

function addLights(scene, shadow = false) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a5a8a, 1.5));
    const d = new THREE.DirectionalLight(0xffffff, 2.3);
    d.position.set(7, 18, 6);
    d.target.position.set(0, 0, -6);
    scene.add(d);
    scene.add(d.target);
    if (shadow) {
        d.castShadow = !save.light;
        d.shadow.mapSize.set(1024, 1024);
        const c = d.shadow.camera;
        c.left = -18;
        c.right = 18;
        c.top = 18;
        c.bottom = -18;
        c.near = 1;
        c.far = 60;
        d.shadow.bias = -0.0008;
    }
    return d;
}

function disposeDeep(o) {
    o.traverse(c => {
        if (c.geometry && !c.userData.isOutline) c.geometry.dispose();
    });
}

/* =====================================================================
テクスチャ（Canvas 2D で動的生成）
※ キャンバスに描く前に Webフォント の読み込みを待つ（最大2.5秒）
===================================================================== */
{
    const sample = 'レポート出席番号42山田について提出日締切当日ギリがんばった本日の課題ホッチキス左上を綴じることテストに出る地球の存亡に関わる月日直教卓先生受理私立学園日本ココ教室' + REPORT_TOPICS.join('');
    try {
        await Promise.race([Promise.all([document.fonts.load(`40px "Yusei Magic"`, sample), document.fonts.load(`40px "Mochiy Pop One"`, sample)]), new Promise(r => setTimeout(r, 2500)),]);
    } catch (e) {
    }
}

function drawPaperBase(g, w, h) {
    g.fillStyle = '#fffdf3';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9d4f0';
    g.lineWidth = 2;
    for (let y = 130; y < h - 20; y += 34) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
    }
    g.strokeStyle = '#f3a0a0';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(62, 0);
    g.lineTo(62, h);
    g.stroke();
}

const plainPaperTex = canvasTex(256, 362, (g, w, h) => {
    g.fillStyle = '#fffdf3';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c4dbf2';
    g.lineWidth = 1.5;
    for (let y = 60; y < h; y += 17) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
    }
    g.strokeStyle = '#777';
    g.lineWidth = 1.4;
    for (let y = 77; y < h - 20; y += 17) {
        g.beginPath();
        g.moveTo(36, y - 4);
        for (let x = 36; x < w - 20; x += 6) g.lineTo(x, y - 4 + Math.sin(x * 0.7 + y) * 2);
        g.stroke();
    }
});

function fitFont(g, text, maxW, size, family, weight = '') {
    let s = size;
    do {
        g.font = `${weight} ${s}px ${family}`;
        s -= 2;
    } while (g.measureText(text).width > maxW && s > 10);
}

function makeCoverTex(topic) {
    return canvasTex(512, 724, (g, w, h) => {
        drawPaperBase(g, w, h);
        g.fillStyle = '#1d1d2a';
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic';
        g.save();
        g.translate(w / 2 + 10, 100);
        g.rotate(-0.04);
        g.font = `86px ${HAND}`;
        g.fillText('レポート', 0, 0);
        g.restore();
        g.strokeStyle = '#e0303a';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(130, 120);
        for (let x = 130; x < 400; x += 10) g.lineTo(x, 120 + Math.sin(x * 0.15) * 5);
        g.stroke();
        g.save();
        g.translate(w / 2 + 18, 200);
        g.rotate(0.02);
        fitFont(g, topic, 400, 42, HAND);
        g.fillText(topic, 0, 0);
        g.restore();
        // 本文っぽい何か
        g.strokeStyle = '#555';
        g.lineWidth = 2.2;
        for (let i = 0; i < 4; i++) {
            const y = 266 + i * 34;
            g.beginPath();
            g.moveTo(84, y);
            for (let x = 84; x < 430 - i * 40; x += 7) g.lineTo(x, y + Math.sin(x * 0.6 + i * 3) * 3);
            g.stroke();
        }
        // 落書き（棒人間とハート）
        g.strokeStyle = '#333';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(150, 470, 26, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(150, 496);
        g.lineTo(150, 560);
        g.moveTo(150, 515);
        g.lineTo(112, 540);
        g.moveTo(150, 515);
        g.lineTo(196, 492);
        g.moveTo(150, 560);
        g.lineTo(122, 606);
        g.moveTo(150, 560);
        g.lineTo(178, 606);
        g.stroke();
        g.fillStyle = '#333';
        g.beginPath();
        g.arc(141, 466, 3.5, 0, 7);
        g.arc(159, 466, 3.5, 0, 7);
        g.fill();
        g.beginPath();
        g.arc(150, 478, 9, 0.2, Math.PI - 0.2);
        g.stroke();
        g.font = `26px ${HAND}`;
        g.textAlign = 'left';
        g.fillText('がんばった！', 200, 470);
        g.fillStyle = '#ff4f8a';
        g.beginPath();
        g.moveTo(330, 520);
        g.bezierCurveTo(300, 490, 270, 530, 330, 570);
        g.bezierCurveTo(390, 530, 360, 490, 330, 520);
        g.fill();
        // コーヒーのシミ
        g.strokeStyle = 'rgba(140,90,40,.32)';
        g.lineWidth = 12;
        g.beginPath();
        g.arc(400, 420, 46, 0.3, Math.PI * 1.9);
        g.stroke();
        // 名前
        g.fillStyle = '#1d1d2a';
        g.textAlign = 'right';
        g.font = `34px ${HAND}`;
        g.fillText('出席番号42　山田', 478, 668);
        g.font = `20px ${HAND}`;
        g.fillText('提出日：締切当日（ギリ）', 478, 700);
    });
}

const targetTex = canvasTex(256, 256, (g) => {
    g.strokeStyle = 'rgba(255,30,120,0.95)';
    g.lineWidth = 10;
    g.setLineDash([20, 14]);
    g.beginPath();
    g.arc(128, 128, 110, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(128, 96);
    g.lineTo(128, 160);
    g.moveTo(96, 128);
    g.lineTo(160, 128);
    g.stroke();
    g.fillStyle = 'rgba(255,30,120,0.9)';
    g.font = `bold 34px ${POP}`;
    g.textAlign = 'center';
    g.fillText('ココ!', 128, 76);
});
const cursorTex = canvasTex(128, 128, (g) => {
    g.strokeStyle = '#ff2020';
    g.lineWidth = 9;
    g.beginPath();
    g.arc(64, 64, 46, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(40, 40);
    g.lineTo(88, 88);
    g.moveTo(88, 40);
    g.lineTo(40, 88);
    g.stroke();
});
const blobTex = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(0,0,0,.55)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
});
const puffTex = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.5, 'rgba(255,255,255,.6)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
});
const deskCrackTex = canvasTex(512, 512, (g) => {
    g.strokeStyle = '#2a1500';
    g.lineCap = 'round';
    for (let i = 0; i < 11; i++) {
        let x = 256, y = 256, a = i / 11 * Math.PI * 2 + rand(-.2, .2), w = 10;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 14; s++) {
            a += rand(-.5, .5);
            x += Math.cos(a) * rand(12, 22);
            y += Math.sin(a) * rand(12, 22);
            g.lineTo(x, y);
        }
        g.lineWidth = w * rand(.5, 1);
        g.stroke();
    }
    g.fillStyle = '#2a1500';
    g.beginPath();
    g.arc(256, 256, 22, 0, 7);
    g.fill();
});

function drawSeal(g, S) {
    g.clearRect(0, 0, S, S);
    const c = S / 2;
    g.strokeStyle = g.fillStyle = '#e0301e';
    g.lineWidth = S * 0.065;
    g.beginPath();
    g.arc(c, c, S * 0.43, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = S * 0.014;
    g.beginPath();
    g.arc(c, c, S * 0.36, 0, Math.PI * 2);
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${S * 0.075}px ${POP}`;
    g.fillText('先　生', c, c - S * 0.255);
    g.font = `${S * 0.33}px ${POP}`;
    g.fillText('受理', c, c + S * 0.02);
    const d = new Date();
    g.font = `${S * 0.06}px ${POP}`;
    g.fillText(`R${d.getFullYear() - 2018}.${d.getMonth() + 1}.${d.getDate()}`, c, c + S * 0.26);
    // かすれ
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) {
        g.globalAlpha = rand(.3, 1);
        g.beginPath();
        g.arc(rand(0, S), rand(0, S), rand(0.5, S * 0.008), 0, 7);
        g.fill();
    }
    for (let i = 0; i < 14; i++) {
        g.globalAlpha = rand(.35, .75);
        g.lineWidth = rand(1, S * 0.012);
        const y = rand(0, S);
        g.beginPath();
        g.moveTo(rand(0, S * 0.3), y);
        g.lineTo(rand(S * 0.6, S), y + rand(-S * 0.08, S * 0.08));
        g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
}

let sealTex = null;
const haloTex = canvasTex(512, 512, (g) => {
    const c = 256;
    for (let i = 0; i < 28; i++) {
        const a0 = i / 28 * Math.PI * 2, a1 = a0 + Math.PI / 28;
        g.fillStyle = i % 2 ? 'rgba(255,240,120,1)' : 'rgba(255,200,60,1)';
        g.beginPath();
        g.moveTo(c, c);
        g.arc(c, c, 256, a0, a1);
        g.closePath();
        g.fill();
    }
    g.globalCompositeOperation = 'destination-in';
    const r = g.createRadialGradient(c, c, 20, c, c, 256);
    r.addColorStop(0, 'rgba(0,0,0,1)');
    r.addColorStop(0.6, 'rgba(0,0,0,.6)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 512, 512);
});

/* =====================================================================
シーン：教室
===================================================================== */
const classroom = new THREE.Scene();
classroom.background = new THREE.Color(0xff4fa3);
const classLight = addLights(classroom, true);

const PAPER_W = 5, PAPER_D = 7.07, SHEETS = 4, SHEET_T = 0.05, PAPER_TOP = SHEETS * SHEET_T;
const PAPER_X = 0, PAPER_Z = 0;
const TARGET = {x: PAPER_X - PAPER_W / 2 + 0.6, z: PAPER_Z - PAPER_D / 2 + 0.6};
const DESK_HALF = {x: 7, z: 4.75};
const TDESK = {z: -12.5, halfW: 4, halfD: 2.5};
const TEACHER_POS = V3(0, -5, -17), TEACHER_SCALE = 1.6;
const SKIN = new THREE.Color(0xffcf9e), ANGRY = new THREE.Color(0xff2412);

function buildClassroom() {
    const floorTex = canvasTex(512, 512, (g) => {
        for (let i = 0; i < 8; i++) {
            g.fillStyle = i % 2 ? '#d49654' : '#c4823f';
            g.fillRect(0, i * 64, 512, 64);
            g.fillStyle = 'rgba(0,0,0,.12)';
            g.fillRect(0, i * 64, 512, 3);
            g.fillRect((i * 137) % 512, i * 64, 3, 64);
        }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(8, 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), toon(0xffffff, {map: floorTex}));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -5, -8);
    floor.receiveShadow = true;
    classroom.add(floor);

    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), toon(0xff5fb0));
    back.position.set(0, 15, -25);
    classroom.add(back);
    for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), toon(0xff7ac2));
        w.position.set(s * 27, 15, -5);
        w.rotation.y = -s * Math.PI / 2;
        classroom.add(w);
    }
    // 窓
    for (let i = 0; i < 3; i++) {
        const win = box(0.3, 6, 7, 0x8fe3ff, {outlineT: 0.12});
        win.position.set(-26.8, 6, -18 + i * 10);
        classroom.add(win);
    }

    // 黒板
    const bbTex = canvasTex(1024, 410, (g, w, h) => {
        g.fillStyle = '#2f7a3a';
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.06)';
        for (let i = 0; i < 40; i++) g.fillRect(rand(0, w), rand(0, h), rand(40, 160), rand(4, 12));
        g.fillStyle = 'rgba(255,255,255,.92)';
        g.font = `64px ${HAND}`;
        g.textAlign = 'left';
        g.fillText('本日の課題：ホッチキス', 60, 110);
        g.fillStyle = '#ffe96b';
        g.font = `80px ${HAND}`;
        g.fillText('左上を綴じること！！', 90, 230);
        g.strokeStyle = '#ffe96b';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(90, 250);
        g.lineTo(820, 256);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.font = `40px ${HAND}`;
        g.fillText('※テストに出る（地球の存亡に関わる）', 70, 330);
        g.textAlign = 'right';
        g.font = `34px ${HAND}`;
        g.fillText('11月7日　日直：山田', 990, 390);
    });
    const bb = box(22, 8.8, 0.3, null, {mat: toon(0xffffff, {map: bbTex}), outlineT: 0.25});
    bb.position.set(0, 9, -24.7);
    classroom.add(bb);

    // 生徒の机（黄色）
    const top = box(14, 0.5, 9.5, 0xffd400, {receive: true, outlineT: 0.08});
    top.position.set(0, -0.25, 0);
    classroom.add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const l = box(0.5, 4.5, 0.5, 0x777788);
        l.position.set(sx * 6.3, -2.75, sz * 4.2);
        classroom.add(l);
    }
    // 鉛筆と消しゴム（小道具）
    const pencil = new THREE.Group();
    const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3, 6), toon(0x3fbf5a));
    pb.rotation.z = Math.PI / 2;
    outline(pb, 0.03);
    const pt = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 6), toon(0xffd9a0));
    pt.rotation.z = -Math.PI / 2;
    pt.position.x = 1.72;
    outline(pt, 0.03);
    pencil.add(pb, pt);
    pencil.position.set(4.6, 0.17, 2.6);
    pencil.rotation.y = 0.5;
    classroom.add(pencil);
    const eraser = box(1.1, 0.45, 0.6, 0x4fb3ff, {outlineT: 0.03});
    eraser.position.set(-4.8, 0.23, 2.8);
    eraser.rotation.y = -0.3;
    classroom.add(eraser);

    // 教卓（真っ二つに割れるように左右2分割）
    const halves = [];
    const stickerTex = canvasTex(256, 128, (g) => {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, 256, 128);
        g.fillStyle = '#d0001a';
        g.font = `54px ${POP}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('教卓', 128, 66);
    });
    for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * TDESK.halfW, -5, TDESK.z);
        const m = box(TDESK.halfW, 5, TDESK.halfD * 2, 0x9c5a2b, {receive: true, outlineT: 0.07});
        m.position.set(-s * TDESK.halfW / 2, 2.5, 0);
        pivot.add(m);
        if (s < 0) {
            const st = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), toon(0xffffff, {map: stickerTex}));
            st.position.set(-s * TDESK.halfW / 2, 3.2, TDESK.halfD + 0.02);
            st.rotation.z = 0.06;
            pivot.add(st);
        } else {
            const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.8, 10), toon(0xffffff));
            outline(mug, 0.04);
            mug.position.set(-1.0, 5.4, 1.2);
            mug.castShadow = true;
            pivot.add(mug);
        }
        pivot.userData.home = pivot.position.clone();
        pivot.userData.side = s;
        pivot.userData.av = 0;
        classroom.add(pivot);
        halves.push(pivot);
    }
    return halves;
}

const deskHalves = buildClassroom();

/* ---------- ホッチキス（実物の1.5倍、顔つき） ---------- */
function buildStapler() {
    const S = new THREE.Group(), body = new THREE.Group();
    S.add(body);
    const red = toon(0xff2d55), navy = toon(0x3a3f78), metal = toon(0xcfd6e2), white = toon(0xffffff),
        black = toon(0x111111);
    const base = box(1.15, 0.32, 3.3, null, {mat: navy});
    base.position.set(0, 0.16, -1.4);
    body.add(base);
    const anvil = box(0.7, 0.06, 0.5, null, {mat: metal, outlineT: 0});
    anvil.position.set(0, 0.35, 0);
    body.add(anvil);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), toon(0xff7aa8));
    tongue.scale.set(1, 0.35, 1.3);
    tongue.position.set(0, 0.36, -0.5);
    body.add(tongue);
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.42, -2.85);
    body.add(pivot);
    const arm = box(1.05, 0.46, 3.3, null, {mat: red});
    arm.position.set(0, 0.23, 1.55);
    pivot.add(arm);
    const armTop = box(0.8, 0.12, 2.6, null, {mat: metal, outlineT: 0.03});
    armTop.position.set(0, 0.52, 1.35);
    pivot.add(armTop);
    const eyes = [];
    for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8), white);
        outline(eye, 0.035);
        eye.position.set(s * 0.27, 0.64, 2.92);
        pivot.add(eye);
        eyes.push(eye);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), black);
        pupil.position.set(s * 0.03, 0.02, 0.16);
        eye.add(pupil);
        const brow = box(0.3, 0.06, 0.06, 0x111111, {outlineT: 0});
        brow.position.set(s * 0.27, 0.92, 2.98);
        brow.rotation.z = s * -0.3;
        pivot.add(brow);
    }
    S.traverse(o => {
        if (o.isMesh && !o.userData.isOutline) o.castShadow = true;
    });
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.2), new THREE.MeshBasicMaterial({
        map: blobTex, transparent: true, depthWrite: false
    }));
    blob.rotation.x = -Math.PI / 2;
    S.userData = {body, pivot, eyes, blob};
    return S;
}

const stapler = buildStapler();
classroom.add(stapler);
classroom.add(stapler.userData.blob);
const setArmOpen = a => {
    stapler.userData.pivot.rotation.x = -a;
};

const targetMarker = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.TARGET_RADIUS * 2 * 1.16, CONFIG.TARGET_RADIUS * 2 * 1.16), new THREE.MeshBasicMaterial({
    map: targetTex, transparent: true, depthWrite: false
}));
targetMarker.rotation.x = -Math.PI / 2;
targetMarker.position.set(TARGET.x, PAPER_TOP + 0.012, TARGET.z);
classroom.add(targetMarker);
const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({
    map: cursorTex, transparent: true, depthWrite: false
}));
cursor.rotation.x = -Math.PI / 2;
classroom.add(cursor);

/* ---------- 先生（ローポリ・メガネ・ハゲかけ・ネクタイ） ---------- */
const faceCanvas = document.createElement('canvas');
faceCanvas.width = faceCanvas.height = 256;
const faceCtx = faceCanvas.getContext('2d');
const faceTex = new THREE.CanvasTexture(faceCanvas);
faceTex.colorSpace = THREE.SRGBColorSpace;
let curFace = '';

function setFace(expr) {
    if (curFace === expr) return;
    curFace = expr;
    const g = faceCtx;
    g.clearRect(0, 0, 256, 256);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#1b0f2a';
    g.fillStyle = '#1b0f2a';
    const line = (x1, y1, x2, y2, w) => {
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
    };
    const dot = (x, y, r, c = '#1b0f2a') => {
        g.fillStyle = c;
        g.beginPath();
        g.arc(x, y, r, 0, 7);
        g.fill();
    };
    const vein = (x, y) => {
        g.strokeStyle = '#e0201e';
        g.lineWidth = 7;
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            g.beginPath();
            g.arc(x + Math.cos(a + .8) * 14, y + Math.sin(a + .8) * 14, 10, a + 2.4, a + 4.0);
            g.stroke();
        }
        g.strokeStyle = '#1b0f2a';
    };
    switch (expr) {
        case 'neutral':
            line(64, 78, 108, 84, 8);
            line(148, 84, 192, 78, 8);
            dot(88, 112, 11);
            dot(168, 112, 11);
            line(104, 204, 152, 204, 7);
            break;
        case 'think':
            line(64, 70, 108, 82, 8);
            line(148, 88, 192, 74, 8);
            line(72, 114, 104, 114, 7);
            line(152, 114, 184, 114, 7);
            dot(94, 108, 6);
            dot(174, 108, 6);
            g.lineWidth = 6;
            g.beginPath();
            g.arc(140, 206, 9, 0, 7);
            g.stroke();
            g.fillStyle = '#5ab8ff';
            g.beginPath();
            g.moveTo(214, 52);
            g.quadraticCurveTo(232, 86, 214, 92);
            g.quadraticCurveTo(196, 86, 214, 52);
            g.fill();
            break;
        case 'happy':
            line(62, 76, 108, 70, 8);
            line(148, 70, 194, 76, 8);
            g.lineWidth = 9;
            g.beginPath();
            g.arc(88, 122, 17, Math.PI * 1.1, Math.PI * 1.9);
            g.stroke();
            g.beginPath();
            g.arc(168, 122, 17, Math.PI * 1.1, Math.PI * 1.9);
            g.stroke();
            g.fillStyle = '#c81e3a';
            g.beginPath();
            g.moveTo(84, 186);
            g.quadraticCurveTo(128, 262, 172, 186);
            g.closePath();
            g.fill();
            g.lineWidth = 6;
            g.stroke();
            g.fillStyle = '#ff8fb0';
            g.beginPath();
            g.ellipse(52, 152, 20, 11, 0, 0, 7);
            g.ellipse(204, 152, 20, 11, 0, 0, 7);
            g.fill();
            break;
        case 'angry':
        case 'rage': {
            const rage = expr === 'rage';
            line(56, 64, 112, 98, rage ? 15 : 12);
            line(144, 98, 200, 64, rage ? 15 : 12);
            for (const x of [88, 168]) {
                g.fillStyle = '#fff';
                g.beginPath();
                g.arc(x, 120, 17, 0, 7);
                g.fill();
                g.lineWidth = 5;
                g.stroke();
                dot(x, 122, rage ? 4 : 6, rage ? '#d0001a' : '#1b0f2a');
            }
            if (rage) {
                g.fillStyle = '#5a0010';
                g.beginPath();
                g.ellipse(128, 206, 46, 36, 0, 0, 7);
                g.fill();
                g.lineWidth = 6;
                g.stroke();
                g.fillStyle = '#fff';
                g.fillRect(96, 174, 64, 14);
            } else {
                g.fillStyle = '#fff';
                g.fillRect(90, 186, 76, 34);
                g.lineWidth = 6;
                g.strokeRect(90, 186, 76, 34);
                g.lineWidth = 3;
                for (let x = 105; x < 166; x += 15) line(x, 186, x, 220, 3);
                line(90, 203, 166, 203, 3);
            }
            vein(204, 46);
            if (rage) vein(56, 40);
            break;
        }
        case 'smug':
            line(64, 84, 108, 84, 8);
            line(148, 84, 192, 84, 8);
            g.lineWidth = 8;
            g.beginPath();
            g.arc(88, 104, 15, 0.15 * Math.PI, 0.85 * Math.PI);
            g.stroke();
            g.beginPath();
            g.arc(168, 104, 15, 0.15 * Math.PI, 0.85 * Math.PI);
            g.stroke();
            g.lineWidth = 7;
            g.beginPath();
            g.moveTo(100, 206);
            g.quadraticCurveTo(140, 214, 164, 194);
            g.stroke();
            break;
    }
    // 鼻とヒゲ（常時）
    g.strokeStyle = '#c47a52';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(128, 148, 10, 0.2, Math.PI - 0.2);
    g.stroke();
    g.fillStyle = '#3a2a20';
    g.beginPath();
    g.ellipse(108, 172, 24, 9, -0.22, 0, 7);
    g.ellipse(148, 172, 24, 9, 0.22, 0, 7);
    g.fill();
    faceTex.needsUpdate = true;
}

function buildTeacher() {
    const T = new THREE.Group();
    const suit = toon(0x9a8a36), dark = toon(0x2a2a3a), headMat = toon(0xffcf9e), hairMat = toon(0x666666),
        black = toon(0x151515);
    for (const s of [-1, 1]) {
        const leg = box(0.75, 3.6, 0.85, null, {mat: dark});
        leg.position.set(s * 0.55, 1.8, 0);
        T.add(leg);
    }
    const torso = box(2.4, 3.0, 1.4, null, {mat: suit});
    torso.position.y = 5.1;
    T.add(torso);
    const shirt = box(0.95, 2.4, 0.06, 0xffffff, {outlineT: 0});
    shirt.position.set(0, 5.4, 0.72);
    T.add(shirt);
    const knot = box(0.42, 0.34, 0.12, 0xff2a8a, {outlineT: 0.03});
    knot.position.set(0, 6.35, 0.8);
    T.add(knot);
    const tie = box(0.44, 1.75, 0.08, 0xff2a8a, {outlineT: 0.03});
    tie.position.set(0, 5.3, 0.8);
    tie.rotation.z = 0.06;
    T.add(tie);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 8), headMat);
    neck.position.y = 6.85;
    T.add(neck);

    const head = new THREE.Group();
    head.position.set(0, 7.75, 0);
    T.add(head);
    const skull = new THREE.Mesh(flatGeo(new THREE.IcosahedronGeometry(1.05, 1)), headMat);
    outline(skull, 0.06);
    head.add(skull);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(flatGeo(new THREE.IcosahedronGeometry(0.26, 0)), headMat);
        ear.position.set(s * 1.04, 0, 0);
        head.add(ear);
    }
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({
        map: faceTex, transparent: true, depthWrite: false
    }));
    face.position.set(0, -0.05, 1.07);
    head.add(face);
    const glasses = new THREE.Group();
    glasses.position.set(0, 0.12, 1.13);
    head.add(glasses);
    for (const s of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 6, 16), black);
        r.position.x = s * 0.36;
        glasses.add(r);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), black);
    glasses.add(bridge);
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({
        map: puffTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glint.position.set(0.36, 0.05, 0.04);
    glasses.add(glint);
    const hair = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.3, 6, 14, Math.PI * 1.3), hairMat);
    hair.rotation.set(Math.PI / 2, 0, 0.85 * Math.PI);
    hair.position.y = -0.02;
    head.add(hair);
    for (const x of [-0.28, 0, 0.28]) {
        const st = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.035, 4, 12, Math.PI * 0.6), hairMat);
        st.rotation.set(0, Math.PI / 2, 0.2 * Math.PI);
        st.position.x = x;
        head.add(st);
    }

    const arms = [];
    for (const s of [-1, 1]) {
        const p = new THREE.Group();
        p.position.set(s * 1.5, 6.2, 0);
        T.add(p);
        const a = box(0.62, 2.8, 0.62, null, {mat: suit});
        a.position.y = -1.4;
        p.add(a);
        const hand = box(0.72, 0.72, 0.72, null, {mat: headMat, outlineT: 0.04});
        hand.position.y = -2.95;
        p.add(hand);
        p.userData.hand = hand;
        arms.push(p);
    }
    const thumb = box(0.24, 0.62, 0.24, null, {mat: headMat, outlineT: 0.035});
    thumb.position.set(0, -0.27, 0.36);
    thumb.rotation.x = 2.2;
    thumb.scale.setScalar(0.001);
    arms[1].userData.hand.add(thumb);

    const halo = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({
        map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.position.set(0, 7.75, -1.6);
    T.add(halo);

    T.traverse(o => {
        if (o.isMesh && !o.userData.isOutline && o !== halo && o !== face && o !== glint) o.castShadow = true;
    });
    T.userData = {head, headMat, arms, thumb, halo, glint};
    return T;
}

const teacher = buildTeacher();
classroom.add(teacher);
const TU = teacher.userData;

function resetTeacher() {
    classroom.add(teacher);
    teacher.position.copy(TEACHER_POS);
    teacher.scale.setScalar(TEACHER_SCALE);
    teacher.rotation.set(0, 0, 0);
    TU.head.rotation.set(0, 0, 0);
    TU.headMat.color.copy(SKIN);
    TU.arms.forEach(a => a.rotation.set(0, 0, 0));
    TU.thumb.scale.setScalar(0.001);
    TU.halo.material.opacity = 0;
    TU.glint.material.opacity = 0;
    TU.halo.visible = true;
    setFace('neutral');
}

/* =====================================================================
シーン：校舎・日本・宇宙（失敗時の大惨事用）
===================================================================== */
const school = new THREE.Scene();
school.background = new THREE.Color(0x7fd4ff);
addLights(school);
const schoolDome = (() => {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), toon(0x62d35f));
    ground.rotation.x = -Math.PI / 2;
    school.add(ground);
    const winTex = canvasTex(512, 192, (g, w, h) => {
        g.fillStyle = '#fff3d6';
        g.fillRect(0, 0, w, h);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
            g.fillStyle = '#5fc8ff';
            g.fillRect(14 + c * 50, 14 + r * 60, 34, 38);
            g.strokeStyle = '#666';
            g.lineWidth = 3;
            g.strokeRect(14 + c * 50, 14 + r * 60, 34, 38);
        }
    });
    const plain = toon(0xfff3d6), front = toon(0xffffff, {map: winTex});
    const bld = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 8), [plain, plain, plain, plain, front, plain]);
    bld.position.y = 5;
    outline(bld, 0.25);
    school.add(bld);
    const tower = box(6, 6, 6, 0xfff3d6, {outlineT: 0.2});
    tower.position.y = 13;
    school.add(tower);
    const roof = box(31, 0.8, 9, 0xc0392b, {outlineT: 0.2});
    roof.position.y = 10.4;
    school.add(roof);
    const clockTex = canvasTex(256, 256, (g) => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(128, 128, 120, 0, 7);
        g.fill();
        g.lineWidth = 12;
        g.strokeStyle = '#222';
        g.stroke();
        g.lineWidth = 10;
        g.beginPath();
        g.moveTo(128, 128);
        g.lineTo(128, 40);
        g.moveTo(128, 128);
        g.lineTo(190, 150);
        g.stroke();
    });
    const clock = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({map: clockTex}));
    clock.position.set(0, 13.5, 3.02);
    school.add(clock);
    const signTex = canvasTex(512, 96, (g) => {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, 512, 96);
        g.fillStyle = '#222';
        g.font = `52px ${POP}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('私立ホッチキス学園', 256, 50);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.25), new THREE.MeshBasicMaterial({map: signTex}));
    sign.position.set(0, 8.6, 4.03);
    school.add(sign);
    const treeMat = toon(0x2fa84f), trunkMat = toon(0x8a5a2a);
    for (let i = 0; i < 14; i++) {
        const t = new THREE.Group();
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 6), treeMat);
        c.position.y = 3;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 5), trunkMat);
        tr.position.y = 0.7;
        t.add(c, tr);
        t.position.set(rand(-40, 40), 0, rand(8, 30) * (Math.random() < .5 ? -1 : 1));
        if (Math.abs(t.position.x) < 17 && Math.abs(t.position.z) < 6) t.position.z += 12;
        school.add(t);
    }
    const houseCols = [0xff7ac2, 0xffd400, 0x8fe3ff, 0xffffff, 0xff9f43];
    for (let i = 0; i < 70; i++) {
        const r = rand(40, 400), a = rand(0, Math.PI * 2), s = rand(3, 9);
        const h = box(s, s * rand(.6, 1.4), s, houseCols[i % 5], {outlineT: 0});
        h.position.set(Math.cos(a) * r, h.geometry.parameters.height / 2, Math.sin(a) * r);
        school.add(h);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide
    }));
    school.add(dome);
    return dome;
})();

const japan = new THREE.Scene();
japan.background = new THREE.Color(0x2a6fe0);
addLights(japan);
const JAPAN_PT = {x: 0, z: 0};
const japanRing = (() => {
    const J = {
        hokkaido: [[700, 150], [760, 128], [830, 168], [862, 222], [800, 252], [742, 270], [712, 240], [690, 200]],
        honshu: [[688, 298], [738, 330], [748, 420], [722, 500], [694, 558], [642, 600], [560, 622], [480, 652], [400, 682], [350, 672], [360, 640], [430, 610], [500, 580], [560, 560], [612, 520], [640, 460], [652, 400], [660, 340]],
        shikoku: [[430, 690], [500, 680], [522, 712], [470, 734], [420, 722]],
        kyushu: [[300, 680], [352, 690], [362, 742], [332, 802], [290, 792], [270, 732]],
    };
    const tex = canvasTex(1024, 1024, (g, w, h) => {
        g.fillStyle = '#3a8dff';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,255,255,.25)';
        g.lineWidth = 4;
        for (let y = 30; y < h; y += 60) {
            g.beginPath();
            for (let x = 0; x < w; x += 20) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 6);
            g.stroke();
        }
        // 大陸っぽいもの
        g.fillStyle = '#8fd36a';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(520, 0);
        g.lineTo(480, 200);
        g.lineTo(380, 330);
        g.lineTo(240, 420);
        g.lineTo(120, 600);
        g.lineTo(0, 640);
        g.closePath();
        g.fill();
        g.strokeStyle = '#1b0f2a';
        g.lineWidth = 6;
        g.stroke();
        for (const k in J) {
            const p = J[k];
            g.fillStyle = '#62d35f';
            g.beginPath();
            g.moveTo(p[0][0], p[0][1]);
            for (const q of p) g.lineTo(q[0], q[1]);
            g.closePath();
            g.fill();
            g.stroke();
        }
        for (let i = 0; i < 6; i++) {
            g.fillStyle = '#62d35f';
            g.beginPath();
            g.arc(240 - i * 22, 860 + i * 24, 7, 0, 7);
            g.fill();
        }
        g.fillStyle = '#fff';
        g.font = `72px ${POP}`;
        g.textAlign = 'center';
        g.lineWidth = 10;
        g.strokeStyle = '#1b0f2a';
        g.strokeText('日本', 860, 520);
        g.fillText('日本', 860, 520);
        g.fillStyle = '#ff2020';
        g.beginPath();
        g.arc(692, 556, 12, 0, 7);
        g.fill();
        g.font = `34px ${POP}`;
        g.strokeText('ココ（教室）', 820, 640);
        g.fillText('ココ（教室）', 820, 640);
    });
    const S = 100;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({map: tex}));
    plane.rotation.x = -Math.PI / 2;
    japan.add(plane);
    JAPAN_PT.x = (692 / 1024 - 0.5) * S;
    JAPAN_PT.z = (556 / 1024 - 0.5) * S;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(JAPAN_PT.x, 0.1, JAPAN_PT.z);
    japan.add(ring);
    return ring;
})();

const space = new THREE.Scene();
space.background = new THREE.Color(0x0a0420);
addLights(space);
{
    const n = 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const v = V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(300, 800));
        pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    space.add(new THREE.Points(g, new THREE.PointsMaterial({color: 0xffffff, size: 2, sizeAttenuation: false})));
}
const EARTH_R = 5;
const earth = new THREE.Group();
space.add(earth);
const earthTex = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2f86ff');
    gr.addColorStop(1, '#1d5fd6');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let c = 0; c < 10; c++) {
        let cx, cy;
        do {
            cx = rand(0, w);
            cy = rand(70, h - 70);
        } while (Math.hypot(cx - 256, cy - 165) < 150);
        g.fillStyle = c % 3 ? '#3fc25a' : '#c9b25a';
        for (let i = 0; i < 40; i++) {
            g.beginPath();
            g.arc(cx + rand(-90, 90), cy + rand(-55, 55), rand(14, 42), 0, 7);
            g.fill();
        }
    }
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, 26);
    g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#3fc25a';
    g.beginPath();
    g.ellipse(262, 160, 9, 30, 0.5, 0, 7);
    g.fill();
    g.beginPath();
    g.ellipse(272, 128, 10, 9, 0, 0, 7);
    g.fill();
    g.fillStyle = '#ff2020';
    g.beginPath();
    g.arc(256, 165, 5, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 40; i++) {
        g.beginPath();
        g.ellipse(rand(0, w), rand(40, h - 40), rand(20, 70), rand(5, 12), 0, 0, 7);
        g.fill();
    }
});
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 48, 32), toon(0xffffff, {map: earthTex}));
earth.add(earthMesh);
const crackTex = canvasTex(1024, 512, () => {
});
const crackMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.006, 48, 32), new THREE.MeshBasicMaterial({
    map: crackTex, transparent: true, depthWrite: false
}));
earth.add(crackMesh);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.13, 32, 24), new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    transparent: true,
    opacity: 0.28,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
}));
earth.add(atmo);
earth.rotation.set(0.55, 0, 0);
// 亀裂の線分を事前生成（日本から全体へ広がる）
const crackSegs = (() => {
    const segs = [];
    const walkers = [];
    for (let i = 0; i < 7; i++) walkers.push({x: 256, y: 165, a: i / 7 * Math.PI * 2, life: rand(30, 55), gen: 0});
    while (walkers.length) {
        const w = walkers.pop();
        for (let s = 0; s < w.life; s++) {
            w.a += rand(-0.5, 0.5);
            const nx = w.x + Math.cos(w.a) * 11, ny = clamp(w.y + Math.sin(w.a) * 11, 10, 502);
            segs.push({x1: w.x, y1: w.y, x2: nx, y2: ny, o: w.gen + s});
            w.x = (nx + 1024) % 1024;
            w.y = ny;
            if (Math.random() < 0.06 && segs.length < 1400) walkers.push({
                x: w.x, y: w.y, a: w.a + rand(-1.2, 1.2), life: rand(10, 30), gen: w.gen + s
            });
        }
    }
    segs.sort((a, b) => a.o - b.o);
    return segs;
})();
const crackMaxO = crackSegs[crackSegs.length - 1].o;
let crackDrawn = 0;

function drawCracks(p) {
    const g = crackTex.userData.ctx, lim = p * crackMaxO;
    let any = false;
    g.lineCap = 'round';
    while (crackDrawn < crackSegs.length && crackSegs[crackDrawn].o <= lim) {
        const s = crackSegs[crackDrawn++];
        if (Math.abs(s.x2 - s.x1) > 500) continue;
        g.strokeStyle = '#2a0800';
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.stroke();
        g.strokeStyle = '#ff8a00';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.stroke();
        any = true;
    }
    if (any) crackTex.needsUpdate = true;
}

function resetCracks() {
    crackTex.userData.ctx.clearRect(0, 0, 1024, 512);
    crackTex.needsUpdate = true;
    crackDrawn = 0;
}

const shockRingMat = () => new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide
});

/* =====================================================================
パーティクル・簡易物理
===================================================================== */
const systems = [];   // { update(dt) -> bool(生存), kill() }
const bodies = [];    // 簡易剛体
let roundObjs = [];   // ラウンドごとに消すもの
let teacherDeskBroken = false;

function groundY(x, z) {
    if (report && report.visible && report.parent === classroom && carrier === report && report.position.lengthSq() < 1e-6 && surfaceAt(x, z) > 0) return PAPER_TOP;
    if (Math.abs(x - PAPER_X) <= DESK_HALF.x && Math.abs(z - PAPER_Z) <= DESK_HALF.z) return 0;
    if (!teacherDeskBroken && Math.abs(x) <= TDESK.halfW && Math.abs(z - TDESK.z) <= TDESK.halfD) return 0;
    return -5;
}

function addBody(obj, v, av, opts = {}) {
    const b = Object.assign({obj, v, av, g: -20, r: 0.03, bounce: 0.3}, opts);
    bodies.push(b);
    return b;
}

function updateBodies(dt) {
    for (const b of bodies) {
        if (b.frozen) continue;
        b.v.y += b.g * dt;
        if (b.drag) b.v.multiplyScalar(Math.max(0, 1 - b.drag * dt));
        const p = b.obj.position;
        p.addScaledVector(b.v, dt);
        b.obj.rotation.x += b.av.x * dt;
        b.obj.rotation.y += b.av.y * dt;
        b.obj.rotation.z += b.av.z * dt;
        if (b.noGround) continue;
        const gy = groundY(p.x, p.z) + b.r;
        if (p.y < gy && p.y > gy - 1.2) {
            p.y = gy;
            if (b.v.y < 0) b.v.y *= -b.bounce;
            b.v.x *= 0.55;
            b.v.z *= 0.55;
            b.av.multiplyScalar(0.5);
            if (b.paper) {
                b.obj.rotation.x = -Math.PI / 2 + rand(-.05, .05);
                b.obj.rotation.y = 0;
                b.av.x = b.av.y = 0;
            }
        }
    }
}

function burst(scene, origin, o = {}) {
    const n = o.n || 200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [];
    const cols = (o.colors || [0xffffff]).map(c => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
        const d = V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        if (o.up) d.y = Math.abs(d.y) * o.up;
        vel.push(d.multiplyScalar(rand(o.speed ? o.speed[0] : 2, o.speed ? o.speed[1] : 8)));
        const sp = o.spread || 0;
        pos.set([origin.x + rand(-sp, sp), origin.y + rand(-sp, sp), origin.z + rand(-sp, sp)], i * 3);
        const c = cols[i % cols.length];
        col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
        size: o.size || 0.4,
        map: puffTex,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    const life = o.life || 1.5, grav = o.gravity ?? -6, drag = o.drag ?? 1, grow = o.grow || 0;
    let t = 0;
    const sys = {
        update(dt) {
            t += dt;
            const a = geo.attributes.position.array;
            for (let i = 0; i < n; i++) {
                const v = vel[i];
                v.y += grav * dt;
                v.multiplyScalar(Math.max(0, 1 - drag * dt));
                a[i * 3] += v.x * dt;
                a[i * 3 + 1] += v.y * dt;
                a[i * 3 + 2] += v.z * dt;
            }
            geo.attributes.position.needsUpdate = true;
            mat.opacity = clamp(1 - t / life);
            mat.size = (o.size || 0.4) * (1 + t * grow);
            if (t >= life) {
                this.kill();
                return false;
            }
            return true;
        }, kill() {
            scene.remove(pts);
            geo.dispose();
            mat.dispose();
        }
    };
    systems.push(sys);
    return sys;
}

function confetti(scene, origin, n, spread = 4, up = 7, floorY = -5) {
    const geo = new THREE.PlaneGeometry(0.2, 0.3), mat = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
    const im = new THREE.InstancedMesh(geo, mat, n),
        cols = [0xff2d55, 0xffd400, 0x29e05a, 0x34d3ff, 0xa25cff, 0xff8a00, 0xffffff];
    const ps = [], dummy = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
        im.setColorAt(i, c.setHex(cols[i % cols.length]));
        ps.push({
            p: origin.clone().add(V3(rand(-.3, .3), 0, rand(-.3, .3))),
            v: V3(rand(-1, 1) * spread, rand(0.4, 1) * up, rand(-1, 1) * spread),
            r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
            av: V3(rand(-12, 12), rand(-12, 12), rand(-12, 12))
        });
    }
    im.instanceColor.needsUpdate = true;
    scene.add(im);
    const life = 4.5;
    let t = 0;
    const sys = {
        update(dt) {
            t += dt;
            for (let i = 0; i < n; i++) {
                const q = ps[i];
                q.v.y -= 9 * dt;
                q.v.multiplyScalar(1 - 1.6 * dt);
                q.p.addScaledVector(q.v, dt);
                if (q.p.y < floorY) {
                    q.p.y = floorY;
                    q.v.set(0, 0, 0);
                } else {
                    q.r.x += q.av.x * dt;
                    q.r.y += q.av.y * dt;
                    q.r.z += q.av.z * dt;
                }
                dummy.position.copy(q.p);
                dummy.rotation.copy(q.r);
                dummy.scale.setScalar(clamp(life - t));
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
            }
            im.instanceMatrix.needsUpdate = true;
            if (t >= life) {
                this.kill();
                return false;
            }
            return true;
        }, kill() {
            scene.remove(im);
            geo.dispose();
            mat.dispose();
            im.dispose();
        }
    };
    systems.push(sys);
    return sys;
}

function ringWave(scene, pos, {speed = 40, life = 1.2, color = 0xffffff, flat = true} = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), shockRingMat());
    m.material.color.setHex(color);
    if (flat) m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    scene.add(m);
    let t = 0;
    const sys = {
        update(dt) {
            t += dt;
            m.scale.setScalar(0.5 + t * speed);
            m.material.opacity = 0.9 * clamp(1 - t / life);
            if (t >= life) {
                this.kill();
                return false;
            }
            return true;
        }, kill() {
            scene.remove(m);
            m.geometry.dispose();
            m.material.dispose();
        }
    };
    systems.push(sys);
}

function updateSystems(dt) {
    for (let i = systems.length - 1; i >= 0; i--) if (!systems[i].update(dt)) systems.splice(i, 1);
}

/* =====================================================================
カメラ（タメ・揺れ・縦画面補正）
===================================================================== */
const cam = {pos: V3(0, 12, 16), target: V3(0, 0, -2)};
let camTween = null, shakeAmp = 0, hitstopT = 0;

function camTo(pos, target, dur = 1, ease = Ease.inOut) {
    camTween = {fp: cam.pos.clone(), ft: cam.target.clone(), tp: pos.clone(), tt: target.clone(), dur, t: 0, ease};
}

function setCam(pos, target) {
    camTween = null;
    cam.pos.copy(pos);
    cam.target.copy(target);
}

const shake = a => {
    shakeAmp = Math.max(shakeAmp, a);
};
const hitstop = s => {
    hitstopT = Math.max(hitstopT, s);
};
const _cv = V3(), _ct = V3();

function updateCamera(raw) {
    if (camTween) {
        camTween.t += raw;
        const k = camTween.ease(clamp(camTween.t / camTween.dur));
        cam.pos.lerpVectors(camTween.fp, camTween.tp, k);
        cam.target.lerpVectors(camTween.ft, camTween.tt, k);
        if (camTween.t >= camTween.dur) camTween = null;
    }
    const aspect = camera.aspect, k = Math.min(2.4, Math.max(1, 1.3 / aspect));   // 縦画面では少し引く
    _cv.copy(cam.pos).sub(cam.target).multiplyScalar(k).add(cam.target);
    const s = shakeAmp * (currentScene === space ? 0.6 : 1);
    _cv.x += rand(-1, 1) * s;
    _cv.y += rand(-1, 1) * s;
    _cv.z += rand(-1, 1) * s * 0.5;
    camera.position.copy(_cv);
    _ct.copy(cam.target);
    _ct.x += rand(-1, 1) * s * 0.3;
    _ct.y += rand(-1, 1) * s * 0.3;
    camera.lookAt(_ct);
    shakeAmp *= Math.exp(-raw * 5.5);
    if (shakeAmp < 0.002) shakeAmp = 0;
}

/* =====================================================================
DOM UI ヘルパー
===================================================================== */
const UI = {
    hint: $('#hint'),
    power: $('#power'),
    marker: $('#power .marker'),
    bubble: $('#bubble'),
    bubbleIn: $('#bubble .in'),
    telop: $('#telop'),
    telopIn: $('#telop .in'),
    shout: $('#shout'),
    shoutIn: $('#shout .in'),
    stamp: $('#stampWrap'),
    gameover: $('#gameover'),
    flash: $('#flash'),
    result: $('#result'),
    zukan: $('#zukan'),
    title: $('#title'),
};
const restartAnim = el => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
};

function hint(text) {
    UI.hint.textContent = text;
    UI.hint.classList.toggle('show', !!text);
}

let bubbleAnchor = null;

function showBubble(text, anchorFn, cls = '') {
    UI.bubbleIn.textContent = text;
    UI.bubble.className = 'show ' + cls;
    bubbleAnchor = anchorFn;
    restartAnim(UI.bubbleIn);
    updateBubble();
}

function hideBubble() {
    UI.bubble.className = '';
    bubbleAnchor = null;
}

const _bv = V3();

function updateBubble() {
    if (!bubbleAnchor) return;
    _bv.copy(bubbleAnchor());
    _bv.project(camera);
    if (_bv.z > 1) {
        UI.bubble.style.visibility = 'hidden';
        return;
    }
    UI.bubble.style.visibility = '';
    const W = innerWidth, H = innerHeight, bw = UI.bubble.offsetWidth, bh = UI.bubble.offsetHeight;
    let x = (_bv.x * 0.5 + 0.5) * W, y = (-_bv.y * 0.5 + 0.5) * H;
    x = clamp(x - bw * 0.3, 6, Math.max(6, W - bw - 6));
    y = clamp(y - bh - 22, 50, H - bh - 10);
    UI.bubble.style.transform = `translate(${x}px,${y}px)`;
}

function telop(text, cls = '') {
    UI.telopIn.innerHTML = deco(text, cls);
    UI.telop.classList.add('show');
    restartAnim(UI.telopIn);
}

const hideTelop = () => UI.telop.classList.remove('show');

function shout(text) {
    UI.shoutIn.innerHTML = deco(text, 'fire');
    UI.shout.classList.add('show');
    restartAnim(UI.shoutIn);
}

const hideShout = () => UI.shout.classList.remove('show');
let flashA = 0, flashDecay = 2;

function flash(a = 1, dur = 0.5) {
    flashA = Math.max(flashA, a);
    flashDecay = a / dur;
}

function updateFlash(raw) {
    flashA = Math.max(0, flashA - flashDecay * raw);
    UI.flash.style.opacity = flashA.toFixed(3);
}

const showScreen = el => el.classList.add('show');
const hideScreen = el => el.classList.remove('show');

function setupPowerUI() {
    const zw = CONFIG.ZONE_WEAK * 100, zj = CONFIG.ZONE_JUST * 100, p = UI.power;
    p.querySelector('.z.weak').style.cssText = `bottom:0;height:${zw}%`;
    p.querySelector('.z.just').style.cssText = `bottom:${zw}%;height:${zj}%`;
    p.querySelector('.z.strong').style.cssText = `bottom:${zw + zj}%;height:${100 - zw - zj}%`;
    p.querySelector('.lab.weak').style.bottom = `${zw / 2}%`;
    p.querySelector('.lab.just').style.bottom = `${zw + zj / 2}%`;
    p.querySelector('.lab.strong').style.bottom = `${(zw + zj + 100) / 2}%`;
    p.querySelector('.ptitle').innerHTML = deco('パワー', 'rainbow');
}

function showPower() {
    const p = UI.power;
    p.querySelector('.lab.weak').textContent = pick('pw.weak', LINES.power.weak);
    p.querySelector('.lab.just').textContent = pick('pw.just', LINES.power.just);
    p.querySelector('.lab.strong').textContent = pick('pw.strong', LINES.power.strong);
    p.classList.add('show');
}

const hidePower = () => UI.power.classList.remove('show');
const zoneOf = g => g < CONFIG.ZONE_WEAK ? 'weak' : g < CONFIG.ZONE_WEAK + CONFIG.ZONE_JUST ? 'just' : 'strong';

function setMarker(g) {
    UI.marker.style.bottom = (g * 100) + '%';
    const z = zoneOf(g);
    for (const k of ['weak', 'just', 'strong']) UI.power.querySelector('.lab.' + k).classList.toggle('on', k === z);
}

/* =====================================================================
ステートマシン
===================================================================== */
class Timeline {
    constructor(ev) {
        this.ev = ev.slice().sort((a, b) => a[0] - b[0]);
        this.i = 0;
    }

    update(t) {
        while (this.i < this.ev.length && this.ev[this.i][0] <= t) {
            const f = this.ev[this.i++][1];
            f();
        }
    }
}

const states = {};
let state = null, st = 0, tl = null, time = 0;
let currentScene = classroom;

function go(name) {
    if (state && states[state].exit) states[state].exit();
    state = name;
    st = 0;
    tl = null;
    states[name].enter();
}

// ラウンドごとのデータ
let R = {};
let report = null, carrier = null;
let coverTex = null;

function buildReport() {
    const g = new THREE.Group();
    g.position.set(PAPER_X, 0, PAPER_Z);
    if (coverTex) coverTex.dispose();
    coverTex = makeCoverTex(pick('topic', REPORT_TOPICS));
    const side = toon(0xf4f1e6), geo = new THREE.BoxGeometry(PAPER_W, SHEET_T, PAPER_D);
    for (let i = 0; i < SHEETS; i++) {
        const top = i === SHEETS - 1;
        const face = top ? toon(0xffffff, {map: coverTex}) : toon(0xffffff, {map: plainPaperTex});
        const m = new THREE.Mesh(geo, [side, side, face, side, side, side]);
        m.position.y = SHEET_T / 2 + i * SHEET_T;
        if (!top) {
            m.rotation.y = rand(-0.07, 0.07);
            m.position.x = rand(-0.12, 0.12);
            m.position.z = rand(-0.1, 0.1);
        }
        m.castShadow = m.receiveShadow = true;
        outline(m, 0.03);
        m.userData.faceTex = face.map;
        g.add(m);
    }
    return g;
}

function resetRound() {
    for (const s of systems) s.kill();
    systems.length = 0;
    bodies.length = 0;
    for (const o of roundObjs) {
        if (o.parent) o.parent.remove(o);
        disposeDeep(o);
    }
    roundObjs = [];
    if (report) {
        if (report.parent) report.parent.remove(report);
        disposeDeep(report);
    }
    report = buildReport();
    classroom.add(report);
    carrier = report;
    outlines = outlines.filter(o => {
        let p = o;
        while (p.parent) p = p.parent;
        return p.isScene;
    });
    stapler.visible = true;
    stapler.position.set(-CONFIG.STAPLER_RANGE, CONFIG.STAPLER_HOVER_Y, TARGET.z);
    stapler.rotation.set(0, 0, 0);
    stapler.userData.body.scale.set(1, 1, 1);
    setArmOpen(0.35);
    resetTeacher();
    teacherDeskBroken = false;
    for (const h of deskHalves) {
        h.position.copy(h.userData.home);
        h.rotation.set(0, 0, 0);
        h.userData.av = 0;
    }
    targetMarker.visible = false;
    cursor.visible = false;
    schoolDome.scale.setScalar(0.01);
    japanRing.scale.setScalar(0.01);
    earth.visible = true;
    earth.position.set(0, 0, 0);
    resetCracks();
    crackMesh.material.opacity = 1;
    currentScene = classroom;
    hint('');
    hideBubble();
    hideTelop();
    hideShout();
    hidePower();
    UI.stamp.className = '';
    UI.gameover.className = '';
    hideScreen(UI.result);
    SFX.humStop();
    R = {exact: null};
}

const stAnchorV = V3(), tAnchorV = V3();
const staplerAnchor = () => stAnchorV.copy(stapler.position).add(V3(0.2, 1.7, -1.2));
const teacherAnchor = () => {
    TU.head.getWorldPosition(tAnchorV);
    return tAnchorV.add(V3(1.3, 1.9, 0));
};
const surfaceAt = (x, z) => (Math.abs(x - PAPER_X) <= PAPER_W / 2 && Math.abs(z - PAPER_Z) <= PAPER_D / 2) ? PAPER_TOP : 0;

/* ---------- 判定 ---------- */
function judge(px, pz, g) {
    const onPaper = Math.abs(px - PAPER_X) <= PAPER_W / 2 && Math.abs(pz - PAPER_Z) <= PAPER_D / 2;
    const dist = Math.hypot(px - TARGET.x, pz - TARGET.z);
    const zone = zoneOf(g), Rr = CONFIG.TARGET_RADIUS, ZW = CONFIG.ZONE_WEAK, ZJ = CONFIG.ZONE_JUST;
    let posPen;
    if (dist <= Rr * 0.2) posPen = 0; else if (dist <= Rr) posPen = (dist - Rr * 0.2) / (Rr * 0.8) * 15; else posPen = 15 + (dist - Rr) * 40;
    const powPen = zone === 'just' ? Math.abs(g - (ZW + ZJ / 2)) / (ZJ / 2) * 5 : 0;
    let score = clamp(Math.round(100 - posPen - powPen), 0, 100), type;
    if (zone === 'weak') {
        type = 'weak';
        score = Math.round(g / ZW * 30);
    } else if (!onPaper) {
        type = 'place';
        score = 0;
    } else if (zone === 'strong') {
        type = 'strong';
        score = Math.max(0, Math.round((1 - g) / (1 - ZW - ZJ) * 30));
    } else if (score < CONFIG.FAIL_SCORE) type = 'place'; else type = 'success';
    return {type, onPaper, dist, zone, score};
}

/* ---------- 芯 ---------- */
function makeStaple() {
    const g = new THREE.Group(), m = toon(0xdfe5ef);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.78), m);
    crown.position.y = 0.025;
    outline(crown, 0.015);
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), m);
    l1.position.set(0, -0.16, 0.35);
    const l2 = l1.clone();
    l2.position.z = -0.35;
    g.add(crown, l1, l2);
    g.userData.legs = [l1, l2];
    g.traverse(o => {
        if (o.isMesh) o.castShadow = true;
    });
    return g;
}

function embedStaple(pos, parent) {
    const s = makeStaple();
    s.position.copy(pos);
    s.rotation.y = rand(-0.08, 0.08);
    classroom.add(s);
    if (parent && parent !== classroom) parent.attach(s);
    roundObjs.push(s);
    return s;
}

function spawnBentStaple(pos, violent) {
    const s = makeStaple();
    const [l1, l2] = s.userData.legs;
    l1.rotation.x = 1.1;
    l1.position.set(0, -0.08, 0.42);
    l2.rotation.x = -0.6;
    l2.position.set(0.05, -0.12, -0.3);
    l2.rotation.z = 0.5;
    s.position.copy(pos).add(V3(0, 0.45, 0.15));
    s.rotation.set(rand(0, 1), rand(0, 6), rand(0, 1));
    classroom.add(s);
    roundObjs.push(s);
    const b = addBody(s, violent ? V3(rand(-4, 4), rand(6, 10), rand(-4, 4)) : V3(rand(-.6, .6), 1.4, rand(.4, 1.2)), violent ? V3(rand(-15, 15), rand(-15, 15), rand(-15, 15)) : V3(rand(-5, 5), rand(-3, 3), rand(-5, 5)), {
        r: 0.06, bounce: 0.45
    });
    b.followReport = !violent;
    return s;
}

/* ---------- 机のヒビ ---------- */
function deskCrack(x, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({
        map: deskCrackTex, transparent: true, depthWrite: false
    }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rand(0, 6);
    m.position.set(x, 0.008, z);
    m.scale.setScalar(0.2);
    classroom.add(m);
    roundObjs.push(m);
    let t = 0;
    systems.push({
        update(dt) {
            t += dt;
            m.scale.setScalar(lerp(0.2, 1, Ease.out(clamp(t / 0.25))));
            return t < 0.3;
        }, kill() {
        }
    });
}

/* ---------- レポート粉砕 ---------- */
function shatter(hit) {
    report.visible = false;
    R.shattered = true;
    R.paperBodies = [];
    const cols = save.light ? 4 : 6, rows = save.light ? 5 : 8;
    report.children.forEach((sheet, si) => {
        if (!sheet.isMesh) return;
        const tex = sheet.userData.faceTex, cw = PAPER_W / cols, ch = PAPER_D / rows;
        const mat = new THREE.MeshLambertMaterial({map: tex, side: THREE.DoubleSide});
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (si < SHEETS - 2 && Math.random() < 0.5) continue;
            const geo = new THREE.PlaneGeometry(cw * rand(.85, 1.05), ch * rand(.85, 1.05));
            const uv = geo.attributes.uv, u0 = c / cols, u1 = (c + 1) / cols, v0 = 1 - (r + 1) / rows,
                v1 = 1 - r / rows;
            for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
            const m = new THREE.Mesh(geo, mat);
            m.castShadow = true;
            m.position.set(PAPER_X - PAPER_W / 2 + (c + .5) * cw, sheet.position.y + 0.01, PAPER_Z - PAPER_D / 2 + (r + .5) * ch);
            m.rotation.set(-Math.PI / 2, 0, 0);
            classroom.add(m);
            roundObjs.push(m);
            const d = V3(m.position.x - hit.x, 0, m.position.z - hit.z);
            if (d.lengthSq() < 1e-4) d.set(rand(-1, 1), 0, rand(-1, 1));
            d.normalize();
            const v = d.multiplyScalar(rand(2.5, 9));
            v.y = rand(4, 12);
            R.paperBodies.push(addBody(m, v, V3(rand(-14, 14), rand(-14, 14), rand(-14, 14)), {
                paper: true, drag: 1.2, g: -16, r: 0.02 + rand(0, 0.04), bounce: 0.2
            }));
        }
    });
}

/* ---------- 打撃の瞬間 ---------- */
const PLACE_PAPER_LINES = LINES.hit.place.filter(s => !/[机床]/.test(s));
const PLACE_DESK_LINES = LINES.hit.place.filter(s => /[机床]/.test(s));

function impact() {
    const o = R.out, x = R.px, z = R.pz, hit = V3(x, R.surf, z);
    hidePower();
    stapler.userData.body.scale.set(1.25, 0.7, 1.1);
    if (o.zone === 'weak') {
        SFX.kasu();
        spawnBentStaple(hit, false);
        shake(0.06);
        telop(pick('hit.weak', LINES.hit.weak), 'sad');
        return;
    }
    if (!o.onPaper) {
        SFX.gashan();
        SFX.thud();
        embedStaple(V3(x, 0, z), null);
        burst(classroom, hit, {
            n: save.light ? 30 : 80,
            colors: [0xb98a4a, 0xffe08a],
            speed: [1, 4],
            up: 2,
            size: 0.25,
            life: 0.9,
            gravity: -8,
            additive: false
        });
        if (o.zone === 'strong') {
            deskCrack(x, z);
            SFX.crack();
            shake(0.9);
            hitstop(0.1);
        } else shake(0.35);
        telop(pick('hit.desk', PLACE_DESK_LINES), 'bad');
        SFX.buzzer(0.45);
        return;
    }
    if (o.zone === 'strong') {
        SFX.biri();
        SFX.crack();
        shatter(hit);
        deskCrack(x, z);
        spawnBentStaple(hit, true);
        shake(1.3);
        hitstop(0.12);
        flash(0.5, 0.4);
        burst(classroom, hit, {
            n: save.light ? 40 : 120,
            colors: [0xffffff, 0xfff0b0],
            speed: [3, 10],
            up: 1.5,
            size: 0.3,
            life: 0.8,
            gravity: -10,
            additive: false
        });
        telop(pick('hit.strong', LINES.hit.strong), 'rainbow');
        return;
    }
    SFX.gashan();
    embedStaple(V3(x, PAPER_TOP, z), report);
    hitstop(0.08);
    if (o.type === 'success') {
        shake(0.4);
        confetti(classroom, hit.clone().add(V3(0, 0.3, 0)), save.light ? 40 : 100, 3.5, 8, 0);
        telop(pick('hit.just', LINES.hit.just), 'rainbow');
    } else {
        shake(0.3);
        telop(pick('hit.paper', PLACE_PAPER_LINES), 'bad');
        SFX.buzzer(0.45);
    }
}

/* ---------- 称号 ---------- */
const specialName = id => TITLES.special.find(s => s.id === id).name;

function finalizeRound() {
    const o = R.out, ok = o.type === 'success';
    save.plays++;
    if (ok) {
        save.successStreak++;
        save.failStreak = 0;
    } else {
        save.earths++;
        save.failStreak++;
        save.successStreak = 0;
    }
    save.best = Math.max(save.best, o.score);
    let normal;
    if (ok) {
        const s = o.score, T = TITLES.success;
        const key = s >= 100 ? 's100' : s >= 90 ? 's90' : s >= 70 ? 's70' : 's50';
        normal = pick('t.' + key, T[key]);
    } else normal = pick('t.' + o.type, TITLES.fail[o.type]);
    const sp = [];
    if (!ok && save.earths === 100) sp.push('galaxy');
    if (!ok && save.earths === 10) sp.push('planet');
    if (!ok && save.failStreak === 3) sp.push('enemy');
    if (ok && save.successStreak === 3) sp.push('soulmate');
    if (ok && save.plays === 1) sp.push('genius');
    if (R.exact === 'max') sp.push('limit');
    if (R.exact === 'min') sp.push('mu');
    const specials = TITLES.special.filter(s => sp.includes(s.id)).map(s => s.name); // 優先度順
    const got = [normal, ...specials];
    const fresh = got.filter(t => !save.titles.includes(t));
    save.titles.push(...fresh);
    R.titles = {main: specials[0] || normal, normal, specials, fresh, isSpecial: specials.length > 0};
    writeSave();
}

/* =====================================================================
0. タイトル画面
===================================================================== */
function updateTitleStats() {
    $('#titleStats').innerHTML = `ベストスコア <b>${save.best}</b>点　／　累計破壊した地球の数 <b>${save.earths}</b>個<br>プレイ回数 ${save.plays}回　／　称号 ${save.titles.length}/${allTitleCount()}`;
}

states.title = {
    guard: 0.3, enter() {
        resetRound();
        showScreen(UI.title);
        $('#catch').textContent = pick('catch', LINES.catch);
        R.catchT = 0;
        updateTitleStats();
        setFace('neutral');
    }, update(dt) {
        const a = Math.sin(time * 0.22) * 0.75;
        setCam(V3(Math.sin(a) * 19, 9, Math.cos(a) * 19 - 4), V3(0, 2, -6));
        stapler.position.set(Math.sin(time * 0.9) * 3.2, CONFIG.STAPLER_HOVER_Y + Math.sin(time * 2.2) * 0.35, TARGET.z + 1);
        stapler.rotation.z = Math.cos(time * 0.9) * 0.15;
        setArmOpen(0.35 + Math.sin(time * 3) * 0.2);
        R.catchT += dt;
        if (R.catchT > 4.5) {
            R.catchT = 0;
            $('#catch').textContent = pick('catch', LINES.catch);
            restartAnim($('#catch'));
        }
    }, press() {
        SFX.start();
        hideScreen(UI.title);
        go('aim');
    },
};

/* =====================================================================
1. 位置決めフェーズ
===================================================================== */
const AIM_P = V3(0, 10.5, 8.8), AIM_T = V3(0, 0, -0.9);
states.aim = {
    enter() {
        R.dir = 1;
        R.sx = -CONFIG.STAPLER_RANGE;
        R.hop = 1;
        R.mumbleT = 0;
        stapler.visible = true;
        stapler.rotation.set(0, 0, 0);
        targetMarker.visible = true;
        cursor.visible = true;
        camTo(AIM_P, AIM_T, 0.9);
        hint('クリック / スペース / タップで ホッチキスを止めろ！');
        showBubble(pick('aim', LINES.aim), staplerAnchor);
        SFX.mumble();
    }, update(dt) {
        const sp = CONFIG.STAPLER_SPEED * (1 + (speedMult() - 1) * CONFIG.STAPLER_SPEEDUP_RATIO);
        R.sx += R.dir * sp * dt;
        if (Math.abs(R.sx) > CONFIG.STAPLER_RANGE) {
            R.sx = Math.sign(R.sx) * CONFIG.STAPLER_RANGE;
            R.dir *= -1;
            R.hop = 0;
            SFX.boing();
        }
        R.hop += dt;
        const hk = R.hop < 0.28 ? Math.sin(R.hop / 0.28 * Math.PI) : 0;    // 端でちょっと跳ねる
        const z = TARGET.z + Math.sin(time * 1.9) * CONFIG.STAPLER_Z_WOBBLE;
        stapler.position.set(R.sx, CONFIG.STAPLER_HOVER_Y + hk * 0.75 + Math.sin(time * 7) * 0.05, z);
        stapler.rotation.z = R.dir * 0.1 * (1 - hk);
        stapler.userData.body.scale.set(1 + 0.22 * hk, 1 - 0.22 * hk, 1);
        setArmOpen(0.3 + Math.sin(time * 5) * 0.08);
        cursor.position.set(R.sx, surfaceAt(R.sx, z) + 0.015, z);
        targetMarker.material.opacity = 0.55 + Math.sin(time * 6) * 0.35;
        R.mumbleT += dt;
        if (R.mumbleT > 2.3) {
            R.mumbleT = 0;
            showBubble(pick('aim', LINES.aim), staplerAnchor);
            SFX.mumble();
        }
    }, press() {
        R.px = stapler.position.x;
        R.pz = stapler.position.z;
        SFX.stop();
        go('power');
    },
};

/* =====================================================================
2. 威力決めフェーズ
===================================================================== */
states.power = {
    enter() {
        R.phase = 0;
        R.g = 0;
        showPower();
        setMarker(0);
        hint('もう一回押して 威力を決めろ！');
        hideBubble();
        SFX.humStart();
        stapler.userData.body.scale.set(1, 1, 1);
        stapler.rotation.z = 0;
    }, update(dt) {
        R.phase += dt * CONFIG.GAUGE_SPEED * speedMult();
        const p = R.phase % 2;
        R.g = p < 1 ? p : 2 - p;
        const g = R.g;
        setMarker(g);
        stapler.position.set(R.px + rand(-1, 1) * 0.05 * g, CONFIG.STAPLER_HOVER_Y + g * 0.9, R.pz + rand(-1, 1) * 0.05 * g);
        setArmOpen(0.3 + g * 0.6);
        cursor.position.set(R.px, surfaceAt(R.px, R.pz) + 0.015, R.pz);
        SFX.humSet(170 + g * 720);
    }, press() {
        const e = CONFIG.EXACT_EPS;
        R.exact = R.g >= 1 - e ? 'max' : R.g <= e ? 'min' : null;
        SFX.humStop();
        go('strike');
    }, exit() {
        SFX.humStop();
    },
};

/* =====================================================================
3. 打撃フェーズ
===================================================================== */
states.strike = {
    enter() {
        hint('');
        cursor.visible = false;
        targetMarker.visible = false;
        R.out = judge(R.px, R.pz, R.g);
        R.startY = stapler.position.y;
        R.surf = R.out.onPaper ? PAPER_TOP : 0;
        R.slamStart = 0.28;
        R.slamEnd = R.slamStart + (R.out.zone === 'weak' ? 0.22 : R.out.zone === 'strong' ? 0.06 : 0.1);
        camTo(V3(R.px * 0.4 + 2.2, 7, R.pz + 7.2), V3(R.px, 0.3, R.pz), 0.35, Ease.out);
        SFX.whoosh();
        tl = new Timeline([[R.slamEnd, impact], [2.8, () => go('submit')]]);
    }, update(dt) {
        const t = st, B = stapler.userData.body;
        if (t < R.slamStart) {
            const k = Ease.out(t / R.slamStart);
            stapler.position.y = R.startY + k * 1.3;
            setArmOpen(lerp(0.3 + R.g * 0.6, 0.95, k));
        } else if (t < R.slamEnd) {
            const k = Ease.in((t - R.slamStart) / (R.slamEnd - R.slamStart));
            stapler.position.y = lerp(R.startY + 1.3, R.surf, k);
            setArmOpen(lerp(0.95, 0, k));
        } else {
            const tt = t - R.slamEnd;
            B.scale.x = lerp(B.scale.x, 1, 0.2);
            B.scale.y = lerp(B.scale.y, 1, 0.2);
            B.scale.z = lerp(B.scale.z, 1, 0.2);
            if (R.out.zone === 'weak') {
                stapler.rotation.x = lerp(stapler.rotation.x, 0.12, 0.1);
                setArmOpen(0.2);
            }
            if (tt > 0.6) {
                const k = Ease.in(clamp((tt - 0.6) / 0.9));
                stapler.position.y = R.surf + k * 18;
                stapler.rotation.y += dt * k * 14;
            }
        }
    },
};

/* =====================================================================
4. 提出フェーズ（カメラぐるっと → 教卓へスライド → タメ）
===================================================================== */
const THINK_P0 = V3(9, 7, -3), THINK_P1 = V3(4.5, 6.6, -6.8), THINK_T = V3(0, 3.8, -14.5);
states.submit = {
    enter() {
        stapler.visible = false;
        R.curve = new THREE.CatmullRomCurve3([cam.pos.clone(), V3(11, 9.5, 3.5), V3(12.5, 7.5, -2.5), THINK_P0]);
        R.camT0 = cam.target.clone();
        camTween = null;
        // 粉砕時は紙片を集めて山にする
        if (R.shattered) {
            R.pile = new THREE.Group();
            R.pile.position.set(PAPER_X, 0, PAPER_Z);
            classroom.add(R.pile);
            roundObjs.push(R.pile);
            R.gather = R.paperBodies.map(b => {
                b.frozen = true;
                return {
                    b,
                    from: b.obj.position.clone(),
                    fx: b.obj.rotation.x,
                    fy: b.obj.rotation.y,
                    to: V3(rand(-1.7, 1.7), rand(0.04, 0.95), rand(-1.7, 1.7))
                };
            });
            R.gathered = false;
            carrier = R.pile;
        } else {
            for (const b of bodies) if (b.followReport && surfaceAt(b.obj.position.x, b.obj.position.z) > 0) {
                b.frozen = true;
                report.attach(b.obj);
            }
            carrier = report;
        }
        R.cStart = carrier.position.clone();
        SFX.whoosh(true);
        tl = new Timeline([[0.6, hideTelop], [2.5, () => {
            SFX.pon();
            shake(0.15);
        }], [2.7, () => {
            setFace('think');
            showBubble(pick('judging', LINES.judging), teacherAnchor);
            SFX.drumroll(2.5);
        }], [3.9, () => {
            showBubble(pick('judging', LINES.judging), teacherAnchor);
            TU.glint.material.opacity = 1;
            SFX.kirin();
        }], [5.2, () => {
            SFX.crash();
            hideBubble();
            go(R.out.type === 'success' ? 'success' : 'fail');
        }],]);
    }, update(dt) {
        // カメラ（映画並みに大げさに回り込む）
        if (st < 2.4) {
            const k = Ease.inOut(clamp(st / 2.4));
            cam.pos.copy(R.curve.getPoint(k));
            cam.target.lerpVectors(R.camT0, THINK_T, k);
        } else {
            const k = Ease.inOut(clamp((st - 2.4) / 2.8));
            cam.pos.lerpVectors(THINK_P0, THINK_P1, k);
            cam.target.copy(THINK_T);
        }
        // 紙片を集める
        if (R.shattered && !R.gathered) {
            const k = Ease.inOut(clamp(st / 0.55));
            for (const q of R.gather) {
                q.b.obj.position.lerpVectors(q.from, q.to, k);
                q.b.obj.rotation.x = lerp(q.fx, -Math.PI / 2, k);
                q.b.obj.rotation.y = lerp(q.fy, 0, k);
            }
            if (st >= 0.55) {
                R.gathered = true;
                for (const q of R.gather) R.pile.attach(q.b.obj);
            }
        }
        // 教卓へ運ぶ
        const ks = clamp((st - 0.6) / 1.9), e = Ease.inOut(ks);
        carrier.position.set(lerp(R.cStart.x, 0, e), Math.sin(ks * Math.PI) * 2.6, lerp(R.cStart.z, TDESK.z, e));
        carrier.rotation.y = lerp(0, Math.PI / 2, e) + Math.sin(ks * Math.PI) * 0.4;
        // 先生がじっくり見る
        if (st > 2.7) {
            teacher.rotation.x = lerp(teacher.rotation.x, 0.12, 0.05);
            TU.head.rotation.y = Math.sin((st - 2.7) * 1.6) * 0.25;
            TU.head.rotation.x = 0.25;
        }
        TU.glint.material.opacity = Math.max(0, TU.glint.material.opacity - dt * 2);
    },
};

/* =====================================================================
5-A. 採点・成功演出
===================================================================== */
const SUCC_P = V3(0, 6.2, -1.5), SUCC_T = V3(0, 5, -15.5);

function stampDrop() {
    if (!UI.stamp.dataset.drawn) {
        drawSeal($('#stampCanvas').getContext('2d'), 512);
        UI.stamp.dataset.drawn = 1;
    }
    UI.stamp.className = 'show drop';
    restartAnim(UI.stamp);
}

function addStampDecal() {
    if (!sealTex) sealTex = canvasTex(512, 512, (g) => drawSeal(g, 512));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({
        map: sealTex, transparent: true, depthWrite: false
    }));
    m.rotation.set(-Math.PI / 2, 0, -0.3);
    carrier.add(m);
    m.position.set(0, R.shattered ? 1.0 : PAPER_TOP + 0.06, 0);
    roundObjs.push(m);
}

states.success = {
    enter() {
        finalizeRound();
        setFace('happy');
        SFX.pon();
        TU.head.rotation.set(0, 0, 0);
        showBubble(pick('success', LINES.success), teacherAnchor, 'big');
        camTo(SUCC_P, SUCC_T, 1.1);
        R.thumbT = -1;
        tl = new Timeline([[0.55, stampDrop], [0.9, () => {
            SFX.don();
            shake(1.5);
            flash(0.55, 0.5);
            addStampDecal();
        }], [1.4, () => {
            R.thumbT = 0;
            SFX.fanfare();
            confetti(classroom, V3(0, 15, -12), save.light ? 80 : 220, 9, 2);
        }], [4.8, () => go('result')],]);
    }, update(dt) {
        teacher.rotation.x = lerp(teacher.rotation.x, 0, 0.1);
        teacher.position.y = TEACHER_POS.y + Math.abs(Math.sin(st * 5)) * 0.3;
        if (R.thumbT >= 0) {
            R.thumbT += dt;
            const k = clamp(R.thumbT / 0.4);
            TU.arms[1].rotation.x = lerp(0, -2.2, Ease.back(k));
            TU.arms[1].rotation.z = lerp(0, 0.25, k);
            TU.thumb.scale.setScalar(Math.max(0.001, Ease.back(k)));
            TU.halo.material.opacity = 0.9 * clamp(R.thumbT / 0.8);
            TU.halo.rotation.z += dt * 0.7;
            TU.halo.scale.setScalar(1 + Math.sin(st * 4) * 0.05);
        }
    },
};

/* =====================================================================
5-B. 採点・失敗演出（全力）
===================================================================== */
const FACE_P = V3(1.2, 7.8, -10), FACE_T = V3(0, 7.3, -17);
const FIST_P = V3(7, 5, -4), FIST_T = V3(0, 2, -13);

function smash() {
    teacherDeskBroken = true;
    for (const h of deskHalves) h.userData.av = h.userData.side * -2.5;
    SFX.crack();
    SFX.dokan(false);
    shake(2.2);
    flash(0.8, 0.5);
    hitstop(0.12);
    const o = V3(0.8, 0.3, TDESK.z);
    burst(classroom, o, {
        n: save.light ? 60 : 180,
        colors: [0x9c5a2b, 0xffd28a, 0xffffff],
        speed: [4, 16],
        up: 1.2,
        size: 0.45,
        life: 1.4,
        gravity: -12,
        additive: false
    });
    const cnt = save.light ? 10 : 26, mat = toon(0x9c5a2b);
    for (let i = 0; i < cnt; i++) {
        const s = rand(0.2, 0.6),
            m = new THREE.Mesh(new THREE.BoxGeometry(s, s * rand(.5, 1.5), s * rand(.5, 1.5)), mat);
        m.position.set(rand(-1.2, 1.2), rand(-0.5, 0.3), TDESK.z + rand(-1.5, 1.5));
        classroom.add(m);
        roundObjs.push(m);
        addBody(m, V3(rand(-9, 9), rand(6, 16), rand(-2, 10)), V3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), {
            r: s * 0.4, bounce: 0.35
        });
    }
    // レポートも吹っ飛ぶ
    addBody(carrier, V3(rand(-3, 3), 16, 9), V3(rand(-4, 4), rand(-6, 6), rand(-4, 4)), {noGround: true, g: -14});
}

function steam() {
    TU.head.getWorldPosition(tAnchorV);
    burst(classroom, tAnchorV.clone().add(V3(rand(-.6, .6), 1.6, 0)), {
        n: 4,
        colors: [0xffffff],
        speed: [1.5, 3.5],
        up: 3,
        size: 1.4,
        life: 1.0,
        gravity: 3,
        drag: 1.5,
        additive: false,
        grow: 1.5
    });
}

function toSchool() {
    currentScene = school;
    R.scn = 'school';
    R.scnT = st;
    flash(0.6, 0.3);
    SFX.whoosh(true);
    schoolDome.scale.setScalar(1);
    schoolDome.material.opacity = 0.7;
    setCam(V3(0, 7, 34), V3(0, 6, 0));
    camTo(V3(0, 220, 520), V3(0, 0, 0), 1.4, Ease.in);
}

function toJapan() {
    currentScene = japan;
    R.scn = 'japan';
    R.scnT = st;
    flash(0.6, 0.3);
    SFX.whoosh(true);
    japanRing.scale.setScalar(0.3);
    setCam(V3(JAPAN_PT.x, 6, JAPAN_PT.z + 3), V3(JAPAN_PT.x, 0, JAPAN_PT.z));
    camTo(V3(0, 100, 60), V3(0, 0, 0), 1.4, Ease.in);
}

function toSpace() {
    currentScene = space;
    R.scn = 'space';
    R.scnT = st;
    flash(0.6, 0.3);
    SFX.rumble(2.5);
    earth.visible = true;
    resetCracks();
    setCam(V3(0, 0, 8.2), V3(0, 0, 0));
    camTo(V3(0, 0, 24), V3(0, 0, 0), 2.3, Ease.out);
}

function earthExplode() {
    earth.visible = false;
    flash(1, 1.4);
    SFX.dokan(true);
    shake(1.8);
    R.scn = 'boom';
    const n = save.light ? 900 : 2800;
    burst(space, V3(0, 0, 0), {
        n,
        colors: [0xffffff, 0xfff066, 0xff9a00, 0xff3d00],
        speed: [6, 45],
        size: 0.9,
        life: 3.2,
        gravity: 0,
        drag: 0.9,
        spread: 2
    });
    burst(space, V3(0, 0, 0), {
        n: Math.floor(n / 3), colors: [0xffffff, 0x9fe8ff], speed: [20, 60], size: 0.5, life: 2.2, gravity: 0, drag: 0.4
    });
    ringWave(space, V3(0, 0, 0), {speed: 30, life: 2.0, color: 0xfff2a0, flat: false});
    ringWave(space, V3(0, 0, 0), {speed: 22, life: 2.4, color: 0xff8a40, flat: true});
    const cols = [0x3fc25a, 0x2f86ff, 0x8a5a2a, 0xc9b25a];
    for (let i = 0; i < (save.light ? 18 : 42); i++) {
        const d = V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), s = rand(0.4, 1.4);
        const m = new THREE.Mesh(flatGeo(new THREE.IcosahedronGeometry(s, 0)), i % 5 === 0 ? new THREE.MeshBasicMaterial({color: 0xff6a00}) : toon(cols[i % 4]));
        m.position.copy(d).multiplyScalar(rand(0.5, 4));
        space.add(m);
        roundObjs.push(m);
        addBody(m, d.multiplyScalar(rand(2, 7)), V3(rand(-2, 2), rand(-2, 2), rand(-2, 2)), {
            noGround: true, g: 0, drag: 0.25
        });
    }
}

function teacherInSpace() {
    space.add(teacher);
    teacher.position.set(0, -2.6, 0);
    teacher.rotation.set(0, 0, 0);
    teacher.scale.setScalar(0.001);
    TU.headMat.color.copy(SKIN);
    setFace('smug');
    TU.head.rotation.set(0, 0, 0);
    TU.halo.visible = false;
    TU.thumb.scale.setScalar(0.001);
    TU.arms[0].rotation.set(-1.4, 0, 0.9);
    TU.arms[1].rotation.set(-1.4, 0, -0.9);
    R.tsT = 0;
}

function showGameOver() {
    UI.gameover.querySelector('.go1').innerHTML = deco('GAME OVER');
    UI.gameover.querySelector('.go2').innerHTML = deco('〜地球は滅亡しました〜', 'rainbow');
    UI.gameover.querySelector('.go3').textContent = pick('earth', LINES.earth.filter(s => s !== '〜地球は滅亡しました〜'));
    UI.gameover.className = 'show';
    SFX.gameover();
}

states.fail = {
    enter() {
        finalizeRound();
        const reason = R.out.type;
        let lines = LINES.fail[reason];
        if (reason === 'place') lines = R.out.onPaper ? lines.filter(s => !s.includes('机')) : lines;
        setFace('angry');
        TU.head.rotation.set(0, 0, 0);
        showBubble(pick('fail.' + reason, lines), teacherAnchor, 'big angry');
        SFX.rumble(2.4);
        SFX.angry();
        camTo(FACE_P, FACE_T, 2.3);
        R.scn = 'class';
        R.steamT = 0;
        R.armA = 0;
        R.lean = 0.12;
        tl = new Timeline([[2.4, () => {
            hideBubble();
            setFace('rage');
            shout(pick('fail.common', LINES.fail.common));
            SFX.scream(1.5);
            shake(0.6);
        }], [3.9, () => {
            hideShout();
            camTo(FIST_P, FIST_T, 0.45, Ease.out);
        }], [4.62, smash], [4.85, () => {
            ringWave(classroom, V3(0, 0.2, TDESK.z), {speed: 55, life: 1.3});
            ringWave(classroom, V3(0, 4, TDESK.z), {speed: 45, life: 1.3, flat: false});
            SFX.whoosh(true);
            camTo(V3(0, 22, 70), V3(0, 0, -12), 1.25, Ease.in);
        }], [6.1, toSchool], [7.5, toJapan], [8.9, toSpace], [11.3, earthExplode], [12.0, teacherInSpace], [12.7, showGameOver], [16.2, () => go('result')],]);
    }, update(dt) {
        const t = st;
        // 1. 顔がみるみる赤く・湯気・ブルブル
        if (t < 6.1) {
            const anger = clamp(t / 2.4);
            TU.headMat.color.lerpColors(SKIN, ANGRY, anger);
            if (!teacherDeskBroken) teacher.position.set(TEACHER_POS.x + rand(-1, 1) * anger * 0.18, TEACHER_POS.y + rand(-1, 1) * anger * 0.06, TEACHER_POS.z);
            R.steamT += dt;
            if (anger > 0.25 && R.steamT > 0.07) {
                R.steamT = 0;
                steam();
            }
            if (t > 2.4 && t < 3.9) shake(0.25);
        }
        // 3. 拳を振り上げて振り下ろす
        if (t >= 3.9 && t < 4.5) {
            const k = Ease.out((t - 3.9) / 0.6);
            R.armA = lerp(0, -2.9, k);
            R.lean = lerp(0.12, -0.15, k);
        } else if (t >= 4.5 && t < 4.62) {
            const k = Ease.in((t - 4.5) / 0.12);
            R.armA = lerp(-2.9, -0.7, k);
            R.lean = lerp(-0.15, 0.3, k);
        }
        if (currentScene === classroom) {
            TU.arms[1].rotation.x = R.armA;
            teacher.rotation.x = R.lean;
        }
        // 机が真っ二つ
        if (teacherDeskBroken) for (const h of deskHalves) {
            const u = h.userData;
            u.av += u.side * -9 * dt;
            h.rotation.z += u.av * dt;
            if (Math.abs(h.rotation.z) > 1.52) {
                h.rotation.z = Math.sign(h.rotation.z) * 1.52;
                u.av *= -0.25;
            }
        }
        // 4〜5. 校舎 → 日本 → 地球
        if (R.scn === 'school') {
            const k = t - R.scnT;
            schoolDome.scale.setScalar(1 + k * k * 140);
            schoolDome.material.opacity = 0.7 * clamp(1 - k / 1.6);
        }
        if (R.scn === 'japan') {
            const k = t - R.scnT;
            japanRing.scale.setScalar(0.3 + k * k * 40);
            japanRing.material.opacity = 0.9 * clamp(1 - k / 1.6);
        }
        if (R.scn === 'space') {
            const k = clamp((t - R.scnT) / 2.3);
            drawCracks(k);
            earth.position.set(rand(-1, 1) * k * 0.12, rand(-1, 1) * k * 0.12, 0);
            crackMesh.material.opacity = 0.75 + Math.sin(t * 30) * 0.25 * k;
            shake(0.05 + k * 0.25);
        }
        // 6. 宇宙空間で腕組みの先生
        if (R.tsT !== undefined && R.tsT >= 0 && teacher.parent === space) {
            R.tsT += dt;
            teacher.scale.setScalar(Math.max(0.001, 0.55 * Ease.back(clamp(R.tsT / 0.8))));
            teacher.rotation.y = Math.sin(R.tsT * 0.5) * 0.5;
            teacher.position.y = -2.6 + Math.sin(R.tsT * 1.3) * 0.3;
            cam.pos.lerp(V3(0, 2, 22), 0.01);
        }
    },
};

/* =====================================================================
6. リザルト画面
===================================================================== */
function buildResult() {
    const o = R.out, ok = o.type === 'success', T = R.titles;
    const head = ok ? deco('受理！！', 'rainbow') : deco('GAME OVER', 'fire');
    const tsub = T.isSpecial ? `<div class="tsub">（通常称号：${esc(T.normal)}${T.specials.length > 1 ? '　／　他：' + esc(T.specials.slice(1).join('、')) : ''}）</div>` : '';
    const fresh = T.fresh.length ? `<div class="newt">NEW！ 称号獲得：${esc(T.fresh.join('、'))}</div>` : '';
    const info = ok ? `レポートは無事受理されました。地球は今日も平和です。<br>ベスト ${save.best}点 ／ 累計破壊した地球 ${save.earths}個` : `失敗理由：<b>${REASON_LABEL[o.type]}</b>　／　地球：滅亡（累計 <b>${save.earths}</b>個目）<br>ベスト ${save.best}点 ／ 連続破壊 ${save.failStreak}回`;
    UI.result.innerHTML = `
    <div class="rhead">${head}</div>
    <div class="score">ホッチキス力 <b>${o.score}</b>点</div>
    <div class="tl">— 称号 —</div>
    <div class="tmain">${deco('『' + T.main + '』', T.isSpecial ? 'rainbow' : '')}</div>
    ${tsub}${fresh}
    <div class="info">${info}</div>
    <div class="btnRow">
      <button class="btn" id="btnRetry">もう一回</button>
      <button class="btn black" id="btnShare">Xでシェア</button>
      <button class="btn cyan" id="btnToTitle">タイトルへ</button>
    </div>`;
    $('#btnRetry').onclick = e => {
        e.currentTarget.blur();
        retry();
    };
    $('#btnToTitle').onclick = e => {
        e.currentTarget.blur();
        SFX.click();
        go('title');
    };
    $('#btnShare').onclick = e => {
        e.currentTarget.blur();
        share();
    };
}

function share() {
    const o = R.out, T = R.titles, tag = '#ホッチキスザファイナル';
    const text = o.type === 'success' ? `ホッチキス力${o.score}点でレポートが受理されました。称号『${T.main}』を獲得しました。地球は無事です。${tag}` : `ホッチキスを止めたら地球が爆発しました。（累計${save.earths}個目）称号『${T.main}』を獲得しました。${tag}`;
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

function retry() {
    hideScreen(UI.result);
    SFX.click();
    resetRound();
    setCam(V3(0, 15, 15), V3(0, 0, -2));
    go('aim');
}

states.result = {
    guard: 1.0, enter() {
        hideBubble();
        hint('');
        buildResult();
        showScreen(UI.result);
        if (UI.gameover.classList.contains('show')) UI.gameover.classList.add('dim');
        if (UI.stamp.classList.contains('show')) UI.stamp.classList.add('dim');
    }, update(dt) {
        if (teacher.parent === space) {
            teacher.rotation.y += dt * 0.3;
        }
    }, press() {
        retry();
    },
};

/* =====================================================================
称号図鑑
===================================================================== */
function titleGroups() {
    const S = TITLES.success, F = TITLES.fail;
    return [{name: '成功：100点', list: S.s100}, {name: '成功：90〜99点', list: S.s90}, {
        name: '成功：70〜89点', list: S.s70
    }, {name: '成功：50〜69点', list: S.s50}, {name: '失敗：弱すぎ', list: F.weak}, {
        name: '失敗：強すぎ', list: F.strong
    }, {
        name: '失敗：場所ズレ', list: F.place
    }, {name: '特殊称号', list: TITLES.special.map(s => s.name), conds: TITLES.special.map(s => s.cond)},];
}

function allTitleCount() {
    return titleGroups().reduce((a, g) => a + g.list.length, 0);
}

let zukanOpen = false;

function openZukan() {
    zukanOpen = true;
    SFX.init();
    SFX.click();
    let got = 0;
    const html = titleGroups().map(g => `<div class="grp">${esc(g.name)}</div><div class="grid">` + g.list.map((t, i) => {
        const has = save.titles.includes(t);
        if (has) got++;
        return `<div class="it ${has ? '' : 'no'}">${has ? esc(t) : '？？？'}${has && g.conds ? `<span class="c">${esc(g.conds[i])}</span>` : ''}</div>`;
    }).join('') + `</div>`).join('');
    UI.zukan.innerHTML = `<h2>${deco('称号図鑑', 'rainbow')}</h2><div class="cnt">獲得 ${got} / ${allTitleCount()}</div>${html}
    <div class="btnRow" style="margin-top:16px"><button class="btn" id="btnZClose">とじる</button></div>`;
    $('#btnZClose').onclick = e => {
        e.currentTarget.blur();
        closeZukan();
    };
    showScreen(UI.zukan);
}

function closeZukan() {
    SFX.click();
    hideScreen(UI.zukan);
    setTimeout(() => {
        zukanOpen = false;
    }, 50);
}

/* =====================================================================
入力（ワンボタン）
===================================================================== */
function onPress() {
    if (zukanOpen || !state) return;
    SFX.init();
    const s = states[state];
    if (s.press && st >= (s.guard ?? CONFIG.INPUT_GUARD)) s.press();
}

window.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('button,.panel')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    onPress();
});
window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (zukanOpen) {
            if (e.code === 'Space') return;
        }
        onPress();
    } else if (e.code === 'Escape' && zukanOpen) closeZukan();
});
$('#btnZukan').onclick = e => {
    e.currentTarget.blur();
    openZukan();
};

function applyLight() {
    $('#btnLight').textContent = '軽量モード：' + (save.light ? 'ON' : 'OFF');
    classLight.castShadow = !save.light;
    stapler.userData.blob.visible = save.light;
    for (const o of outlines) o.visible = !save.light;
    resize();
}

$('#btnLight').onclick = e => {
    e.currentTarget.blur();
    save.light = !save.light;
    writeSave();
    applyLight();
    SFX.click();
};
$('#btnMute').onclick = e => {
    e.currentTarget.blur();
    save.mute = !save.mute;
    writeSave();
    SFX.init();
    SFX.setMute(save.mute);
    $('#btnMute').textContent = '音：' + (save.mute ? 'OFF' : 'ON');
};
$('#btnMute').textContent = '音：' + (save.mute ? 'OFF' : 'ON');

/* =====================================================================
リサイズ・メインループ
===================================================================== */
function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(save.light ? 1 : Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);

let last = performance.now();

function loop(now) {
    requestAnimationFrame(loop);
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += raw;
    let dt = raw;
    if (hitstopT > 0) {
        hitstopT -= raw;
        dt = raw * 0.05;
    }
    if (state) {
        st += dt;
        if (tl) tl.update(st);
        states[state].update(dt);
    }
    // ホッチキスのまばたき
    const blink = (time % 3.1) < 0.12 ? 0.1 : 1;
    for (const e of stapler.userData.eyes) e.scale.y = blink;
    if (stapler.userData.blob.visible) {
        const b = stapler.userData.blob;
        b.position.set(stapler.position.x, surfaceAt(stapler.position.x, stapler.position.z) + 0.01, stapler.position.z - 1.4);
    }
    updateBodies(dt);
    updateSystems(dt);
    updateCamera(raw);
    updateBubble();
    updateFlash(raw);
    renderer.render(currentScene, camera);
}

/* =====================================================================
起動
===================================================================== */
function boot() {
    $('#logo .r1').innerHTML = deco('ホッチキス');
    $('#logo .r2').innerHTML = deco('・ザ・ファイナル', 'rainbow');
    $('#startMsg').innerHTML = deco('クリックかスペースでスタート');
    setupPowerUI();
    applyLight();
    $('#loading').classList.add('hide');
    go('title');
    requestAnimationFrame(t => {
        last = t;
        loop(t);
    });
}

boot();
