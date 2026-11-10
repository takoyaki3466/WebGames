'use strict';
/* ============================================================
   屋台ボッコ
   ------------------------------------------------------------
   3D版（WebGL・外部ライブラリなし）
   ▼ 調整しやすいパラメータは PARAMS、セリフは SERIFU にまとめています
   ============================================================ */

const PARAMS = {
    // ---- 爺さんの動き ----
    JII_SPEED_BASE: 46,       // 1人目の歩く速さ（進行度/秒。出発点→屋台は 273）
    JII_SPEED_INC: 9,         // 1人追い返すごとに速くなる量
    JII_SPEED_MAX: 130,       // 速さの上限
    FESTIVAL_SPEED_MUL: 0.75, // お祭りモード時の速さ倍率
    KNOCKBACK_BASE: 9,        // 1発で押し戻す距離（進行度）
    KNOCKBACK_DECAY: 0.06,    // 1人ごとに押し戻しが弱まる割合
    KNOCKBACK_MIN_RATE: 0.4,  // 押し戻しの下限（基本値に対する割合）
    BLOCK_RATE_BASE: 0,       // 1人目の杖ガード発生率（回/秒）
    BLOCK_RATE_INC: 0.22,     // 1人ごとのガード率アップ
    BLOCK_RATE_MAX: 1.1,      // ガード率の上限
    BLOCK_TIME: 0.75,         // ガードの持続（秒）
    BLOCK_GRACE: 0.12,        // ガード直後この秒数は叩いても通る（反応猶予）
    BLOCK_PUSH: 16,           // ガード中に叩くと爺さんが進む距離

    // ---- 叩き ----
    HIT_INTERVAL_MIN: 0.08,   // 連打の最短間隔（秒）
    COMBO_WINDOW: 0.9,        // この秒数以内に次を当てるとコンボ継続
    GAUGE_MAX: 100, GAUGE_PER_HIT: 8,         // 1発で溜まる怒りゲージ
    GAUGE_COMBO_BONUS: 0.35,  // コンボ数×この値 が上乗せ
    GAUGE_DECAY: 6,           // 叩かないとゲージが減る速さ（/秒）
    GAUGE_DECAY_DELAY: 1.2,   // 何秒叩かないと減り始めるか
    GAUGE_BLOCK_PENALTY: 10,  // ガードを叩いた時のゲージ減少
    NUMB_TIME: 0.35,          // ガードを叩いた後、手がしびれて叩けない時間
    HITSTOP_HIT: 0.05,        // 通常ヒットのヒットストップ（秒）
    HITSTOP_FINISH: 0.22,     // トドメのヒットストップ（秒）

    // ---- トドメのパワーメーター ----
    METER_SPEED_BASE: 1.2,    // 1秒あたりの片道回数
    METER_SPEED_INC: 0.12,    // 1人ごとのメーター加速
    METER_SPEED_MAX: 2.8, METER_INPUT_GRACE: 0.35,  // メーター開始直後の誤タップ無視（秒）
    METER_TIMEOUT: 3.5,       // 放置すると自動で止まる（秒）
    JUST_THRESHOLD: 0.93,     // 精度がこれ以上でジャスト（1.0=ど真ん中）
    DIST_MIN: 80,             // 最低飛距離（m）
    DIST_MAX: 1250,           // 精度100%で加算される飛距離（m）
    JUST_BONUS: 1.3,          // ジャスト時の飛距離倍率
    COMBO_DIST_BONUS: 0.01,   // コンボ1につき飛距離+1%
    COMBO_DIST_CAP: 40,       // 飛距離ボーナスに数えるコンボの上限
    FLY_TIME: 1.7,            // 吹っ飛び演出の長さ（秒）

    // ---- 売上 ----
    SALES_PER_JII: 1000,      // 1人追い返すごとの基本売上
    GOLD_BONUS: 3,            // 金色の爺の売上倍率
    // 1人あたりの売上 = 飛距離 ×（10 + コンボ）÷ 2 + 基本売上（金色なら×3）
    calcSales(dist, combo, isGold) {
        let v = dist * (10 + combo) / 2 + this.SALES_PER_JII;
        if (isGold) v *= this.GOLD_BONUS;
        return Math.round(v / 10) * 10;
    }, RANKS: [ // 売上に応じた称号（min 以上）
        {min: 0, name: 'ほぼ閉店'}, {min: 12000, name: '町内でうわさの店'}, {
            min: 45000, name: '行列のできる屋台'
        }, {min: 100000, name: '祭りの主役'}, {min: 180000, name: '伝説のテキ屋'},],

    // ---- 爺さんの出現率（残りが通常の爺）----
    SPAWN_RATES: {
        chonaikai: 0.07, hokenjo: 0.06, karaoke: 0.06, radio: 0.06, bon: 0.06, gateball: 0.06, gold: 0.01,
    },

    // ---- セリフ ----
    SERIF_TIME: 1.8,          // 吹き出しの表示時間（秒）
    SERIF_ENTER_DELAY: 0.35,  // 登場してからしゃべるまで
    SERIF_HIT_RATE: 0.3,      // 叩かれた時にしゃべる確率
    SERIF_COMBO_AT: 11,       // このコンボ数で「コンボ10超え」セリフ
    SERIF_COMBO_RATE: 0.5,    // コンボ10超え中、叩かれセリフがコンボ用になる確率
    SERIF_REENTER_RATE: 0.6,  // 2人目以降の通常爺が「再登場」セリフを言う確率
    SERIF_UNHEARD_BIAS: 0.5,  // 未収集セリフを優先する確率

    // ---- その他 ----
    FESTIVAL_COUNT: 3,        // お祭りモードの同時出現数
    LANTERN_TAPS: 5,          // 隠し要素：タイトルの提灯タップ回数
};

/* ------------------------------------------------------------
   セリフ定数
   SERIFU[爺さんの種類][状況] = [セリフ, ...]
   状況: enter(登場) hit(叩かれ) combo10(コンボ10超え) fly(吹っ飛び)
         just(ジャストトドメ) reenter(2人目以降の再登場) win(閉店させた)
   特殊爺に無い状況は normal のセリフが使われます。
   ------------------------------------------------------------ */
const SERIFU = {
    normal: {
        enter: ['出店停止じゃ〜！許可証を見せんかい！', '出店停止じゃ！理由はあとで考える！', 'わしの家の前で焼きそば焼くなー！腹が減るじゃろが！', '出店停止じゃ！…あ、たこ焼き1個ちょうだい', 'ここはわしの散歩コースじゃ！あと昼寝コースでもある！', '町内会で決まったんじゃ！会議に来たのはわし一人じゃったが！', '祭りは静かにやるもんじゃ！わしは大声で言うがの！', 'わしが若い頃はのう、屋台なんぞなかった！…いや、あったわ',],
        hit: ['いたっ！', 'ぬおっ！', '入れ歯が！入れ歯が！', '効かんのう！…ちょっと効いた', 'ばあさんにも叩かれたことないのに！', 'やめんか！ソースが付くじゃろ！', '年寄りはいたわらんかい！',],
        combo10: ['ちょ、ちょっと休憩させて', 'わし、何しに来たんじゃっけ', 'これは…新しい肩たたきか？', 'お、そこそこ。もうちょい右',],
        fly: ['覚えとれ〜〜〜！', '明日も来るからな〜〜！', 'ばあさーん！わし飛んどるー！', 'おお、花火がよう見えるわい', '保険証持ってきとらんのに〜！',],
        just: ['…お見事', 'ナイスショットじゃ…',],
        reenter: ['さっきのは練習じゃ！', '着地した場所がたまたま近くでのう！', '今度は本気の杖じゃ！',],
        win: ['勝ったぞい！今日はわしがここで店を出す！', '閉店じゃ閉店！…ところで、たこ焼き余っとるか？', 'ふぉっふぉっふぉ、正義は勝つ！',],
    }, chonaikai: {
        enter: ['回覧板にも書いたじゃろ！誰も読んどらんが！', '会長権限で出店停止じゃ！権限があるかは知らん！',],
        fly: ['次の回覧板に書いてやる〜〜！'],
    }, hokenjo: {
        enter: ['保健所の者じゃ！…の、知り合いの知り合いじゃ！', 'この焼きそば、検査せねばならん！大盛りで！',],
        fly: ['検査結果は、おいしかった〜〜！'],
    }, karaoke: {
        enter: ['出店〜停止〜じゃ〜♪（こぶし）', '十八番を歌い終わるまで営業禁止じゃ〜♪',], fly: ['アンコールは〜〜♪'],
    }, radio: {
        enter: ['出店停止〜！いち、に、さん、し！', '深呼吸〜！…ソースのにおいで吸いすぎた！',], fly: ['腕を大きく回して〜〜！'],
    }, bon: {
        enter: ['出店停止じゃ〜♪ あ、よいよい！', '踊りの輪から出店停止じゃ！…輪はどこじゃ？',], fly: ['よいよい〜〜〜！'],
    }, gateball: {
        enter: ['出店停止じゃ！ここはゲートボールの通り道じゃ！', 'この屋台、第3ゲートにちょうどええのう！',],
        fly: ['ホールインワン〜〜！…それはゴルフじゃ〜！'],
    }, gold: {
        enter: ['わしは金色じゃ。理由は知らん', '出店停止じゃ。なお、ご利益はある',], fly: ['ご利益〜〜〜！'],
    },
};

/* 爺さん図鑑（見た目・性能・プロフィール） */
const JII_TYPES = {
    normal: {
        name: '通常の爺', profile: '毎晩どこからともなく現れる。出店停止の理由は毎回ちがう。', look: {body: '#6f7fc2'}
    }, chonaikai: {
        name: '町内会長爺',
        profile: '自称・町内会長。任期は本人もよく知らない。ちょっと打たれ強い。',
        look: {body: '#3c4a8c'},
        gaugeMul: 0.85
    }, hokenjo: {
        name: '保健所っぽい爺', profile: '白衣は通販で買った。検査という名の試食が趣味。', look: {body: '#eef2f7'}
    }, karaoke: {
        name: 'カラオケ帰り爺',
        profile: '二次会の帰り道。マイクは返し忘れた。歩くのが遅い。',
        look: {body: '#2f3658'},
        speedMul: 0.85
    }, radio: {
        name: 'ラジオ体操爺',
        profile: '朝も夜も体操。杖ガードの構えがやたら速い。',
        look: {body: '#f4f4f4'},
        blockMul: 1.8
    }, bon: {
        name: '盆踊り爺',
        profile: '踊りながら来るのでジグザグに進む。足どりは軽い。',
        look: {body: '#e8443a'},
        zigzag: true
    }, gateball: {
        name: 'ゲートボール爺',
        profile: '町内大会の常連。足腰が強く、歩くのが速い。',
        look: {body: '#5aa0d8'},
        speedMul: 1.2
    }, gold: {
        name: '金色の爺',
        profile: '正体不明。めったに来ない。倒すと売上にご利益がある。',
        look: {body: '#e6a91c', skin: '#ffd75e', nose: '#f0a800', hair: '#fff4c2', leg: '#a8740e'},
        speedMul: 1.15
    },
};

/* 屋台道具（累計売上で解放） */
const WEAPONS = [{
    id: 'pick',
    name: 'たこ焼きピック',
    unlock: 0,
    distMul: 1.0,
    gaugeMul: 1.0,
    comboMul: 1.0,
    knockMul: 1.0,
    desc: '基本の一本。先っぽにたこ焼き付き。'
}, {
    id: 'hera',
    name: '焼きそばのヘラ',
    unlock: 40000,
    distMul: 1.15,
    gaugeMul: 1.0,
    comboMul: 1.0,
    knockMul: 1.3,
    desc: '平たいので押し戻しが強い。'
}, {
    id: 'wataame',
    name: 'わたあめ棒',
    unlock: 120000,
    distMul: 1.0,
    gaugeMul: 1.15,
    comboMul: 1.5,
    knockMul: 0.9,
    desc: 'ふわふわでコンボがつながりやすい。'
}, {
    id: 'poi',
    name: '金魚すくいのポイ',
    unlock: 300000,
    distMul: 1.5,
    gaugeMul: 0.85,
    comboMul: 1.0,
    knockMul: 0.8,
    desc: '破れやすいが、なぜかよく飛ぶ。'
}, {
    id: 'uchiwa',
    name: '巨大うちわ',
    unlock: 600000,
    distMul: 1.35,
    gaugeMul: 1.2,
    comboMul: 1.2,
    knockMul: 1.6,
    desc: 'あおげば爺も飛ぶ。全部そこそこ強い。'
},];

/* 実績 */
const ACHIEVEMENTS = [{id: 'first', name: '開店', desc: '爺さんを1人追い返す'}, {
    id: 'just1', name: 'ど真ん中', desc: 'ジャストトドメを決める'
}, {id: 'just10', name: '職人の一撃', desc: 'ジャストトドメ通算10回'}, {
    id: 'combo20', name: '肩たたき名人', desc: '20コンボ達成'
}, {id: 'combo50', name: '止まらない手', desc: '50コンボ達成'}, {
    id: 'dist2000', name: '星になれ', desc: '1回で2,000m以上ぶっ飛ばす'
}, {id: 'ten', name: '千客万来', desc: '1プレイで10人追い返す'}, {
    id: 'gold', name: 'ご利益', desc: '金色の爺を倒す'
}, {id: 'zukan', name: '爺さん博士', desc: '爺さん図鑑をコンプリート'}, {
    id: 'serif', name: '聞き上手', desc: 'セリフを全部聞く'
}, {id: 'legend', name: '伝説のテキ屋', desc: '称号「伝説のテキ屋」を獲得'}, {
    id: 'fest', name: 'お祭りさわぎ', desc: '隠し要素を見つける'
},];

const SITU_LABEL = {
    enter: '登場', hit: '叩かれ', combo10: 'コンボ', fly: '吹っ飛び', just: 'ジャスト', reenter: '再登場', win: '閉店'
};
const ONOMA = ['ボコッ！', 'ポコッ！', 'バキッ！', 'ドカッ！', 'ボカッ！'];

/* ============================================================
   ここから下は本体
   ============================================================ */
const P = PARAMS;
// 論理座標（UI・2D演出用）と、爺さんの進行度
const W = 360, H = 640, SPAWN_Y = 205, RANGE_Y = 330, STALL_Y = 478;
const COL = {navy: '#13204a', deep: '#0b1433', ink: '#1b0f2a', red: '#ff4a3d', yellow: '#ffd23f', white: '#ffffff'};
const LOOK_DEFAULT = {skin: '#f6d2ad', nose: '#eaa588', hair: '#ffffff', leg: '#2b3360'};
for (const k in JII_TYPES) JII_TYPES[k].look = Object.assign({}, LOOK_DEFAULT, JII_TYPES[k].look);
const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","BIZ UDPGothic","Meiryo","Noto Sans JP",sans-serif';
const SWING_DUR = 0.15;
const SAVE_KEY = 'yataiBokko_v1';
// 3D 配置
const Z_SPAWN = -26, Z_STALL = -0.9;                 // 爺さんの出発地点と屋台の手前
const Z_RANGE = -8;                                 // 叩ける範囲の入口
const zOf = y => y < RANGE_Y ? Z_SPAWN + (y - SPAWN_Y) / (RANGE_Y - SPAWN_Y) * (Z_RANGE - Z_SPAWN) : Z_RANGE + (y - RANGE_Y) / (STALL_Y - RANGE_Y) * (Z_STALL - Z_RANGE);
const xOf = x => (x - 180) / 90;
const CAM = {eye: [0, 3.6, 5.6], target: [0, 1.2, -8], fov: 50};
const HAND_PIVOT = [0.9, 1.45, 0.9];

/* ---------- 全セリフ一覧（セリフ帳用） ---------- */
const ALL_SERIF = [];
(function () {
    const seen = new Set();
    for (const type in SERIFU) for (const sit in SERIFU[type]) for (const text of SERIFU[type][sit]) {
        if (seen.has(text)) continue;
        seen.add(text);
        ALL_SERIF.push({text, type, sit});
    }
})();

/* ---------- セーブ ---------- */
function defaultSave() {
    return {
        best: {dist: 0, sales: 0, combo: 0},
        total: 0,
        plays: 0,
        justTotal: 0,
        zukan: {},
        serif: {},
        ach: {},
        weapon: 'pick',
        fest: false,
        festOn: false,
        mute: false,
        lite: false
    };
}

function loadSave() {
    const d = defaultSave();
    try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (!s) return d;
        const o = Object.assign(d, s);
        o.best = Object.assign(defaultSave().best, s.best || {});
        return o;
    } catch (e) {
        return d;
    }
}

let save = loadSave();

function persist() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
    }
}

/* ---------- 効果音 (Web Audio) ---------- */
const SND = {
    ctx: null, master: null, nb: null, init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            this.ctx = new AC();
        } catch (e) {
            return;
        }
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.5);
        const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.nb = b;
    }, resume() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }, tone(f0, f1, dur, type, vol, delay) {
        const c = this.ctx, t = c.currentTime + (delay || 0);
        const o = c.createOscillator(), g = c.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.03);
    }, noise(dur, vol, freq, q, f1, delay) {
        const c = this.ctx, t = c.currentTime + (delay || 0);
        const s = c.createBufferSource();
        s.buffer = this.nb;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = q || 1;
        f.frequency.setValueAtTime(freq, t);
        if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f);
        f.connect(g);
        g.connect(this.master);
        s.start(t);
        s.stop(t + dur + 0.03);
    }, play(n, arg) {
        if (save.mute || !this.ctx) return;
        try {
            switch (n) {
                case 'poko': {
                    const p = 1 + Math.min(arg || 0, 30) * 0.02;
                    this.tone(560 * p, 170 * p, 0.12, 'sine', 0.55);
                    this.noise(0.05, 0.25, 1800, 1.5);
                    break;
                }
                case 'kan':
                    this.tone(1350, 1320, 0.35, 'triangle', 0.25);
                    this.tone(2030, 2000, 0.25, 'sine', 0.12);
                    this.noise(0.04, 0.2, 4000, 2);
                    break;
                case 'smash':
                    this.tone(190, 60, 0.3, 'square', 0.22);
                    this.noise(0.25, 0.5, 1400, 0.8, 300);
                    this.tone(1480, 1440, 0.55, 'triangle', 0.22, 0.02);
                    break;
                case 'hyun':
                    this.tone(480, 1800, 0.9, 'sine', 0.16);
                    break;
                case 'kiran':
                    [1568, 2093, 2637].forEach((f, i) => this.tone(f, f, 0.22, 'sine', 0.16, i * 0.07));
                    this.tone(3136, 3136, 0.5, 'sine', 0.09, 0.21);
                    break;
                case 'whiff':
                    this.noise(0.12, 0.22, 600, 1, 2400);
                    break;
                case 'full':
                    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.07, i * 0.05));
                    break;
                case 'stop':
                    this.tone(880, 880, 0.08, 'square', 0.1);
                    break;
                case 'just':
                    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.2, i * 0.045));
                    break;
                case 'over':
                    [392, 349, 330, 262].forEach((f, i) => this.tone(f, f * 0.97, 0.32, 'triangle', 0.2, i * 0.18));
                    break;
                case 'click':
                    this.tone(660, 880, 0.06, 'sine', 0.14);
                    break;
                case 'toast':
                    this.tone(1319, 1319, 0.12, 'sine', 0.1);
                    this.tone(1760, 1760, 0.2, 'sine', 0.1, 0.08);
                    break;
                case 'pon':
                    this.tone(760, 380, 0.1, 'sine', 0.25);
                    break;
                case 'guard':
                    this.tone(980, 980, 0.04, 'square', 0.05);
                    break;
                case 'secret':
                    [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, f, 0.2, 'triangle', 0.15, i * 0.07));
                    break;
            }
        } catch (e) {
        }
    },
};

/* ---------- 便利関数 ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.random() * a.length | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('ja-JP');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function ell(c, x, y, rx, ry) {
    c.beginPath();
    c.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
    c.fill();
}

function circ(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.abs(r), 0, Math.PI * 2);
    c.fill();
}

function ln(c, x0, y0, x1, y1) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
}

function rrect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

function star4(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
}

const weapon = () => WEAPONS.find(w => w.id === save.weapon && save.total >= w.unlock) || WEAPONS[0];

function getRank(sales) {
    let r = P.RANKS[0];
    for (const k of P.RANKS) if (sales >= k.min) r = k;
    return r;
}

function hex3(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

const v3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => {
        const l = Math.hypot(a[0], a[1], a[2]) || 1;
        return [a[0] / l, a[1] / l, a[2] / l];
    },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
};

/* ============================================================
   ミニ3Dエンジン（WebGL・トゥーン陰影＋輪郭線）
   ============================================================ */
const $ = id => document.getElementById(id);
const wrap = $('wrap'), bgc = $('bg'), glc = $('gl'), fxc = $('fx');
const bctx = bgc.getContext('2d'), ctx = fxc.getContext('2d');
const gl = glc.getContext('webgl', {
    antialias: true, alpha: true, premultipliedAlpha: true
}) || glc.getContext('experimental-webgl', {antialias: true, alpha: true});
if (!gl) {
    $('err').style.display = 'flex';
    throw new Error('WebGL unavailable');
}

const M4 = {
    T: new Float32Array(16), mul(o, a, b) {
        const r = this.T;
        for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) {
            r[c * 4 + i] = a[i] * b[c * 4] + a[4 + i] * b[c * 4 + 1] + a[8 + i] * b[c * 4 + 2] + a[12 + i] * b[c * 4 + 3];
        }
        o.set(r);
        return o;
    }, // M = T * Ry * Rx * Rz * S
    trs(o, p, r, s) {
        const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]),
            sz = Math.sin(r[2]);
        const r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
        const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
        const r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
        o[0] = r00 * s[0];
        o[1] = r10 * s[0];
        o[2] = r20 * s[0];
        o[3] = 0;
        o[4] = r01 * s[1];
        o[5] = r11 * s[1];
        o[6] = r21 * s[1];
        o[7] = 0;
        o[8] = r02 * s[2];
        o[9] = r12 * s[2];
        o[10] = r22 * s[2];
        o[11] = 0;
        o[12] = p[0];
        o[13] = p[1];
        o[14] = p[2];
        o[15] = 1;
        return o;
    }, persp(o, fovy, asp, n, f) {
        const t = 1 / Math.tan(fovy / 2);
        o.fill(0);
        o[0] = t / asp;
        o[5] = t;
        o[10] = (f + n) / (n - f);
        o[11] = -1;
        o[14] = 2 * f * n / (n - f);
        return o;
    }, look(o, e, t, up) {
        const z = v3.norm(v3.sub(e, t)), x = v3.norm(v3.cross(up, z)), y = v3.cross(z, x);
        o[0] = x[0];
        o[1] = y[0];
        o[2] = z[0];
        o[3] = 0;
        o[4] = x[1];
        o[5] = y[1];
        o[6] = z[1];
        o[7] = 0;
        o[8] = x[2];
        o[9] = y[2];
        o[10] = z[2];
        o[11] = 0;
        o[12] = -v3.dot(x, e);
        o[13] = -v3.dot(y, e);
        o[14] = -v3.dot(z, e);
        o[15] = 1;
        return o;
    }, // 法線行列（左上3x3の逆転置・スケール省略）
    nrm(o, m) {
        const a00 = m[0], a01 = m[4], a02 = m[8], a10 = m[1], a11 = m[5], a12 = m[9], a20 = m[2], a21 = m[6],
            a22 = m[10];
        o[0] = a11 * a22 - a12 * a21;
        o[1] = -(a01 * a22 - a02 * a21);
        o[2] = a01 * a12 - a02 * a11;
        o[3] = -(a10 * a22 - a12 * a20);
        o[4] = a00 * a22 - a02 * a20;
        o[5] = -(a00 * a12 - a02 * a10);
        o[6] = a10 * a21 - a11 * a20;
        o[7] = -(a00 * a21 - a01 * a20);
        o[8] = a00 * a11 - a01 * a10;
        return o;
    },
};

function xform(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

function xformN(n, v) {
    return v3.norm([n[0] * v[0] + n[3] * v[1] + n[6] * v[2], n[1] * v[0] + n[4] * v[1] + n[7] * v[2], n[2] * v[0] + n[5] * v[1] + n[8] * v[2]]);
}

function compile(vs, fs) {
    const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
        const nm = gl.getActiveUniform(p, i).name;
        u[nm] = gl.getUniformLocation(p, nm);
    }
    return {p, u};
}

const TOON = compile(`
attribute vec3 aP; attribute vec3 aN; attribute vec3 aO; attribute vec3 aC;
uniform mat4 uM; uniform mat4 uVP; uniform mat3 uNM; uniform float uT;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
void main(){
  vec4 w = uM * vec4(aP, 1.0);
  if (uT > 0.0) w.xyz += normalize(uNM * aO) * uT;
  vN = uNM * aN; vW = w.xyz; vC = aC;
  gl_Position = uVP * w;
}`, `
precision mediump float;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
uniform vec3 uC; uniform vec3 uE; uniform vec3 uL; uniform vec3 uCam; uniform vec3 uFogC; uniform vec2 uFog; uniform float uInk;
void main(){
  float dist = length(uCam - vW);
  float f = clamp((dist - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
  if (uInk > 0.5) { gl_FragColor = vec4(mix(vec3(0.106, 0.059, 0.165), uFogC, f), 1.0); return; }
  vec3 n = normalize(vN);
  float d = dot(n, uL);
  float t = d > 0.35 ? 1.0 : (d > -0.1 ? 0.72 : 0.5);
  vec3 amb = mix(vec3(0.34, 0.24, 0.40), vec3(0.46, 0.52, 0.82), n.y * 0.5 + 0.5);
  vec3 base = uC * vC;
  vec3 c = base * (t * 0.8 + amb * 0.36) + uE;
  vec3 v = normalize(uCam - vW);
  float rim = 1.0 - max(dot(n, v), 0.0);
  c += vec3(1.0, 0.82, 0.55) * smoothstep(0.62, 0.8, rim) * 0.14;
  gl_FragColor = vec4(mix(c, uFogC, f), 1.0);
}`);
const GLOW = compile(`
attribute vec3 aP;
uniform mat4 uM; uniform mat4 uVP; uniform vec3 uCR; uniform vec3 uCU; uniform float uB; uniform vec2 uS;
varying vec2 vUV;
void main(){
  vUV = aP.xy * 2.0;
  vec4 w;
  if (uB > 0.5) { vec3 c = (uM * vec4(0.0, 0.0, 0.0, 1.0)).xyz; w = vec4(c + uCR * aP.x * uS.x + uCU * aP.y * uS.y, 1.0); }
  else w = uM * vec4(aP, 1.0);
  gl_Position = uVP * w;
}`, `
precision mediump float;
varying vec2 vUV; uniform vec3 uC; uniform float uA; uniform float uSoft;
void main(){
  float r = length(vUV);
  float a = uSoft > 0.5 ? pow(max(0.0, 1.0 - r), 2.0) : (1.0 - smoothstep(0.55, 1.0, r));
  a *= uA;
  gl_FragColor = vec4(uC * a, a);
}`);

/* ---------- ジオメトリ ---------- */
function finalize(P_, N_, I_) {
    // 巻き順を外向きに揃える
    for (let t = 0; t < I_.length; t += 3) {
        const a = I_[t] * 3, b = I_[t + 1] * 3, c = I_[t + 2] * 3;
        const e1 = [P_[b] - P_[a], P_[b + 1] - P_[a + 1], P_[b + 2] - P_[a + 2]];
        const e2 = [P_[c] - P_[a], P_[c + 1] - P_[a + 1], P_[c + 2] - P_[a + 2]];
        const fn = v3.cross(e1, e2);
        const an = [N_[a] + N_[b] + N_[c], N_[a + 1] + N_[b + 1] + N_[c + 1], N_[a + 2] + N_[b + 2] + N_[c + 2]];
        if (v3.dot(fn, an) < 0) {
            const tmp = I_[t + 1];
            I_[t + 1] = I_[t + 2];
            I_[t + 2] = tmp;
        }
    }
    // 輪郭線用のなめらか法線（同じ位置の頂点の法線を合算）
    const acc = new Map(), O_ = new Array(P_.length);
    const key = i => Math.round(P_[i] * 500) + ',' + Math.round(P_[i + 1] * 500) + ',' + Math.round(P_[i + 2] * 500);
    for (let i = 0; i < P_.length; i += 3) {
        const k = key(i), s = acc.get(k) || [0, 0, 0];
        s[0] += N_[i];
        s[1] += N_[i + 1];
        s[2] += N_[i + 2];
        acc.set(k, s);
    }
    for (let i = 0; i < P_.length; i += 3) {
        const n = v3.norm(acc.get(key(i)));
        O_[i] = n[0];
        O_[i + 1] = n[1];
        O_[i + 2] = n[2];
    }
    return upload({P: P_, N: N_, O: O_, I: I_});
}

function upload(g, C_) {
    const n = g.P.length / 3, data = new Float32Array(n * 12);
    for (let i = 0; i < n; i++) {
        data.set([g.P[i * 3], g.P[i * 3 + 1], g.P[i * 3 + 2], g.N[i * 3], g.N[i * 3 + 1], g.N[i * 3 + 2], g.O[i * 3], g.O[i * 3 + 1], g.O[i * 3 + 2], C_ ? C_[i * 3] : 1, C_ ? C_[i * 3 + 1] : 1, C_ ? C_[i * 3 + 2] : 1], i * 12);
    }
    g.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g.vb);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    g.ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.I), gl.STATIC_DRAW);
    g.count = g.I.length;
    return g;
}

function geoSphere(ws, hs) {
    const P_ = [], N_ = [], I_ = [];
    for (let i = 0; i <= hs; i++) {
        const ph = i / hs * Math.PI;
        for (let j = 0; j <= ws; j++) {
            const th = j / ws * Math.PI * 2;
            const x = -Math.cos(th) * Math.sin(ph), y = Math.cos(ph), z = Math.sin(th) * Math.sin(ph);
            P_.push(x, y, z);
            N_.push(x, y, z);
        }
    }
    for (let i = 0; i < hs; i++) for (let j = 0; j < ws; j++) {
        const a = i * (ws + 1) + j, b = a + ws + 1;
        if (i > 0) I_.push(a, b, a + 1);
        if (i < hs - 1) I_.push(b, b + 1, a + 1);
    }
    return finalize(P_, N_, I_);
}

function geoBox() {
    const P_ = [], N_ = [], I_ = [];
    const faces = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
    for (const n of faces) {
        const u = Math.abs(n[1]) === 1 ? [1, 0, 0] : [0, 1, 0], v = v3.cross(n, u), b = P_.length / 3;
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            P_.push((n[0] + u[0] * su + v[0] * sv) * 0.5, (n[1] + u[1] * su + v[1] * sv) * 0.5, (n[2] + u[2] * su + v[2] * sv) * 0.5);
            N_.push(n[0], n[1], n[2]);
        }
        I_.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return finalize(P_, N_, I_);
}

// 高さ1・中心原点の円柱（rt/rb は上下の半径）
function geoCyl(rt, rb, seg) {
    const P_ = [], N_ = [], I_ = [];
    const sl = (rb - rt);
    for (let j = 0; j <= seg; j++) {
        const th = j / seg * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), n = v3.norm([c, sl, s]);
        P_.push(c * rt, 0.5, s * rt, c * rb, -0.5, s * rb);
        N_.push(...n, ...n);
    }
    for (let j = 0; j < seg; j++) {
        const a = j * 2;
        I_.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    for (const [y, r, ny] of [[0.5, rt, 1], [-0.5, rb, -1]]) {
        if (r <= 0) continue;
        const c0 = P_.length / 3;
        P_.push(0, y, 0);
        N_.push(0, ny, 0);
        for (let j = 0; j <= seg; j++) {
            const th = j / seg * Math.PI * 2;
            P_.push(Math.cos(th) * r, y, Math.sin(th) * r);
            N_.push(0, ny, 0);
        }
        for (let j = 0; j < seg; j++) I_.push(c0, c0 + 1 + j, c0 + 2 + j);
    }
    return finalize(P_, N_, I_);
}

// XZ平面に寝たドーナツ
function geoTorus(R, r, seg, tube) {
    const P_ = [], N_ = [], I_ = [];
    for (let i = 0; i <= seg; i++) {
        const u = i / seg * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
        for (let j = 0; j <= tube; j++) {
            const v = j / tube * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
            P_.push((R + r * cv) * cu, r * sv, (R + r * cv) * su);
            N_.push(cv * cu, sv, cv * su);
        }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
        const a = i * (tube + 1) + j, b = a + tube + 1;
        I_.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return finalize(P_, N_, I_);
}

const GEO = {
    sph: geoSphere(18, 12),
    sphLo: geoSphere(10, 7),
    box: geoBox(),
    cyl: geoCyl(1, 1, 16),
    cylLo: geoCyl(1, 1, 8),
    cone: geoCyl(0, 1, 14),
    ring: geoTorus(1, 0.12, 24, 8),
    ringThin: geoTorus(1, 0.07, 24, 6),
};
const QUAD = (() => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), gl.STATIC_DRAW);
    return b;
})();

/* ---------- シーンノード ---------- */
class Node {
    constructor(geo, col, o) {
        o = o || {};
        this.geo = geo || null;
        this.col = col ? hex3(col) : [1, 1, 1];
        this.em = o.em ? (typeof o.em === 'string' ? hex3(o.em) : o.em) : [0, 0, 0];
        this.ol = o.ol === undefined ? 0.03 : o.ol;
        this.glow = o.glow || 0;            // 1:加算ビルボード 2:影（床） 3:加算（床）
        this.ga = o.ga === undefined ? 1 : o.ga;
        this.soft = o.soft === undefined ? 1 : o.soft;
        this.p = [0, 0, 0];
        this.r = [0, 0, 0];
        this.s = [1, 1, 1];
        this.ch = [];
        this.vis = true;
        this.M = new Float32Array(16);
        this.NM = new Float32Array(9);
    }

    add(...n) {
        this.ch.push(...n);
        return this;
    }

    at(x, y, z) {
        this.p = [x, y, z];
        return this;
    }

    sc(x, y, z) {
        this.s = [x, y === undefined ? x : y, z === undefined ? x : z];
        return this;
    }

    rot(x, y, z) {
        this.r = [x, y || 0, z || 0];
        return this;
    }
}

const grp = () => new Node(null);
const sph = (r, col, o) => new Node(GEO.sph, col, o).sc(r);
const ell3 = (x, y, z, col, o) => new Node(GEO.sph, col, o).sc(x, y, z);
const box = (w, h, d, col, o) => new Node(GEO.box, col, o).sc(w, h, d);
const cyl = (r, h, col, o) => new Node(GEO.cyl, col, o).sc(r, h, r);
const glowN = (size, col, a, o) => {
    const n = new Node(null, col, Object.assign({glow: 1, ga: a}, o));
    n.gs = [size, size];
    return n;
};

function alignY(n, d) {
    d = v3.norm(d);
    n.r = [Math.acos(clamp(d[1], -1, 1)), Math.atan2(d[0], d[2]), 0];
}

function walk(n, parentM, out) {
    if (!n.vis) return;
    M4.trs(n.M, n.p, n.r, n.s);
    if (parentM) M4.mul(n.M, parentM, n.M);
    if (n.geo) {
        M4.nrm(n.NM, n.M);
        out.o.push(n);
    } else if (n.glow) out.g.push(n);
    for (const c of n.ch) walk(c, n.M, out);
}

// 静的オブジェクトを1つのジオメトリに焼き込む（描画回数削減）
function bake(root) {
    const out = {o: [], g: []};
    walk(root, null, out);
    const P_ = [], N_ = [], O_ = [], C_ = [], I_ = [];
    for (const n of out.o) {
        const g = n.geo, base = P_.length / 3;
        for (let i = 0; i < g.P.length; i += 3) {
            const p = xform(n.M, [g.P[i], g.P[i + 1], g.P[i + 2]]);
            const nn = xformN(n.NM, [g.N[i], g.N[i + 1], g.N[i + 2]]),
                on = xformN(n.NM, [g.O[i], g.O[i + 1], g.O[i + 2]]);
            P_.push(...p);
            N_.push(...nn);
            O_.push(...on);
            C_.push(...n.col);
        }
        for (const i of g.I) I_.push(base + i);
    }
    const g = upload({P: P_, N: N_, O: O_, I: I_}, C_);
    const node = new Node(g, '#ffffff', {ol: 0.035});
    return {node, glows: out.g};
}

/* ---------- 描画状態 ---------- */
let VS = 1, DPR = 1;
const VIEW = new Float32Array(16), PROJ = new Float32Array(16), VP = new Float32Array(16);
let CAM_EYE = CAM.eye.slice(), CAM_R = [1, 0, 0], CAM_U = [0, 1, 0];
const LIGHT = v3.norm([-0.45, 0.75, 0.55]);
const FOG_C = hex3('#2c3b7c');

function setCamera(eye, target, fov, asp) {
    M4.look(VIEW, eye, target, [0, 1, 0]);
    M4.persp(PROJ, fov * Math.PI / 180, asp, 0.1, 200);
    M4.mul(VP, PROJ, VIEW);
    CAM_EYE = eye;
    CAM_R = [VIEW[0], VIEW[4], VIEW[8]];
    CAM_U = [VIEW[1], VIEW[5], VIEW[9]];
}

function proj(p) {
    const m = VP, x = p[0], y = p[1], z = p[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13],
        cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return {x: (cx / cw * 0.5 + 0.5) * W, y: (0.5 - cy / cw * 0.5) * H, w: cw};
}

const ppu = p => {
    const a = proj(p), b = proj([p[0], p[1] + 1, p[2]]);
    return Math.abs(a.y - b.y);
};

function bindToon(g) {
    const u = TOON.u;
    gl.bindBuffer(gl.ARRAY_BUFFER, g.vb);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib);
    gl.vertexAttribPointer(ATT.aP, 3, gl.FLOAT, false, 48, 0);
    gl.vertexAttribPointer(ATT.aN, 3, gl.FLOAT, false, 48, 12);
    gl.vertexAttribPointer(ATT.aO, 3, gl.FLOAT, false, 48, 24);
    gl.vertexAttribPointer(ATT.aC, 3, gl.FLOAT, false, 48, 36);
}

const ATT = {};
['aP', 'aN', 'aO', 'aC'].forEach(a => ATT[a] = gl.getAttribLocation(TOON.p, a));
const ATT_G = gl.getAttribLocation(GLOW.p, 'aP');

function drawScene(roots, opts) {
    opts = opts || {};
    const out = {o: [], g: []};
    for (const r of roots) walk(r, null, out);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(TOON.p);
    const u = TOON.u;
    for (const a of Object.values(ATT)) if (a >= 0) gl.enableVertexAttribArray(a);
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform3fv(u.uL, LIGHT);
    gl.uniform3fv(u.uCam, CAM_EYE);
    gl.uniform3fv(u.uFogC, FOG_C);
    gl.uniform2f(u.uFog, opts.fogNear || 22, opts.fogFar || 78);
    // 本体
    gl.cullFace(gl.BACK);
    gl.uniform1f(u.uInk, 0);
    gl.uniform1f(u.uT, 0);
    for (const n of out.o) {
        bindToon(n.geo);
        gl.uniformMatrix4fv(u.uM, false, n.M);
        gl.uniformMatrix3fv(u.uNM, false, n.NM);
        gl.uniform3fv(u.uC, n.col);
        gl.uniform3fv(u.uE, n.em);
        gl.drawElements(gl.TRIANGLES, n.geo.count, gl.UNSIGNED_SHORT, 0);
    }
    // 輪郭線（裏面を膨らませて墨色で塗る）
    if (!save.lite) {
        gl.cullFace(gl.FRONT);
        gl.uniform1f(u.uInk, 1);
        for (const n of out.o) {
            if (!n.ol) continue;
            bindToon(n.geo);
            gl.uniformMatrix4fv(u.uM, false, n.M);
            gl.uniformMatrix3fv(u.uNM, false, n.NM);
            gl.uniform1f(u.uT, n.ol);
            gl.drawElements(gl.TRIANGLES, n.geo.count, gl.UNSIGNED_SHORT, 0);
        }
    }
    for (const a of Object.values(ATT)) if (a >= 0) gl.disableVertexAttribArray(a);
    // 光・影
    if (out.g.length) {
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.useProgram(GLOW.p);
        const g = GLOW.u;
        gl.bindBuffer(gl.ARRAY_BUFFER, QUAD);
        gl.enableVertexAttribArray(ATT_G);
        gl.vertexAttribPointer(ATT_G, 3, gl.FLOAT, false, 12, 0);
        gl.uniformMatrix4fv(g.uVP, false, VP);
        gl.uniform3fv(g.uCR, CAM_R);
        gl.uniform3fv(g.uCU, CAM_U);
        for (const n of out.g) {
            if (save.lite && n.glow !== 2 && !n.keepLite) continue;
            if (n.glow === 2) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.ONE, gl.ONE);
            gl.uniformMatrix4fv(g.uM, false, n.M);
            gl.uniform1f(g.uB, n.glow === 1 ? 1 : 0);
            gl.uniform2fv(g.uS, n.gs || [1, 1]);
            gl.uniform3fv(g.uC, n.col);
            gl.uniform1f(g.uA, n.ga);
            gl.uniform1f(g.uSoft, n.soft);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.disableVertexAttribArray(ATT_G);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
}

/* ============================================================
   3Dモデル
   ============================================================ */

// 爺さん（ゆるい2頭身）：足元が原点、カメラ（+Z）を向く
function buildJii(type) {
    const T = JII_TYPES[type], L = T.look, gold = type === 'gold';
    const em = gold ? [0.18, 0.12, 0.0] : [0, 0, 0];
    const root = grp(), spin = grp().at(0, 1.1, 0), inner = grp().at(0, -1.1, 0);
    root.add(spin);
    spin.add(inner);
    const m = {root, spin, inner, type};
    m.legL = ell3(0.2, 0.17, 0.24, L.leg).at(-0.22, 0.15, 0);
    m.legR = ell3(0.2, 0.17, 0.24, L.leg).at(0.22, 0.15, 0);
    const body = grp();
    m.body = body;
    inner.add(m.legL, m.legR, body);
    body.add(ell3(0.58, 0.54, 0.5, L.body, {em}).at(0, 0.7, 0));
    // 頭
    const head = grp().at(0, 1.62, 0.02);
    m.head = head;
    body.add(head);
    head.add(ell3(0.64, 0.6, 0.58, L.skin, {em}));
    head.add(ell3(0.13, 0.17, 0.1, L.skin, {em}).at(-0.62, -0.02, 0), ell3(0.13, 0.17, 0.1, L.skin, {em}).at(0.62, -0.02, 0));
    head.add(ell3(0.16, 0.07, 0.1, '#ffffff', {ol: 0, em: [0.35, 0.35, 0.35]}).at(-0.2, 0.42, 0.3).rot(-0.5, 0, 0.5));
    for (const sx of [-1, 1]) head.add(sph(0.21, L.hair).at(sx * 0.53, 0.06, -0.12), sph(0.17, L.hair).at(sx * 0.6, -0.16, -0.04));
    m.browL = box(0.26, 0.07, 0.08, L.hair, {ol: 0.02}).at(-0.21, 0.2, 0.52);
    m.browR = box(0.26, 0.07, 0.08, L.hair, {ol: 0.02}).at(0.21, 0.2, 0.52);
    m.eyeL = sph(1, '#1b1b2a', {ol: 0}).at(-0.2, 0.04, 0.55);
    m.eyeR = sph(1, '#1b1b2a', {ol: 0}).at(0.2, 0.04, 0.55);
    head.add(m.browL, m.browR, m.eyeL, m.eyeR);
    head.add(sph(0.13, L.nose, {em}).at(0, -0.1, 0.6));
    // ヒゲ
    for (const [x, y, z, r] of [[0, -0.42, 0.36, 0.32], [-0.27, -0.33, 0.34, 0.25], [0.27, -0.33, 0.34, 0.25], [-0.42, -0.12, 0.26, 0.2], [0.42, -0.12, 0.26, 0.2], [0, -0.66, 0.24, 0.22]]) head.add(sph(r, L.hair, {ol: 0.025}).at(x, y, z));
    m.mouth = ell3(0.1, 0.04, 0.05, '#7a1f2b', {ol: 0}).at(0, -0.31, 0.64);
    head.add(m.mouth);
    head.add(ell3(0.17, 0.08, 0.08, L.hair, {ol: 0.02}).at(-0.15, -0.2, 0.6).rot(0, 0, 0.25), ell3(0.17, 0.08, 0.08, L.hair, {ol: 0.02}).at(0.15, -0.2, 0.6).rot(0, 0, -0.25));
    // 手と杖
    m.handL = sph(0.14, L.skin, {em}).at(-0.56, 0.74, 0.2);
    m.handR = sph(0.14, L.skin, {em}).at(0.56, 0.76, 0.22);
    body.add(m.handL, m.handR);
    m.cane = grp();
    body.add(m.cane);
    if (type === 'gateball') {
        m.cane.add(cyl(0.04, 1.0, '#a0673a').at(0.03, -0.4, 0));
        m.cane.add(new Node(GEO.cyl, COL.red).sc(0.11, 0.36, 0.11).at(0.03, -0.92, 0).rot(0, 0, Math.PI / 2));
        m.cane.add(new Node(GEO.cyl, COL.yellow, {ol: 0}).sc(0.115, 0.08, 0.115).at(0.03, -0.92, 0).rot(0, 0, Math.PI / 2));
    } else {
        m.cane.add(cyl(0.045, 1.1, '#a0673a').at(0.04, -0.37, 0));
        m.cane.add(cyl(0.045, 0.2, '#a0673a').at(-0.03, 0.2, 0).rot(0, 0, Math.PI / 2));
        m.cane.add(sph(0.06, '#a0673a').at(-0.13, 0.17, 0));
    }
    // 種類ごとの小物
    const acc = (n, parent) => {
        (parent || body).add(n);
        return n;
    };
    switch (type) {
        case 'normal':
            acc(box(0.06, 0.3, 0.04, '#ffffff', {ol: 0.015}).at(-0.11, 1.0, 0.45).rot(0, 0, 0.6));
            acc(box(0.06, 0.3, 0.04, '#ffffff', {ol: 0.015}).at(0.11, 1.0, 0.45).rot(0, 0, -0.6));
            break;
        case 'chonaikai':
            acc(box(0.13, 1.15, 0.06, COL.red, {ol: 0.02}).at(0, 0.72, 0.47).rot(0.1, 0, 0.75));
            acc(sph(0.1, COL.yellow).at(-0.24, 0.94, 0.42));
            for (const sx of [-1, 1]) acc(new Node(GEO.ring, '#1b1b2a', {ol: 0}).sc(0.14).at(sx * 0.2, 0.04, 0.58).rot(Math.PI / 2, 0, 0), head);
            acc(box(0.1, 0.03, 0.03, '#1b1b2a', {ol: 0}).at(0, 0.06, 0.62), head);
            break;
        case 'hokenjo':
            acc(new Node(GEO.cyl, '#dfe6ee', {em: [0.15, 0.15, 0.15]}).sc(0.15, 0.04, 0.15).at(0, 0.4, 0.46).rot(1.15, 0, 0), head);
            acc(box(0.46, 0.15, 0.12, '#9fd3ff').at(0, -0.6, 0.42), head);
            m.item = acc(grp().at(-0.66, 0.98, 0.32));
            m.item.add(box(0.3, 0.38, 0.04, '#a0673a'), box(0.24, 0.3, 0.02, '#ffffff', {ol: 0}).at(0, -0.02, 0.025));
            acc(sph(0.05, COL.navy, {ol: 0}).at(0, 0.9, 0.5));
            acc(sph(0.05, COL.navy, {ol: 0}).at(0, 0.7, 0.52));
            break;
        case 'karaoke':
            acc(box(0.24, 0.42, 0.05, '#ffffff', {ol: 0}).at(0, 0.92, 0.46).rot(-0.2, 0, 0));
            acc(box(0.09, 0.36, 0.06, COL.red, {ol: 0.015}).at(0, 0.86, 0.5).rot(-0.2, 0, 0));
            acc(new Node(GEO.ring, COL.red, {ol: 0.015}).sc(0.62, 0.62, 0.62).at(0, 0.2, -0.02).rot(-0.25, 0, 0), head);
            acc(box(0.08, 0.28, 0.05, COL.red).at(0.62, 0.04, 0.05).rot(0, 0, 0.5), head);
            acc(ell3(0.1, 0.06, 0.04, '#ff8fa0', {ol: 0, em: [0.25, 0.05, 0.08]}).at(-0.36, -0.08, 0.5), head);
            acc(ell3(0.1, 0.06, 0.04, '#ff8fa0', {ol: 0, em: [0.25, 0.05, 0.08]}).at(0.36, -0.08, 0.5), head);
            m.item = acc(grp().at(-0.62, 0.92, 0.3));
            m.item.add(cyl(0.04, 0.32, '#444a66').at(0, 0.12, 0).rot(0, 0, 0.3), sph(0.1, '#c9cfe0').at(-0.05, 0.3, 0));
            break;
        case 'radio':
            acc(new Node(GEO.ring, COL.yellow, {ol: 0.02}).sc(0.34, 0.5, 0.34).at(0, 1.18, 0.04));
            acc(box(0.1, 0.34, 0.05, COL.yellow).at(-0.17, 0.98, 0.44));
            acc(box(0.1, 0.34, 0.05, COL.yellow).at(0.17, 0.98, 0.44));
            acc(box(0.24, 0.17, 0.03, '#ffe8a0', {ol: 0.015}).at(0, 0.56, 0.5).rot(0.2, 0, 0));
            break;
        case 'bon':
            acc(box(0.07, 0.62, 0.04, COL.yellow, {ol: 0}).at(-0.13, 0.78, 0.47).rot(0, 0, -0.15));
            acc(box(0.07, 0.62, 0.04, COL.yellow, {ol: 0}).at(0.13, 0.78, 0.47).rot(0, 0, 0.15));
            acc(new Node(GEO.ring, '#ffffff', {ol: 0}).sc(0.56, 0.4, 0.5).at(0, 0.48, 0));
            acc(new Node(GEO.ring, '#ffffff', {ol: 0.015}).sc(0.63, 0.63, 0.63).at(0, 0.18, -0.02).rot(-0.2, 0, 0), head);
            m.item = acc(grp().at(-0.66, 1.0, 0.3));
            m.item.add(cyl(0.025, 0.3, '#a0673a').at(0, -0.05, 0), new Node(GEO.cyl, COL.yellow).sc(0.24, 0.03, 0.24).at(0, 0.28, 0).rot(Math.PI / 2, 0, 0), new Node(GEO.cyl, COL.red, {ol: 0}).sc(0.09, 0.04, 0.09).at(0, 0.28, 0.01).rot(Math.PI / 2, 0, 0));
            break;
        case 'gateball':
            acc(new Node(GEO.ring, COL.yellow, {ol: 0.015}).sc(0.63, 0.63, 0.63).at(0, 0.24, -0.02).rot(-0.12, 0, 0), head);
            acc(new Node(GEO.cyl, COL.yellow).sc(0.34, 0.04, 0.24).at(0, 0.26, 0.52).rot(-0.15, 0, 0), head);
            acc(box(0.3, 0.1, 0.05, '#ffffff', {ol: 0}).at(0, 1.13, 0.4));
            break;
        case 'gold':
            m.sparks = [0, 1, 2].map(() => glowN(0.55, '#fff2a0', 0.9));
            m.sparks.forEach(s => inner.add(s));
            acc(box(0.06, 0.3, 0.04, '#fff4c2', {ol: 0.015}).at(-0.11, 1.0, 0.45).rot(0, 0, 0.6));
            acc(box(0.06, 0.3, 0.04, '#fff4c2', {ol: 0.015}).at(0.11, 1.0, 0.45).rot(0, 0, -0.6));
            break;
    }
    m.shadow = new Node(null, '#000000', {glow: 2, ga: 0.42}).sc(1.25, 0.9, 1).rot(-Math.PI / 2, 0, 0);
    return m;
}

// 姿勢をつける
function faceOf(st) {
    if (st === 'stagger') return 'hit';
    if (st === 'block') return 'block';
    if (st === 'stun' || st === 'fly') return 'dizzy';
    if (st === 'win') return 'win';
    return 'angry';
}

function poseJii(j, m) {
    const t = j.t || 0, st = j.state, walking = st === 'walk' || st === 'block' || st === 'idle';
    const R = m.root;
    R.p = [j.wx, 0, j.wz];
    R.r = [0, 0, 0];
    R.s = [1, 1, 1];
    m.spin.r = [0, 0, 0];
    const sw = walking ? Math.sin(t * 9) : 0;
    m.legL.p[1] = 0.15 + Math.max(0, sw) * 0.13;
    m.legR.p[1] = 0.15 + Math.max(0, -sw) * 0.13;
    m.body.p[1] = walking ? Math.abs(sw) * 0.07 : 0;
    R.r[2] = sw * 0.05;
    if (JII_TYPES[j.type].zigzag && walking) R.r[1] = Math.cos(t * 2.4) * 0.35;
    if (st === 'stagger') R.r[0] = -0.3;
    if (st === 'stun') R.r[2] = Math.sin(t * 14) * 0.1;
    if (st === 'win') R.p[1] = Math.abs(Math.sin(t * 7)) * 0.35;
    if (j.squash > 0) {
        const k = j.squash / 0.15;
        R.s = [1 + 0.22 * k, 1 - 0.18 * k, 1 + 0.22 * k];
    }
    if (st === 'fly') {
        R.p = [j.wx, j.wy - 1.1 * j.fs, j.wz];
        R.s = [j.fs, j.fs, j.fs];
        m.spin.r = [j.rot, 0, j.rot * 0.6];
    }
    // 杖ガード
    if (st === 'block') {
        m.cane.p = [-0.36, 2.58, 0.28];
        m.cane.r = [0, 0, Math.PI / 2];
        m.handR.p = [0.36, 2.56, 0.3];
        m.handL.p = [-0.36, 2.56, 0.3];
        if (m.item) m.item.vis = false;
    } else {
        m.cane.p = [0.56, 0.76, 0.22];
        m.cane.r = [0, 0, 0];
        m.handR.p = [0.56, 0.76, 0.22];
        m.handL.p = [-0.56, 0.74, 0.2];
        if (m.item) m.item.vis = true;
    }
    // 顔
    const face = faceOf(st);
    const talking = j.bubble && j.bubble.t < j.bubble.dur - 0.3;
    let es = [0.07, 0.07, 0.04], ey = 0.04, br = 0.4, by = 0.2, ms = [0.1, 0.035, 0.05];
    if (face === 'hit') {
        es = [0.1, 0.022, 0.03];
        br = -0.35;
        by = 0.27;
        ms = [0.09, 0.1, 0.05];
    } else if (face === 'block') {
        es = [0.1, 0.018, 0.03];
    } else if (face === 'dizzy') {
        es = [0.085, 0.085, 0.03];
        br = -0.3;
        by = 0.26;
        ms = [0.07, 0.06, 0.05];
    } else if (face === 'win') {
        es = [0.09, 0.03, 0.03];
        ey = 0.07;
        br = 0;
        by = 0.24;
        ms = [0.16, 0.07, 0.05];
    }
    if (talking && face !== 'hit') ms = [ms[0], 0.035 + Math.abs(Math.sin(t * 16)) * 0.07, 0.05];
    m.eyeL.s = es;
    m.eyeR.s = es;
    m.eyeL.p[1] = ey;
    m.eyeR.p[1] = ey;
    m.browL.r = [0, 0, -br];
    m.browR.r = [0, 0, br];
    m.browL.p[1] = by;
    m.browR.p[1] = by;
    m.mouth.s = ms;
    if (m.sparks) m.sparks.forEach((s, i) => {
        const a = t * 2 + i * 2.09;
        s.p = [Math.cos(a) * 0.9, 1.2 + Math.sin(a * 1.3) * 0.5, Math.sin(a) * 0.5];
        s.ga = 0.5 + 0.5 * Math.sin(t * 6 + i);
    });
    // 影
    m.shadow.vis = st !== 'fly';
    m.shadow.p = [j.wx, 0.02, j.wz];
}

/* 屋台道具（手元が原点、+Y が先端方向） */
function buildWeapon(id) {
    const g = grp(), m = {g, id};
    const shaft = (r, col) => {
        m.shaft = new Node(GEO.cylLo, col, {ol: 0.02});
        m.shaftR = r;
        g.add(m.shaft);
    };
    m.head = grp();
    g.add(m.head);
    const h = m.head;
    switch (id) {
        case 'pick':
            shaft(0.025, '#efdcae');
            h.add(sph(0.14, '#c97b3a'), ell3(0.12, 0.05, 0.12, '#5a2e1a', {ol: 0}).at(0, 0.08, 0.03), sph(0.025, '#7fcf6a', {ol: 0}).at(-0.04, 0.13, 0.06), sph(0.025, '#7fcf6a', {ol: 0}).at(0.05, 0.12, 0.05));
            break;
        case 'hera':
            shaft(0.05, '#6b3f24');
            h.add(box(0.36, 0.42, 0.03, '#d6dce8', {em: [0.12, 0.12, 0.15]}).at(0, 0.18, 0));
            break;
        case 'wataame':
            shaft(0.03, '#ffffff');
            for (const [x, y, z, r] of [[0, 0.1, 0, 0.2], [-0.15, 0.25, 0, 0.2], [0.14, 0.24, 0.05, 0.2], [0, 0.38, 0, 0.21], [0.02, 0.22, 0.15, 0.17]]) h.add(sph(r, '#ffb3d1', {em: [0.12, 0.04, 0.08]}).at(x, y, z));
            break;
        case 'poi':
            shaft(0.04, COL.red);
            h.add(new Node(GEO.ring, COL.red, {ol: 0.015}).sc(0.26, 0.26, 0.26).at(0, 0.24, 0).rot(Math.PI / 2, 0, 0), new Node(GEO.cyl, '#ffffff', {
                ol: 0, em: [0.2, 0.2, 0.2]
            }).sc(0.25, 0.01, 0.25).at(0, 0.24, 0).rot(Math.PI / 2, 0, 0), ell3(0.08, 0.045, 0.03, '#ff8a3d', {ol: 0}).at(0.03, 0.22, 0.03));
            break;
        case 'uchiwa':
            shaft(0.05, '#8b5a2b');
            h.add(new Node(GEO.cyl, COL.red).sc(0.55, 0.04, 0.55).at(0, 0.5, 0).rot(Math.PI / 2, 0, 0), new Node(GEO.cyl, COL.yellow, {ol: 0}).sc(0.34, 0.05, 0.34).at(0, 0.5, 0).rot(Math.PI / 2, 0, 0), new Node(GEO.cyl, COL.red, {ol: 0}).sc(0.13, 0.06, 0.13).at(0, 0.5, 0).rot(Math.PI / 2, 0, 0));
            break;
    }
    m.setLen = len => {
        m.shaft.p = [0, len / 2, 0];
        m.shaft.s = [m.shaftR, len, m.shaftR];
        m.head.p = [0, len, 0];
    };
    m.setLen(1);
    return m;
}

const ARM = (() => {
    const root = grp();
    const sleeve = new Node(GEO.cyl, COL.red, {ol: 0.03});
    const from = [1.9, 0.5, 2.6], d = v3.sub(HAND_PIVOT, from), L = v3.len(d);
    sleeve.p = v3.lerp(from, HAND_PIVOT, 0.5);
    sleeve.s = [0.17, L, 0.17];
    alignY(sleeve, d);
    const glove = sph(0.16, '#ffffff').at(...HAND_PIVOT);
    const holder = grp().at(...HAND_PIVOT);
    root.add(sleeve, holder, glove);
    return {root, holder, w: null};
})();

function setWeaponModel() {
    const id = weapon().id;
    if (ARM.w && ARM.w.id === id) return;
    ARM.holder.ch = [];
    ARM.w = buildWeapon(id);
    ARM.holder.add(ARM.w.g);
}

/* ---------- 背景の街並み ---------- */
const WORLD = (() => {
    const S = grp();
    const add = (n, x, y, z) => {
        n.p = [x, y, z];
        S.add(n);
        return n;
    };
    add(box(40, 0.2, 100, '#262a5a', {ol: 0}), 0, -0.1, -42);
    add(box(4.6, 0.04, 100, '#383e7c', {ol: 0}), 0, 0.01, -42);
    for (const sx of [-1, 1]) add(box(0.25, 0.12, 100, '#4d559c', {ol: 0}), sx * 2.4, 0.06, -42);
    // 両側の屋台
    for (let i = 0; i < 10; i++) for (const sx of [-1, 1]) {
        const z = -6 - i * 7 - (sx > 0 ? 3.5 : 0), x = sx * 4.0;
        const s = grp().at(x, 0, z).rot(0, -sx * Math.PI / 2, 0);
        s.add(box(2.6, 1.1, 1.4, '#7a4a32').at(0, 0.55, 0.3));
        s.add(box(2.7, 0.1, 1.5, '#f3e3c3').at(0, 1.15, 0.3));
        for (const px of [-1.25, 1.25]) s.add(box(0.1, 2.4, 0.1, '#5b3a24', {ol: 0.02}).at(px, 1.2, 0.95));
        for (let k = 0; k < 6; k++) s.add(box(0.45, 0.14, 1.3, k % 2 ? '#ffffff' : COL.red, {ol: 0.02}).at(-1.13 + k * 0.45, 2.45, 0.45).rot(0.25, 0, 0));
        s.add(box(1.1, 0.4, 0.06, i % 3 === 0 ? COL.yellow : '#ffffff', {ol: 0.02}).at(0, 2.05, 1.06));
        S.add(s);
    }
    // 奥の建物シルエット
    for (let i = 0; i < 9; i++) add(box(rand(3, 6), rand(3, 7), 3, '#1d2452', {ol: 0}), -16 + i * 4, 2.5, -86);
    // やぐら
    const yg = grp().at(0, 0, -62);
    S.add(yg);
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) yg.add(box(0.2, 5, 0.2, '#6b4430').at(x, 2.5, z));
    yg.add(box(3.2, 0.3, 3.2, '#7a4a32').at(0, 4.2, 0), box(3.4, 0.9, 3.4, COL.red).at(0, 3.6, 0), box(3.6, 0.3, 3.6, '#ffffff').at(0, 5.2, 0));
    // 自分の屋台（手前）
    add(box(6, 1.25, 1.6, '#c7372f'), 0, 0.625, 1.05);
    add(box(6.2, 0.1, 1.7, '#f3e3c3'), 0, 1.3, 1.05);
    add(box(1.9, 0.08, 1.0, '#2a2a38', {ol: 0.02}), -0.55, 1.39, 0.95);
    const seeded = [[-1.2, 0.7], [-0.85, 1.05], [-0.5, 0.75], [-0.2, 1.1], [0.05, 0.8], [-0.95, 1.3], [-0.35, 1.32]];
    for (const [x, z] of seeded) add(ell3(0.2, 0.06, 0.14, '#d9a14a', {ol: 0.015}), x, 1.45, z);
    for (const [x, z] of [[-1.0, 0.8], [-0.3, 0.95], [-0.7, 1.2]]) add(sph(0.04, COL.red, {ol: 0}), x, 1.52, z);
    add(cyl(0.09, 0.42, '#5a2e1a', {ol: 0.02}), -1.85, 1.56, 0.8);
    add(cyl(0.05, 0.1, COL.red, {ol: 0.015}), -1.85, 1.82, 0.8);
    add(cyl(0.08, 0.38, '#fff6d0', {ol: 0.02}), -1.6, 1.54, 0.95);
    add(cyl(0.04, 0.1, COL.red, {ol: 0.015}), -1.6, 1.78, 0.95);
    add(box(0.5, 0.12, 0.32, '#ffffff', {ol: 0.015}), 0.42, 1.41, 1.25);
    // 屋根の垂れ幕（画面上端の額縁）
    add(box(6.6, 0.3, 0.3, '#3a2330'), 0, 6.15, 0.2);
    for (let i = -6; i <= 6; i++) {
        add(box(0.5, 0.55, 0.06, i % 2 ? '#ffffff' : COL.red, {ol: 0.02}), i * 0.5, 5.76, 0.22);
        add(new Node(GEO.cyl, i % 2 ? '#ffffff' : COL.red, {ol: 0.02}).sc(0.25, 0.06, 0.25).rot(Math.PI / 2, 0, 0), i * 0.5, 5.48, 0.22);
    }
    // 提灯の柱と綱
    const strings = [-3, -9, -15, -21, -27, -33];
    for (const z of strings) {
        for (const sx of [-1, 1]) add(cyl(0.07, 4.6, '#5b3a24', {ol: 0.02}), sx * 2.8, 2.3, z);
        let prev = null;
        for (let k = 0; k <= 10; k++) {
            const x = -2.8 + k * 0.56, y = 4.5 - 0.42 * (1 - Math.pow(x / 2.8, 2));
            if (prev) {
                const d = v3.sub([x, y, z], prev), seg = new Node(GEO.cylLo, '#1b0f2a', {ol: 0});
                seg.p = v3.lerp(prev, [x, y, z], 0.5);
                seg.s = [0.015, v3.len(d), 0.015];
                alignY(seg, d);
                S.add(seg);
            }
            prev = [x, y, z];
        }
    }
    const baked = bake(S);
    // 提灯（揺れるので別扱い）
    const lanterns = [], lroot = grp();
    strings.forEach((z, si) => {
        for (let k = 0; k < 5; k++) {
            const x = -2.24 + k * 1.12, y = 4.5 - 0.42 * (1 - Math.pow(x / 2.8, 2));
            const col = (k + si) % 2 ? COL.yellow : COL.red;
            const g = grp().at(x, y, z), c3 = hex3(col);
            g.add(ell3(0.28, 0.36, 0.28, col, {em: v3.mul(c3, 0.55), ol: 0.03}).at(0, -0.45, 0));
            g.add(cyl(0.12, 0.07, '#2a1420', {ol: 0}).at(0, -0.1, 0), cyl(0.12, 0.07, '#2a1420', {ol: 0}).at(0, -0.8, 0));
            const gl_ = glowN(2.0, col, 0.38);
            gl_.p = [0, -0.45, 0];
            g.add(gl_);
            lroot.add(g);
            lanterns.push({g, x, y, z, ph: si * 0.7 + k, kick: 0, near: si === 0});
        }
    });
    // 叩ける範囲（地面の光）
    const range = new Node(null, COL.yellow, {
        glow: 3, ga: 0.08
    }).sc(5.2, 7.2, 1).rot(-Math.PI / 2, 0, 0).at(0, 0.03, -4.2);
    range.keepLite = true;
    return {node: baked.node, lanterns, lroot, range};
})();

/* ---------- ゲーム状態 ---------- */
const G = {
    state: 'title',
    clock: 0,
    time: 0,
    jiis: [],
    stars: [],
    parts: [],
    texts: [],
    shake: 0,
    flash: 0,
    freeze: 0,
    spawnCount: 0,
    defeated: 0,
    sales: 0,
    salesShown: 0,
    totalDist: 0,
    maxDist: 0,
    combo: 0,
    maxCombo: 0,
    comboPulse: 0,
    lastHitT: -9,
    lastSwing: -9,
    gauge: 0,
    numb: 0,
    swingT: 0,
    swingTarget: [0, 1.6, -4],
    nextSpawnT: 0,
    festival: false,
    meter: null,
    distShow: null,
    hint: false,
    overT: 0,
    goldHit: false,
    titleJii: null,
    lanternTaps: 0,
    lanternLast: 0,
};

function resetRun() {
    Object.assign(G, {
        time: 0,
        jiis: [],
        stars: [],
        parts: [],
        texts: [],
        shake: 0,
        flash: 0,
        freeze: 0,
        spawnCount: 0,
        defeated: 0,
        sales: 0,
        salesShown: 0,
        totalDist: 0,
        maxDist: 0,
        combo: 0,
        maxCombo: 0,
        comboPulse: 0,
        lastHitT: -9,
        lastSwing: -9,
        gauge: 0,
        numb: 0,
        swingT: 0,
        nextSpawnT: 0.5,
        meter: null,
        distShow: null,
        overT: 0,
        goldHit: false,
    });
}

const headW = j => [j.wx, 1.65, j.wz];
const topW = j => [j.wx, 2.45, j.wz];

/* ---------- セリフ ---------- */
let lastSerif = '';

function pickSerif(type, sit) {
    const list = (SERIFU[type] && SERIFU[type][sit]) || SERIFU.normal[sit] || [];
    if (!list.length) return null;
    let cand = list.filter(s => s !== lastSerif);
    if (!cand.length) cand = list;
    const unheard = cand.filter(s => !save.serif[s]);
    if (unheard.length && Math.random() < P.SERIF_UNHEARD_BIAS) cand = unheard;
    const s = pick(cand);
    lastSerif = s;
    return s;
}

function say(j, sit, dur) {
    if (sit === 'reenter' && j.type !== 'normal') sit = 'enter';
    const text = pickSerif(j.type, sit);
    if (!text) return;
    j.bubble = {text, t: 0, dur: dur || P.SERIF_TIME};
    hearSerif(text);
}

function hearSerif(text) {
    if (save.serif[text]) return;
    save.serif[text] = 1;
    persist();
    if (ALL_SERIF.every(s => save.serif[s.text])) unlockAch('serif');
}

/* ---------- 実績・図鑑・トースト ---------- */
function toast(label, text) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = `<b>${esc(label)}</b>${esc(text)}`;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), 2600);
}

function unlockAch(id) {
    if (save.ach[id]) return;
    save.ach[id] = true;
    persist();
    const a = ACHIEVEMENTS.find(a => a.id === id);
    if (a) {
        toast('実績解除', a.name);
        SND.play('toast');
    }
}

function registerZukan(type) {
    if (save.zukan[type]) return;
    save.zukan[type] = 1;
    persist();
    toast('図鑑に登録', JII_TYPES[type].name);
    if (Object.keys(JII_TYPES).every(k => save.zukan[k])) unlockAch('zukan');
}

/* ---------- 2Dエフェクト ---------- */
function addText(text, x, y, size, color, life, rot) {
    G.texts.push({text, x, y, size, color, life, max: life, rot: rot || 0});
}

function burst(x, y, n, cols) {
    n = save.lite ? Math.ceil(n / 3) : n;
    cols = cols || [COL.yellow, '#fff', COL.yellow, COL.red];
    for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), sp = rand(90, 280);
        G.parts.push({
            x,
            y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 60,
            life: rand(0.35, 0.7),
            max: 0.7,
            r: rand(2.5, 5),
            col: pick(cols),
            star: Math.random() < 0.4
        });
    }
}

function sparkle(x, y) {
    const n = save.lite ? 3 : 8;
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        G.parts.push({
            x,
            y,
            vx: Math.cos(a) * 60,
            vy: Math.sin(a) * 60,
            life: 0.6,
            max: 0.6,
            r: 3,
            col: '#fff6b0',
            star: true,
            nog: true
        });
    }
}

function updateFx(dt) {
    for (const p of G.parts) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (!p.nog) p.vy += 520 * dt; else {
            p.vx *= 0.92;
            p.vy *= 0.92;
        }
    }
    G.parts = G.parts.filter(p => p.life > 0);
    for (const t of G.texts) t.life -= dt;
    G.texts = G.texts.filter(t => t.life > 0);
}

/* ---------- 爺さんの生成・更新 ---------- */
function rollType() {
    let r = Math.random();
    for (const k in P.SPAWN_RATES) {
        r -= P.SPAWN_RATES[k];
        if (r < 0) return k;
    }
    return 'normal';
}

function spawnJii() {
    const n = G.spawnCount++;
    const type = n === 0 ? 'normal' : rollType();
    const T = JII_TYPES[type];
    const x = rand(110, 250);
    const tx = G.festival ? [112, 180, 248][n % 3] + rand(-12, 12) : rand(135, 225);
    let speed = Math.min(P.JII_SPEED_MAX, P.JII_SPEED_BASE + n * P.JII_SPEED_INC) * (T.speedMul || 1);
    if (G.festival) speed *= P.FESTIVAL_SPEED_MUL;
    const blockRate = Math.min(P.BLOCK_RATE_MAX, P.BLOCK_RATE_BASE + n * P.BLOCK_RATE_INC) * (T.blockMul || 1);
    const j = {
        type,
        n,
        x,
        baseX: x,
        tx,
        y: SPAWN_Y,
        t: rand(0, 1),
        state: 'walk',
        speed,
        blockRate,
        blockT: 0,
        staggerT: 0,
        kb: 0,
        squash: 0,
        bubble: null,
        enterT: P.SERIF_ENTER_DELAY,
        comboSaid: false,
        m: buildJii(type),
    };
    j.wx = xOf(j.x);
    j.wz = zOf(j.y);
    G.jiis.push(j);
}

function frontJii() {
    let best = null;
    for (const j of G.jiis) {
        if ((j.state === 'walk' || j.state === 'stagger' || j.state === 'block') && j.y >= RANGE_Y) {
            if (!best || j.y > best.y) best = j;
        }
    }
    return best;
}

function tryBlock(j, dt) {
    if (j.y >= RANGE_Y - 10 && j.blockRate > 0 && Math.random() < j.blockRate * dt) {
        j.state = 'block';
        j.blockT = P.BLOCK_TIME;
        SND.play('guard');
    }
}

function updateJii(j, dt) {
    j.t += dt;
    if (j.bubble) {
        j.bubble.t += dt;
        if (j.bubble.t >= j.bubble.dur) j.bubble = null;
    }
    if (j.squash > 0) j.squash = Math.max(0, j.squash - dt);
    if (j.enterT > 0 && j.state === 'walk') {
        j.enterT -= dt;
        if (j.enterT <= 0) say(j, (j.n > 0 && j.type === 'normal' && Math.random() < P.SERIF_REENTER_RATE) ? 'reenter' : 'enter');
    }
    switch (j.state) {
        case 'walk':
        case 'block': {
            j.y += j.speed * dt;
            if (JII_TYPES[j.type].zigzag) j.x = j.baseX + Math.sin(j.t * 2.4) * 36; else {
                j.baseX += (j.tx - j.baseX) * Math.min(1, dt * 0.6);
                j.x = j.baseX;
            }
            if (j.state === 'block') {
                j.blockT -= dt;
                if (j.blockT <= 0) j.state = 'walk';
            } else tryBlock(j, dt);
            if (j.y >= STALL_Y) gameOver(j);
            break;
        }
        case 'stagger':
            j.staggerT -= dt;
            j.y = Math.max(RANGE_Y + 2, j.y - j.kb * dt / 0.12);
            if (j.staggerT <= 0) j.state = 'walk'; else tryBlock(j, dt);
            break;
        case 'fly': {
            if (j.flySayT > 0) {
                j.flySayT -= dt;
                if (j.flySayT <= 0) say(j, 'fly', P.FLY_TIME);
            }
            j.fu += dt / P.FLY_TIME;
            const u = Math.min(1, j.fu), e = 1 - Math.pow(1 - u, 2);
            const p = v3.lerp(j.f0, j.f1, e);
            j.wx = p[0];
            j.wy = p[1] + Math.sin(u * Math.PI) * 3;
            j.wz = p[2];
            j.fs = 1 - 0.45 * u;
            j.rot += dt * 13;
            if (u >= 1) {
                j.state = 'gone';
                const s = proj(j.f1);
                G.stars.push({x: s.x, y: s.y, p: rand(0, 6), gold: j.type === 'gold'});
                SND.play('kiran');
                sparkle(s.x, s.y);
                addText('キラーン', s.x, s.y + 18, 13, '#fff', 0.9);
                if (!G.festival && G.state === 'play') G.nextSpawnT = G.time + 0.6;
            }
            return;
        }
    }
    j.wx = xOf(j.x);
    j.wz = zOf(j.y);
}

/* ---------- プレイヤー操作 ---------- */
function action() {
    SND.resume();
    if (G.state === 'play') swingHit(); else if (G.state === 'meter') {
        if (G.meter && G.meter.t >= P.METER_INPUT_GRACE) stopMeter();
    } else if (G.state === 'over') {
        if (G.overT > 1.2) showResult();
    }
}

function swingHit() {
    if (G.numb > 0) return;
    if (G.time - G.lastSwing < P.HIT_INTERVAL_MIN) return;
    G.lastSwing = G.time;
    const j = frontJii(), w = weapon();
    G.swingT = SWING_DUR;
    if (!j) {
        G.swingTarget = [rand(-0.6, 0.6), 1.3, -3.5];
        SND.play('whiff');
        addText('スカッ', 180 + rand(-30, 30), 400, 18, '#bcc8f0', 0.5);
        G.combo = 0;
        return;
    }
    const hp = headW(j), hs = proj(hp), k = ppu(hp);
    G.swingTarget = [hp[0], hp[1] + 0.2, hp[2] + 0.3];
    // 杖ガードに当たった
    if (j.state === 'block' && (P.BLOCK_TIME - j.blockT) > P.BLOCK_GRACE) {
        SND.play('kan');
        G.combo = 0;
        G.gauge = Math.max(0, G.gauge - P.GAUGE_BLOCK_PENALTY);
        j.y = Math.min(STALL_Y - 1, j.y + P.BLOCK_PUSH);
        G.numb = P.NUMB_TIME;
        G.shake = save.lite ? 0 : 0.06;
        const tp = proj([j.wx, 2.65, j.wz]);
        addText('カーン！', tp.x, tp.y - 14, 28, '#bfe3ff', 0.6);
        burst(tp.x, tp.y, 8, ['#fff', '#bfe3ff']);
        addText('ビリッ', 300, 500, 16, '#bfe3ff', 0.5);
        return;
    }
    // ヒット
    if (G.time - G.lastHitT <= P.COMBO_WINDOW * w.comboMul) G.combo++; else G.combo = 1;
    G.lastHitT = G.time;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    G.comboPulse = 1;
    const T = JII_TYPES[j.type];
    G.gauge += (P.GAUGE_PER_HIT + Math.min(G.combo, 30) * P.GAUGE_COMBO_BONUS) * w.gaugeMul * (T.gaugeMul || 1);
    j.state = 'stagger';
    j.staggerT = 0.12;
    j.squash = 0.15;
    j.kb = P.KNOCKBACK_BASE * w.knockMul * Math.max(P.KNOCKBACK_MIN_RATE, 1 - j.n * P.KNOCKBACK_DECAY);
    G.freeze = P.HITSTOP_HIT;
    G.shake = save.lite ? 0 : Math.min(0.14, 0.05 + G.combo * 0.004);
    SND.play('poko', G.combo);
    const side = Math.random() < 0.5 ? -1 : 1;
    addText(pick(ONOMA), hs.x + side * rand(0.55, 0.9) * k, hs.y + rand(-0.25, 0.3) * k, 28 + Math.min(G.combo, 20) * 0.7, pick([COL.yellow, '#fff', COL.yellow, COL.red]), 0.55, rand(-0.3, 0.3));
    burst(hs.x, hs.y, 10);
    G.hint = false;
    if (G.combo >= 20) unlockAch('combo20');
    if (G.combo >= 50) unlockAch('combo50');
    if (G.combo >= P.SERIF_COMBO_AT && !j.comboSaid) {
        j.comboSaid = true;
        say(j, 'combo10');
    } else if (Math.random() < P.SERIF_HIT_RATE) say(j, (G.combo >= P.SERIF_COMBO_AT && Math.random() < P.SERIF_COMBO_RATE) ? 'combo10' : 'hit');
    if (G.gauge >= P.GAUGE_MAX) {
        G.gauge = P.GAUGE_MAX;
        startMeter(j);
    }
}

/* ---------- トドメ ---------- */
function startMeter(target) {
    G.state = 'meter';
    target.state = 'stun';
    G.meter = {
        t: 0,
        pos: 0,
        target,
        stopped: false,
        wait: 0,
        acc: 0,
        just: false,
        speed: Math.min(P.METER_SPEED_MAX, P.METER_SPEED_BASE + G.defeated * P.METER_SPEED_INC)
    };
    SND.play('full');
    G.freeze = 0.12;
}

function updateMeter(dt) {
    const m = G.meter;
    m.target.t += dt;
    if (m.target.bubble) {
        m.target.bubble.t += dt;
        if (m.target.bubble.t >= m.target.bubble.dur) m.target.bubble = null;
    }
    if (!m.stopped) {
        m.t += dt;
        const x = m.t * m.speed, f = x % 2;
        m.pos = f < 1 ? f : 2 - f;
        if (m.t > P.METER_TIMEOUT) stopMeter();
    } else {
        m.wait -= dt;
        if (m.wait <= 0) launch();
    }
}

function stopMeter() {
    const m = G.meter;
    if (!m || m.stopped) return;
    m.stopped = true;
    m.acc = 1 - Math.abs(m.pos - 0.5) * 2;
    m.just = m.acc >= P.JUST_THRESHOLD;
    let label, col;
    if (m.just) {
        label = 'ジャスト！！';
        col = COL.red;
        SND.play('just');
        say(m.target, 'just', 1.1);
        m.wait = 0.8;
        G.flash = 0.35;
    } else if (m.acc > 0.75) {
        label = 'ナイス！';
        col = COL.yellow;
        m.wait = 0.35;
        SND.play('stop');
    } else if (m.acc > 0.4) {
        label = 'まあまあ';
        col = '#fff';
        m.wait = 0.35;
        SND.play('stop');
    } else {
        label = 'うーん…';
        col = '#bcc8f0';
        m.wait = 0.35;
        SND.play('stop');
    }
    addText(label, 180, 232, 34, col, 0.9);
}

function launch() {
    const m = G.meter, j = m.target, w = weapon();
    let dist = (P.DIST_MIN + P.DIST_MAX * m.acc * m.acc) * w.distMul * (m.just ? P.JUST_BONUS : 1) * (1 + Math.min(G.combo, P.COMBO_DIST_CAP) * P.COMBO_DIST_BONUS) * rand(0.96, 1.04);
    dist = Math.round(dist);
    const gold = j.type === 'gold';
    const sales = P.calcSales(dist, G.combo, gold);
    G.sales += sales;
    G.totalDist += dist;
    G.maxDist = Math.max(G.maxDist, dist);
    G.defeated++;
    if (m.just) save.justTotal++;
    if (gold) G.goldHit = true;
    // 吹っ飛び開始（夜空の奥へ）
    const hp = headW(j), hs = proj(hp);
    j.state = 'fly';
    j.fu = 0;
    j.rot = 0;
    j.fs = 1;
    j.flySayT = 0.3;
    j.f0 = [j.wx, 1.1, j.wz];
    j.f1 = [rand(-8, 8), rand(7, 9.5), -56];
    j.wy = 1.1;
    j.ppu0 = ppu(hp);
    G.swingT = SWING_DUR;
    G.swingTarget = [hp[0], hp[1], hp[2] + 0.3];
    G.state = 'play';
    G.meter = null;
    G.gauge = 0;
    G.combo = 0;
    G.lastHitT = -9;
    G.freeze = P.HITSTOP_FINISH;
    G.flash = save.lite ? 0.4 : 0.9;
    G.shake = save.lite ? 0 : 0.28;
    SND.play('smash');
    setTimeout(() => SND.play('hyun'), 230);
    addText('カキーン！', hs.x, hs.y - 30, 46, COL.yellow, 1.0, -0.12);
    burst(hs.x, hs.y, 26);
    G.distShow = {v: dist, t: 0, just: m.just, gold, sales};
    G.nextSpawnT = G.festival ? G.time + 1.0 : Infinity;
    registerZukan(j.type);
    unlockAch('first');
    if (m.just) {
        unlockAch('just1');
        if (save.justTotal >= 10) unlockAch('just10');
    }
    if (dist >= 2000) unlockAch('dist2000');
    if (G.defeated >= 10) unlockAch('ten');
    if (gold) unlockAch('gold');
    persist();
}

/* ---------- ゲームオーバー・結果 ---------- */
function gameOver(j) {
    if (G.state !== 'play') return;
    G.state = 'over';
    G.overT = 0;
    j.state = 'win';
    j.y = STALL_Y - 4;
    j.wx = xOf(j.x);
    j.wz = zOf(j.y);
    for (const o of G.jiis) if (o !== j && o.state !== 'fly') o.state = 'idle';
    say(j, 'win', 3.2);
    SND.play('over');
    G.shake = save.lite ? 0 : 0.15;
    save.plays++;
    persist();
}

function showResult() {
    if (G.state === 'result') return;
    G.state = 'result';
    const rank = getRank(G.sales);
    const rec = {dist: false, sales: false, combo: false};
    if (!G.festival) {
        if (G.maxDist > save.best.dist) {
            save.best.dist = G.maxDist;
            rec.dist = true;
        }
        if (G.sales > save.best.sales) {
            save.best.sales = G.sales;
            rec.sales = true;
        }
        if (G.maxCombo > save.best.combo) {
            save.best.combo = G.maxCombo;
            rec.combo = true;
        }
    }
    const prevTotal = save.total;
    save.total += G.sales;
    persist();
    if (rank === P.RANKS[P.RANKS.length - 1]) unlockAch('legend');
    WEAPONS.filter(w => w.unlock > prevTotal && w.unlock <= save.total).forEach(w => {
        setTimeout(() => {
            toast('新しい道具', w.name);
            SND.play('toast');
        }, 600);
    });
    $('rRank').innerHTML = `称号「<b>${esc(rank.name)}</b>」`;
    $('rStats').innerHTML = `<div>追い返した爺<b>${G.defeated}人</b></div><div>最大コンボ<b>${G.maxCombo}</b></div>` + `<div>合計飛距離<b>${fmt(G.totalDist)}m</b></div><div>最高飛距離<b>${fmt(G.maxDist)}m</b></div>`;
    const nw = f => f ? '<span class="new">NEW</span>' : '';
    $('rBest').innerHTML = `ベスト記録　最高飛距離 ${fmt(save.best.dist)}m${nw(rec.dist)}<br>` + `最高売上 ${fmt(save.best.sales)}円${nw(rec.sales)}　最大コンボ ${save.best.combo}${nw(rec.combo)}<br>` + `<span style="opacity:.6">累計売上 ${fmt(save.total)}円</span>`;
    $('rNote').textContent = G.festival ? 'お祭りモードの記録はベストに残りません' : (G.goldHit ? '金色の爺のご利益があった！' : '');
    showScreen('result');
    const target = G.sales, t0 = performance.now(), el = $('rSales');
    (function step(now) {
        const k = Math.min(1, (now - t0) / 900);
        const s = fmt(target * (1 - Math.pow(1 - k, 3)));
        el.textContent = s;
        if (k < 1 && G.state === 'result') requestAnimationFrame(step);
    })(t0);
}

function postX() {
    const rank = getRank(G.sales).name;
    const text = `出店停止爺を ${G.defeated}人・合計 ${fmt(G.totalDist)}m ぶっ飛ばした！本日の売上 ${fmt(G.sales)}円「${rank}」 #屋台ボッコ`;
    let url = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text);
    if (/^https?:/.test(location.protocol)) url += '&url=' + encodeURIComponent(location.href.split('#')[0]);
    window.open(url, '_blank', 'noopener');
}

/* ---------- 画面切り替え ---------- */
function showScreen(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
}

function makeTitleJii() {
    const j = {type: 'normal', t: 0, state: 'idle', x: 180, y: 0, wx: 0, wz: -2.1, m: buildJii('normal')};
    return j;
}

function showTitle() {
    G.state = 'title';
    resetRun();
    G.titleJii = makeTitleJii();
    updateFestBtn();
    showScreen('title');
}

function startGame() {
    SND.resume();
    SND.play('click');
    if (document.activeElement) document.activeElement.blur();
    resetRun();
    setWeaponModel();
    G.festival = save.fest && save.festOn;
    G.hint = save.plays === 0;
    G.state = 'play';
    showScreen('');
}

function updateFestBtn() {
    const b = $('btnFest');
    b.classList.toggle('show', !!save.fest);
    b.classList.toggle('on', !!save.festOn);
    b.textContent = 'お祭りモード：' + (save.festOn ? 'ON' : 'OFF');
}

function lanternTap(lx, ly) {
    for (const l of WORLD.lanterns) {
        const s = proj([l.x, l.y - 0.45, l.z]);
        const r = Math.max(18, ppu([l.x, l.y, l.z]) * 0.45);
        if (Math.hypot(lx - s.x, ly - s.y) < r) {
            l.kick = 1;
            SND.play('pon');
            const now = performance.now();
            G.lanternTaps = (now - G.lanternLast < 2500) ? G.lanternTaps + 1 : 1;
            G.lanternLast = now;
            if (G.lanternTaps >= P.LANTERN_TAPS && !save.fest) {
                save.fest = true;
                save.festOn = true;
                persist();
                SND.play('secret');
                toast('隠し要素', 'お祭りモード解放！爺さんが3人同時に来る');
                unlockAch('fest');
                updateFestBtn();
            }
            return;
        }
    }
}

/* ============================================================
   描画
   ============================================================ */
const BG_STARS = Array.from({length: 50}, () => ({x: rand(0, W), y: rand(0, 250), r: rand(0.6, 1.7), p: rand(0, 6)}));
let SKY_G;

function resize() {
    VS = Math.min(window.innerWidth / W, window.innerHeight / H);
    DPR = save.lite ? 1 : Math.min(2, window.devicePixelRatio || 1);
    wrap.style.width = W * VS + 'px';
    wrap.style.height = H * VS + 'px';
    wrap.style.fontSize = 16 * VS + 'px';
    for (const c of [bgc, glc, fxc]) {
        c.width = Math.round(W * VS * DPR);
        c.height = Math.round(H * VS * DPR);
    }
    SKY_G = bctx.createLinearGradient(0, 0, 0, 300);
    SKY_G.addColorStop(0, '#0a1230');
    SKY_G.addColorStop(0.6, '#1c2a62');
    SKY_G.addColorStop(1, '#2c3b7c');
}

window.addEventListener('resize', resize);

function drawSky() {
    const c = bctx;
    c.setTransform(VS * DPR, 0, 0, VS * DPR, 0, 0);
    c.fillStyle = SKY_G;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    for (const s of BG_STARS) {
        c.globalAlpha = save.lite ? 0.6 : 0.3 + 0.4 * Math.sin(G.clock * 2 + s.p);
        circ(c, s.x, s.y, s.r);
    }
    c.globalAlpha = 1;
    // 月
    c.fillStyle = '#fff1bf';
    circ(c, 296, 214, 17);
    c.fillStyle = '#22306a';
    circ(c, 303, 208, 15);
    // 追い返した爺の星
    for (const s of G.stars) {
        const tw = 1 + 0.25 * Math.sin(G.clock * 4 + s.p);
        c.fillStyle = 'rgba(255,246,176,.25)';
        circ(c, s.x, s.y, 9 * tw);
        c.fillStyle = s.gold ? '#ffe680' : '#fff6b0';
        star4(c, s.x, s.y, 7 * tw);
    }
}

function render3D() {
    gl.viewport(0, 0, glc.width, glc.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let eye = CAM.eye, target = CAM.target;
    if (G.shake > 0 && !save.lite) {
        const s = G.shake, o = [rand(-1, 1) * s, rand(-1, 1) * s, 0];
        eye = v3.add(eye, o);
        target = v3.add(target, o);
    }
    setCamera(eye, target, CAM.fov, W / H);
    // 提灯の揺れ
    for (const l of WORLD.lanterns) {
        l.g.r = [Math.sin(G.clock * 1.2 + l.ph) * (save.lite ? 0 : 0.05), 0, (save.lite ? 0 : Math.sin(G.clock * 1.4 + l.ph) * 0.06) + l.kick * Math.sin(G.clock * 16) * 0.45];
    }
    const roots = [WORLD.node, WORLD.lroot];
    const inRange = G.state !== 'title' && !!frontJii();
    WORLD.range.ga = G.state === 'title' ? 0 : (inRange ? 0.16 + 0.06 * Math.sin(G.clock * 10) : 0.07);
    roots.push(WORLD.range);
    const js = G.state === 'title' ? [G.titleJii] : G.jiis;
    for (const j of js) {
        poseJii(j, j.m);
        roots.push(j.m.root, j.m.shadow);
    }
    if (G.state !== 'title') {
        poseWeapon();
        roots.push(ARM.root);
    }
    drawScene(roots);
}

function poseWeapon() {
    setWeaponModel();
    const rest = v3.norm([-0.25, 1, -0.18]), restLen = 1.0;
    let d = rest, len = restLen + (save.lite ? 0 : Math.sin(G.clock * 2) * 0.02);
    if (G.swingT > 0) {
        const k = Math.pow(G.swingT / SWING_DUR, 0.6);
        const to = v3.sub(G.swingTarget, HAND_PIVOT);
        d = v3.norm(v3.lerp(rest, v3.norm(to), k));
        len = restLen + (Math.max(restLen, v3.len(to) - 0.15) - restLen) * k;
    }
    if (G.numb > 0) d = v3.norm(v3.add(d, [Math.sin(G.clock * 70) * 0.06, 0, 0]));
    alignY(ARM.holder, d);
    ARM.w.setLen(len);
}

/* 吹き出し・2D演出 */
const NO_HEAD = '、。！？!?〜ー…）」』♪ぁぃぅぇぉっゃゅょァィゥェォッャュョ';

function wrapText(c, text, maxW) {
    const lines = [];
    let cur = '';
    for (const ch of text) {
        const test = cur + ch;
        if (c.measureText(test).width > maxW && cur && !NO_HEAD.includes(ch)) {
            lines.push(cur);
            cur = ch;
        } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
}

function drawBubble(c, text, x, y, fs, alpha) {
    if (fs < 4) return;
    c.save();
    c.globalAlpha = alpha;
    c.font = `900 ${fs}px ${FONT}`;
    const lines = wrapText(c, text, fs * 11), lh = fs * 1.28;
    let tw = 0;
    for (const l of lines) tw = Math.max(tw, c.measureText(l).width);
    const pad = fs * 0.6, bw = tw + pad * 2, bh = lines.length * lh + pad * 1.1, tail = fs * 0.7;
    const bx = Math.max(6, Math.min(W - 6 - bw, x - bw / 2));
    const by = Math.max(6, y - tail - bh);
    const tx = Math.max(bx + fs, Math.min(bx + bw - fs, x)), tipX = Math.max(bx, Math.min(bx + bw, x));
    const path = () => {
        rrect(c, bx, by, bw, bh, Math.min(fs * 0.8, bh / 2));
        c.moveTo(tx - tail * 0.7, by + bh - 1);
        c.lineTo(tipX, by + bh + tail);
        c.lineTo(tx + tail * 0.7, by + bh - 1);
    };
    c.lineJoin = 'round';
    c.strokeStyle = COL.ink;
    c.lineWidth = Math.max(1.5, fs * 0.2);
    path();
    c.stroke();
    c.fillStyle = '#fff';
    rrect(c, bx, by, bw, bh, Math.min(fs * 0.8, bh / 2));
    c.fill();
    c.beginPath();
    c.moveTo(tx - tail * 0.7, by + bh - 1);
    c.lineTo(tipX, by + bh + tail);
    c.lineTo(tx + tail * 0.7, by + bh - 1);
    c.closePath();
    c.fill();
    c.fillStyle = COL.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, bx + bw / 2, by + pad * 0.55 + lh * (i + 0.5)));
    c.restore();
}

function bubbleAlpha(b) {
    return Math.min(1, b.t / 0.08, (b.dur - b.t) / 0.25);
}

function drawAnger(c, j) {
    const f = faceOf(j.state);
    if (f !== 'angry' && f !== 'hit' && f !== 'block') return;
    const p = [j.wx + 0.48, 2.28 + (j.state === 'win' ? 0 : 0), j.wz], s = proj(p), k = ppu(p) * 0.012;
    c.save();
    c.translate(s.x, s.y);
    const pu = (1 + Math.sin(j.t * 8) * 0.1) * k;
    c.scale(pu, pu);
    c.lineCap = 'round';
    for (const [col, lw] of [[COL.ink, 7], [COL.red, 3.6]]) {
        c.strokeStyle = col;
        c.lineWidth = lw;
        for (let i = 0; i < 4; i++) {
            c.rotate(Math.PI / 2);
            c.beginPath();
            c.moveTo(2.5, -9);
            c.quadraticCurveTo(2.5, -2.5, 9, -2.5);
            c.stroke();
        }
    }
    c.restore();
}

function drawDizzy(c, j) {
    if (j.state !== 'stun') return;
    const p = [j.wx, 2.35, j.wz], s = proj(p), k = ppu(p);
    c.fillStyle = COL.yellow;
    c.strokeStyle = COL.ink;
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const a = j.t * 5 + i * 2.09;
        star4(c, s.x + Math.cos(a) * k * 0.55, s.y + Math.sin(a) * k * 0.15, 6);
    }
}

function drawParticles(c) {
    for (const p of G.parts) {
        c.globalAlpha = Math.min(1, p.life / p.max * 1.6);
        c.fillStyle = p.col;
        if (p.star) star4(c, p.x, p.y, p.r * 1.6); else circ(c, p.x, p.y, p.r);
    }
    c.globalAlpha = 1;
}

function drawTexts(c) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const t of G.texts) {
        const k = 1 - t.life / t.max;
        const sc = k < 0.12 ? 0.6 + k / 0.12 * 0.6 : 1.2 - Math.min(0.2, (k - 0.12) * 0.6);
        c.save();
        c.translate(t.x, t.y - k * 18);
        c.rotate(t.rot);
        c.scale(sc, sc);
        c.globalAlpha = Math.min(1, (t.life / t.max) / 0.3);
        c.font = `900 ${t.size}px ${FONT}`;
        c.lineJoin = 'round';
        c.lineWidth = t.size * 0.3;
        c.strokeStyle = COL.ink;
        c.strokeText(t.text, t.size * 0.04, t.size * 0.08);
        c.strokeText(t.text, 0, 0);
        c.fillStyle = t.color;
        c.fillText(t.text, 0, 0);
        c.restore();
    }
}

function decoText(c, text, x, y, size, fill, align) {
    c.font = `900 ${size}px ${FONT}`;
    c.textAlign = align || 'center';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.28;
    c.strokeStyle = COL.ink;
    c.strokeText(text, x + size * 0.04, y + size * 0.07);
    c.strokeText(text, x, y);
    c.fillStyle = fill;
    c.fillText(text, x, y);
}

function drawMeter(c) {
    const m = G.meter, x0 = 40, w = 280, y = 142, h = 26;
    c.fillStyle = '#fffaf0';
    c.strokeStyle = COL.ink;
    c.lineWidth = 3.5;
    rrect(c, 20, 100, 320, 96, 18);
    c.fill();
    c.stroke();
    c.textBaseline = 'middle';
    decoText(c, 'トドメ！ まんなかで止めろ！', 180, 122, 19, COL.yellow);
    c.fillStyle = '#e4dccd';
    rrect(c, x0, y, w, h, 8);
    c.fill();
    c.fillStyle = 'rgba(255,210,63,.85)';
    c.fillRect(x0 + w * 0.25, y, w * 0.5, h);
    const jw = w * (1 - P.JUST_THRESHOLD);
    c.fillStyle = COL.red;
    c.fillRect(180 - jw / 2, y, jw, h);
    c.lineWidth = 3;
    rrect(c, x0, y, w, h, 8);
    c.stroke();
    c.fillStyle = COL.ink;
    c.font = `900 10px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('JUST', 180, y + h + 11);
    const nx = x0 + w * m.pos;
    c.fillStyle = (m.stopped && Math.sin(G.clock * 30) > 0) ? COL.yellow : '#fff';
    c.lineWidth = 2.5;
    c.beginPath();
    c.rect(nx - 3, y - 6, 6, h + 12);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(nx - 9, y - 16);
    c.lineTo(nx + 9, y - 16);
    c.lineTo(nx, y - 6);
    c.closePath();
    c.fill();
    c.stroke();
}

function drawHUD(c) {
    const g = c.createLinearGradient(0, 0, 0, 110);
    g.addColorStop(0, 'rgba(11,18,48,.85)');
    g.addColorStop(0.7, 'rgba(11,18,48,.55)');
    g.addColorStop(1, 'rgba(11,18,48,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, 110);
    c.textBaseline = 'alphabetic';
    decoText(c, '本日の売上', 16, 22, 11, '#fff', 'left');
    decoText(c, fmt(G.salesShown) + '円', 16, 52, 27, COL.yellow, 'left');
    decoText(c, '怒りゲージ', 16, 70, 11, '#fff', 'left');
    decoText(c, `追い返した爺 ${G.defeated}人`, 344, 70, 12, '#fff', 'right');
    if (G.festival) decoText(c, 'お祭りモード', 344, 54, 11, COL.yellow, 'right');
    const gx = 16, gy = 76, gw = 328, gh = 14;
    c.fillStyle = 'rgba(255,255,255,.18)';
    rrect(c, gx, gy, gw, gh, 7);
    c.fill();
    const f = clamp(G.gauge / P.GAUGE_MAX, 0, 1);
    if (f > 0) {
        c.fillStyle = (f >= 1 && Math.sin(G.clock * 24) > 0) ? COL.yellow : COL.red;
        rrect(c, gx, gy, Math.max(gh, gw * f), gh, 7);
        c.fill();
    }
    c.strokeStyle = COL.ink;
    c.lineWidth = 3;
    rrect(c, gx, gy, gw, gh, 7);
    c.stroke();
    if (G.combo >= 2) {
        const sc = 1 + G.comboPulse * 0.25;
        c.save();
        c.translate(340, 150);
        c.scale(sc, sc);
        decoText(c, String(G.combo), 0, 0, 46, G.combo >= 10 ? COL.red : COL.yellow, 'right');
        decoText(c, 'コンボ', 0, 22, 15, '#fff', 'right');
        c.restore();
    }
    if (G.hint && G.state === 'play' && G.jiis.length) {
        c.textBaseline = 'middle';
        decoText(c, 'タップでたたく！', 180, 600 + Math.sin(G.clock * 5) * 4, 26, '#fff');
    }
    const d = G.distShow;
    if (d && d.t < 2.6) {
        c.save();
        c.globalAlpha = Math.min(1, (2.6 - d.t) / 0.4);
        c.textBaseline = 'middle';
        const k = Math.min(1, d.t / 1.1), v = d.v * (1 - Math.pow(1 - k, 3));
        decoText(c, d.just ? 'ジャスト！ ぶっ飛び距離' : 'ぶっ飛び距離', 180, 404, 14, '#fff');
        decoText(c, fmt(v) + ' m', 180, 442, 48, COL.yellow);
        if (d.t > 0.9) decoText(c, '+' + fmt(d.sales) + '円' + (d.gold ? '（ご利益×' + P.GOLD_BONUS + '）' : ''), 180, 478, 18, '#fff');
        c.restore();
    }
}

function drawOver(c) {
    const k = Math.min(1, G.overT / 0.5);
    c.fillStyle = `rgba(11,18,48,${0.4 * k})`;
    c.fillRect(0, 0, W, H);
    if (G.overT < 0.3) return;
    const e = Math.min(1, (G.overT - 0.3) / 0.35), dy = (1 - e) * -50;
    c.textBaseline = 'middle';
    decoText(c, '閉店…', 180, 175 + dy, 64, COL.red);
    decoText(c, '爺さんに屋台をとられた！', 180, 222, 16, '#fff');
    if (G.overT > 1.2) {
        c.globalAlpha = 0.6 + 0.4 * Math.sin(G.clock * 5);
        decoText(c, 'タップで結果へ', 180, 252, 13, '#fff');
        c.globalAlpha = 1;
    }
}

function renderFx() {
    const c = ctx;
    c.setTransform(VS * DPR, 0, 0, VS * DPR, 0, 0);
    c.clearRect(0, 0, W, H);
    const js = G.state === 'title' ? [] : G.jiis;
    for (const j of js) if (j.state !== 'fly') {
        drawAnger(c, j);
        drawDizzy(c, j);
    }
    const ground = js.filter(j => j.state !== 'fly').sort((a, b) => a.y - b.y);
    for (const j of ground) if (j.bubble) {
        const hop = j.state === 'win' ? Math.abs(Math.sin(j.t * 7)) * 0.35 : 0;
        const s = proj([j.wx, 2.5 + hop, j.wz]);
        drawBubble(c, j.bubble.text, s.x, s.y, 15, bubbleAlpha(j.bubble));
    }
    for (const j of js) if (j.state === 'fly' && j.bubble) {
        const p = [j.wx, j.wy + 1.3 * j.fs, j.wz], s = proj(p);
        drawBubble(c, j.bubble.text, s.x, s.y, 15 * clamp(ppu(p) * j.fs / j.ppu0, 0, 1.3), bubbleAlpha(j.bubble));
    }
    drawParticles(c);
    if (G.state === 'play' || G.state === 'meter' || G.state === 'over') drawHUD(c);
    if (G.state === 'meter') drawMeter(c);
    drawTexts(c);
    if (G.state === 'over') drawOver(c);
    if (G.flash > 0) {
        c.fillStyle = `rgba(255,255,255,${Math.min(0.85, G.flash)})`;
        c.fillRect(0, 0, W, H);
    }
}

/* ============================================================
   更新ループ
   ============================================================ */
function update(dt) {
    G.clock += dt;
    for (const l of WORLD.lanterns) l.kick *= Math.pow(0.03, dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 0.9);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 3);
    if (G.state === 'title') {
        G.titleJii.t += dt;
        return;
    }
    if (G.state === 'result') {
        updateFx(dt);
        return;
    }
    if (G.freeze > 0) {
        G.freeze -= dt;
        return;
    }
    updateFx(dt);
    if (G.swingT > 0) G.swingT = Math.max(0, G.swingT - dt);
    if (G.comboPulse > 0) G.comboPulse = Math.max(0, G.comboPulse - dt * 4);
    G.salesShown += (G.sales - G.salesShown) * Math.min(1, dt * 6);
    if (Math.abs(G.sales - G.salesShown) < 1) G.salesShown = G.sales;
    if (G.distShow) G.distShow.t += dt;

    if (G.state === 'play') {
        G.time += dt;
        if (G.numb > 0) G.numb -= dt;
        if (G.time - G.lastHitT > P.GAUGE_DECAY_DELAY && G.gauge > 0) G.gauge = Math.max(0, G.gauge - P.GAUGE_DECAY * dt);
        if (G.combo > 0 && G.lastHitT > 0 && G.time - G.lastHitT > P.COMBO_WINDOW * weapon().comboMul) G.combo = 0;
        const active = G.jiis.filter(j => j.state !== 'fly').length;
        const need = G.festival ? P.FESTIVAL_COUNT : 1;
        if (active < need && G.time >= G.nextSpawnT) {
            spawnJii();
            if (G.festival) G.nextSpawnT = G.time + 1.3;
        }
        for (const j of G.jiis.slice()) updateJii(j, dt);
    } else if (G.state === 'meter') {
        updateMeter(dt);
        for (const j of G.jiis) if (j.state === 'fly') updateJii(j, dt);
    } else if (G.state === 'over') {
        G.overT += dt;
        for (const j of G.jiis) updateJii(j, dt);
        if (G.overT > 3.2) showResult();
    }
    G.jiis = G.jiis.filter(j => j.state !== 'gone');
}

let last = performance.now();

function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    update(dt);
    drawSky();
    render3D();
    renderFx();
    requestAnimationFrame(loop);
}

/* ============================================================
   メニュー（どうぐ・図鑑・セリフ帳・実績）
   ============================================================ */
function drawWeaponShape(c, id, len) {   // どうぐ一覧のアイコン用（2D）
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = COL.ink;
    const ink = (f) => {
        c.lineWidth = 3;
        f();
    };
    switch (id) {
        case 'pick':
            c.strokeStyle = COL.ink;
            c.lineWidth = 8;
            ln(c, 0, 0, len - 8, 0);
            c.strokeStyle = '#efdcae';
            c.lineWidth = 4;
            ln(c, 0, 0, len - 8, 0);
            c.fillStyle = '#c97b3a';
            c.lineWidth = 3;
            c.strokeStyle = COL.ink;
            c.beginPath();
            c.arc(len - 6, 0, 12, 0, 7);
            c.fill();
            c.stroke();
            c.fillStyle = '#5a2e1a';
            ell(c, len - 6, -5, 9, 4);
            break;
        case 'hera':
            c.lineWidth = 11;
            ln(c, 0, 0, len * 0.55, 0);
            c.strokeStyle = '#6b3f24';
            c.lineWidth = 7;
            ln(c, 0, 0, len * 0.55, 0);
            c.fillStyle = '#d6dce8';
            c.strokeStyle = COL.ink;
            c.lineWidth = 3;
            rrect(c, len * 0.55, -14, len * 0.45, 28, 4);
            c.fill();
            c.stroke();
            break;
        case 'wataame':
            c.lineWidth = 8;
            ln(c, 0, 0, len * 0.65, 0);
            c.strokeStyle = '#fff';
            c.lineWidth = 4;
            ln(c, 0, 0, len * 0.65, 0);
            c.fillStyle = '#ffb3d1';
            c.strokeStyle = COL.ink;
            c.lineWidth = 3;
            for (const [x, y, r] of [[0.72, 0, 16], [0.84, -11, 18], [0.86, 12, 16], [0.98, 0, 17]]) {
                c.beginPath();
                c.arc(len * x, y, r, 0, 7);
                c.stroke();
            }
            for (const [x, y, r] of [[0.72, 0, 16], [0.84, -11, 18], [0.86, 12, 16], [0.98, 0, 17]]) circ(c, len * x, y, r);
            break;
        case 'poi':
            c.lineWidth = 12;
            ln(c, 0, 0, len * 0.6, 0);
            c.strokeStyle = COL.red;
            c.lineWidth = 8;
            ln(c, 0, 0, len * 0.6, 0);
            c.fillStyle = '#fff';
            circ(c, len * 0.82, 0, 22);
            c.strokeStyle = COL.red;
            c.lineWidth = 6;
            c.beginPath();
            c.arc(len * 0.82, 0, 22, 0, 7);
            c.stroke();
            c.fillStyle = '#ff8a3d';
            ell(c, len * 0.82 + 4, 3, 7, 4);
            break;
        case 'uchiwa':
            c.lineWidth = 11;
            ln(c, 0, 0, len * 0.55, 0);
            c.strokeStyle = '#8b5a2b';
            c.lineWidth = 7;
            ln(c, 0, 0, len * 0.55, 0);
            c.fillStyle = COL.red;
            c.strokeStyle = COL.ink;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(len * 0.8, 0, 40, 0, 7);
            c.fill();
            c.stroke();
            c.fillStyle = COL.yellow;
            circ(c, len * 0.8, 0, 25);
            c.fillStyle = COL.red;
            circ(c, len * 0.8, 0, 10);
            break;
    }
    void ink;
}

function smallCanvas(el, size, drawFn) {
    const pr = Math.max(1, VS * (window.devicePixelRatio || 1));
    el.width = Math.round(size * pr);
    el.height = Math.round(size * pr);
    const c = el.getContext('2d');
    c.setTransform(pr, 0, 0, pr, 0, 0);
    drawFn(c, el);
}

function silhouette(c, size) {
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = '#2b3a72';
    c.fillRect(0, 0, size, size);
    c.globalCompositeOperation = 'source-over';
}

// 3Dの爺さんを小さなキャンバスに描く（図鑑用）
function renderPortrait(type, el) {
    const px = Math.min(glc.width, glc.height, Math.max(64, el.width));
    const j = {type, t: 0.35, state: 'idle', wx: 0, wz: 0, m: buildJii(type)};
    gl.viewport(0, 0, px, px);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, px, px);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    setCamera([1.1, 1.75, 4.3], [0, 1.15, 0], 34, 1);
    poseJii(j, j.m);
    j.m.shadow.vis = false;
    drawScene([j.m.root], {fogNear: 100, fogFar: 200});
    const c = el.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, el.width, el.height);
    c.drawImage(glc, 0, glc.height - px, px, px, 0, 0, el.width, el.height);
}

function openMenu(kind) {
    SND.resume();
    SND.play('click');
    const body = $('mBody');
    let title = '', html = '';
    if (kind === 'weapon') {
        title = 'どうぐ';
        html = `<div class="msub">累計売上 ${fmt(save.total)}円 ／ タップで持ちかえ</div>` + WEAPONS.map(w => {
            const un = save.total >= w.unlock, sel = weapon().id === w.id;
            return `<div class="witem ${un ? '' : 'locked'} ${sel ? 'sel' : ''}" data-w="${w.id}">
        <canvas data-wi="${w.id}"></canvas>
        <div><b>${un ? esc(w.name) : '？？？'}</b>
        <span>${un ? esc(w.desc) : `累計売上 ${fmt(w.unlock)}円で解放`}</span>
        ${un ? `<span class="wst">飛距離×${w.distMul}　ゲージ×${w.gaugeMul}　コンボ受付×${w.comboMul}　押し戻し×${w.knockMul}</span>` : ''}</div>
        ${sel ? '<i>使用中</i>' : ''}</div>`;
        }).join('');
    } else if (kind === 'zukan') {
        const keys = Object.keys(JII_TYPES), got = keys.filter(k => save.zukan[k]).length;
        title = `爺さん図鑑 ${got}/${keys.length}`;
        html = '<div class="zgrid">' + keys.map(k => {
            const T = JII_TYPES[k], ok = save.zukan[k];
            return `<div class="zc"><canvas data-zi="${k}"></canvas><b>${ok ? esc(T.name) : '？？？'}</b>
        <p>${ok ? esc(T.profile) : 'まだ追い返していない'}</p>
        ${ok ? `<q>${esc(SERIFU[k].enter[0])}</q>` : ''}</div>`;
        }).join('') + '</div>';
    } else if (kind === 'serif') {
        const got = ALL_SERIF.filter(s => save.serif[s.text]).length;
        title = `セリフ帳 ${got}/${ALL_SERIF.length}`;
        html = Object.keys(SERIFU).map(type => {
            const list = ALL_SERIF.filter(s => s.type === type);
            const name = save.zukan[type] || type === 'normal' ? JII_TYPES[type].name : '？？？';
            return `<div class="sgroup"><h4>${esc(name)}</h4>` + list.map(s => save.serif[s.text] ? `<div class="sline"><i>${SITU_LABEL[s.sit]}</i>${esc(s.text)}</div>` : `<div class="sline no"><i>${SITU_LABEL[s.sit]}</i>？？？</div>`).join('') + '</div>';
        }).join('');
    } else if (kind === 'ach') {
        const got = ACHIEVEMENTS.filter(a => save.ach[a.id]).length;
        title = `実績 ${got}/${ACHIEVEMENTS.length}`;
        html = `<div class="msub">ジャストトドメ通算 ${save.justTotal}回</div>` + ACHIEVEMENTS.map(a => `<div class="aitem ${save.ach[a.id] ? 'ok' : ''}"><div class="mk">${save.ach[a.id] ? '★' : '・'}</div>
       <div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div></div>`).join('');
    }
    $('mTitle').textContent = title;
    body.innerHTML = html;
    showScreen('menu');
    body.querySelectorAll('canvas[data-wi]').forEach(el => {
        const w = WEAPONS.find(x => x.id === el.dataset.wi), un = save.total >= w.unlock;
        smallCanvas(el, 60, c => {
            c.save();
            c.translate(10, 52);
            c.rotate(-0.8);
            c.scale(0.55, 0.55);
            drawWeaponShape(c, w.id, 110);
            c.fillStyle = '#fff';
            c.strokeStyle = COL.ink;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(0, 0, 12, 0, 7);
            c.fill();
            c.stroke();
            c.restore();
            if (!un) silhouette(c, 60);
        });
    });
    body.querySelectorAll('canvas[data-zi]').forEach(el => {
        const k = el.dataset.zi, pr = Math.max(1, VS * (window.devicePixelRatio || 1));
        el.width = el.height = Math.round(86 * pr);
        renderPortrait(k, el);
        if (!save.zukan[k]) {
            const c = el.getContext('2d');
            silhouette(c, el.width);
        }
    });
    body.querySelectorAll('.witem').forEach(el => el.addEventListener('click', () => {
        const w = WEAPONS.find(x => x.id === el.dataset.w);
        if (save.total < w.unlock) return;
        save.weapon = w.id;
        persist();
        openMenu('weapon');
    }));
    body.parentElement.scrollTop = 0;
}

/* ============================================================
   入力・ボタン
   ============================================================ */
const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';

function updateTopBtns() {
    $('btnMute').innerHTML = save.mute ? ICON_OFF : ICON_ON;
    $('btnMute').classList.toggle('on', !!save.mute);
    $('btnLite').classList.toggle('on', !!save.lite);
}

$('btnMute').addEventListener('click', e => {
    save.mute = !save.mute;
    persist();
    updateTopBtns();
    SND.resume();
    SND.play('click');
    e.currentTarget.blur();
});
$('btnLite').addEventListener('click', e => {
    save.lite = !save.lite;
    persist();
    updateTopBtns();
    resize();
    SND.play('click');
    toast('軽量モード', save.lite ? 'ON（輪郭線・光・揺れをひかえめに）' : 'OFF');
    e.currentTarget.blur();
});
$('btnStart').addEventListener('click', startGame);
$('btnRetry').addEventListener('click', startGame);
$('btnTop').addEventListener('click', () => {
    SND.play('click');
    showTitle();
});
$('btnPost').addEventListener('click', () => {
    SND.play('click');
    postX();
});
$('btnFest').addEventListener('click', e => {
    save.festOn = !save.festOn;
    persist();
    updateFestBtn();
    SND.resume();
    SND.play('click');
    e.currentTarget.blur();
});
$('mClose').addEventListener('click', () => {
    SND.play('click');
    showScreen('title');
});
document.querySelectorAll('.minis button').forEach(b => b.addEventListener('click', () => openMenu(b.dataset.m)));

document.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('button,.panel')) return;
    e.preventDefault();
    SND.resume();
    if (G.state === 'title') {
        const r = fxc.getBoundingClientRect();
        lanternTap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
        return;
    }
    if (G.state === 'play' || G.state === 'meter' || G.state === 'over') action();
}, {passive: false});
const menuOpen = () => $('menu').classList.contains('on');
window.addEventListener('keydown', e => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    e.preventDefault();
    if (e.repeat || menuOpen()) return;
    if (G.state === 'title' || G.state === 'result') startGame(); else action();
});
window.addEventListener('keyup', e => {
    if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- 起動 ---------- */
resize();
updateTopBtns();
setWeaponModel();
showTitle();
requestAnimationFrame(loop);
