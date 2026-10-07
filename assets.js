// assets.js
// ============================================================
//  NGUỒN ẢNH THEO ID + CROP SPRITE + VẼ CANVAS FALLBACK
//  ƯU TIÊN: cardimage > monsterimage > canvas > ghost
// ============================================================
const CARD_IMAGE_PATH = "assets/cardimage/";
const MONSTER_IMAGE_PATH = "assets/monsterimage/";

const CARD_IMAGES = {};
const MONSTER_IMAGES = {};
const CARD_URLS = {};
const CARD_READY = {};
const SPRITE_URLS = {};
const SPRITE_TMP = {};
const SPRITE_META = {};
const GHOST_CACHE = {};
const ID_REGISTRY = {};

function cssUrl(u) { return u ? `url(${JSON.stringify(u)})` : "none"; }

function registerMonsterImage(id, path) {
    MONSTER_IMAGES[id] = path;
    SPRITE_URLS[id] = path;
    SPRITE_META[id] = "sheet";
    ID_REGISTRY[id] = Object.assign(ID_REGISTRY[id] || {}, { monster: path });
}
function registerCardImage(id, path) {
    CARD_IMAGES[id] = path;
    CARD_URLS[id] = path;
    CARD_READY[id] = true;
    ID_REGISTRY[id] = Object.assign(ID_REGISTRY[id] || {}, { card: path });
}
function registerCharacter(id, opts) {
    opts = opts || {};
    ID_REGISTRY[id] = Object.assign(ID_REGISTRY[id] || {}, opts);
    if (opts.monster) registerMonsterImage(id, opts.monster);
    if (opts.card) registerCardImage(id, opts.card);
}

function getCardImage(id) { return CARD_URLS[id] || CARD_IMAGES[id] || ""; }
function hasRealSprite(id) { return !!SPRITE_URLS[id]; }
function hasRealCard(id) { return !!(CARD_URLS[id] || CARD_IMAGES[id]); }
function isCardReady(id) { return !!CARD_READY[id]; }
function isSheetSprite(id) {
    if (SPRITE_META[id]) return SPRITE_META[id] === "sheet";
    return !SPRITE_URLS[id];
}

// ============================================================
//  CROP SPRITE
// ============================================================
function cropSpriteStyle(id, view, side) {
    const url = SPRITE_URLS[id] || SPRITE_TMP[id] || "";
    if (!url) return "";

    const base = `background-image:${cssUrl(url)};background-repeat:no-repeat;`;
    const isSheet = isSheetSprite(id);

    if (!isSheet) {
        return base + "background-size:contain;background-position:center;";
    }

    let v = view;
    if (v === "auto") v = (side === "player") ? "back" : "front";

    const pos = (v === "back") ? "100% 50%" : "0% 50%";
    return base + `background-size:200% 100%;background-position:${pos};`;
}

function applyCrop(el, id, view, side) {
    if (!el) return;
    const url = SPRITE_URLS[id] || SPRITE_TMP[id] || "";
    if (!url) { el.style.backgroundImage = "none"; return; }

    el.style.backgroundImage = cssUrl(url);
    el.style.backgroundRepeat = "no-repeat";

    const isSheet = isSheetSprite(id);
    if (!isSheet) {
        el.style.backgroundSize = "contain";
        el.style.backgroundPosition = "center";
        return;
    }

    let v = view;
    if (v === "auto") v = (side === "player") ? "back" : "front";

    el.style.backgroundSize = "200% 100%";
    el.style.backgroundPosition = (v === "back") ? "100% 50%" : "0% 50%";
}

// ============================================================
//  ART DÙNG CHO Ô VẼ THẺ
// ============================================================
function getArtForCard(id, index) {
    const c = getCardImage(id);
    if (c) return { url: c, kind: "card" };
    if (SPRITE_URLS[id]) return { url: SPRITE_URLS[id], kind: isSheetSprite(id) ? "sheet" : "single" };
    if (SPRITE_TMP[id]) return { url: SPRITE_TMP[id], kind: "drawn" };
    const s = (typeof getSprite === "function") ? getSprite(id, index) : null;
    if (s) return { url: s, kind: SPRITE_TMP[id] ? "drawn" : "ghost" };
    return { url: "", kind: "ghost" };
}

function artStyleFor(kind, url, view) {
    if (!url) return "background-image:none";
    const img = `background-image:${cssUrl(url)};background-repeat:no-repeat;`;
    if (kind === "card") return img + "background-size:cover;background-position:center;";
    if (kind === "single") return img + "background-size:contain;background-position:center;";
    if (kind === "ghost") return img + "background-size:200% 100%;background-position:0% 50%;";
    const pos = (view === "back") ? "100% 50%" : "0% 50%";
    return img + `background-size:200% 100%;background-position:${pos};`;
}

// ============================================================
//  MÀU
// ============================================================
function hexToRgb(hex) {
    let h = String(hex).replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    if (isNaN(n)) return { r: 139, g: 108, b: 255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const f = v => Math.max(0, Math.min(255, Math.round(v + (t - v) * p)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgba(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}

// ============================================================
//  VẼ QUÁI VẬT (chỉ dùng khi KHÔNG có card + KHÔNG có monster)
// ============================================================
function makeCtx(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    return { c, ctx };
}
function ell(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function circ(ctx, x, y, r, fill, stroke, lw) { ell(ctx, x, y, r, r, fill, stroke, lw); }
function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function strokePath(ctx, pts, color, lw) {
    if (!pts || pts.length < 2) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
}
function eye(ctx, x, y, scl, iris, angry) {
    scl = scl || 1;
    ell(ctx, x, y, 9 * scl, 10 * scl, "#ffffff", shade(iris, -0.5), 2);
    ell(ctx, x, y + 1, 4.5 * scl, 6 * scl, iris);
    circ(ctx, x, y + 3 * scl, 2 * scl, "#111");
    circ(ctx, x - 2 * scl, y - 3 * scl, 1.8 * scl, "#fff");
    if (angry) strokePath(ctx, [[x - 11 * scl, y - 13 * scl], [x + 8 * scl, y - 7 * scl]], shade(iris, -0.6), 4);
}
function shadowPad(ctx) { ell(ctx, 110, 196, 66, 13, "rgba(0,0,0,0.28)"); }

const SHAPES = {
    beast(ctx, s, back) {
        const { body, belly, accent } = s;
        const out = shade(body, -0.55);
        shadowPad(ctx);
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i - 2) * 0.34;
            poly(ctx, [[110 + Math.cos(a) * 34, 76 + Math.sin(a) * 34],
            [110 + Math.cos(a) * 56, 76 + Math.sin(a) * 56],
            [110 + Math.cos(a + 0.22) * 34, 76 + Math.sin(a + 0.22) * 34]], shade(body, -0.2), out, 3);
        }
        ell(ctx, 110, 136, 64, 56, body, out, 4);
        ell(ctx, 52, 148, 19, 30, body, out, 4);
        ell(ctx, 168, 148, 19, 30, body, out, 4);
        for (const sx of [45, 175]) for (let i = -1; i <= 1; i++)
            poly(ctx, [[sx + i * 7, 172], [sx + i * 7 + 4, 182], [sx + i * 7 - 2, 181]], "#f5f0e6");
        ell(ctx, 84, 184, 23, 16, body, out, 4);
        ell(ctx, 136, 184, 23, 16, body, out, 4);
        for (const sx of [72, 84, 96, 124, 136, 148])
            poly(ctx, [[sx, 188], [sx + 6, 196], [sx - 2, 196]], "#f5f0e6");
        if (!back) {
            ell(ctx, 110, 156, 42, 34, belly);
            ell(ctx, 110, 156, 42, 34, null, shade(belly, -0.3), 2);
            circ(ctx, 110, 76, 46, body, out, 4);
            poly(ctx, [[74, 44], [92, 66], [60, 64]], shade(body, -0.15), out, 3);
            poly(ctx, [[146, 44], [128, 66], [160, 64]], shade(body, -0.15), out, 3);
            ell(ctx, 110, 92, 30, 21, shade(body, 0.14), out, 3);
            ell(ctx, 100, 88, 5, 7, shade(body, -0.5));
            ell(ctx, 120, 88, 5, 7, shade(body, -0.5));
            strokePath(ctx, [[96, 103], [110, 108], [124, 103]], shade(body, -0.5), 3);
            poly(ctx, [[86, 98], [78, 122], [96, 108]], "#f7f2e4", shade(body, -0.5), 2);
            poly(ctx, [[134, 98], [142, 122], [124, 108]], "#f7f2e4", shade(body, -0.5), 2);
            eye(ctx, 88, 62, 1.05, accent, true);
            eye(ctx, 132, 62, 1.05, accent, true);
        } else {
            ell(ctx, 110, 140, 44, 40, shade(body, -0.12));
            for (let i = -1; i <= 1; i++)
                strokePath(ctx, [[110 + i * 26, 106], [110 + i * 30, 150]], shade(body, 0.18), 4);
            circ(ctx, 110, 74, 46, body, out, 4);
            ell(ctx, 110, 74, 30, 26, shade(body, -0.16));
        }
    },
    dragon(ctx, s, back) {
        const { body, belly, accent } = s;
        const out = shade(body, -0.55);
        shadowPad(ctx);
        if (s.wings) {
            poly(ctx, [[70, 118], [8, 78], [26, 140], [4, 156], [70, 156]], shade(accent, -0.1), out, 3);
            poly(ctx, [[150, 118], [212, 78], [194, 140], [216, 156], [150, 156]], shade(accent, -0.1), out, 3);
        }
        strokePath(ctx, [[150, 158], [186, 174], [202, 152]], body, 16);
        strokePath(ctx, [[150, 158], [186, 174], [202, 152]], out, 3);
        poly(ctx, [[198, 158], [216, 138], [212, 164], [224, 176], [204, 176]], accent, out, 3);
        ell(ctx, 110, 142, 54, 46, body, out, 4);
        ell(ctx, 82, 184, 22, 15, body, out, 4);
        ell(ctx, 138, 184, 22, 15, body, out, 4);
        for (const sx of [70, 82, 94, 126, 138, 150])
            poly(ctx, [[sx, 189], [sx + 6, 197], [sx - 2, 197]], "#fdf6e3");
        ell(ctx, 66, 146, 14, 22, body, out, 4);
        ell(ctx, 154, 146, 14, 22, body, out, 4);
        for (let i = 0; i < 4; i++) {
            const x = 78 + i * 22;
            poly(ctx, [[x, 108 - i * 3], [x + 9, 88 - i * 4], [x + 18, 108 - i * 3]], accent, out, 2);
        }
        if (!back) {
            ell(ctx, 110, 158, 34, 32, belly, shade(belly, -0.3), 2);
            for (let i = 0; i < 3; i++) strokePath(ctx, [[86, 146 + i * 12], [134, 146 + i * 12]], shade(belly, -0.3), 2);
            ell(ctx, 110, 74, 40, 36, body, out, 4);
            ell(ctx, 110, 94, 26, 18, shade(body, 0.1), out, 3);
            poly(ctx, [[86, 44], [74, 14], [100, 40]], shade(belly, 0.1), out, 3);
            poly(ctx, [[134, 44], [146, 14], [120, 40]], shade(belly, 0.1), out, 3);
            strokePath(ctx, [[92, 104], [82, 124]], accent, 4);
            strokePath(ctx, [[128, 104], [138, 124]], accent, 4);
            eye(ctx, 92, 70, 1.05, accent, true);
            eye(ctx, 128, 70, 1.05, accent, true);
            poly(ctx, [[102, 104], [106, 114], [98, 110]], "#fff");
            poly(ctx, [[118, 104], [122, 110], [114, 114]], "#fff");
        } else {
            for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
                const x = 84 + i * 18 + (r % 2) * 9, y = 124 + r * 16;
                ell(ctx, x, y, 8, 7, shade(body, -0.18), shade(body, -0.4), 1.5);
            }
            ell(ctx, 110, 74, 40, 36, body, out, 4);
            poly(ctx, [[86, 46], [74, 16], [100, 42]], shade(belly, 0.1), out, 3);
            poly(ctx, [[134, 46], [146, 16], [120, 42]], shade(belly, 0.1), out, 3);
        }
    },
    turtle(ctx, s, back) {
        const { body, belly, accent } = s;
        const out = shade(body, -0.55);
        shadowPad(ctx);
        poly(ctx, [[176, 168], [200, 158], [192, 178]], body, out, 3);
        ell(ctx, 110, 142, 66, 52, accent, out, 4);
        if (back) {
            ell(ctx, 110, 142, 52, 40, shade(accent, 0.14), shade(accent, -0.4), 3);
            poly(ctx, [[110, 108], [136, 126], [126, 158], [94, 158], [84, 126]], shade(accent, -0.2), shade(accent, -0.5), 2);
            for (let i = 0; i < 5; i++) {
                const a = Math.PI + (i / 4) * Math.PI;
                circ(ctx, 110 + Math.cos(a) * 54, 142 + Math.sin(a) * 40, 9, shade(accent, -0.3), shade(accent, -0.5), 2);
            }
        } else {
            poly(ctx, [[110, 106], [140, 124], [129, 158], [91, 158], [80, 124]], shade(accent, 0.16), shade(accent, -0.45), 2);
            for (const [x, y] of [[70, 132], [150, 132], [74, 162], [146, 162]])
                ell(ctx, x, y, 12, 10, shade(accent, -0.24), shade(accent, -0.5), 2);
        }
        ell(ctx, 110, 172, 60, 16, shade(accent, -0.3), out, 3);
        ell(ctx, 62, 182, 22, 15, body, out, 4);
        ell(ctx, 158, 182, 22, 15, body, out, 4);
        ell(ctx, 56, 152, 13, 20, body, out, 4);
        ell(ctx, 164, 152, 13, 20, body, out, 4);
        if (!back) {
            circ(ctx, 110, 72, 40, body, out, 4);
            ell(ctx, 110, 92, 24, 17, belly, shade(belly, -0.3), 2);
            eye(ctx, 92, 62, 1, accent, false);
            eye(ctx, 128, 62, 1, accent, false);
            ell(ctx, 110, 86, 4, 3, shade(body, -0.5));
            strokePath(ctx, [[98, 102], [110, 107], [122, 102]], shade(body, -0.5), 3);
        } else {
            circ(ctx, 110, 74, 40, body, out, 4);
            ell(ctx, 110, 74, 26, 22, shade(body, -0.16));
        }
    },
    lion(ctx, s, back) {
        const { body, belly, accent } = s;
        const out = shade(body, -0.55);
        shadowPad(ctx);
        strokePath(ctx, [[164, 152], [198, 138], [204, 108]], body, 11);
        circ(ctx, 205, 100, 15, accent, out, 3);
        const maneR = back ? 60 : 56;
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            circ(ctx, 110 + Math.cos(a) * maneR, 86 + Math.sin(a) * maneR, 17, accent, out, 3);
        }
        circ(ctx, 110, 86, maneR, accent, out, 4);
        ell(ctx, 110, 152, 54, 42, body, out, 4);
        ell(ctx, 84, 184, 21, 15, body, out, 4);
        ell(ctx, 136, 184, 21, 15, body, out, 4);
        ell(ctx, 66, 150, 15, 22, body, out, 4);
        ell(ctx, 154, 150, 15, 22, body, out, 4);
        if (!back) {
            circ(ctx, 110, 86, 42, body, out, 4);
            circ(ctx, 74, 52, 14, body, out, 3);
            circ(ctx, 146, 52, 14, body, out, 3);
            ell(ctx, 110, 100, 26, 20, belly, shade(belly, -0.3), 2);
            poly(ctx, [[110, 90], [120, 98], [100, 98]], shade(body, -0.6));
            strokePath(ctx, [[110, 99], [110, 106]], shade(body, -0.6), 3);
            strokePath(ctx, [[100, 110], [110, 106], [120, 110]], shade(body, -0.6), 3);
            eye(ctx, 90, 78, 1.1, accent, true);
            eye(ctx, 130, 78, 1.1, accent, true);
            for (const d of [-1, 1]) for (let i = 0; i < 3; i++)
                strokePath(ctx, [[110 + d * 26, 96 + i * 5], [110 + d * 48, 90 + i * 9]], "rgba(255,255,255,0.75)", 2);
        } else {
            circ(ctx, 110, 86, 42, body, out, 4);
            ell(ctx, 110, 96, 30, 26, shade(body, -0.16));
            ell(ctx, 110, 152, 34, 26, shade(body, 0.16));
        }
    },
    serpent(ctx, s, back) {
        const { body, belly, accent } = s;
        const out = shade(body, -0.55);
        shadowPad(ctx);
        ell(ctx, 110, 176, 64, 24, body, out, 4);
        ell(ctx, 110, 166, 50, 18, shade(body, 0.1), out, 3);
        strokePath(ctx, [[110, 172], [96, 140], [110, 104]], body, 40);
        strokePath(ctx, [[110, 172], [96, 140], [110, 104]], out, 3);
        if (!back) {
            ell(ctx, 106, 142, 20, 34, belly, shade(belly, -0.35), 2);
            for (let i = 0; i < 4; i++) strokePath(ctx, [[92, 126 + i * 12], [120, 126 + i * 12]], shade(belly, -0.35), 2);
        }
        poly(ctx, [[110, 46], [160, 70], [156, 122], [110, 134], [64, 122], [60, 70]], accent, out, 4);
        if (back) {
            poly(ctx, [[110, 56], [142, 74], [138, 116], [110, 124], [82, 116], [78, 74]], shade(accent, -0.22), shade(accent, -0.5), 2);
        } else {
            for (const [x, y] of [[78, 84], [142, 84], [86, 112], [134, 112]])
                ell(ctx, x, y, 11, 9, shade(accent, -0.3), shade(accent, -0.55), 2);
        }
        ell(ctx, 110, 96, 34, 30, body, out, 4);
        if (!back) {
            ell(ctx, 110, 112, 26, 16, shade(body, 0.14), out, 3);
            eye(ctx, 92, 88, 1.15, accent, true);
            eye(ctx, 128, 88, 1.15, accent, true);
            poly(ctx, [[98, 124], [94, 146], [106, 130]], "#fff8dc", shade(body, -0.5), 2);
            poly(ctx, [[122, 124], [126, 146], [114, 130]], "#fff8dc", shade(body, -0.5), 2);
            strokePath(ctx, [[110, 126], [110, 146], [102, 156]], "#e83b5a", 4);
            strokePath(ctx, [[110, 146], [118, 156]], "#e83b5a", 4);
        }
    },
    panther(ctx, s, back) {
        const { body, belly, accent } = s;
        const out = shade(body, -0.6);
        shadowPad(ctx);
        strokePath(ctx, [[162, 158], [200, 170], [210, 132]], body, 13);
        strokePath(ctx, [[162, 158], [200, 170], [210, 132]], out, 3);
        circ(ctx, 211, 124, 12, accent, out, 3);
        ell(ctx, 112, 146, 56, 42, body, out, 4);
        for (const [x, w] of [[74, 17], [100, 15], [134, 15], [156, 17]]) {
            ell(ctx, x, 182, w, 17, body, out, 4);
            ell(ctx, x, 192, w + 3, 8, shade(body, 0.1), out, 3);
        }
        circ(ctx, 110, 80, 42, body, out, 4);
        poly(ctx, [[76, 52], [86, 20], [104, 46]], body, out, 3);
        poly(ctx, [[144, 52], [134, 20], [116, 46]], body, out, 3);
        poly(ctx, [[82, 46], [88, 30], [98, 44]], accent);
        poly(ctx, [[138, 46], [132, 30], [122, 44]], accent);
        if (!back) {
            ell(ctx, 110, 94, 30, 22, shade(body, 0.1), out, 3);
            circ(ctx, 96, 92, 13, belly);
            circ(ctx, 124, 92, 13, belly);
            poly(ctx, [[110, 84], [120, 92], [100, 92]], "#1b1120");
            strokePath(ctx, [[110, 92], [110, 100]], shade(body, -0.6), 3);
            strokePath(ctx, [[98, 104], [110, 100], [122, 104]], shade(body, -0.6), 3);
            eye(ctx, 90, 70, 1.15, accent, true);
            eye(ctx, 130, 70, 1.15, accent, true);
            for (const d of [-1, 1]) for (let i = 0; i < 3; i++)
                strokePath(ctx, [[110 + d * 24, 92 + i * 5], [110 + d * 50, 84 + i * 10]], "rgba(255,255,255,0.6)", 2);
            ell(ctx, 112, 156, 30, 24, belly, shade(belly, -0.4), 2);
        } else {
            for (const [x, y, r] of [[86, 130, 11], [118, 122, 9], [142, 142, 12], [100, 158, 10], [130, 164, 8]])
                ell(ctx, x, y, r, r * 0.8, accent, shade(body, -0.6), 2);
            ell(ctx, 110, 80, 34, 30, shade(body, -0.1));
        }
    }
};

function paintMonster(spec, back, size) {
    const { ctx } = makeCtx(size, size);
    ctx.save();
    ctx.scale(size / 220, size / 220);
    const painter = SHAPES[spec && spec.shape] || SHAPES.beast;
    painter(ctx, spec || { body: "#556", belly: "#889", accent: "#aaf" }, back);
    if (spec && spec.aura) {
        ctx.globalCompositeOperation = "screen";
        const g = ctx.createRadialGradient(110, 120, 20, 110, 120, 120);
        g.addColorStop(0, rgba(spec.aura, 0.22));
        g.addColorStop(1, rgba(spec.aura, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, 220, 220);
        ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
    return ctx.canvas;
}
function buildSpriteFromSpec(spec) {
    const size = 220;
    const { ctx } = makeCtx(size * 2, size);
    ctx.drawImage(paintMonster(spec, false, size), 0, 0);
    ctx.drawImage(paintMonster(spec, true, size), size, 0);
    return ctx.canvas.toDataURL("image/png");
}

function buildTypeGhost(typeKey, label) {
    if (GHOST_CACHE[typeKey]) return GHOST_CACHE[typeKey];
    const T = (typeof TYPES !== "undefined" && TYPES[typeKey]) || { color: "#666", icon: "?", name: "?" };
    const size = 220;
    const { ctx } = makeCtx(size * 2, size);
    for (let p = 0; p < 2; p++) {
        ctx.save();
        ctx.translate(p * size, 0);
        ell(ctx, 110, 196, 66, 13, "rgba(0,0,0,0.25)");
        ell(ctx, 110, 132, 58, 52, rgba(T.color, 0.85), shade(T.color, -0.5), 4);
        circ(ctx, 110, 78, 42, rgba(T.color, 0.95), shade(T.color, -0.5), 4);
        if (p === 0) {
            ctx.font = "bold 46px 'Baloo 2', sans-serif";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(255,255,255,.92)";
            ctx.fillText("?", 110, 76);
        }
        ctx.font = "64px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(T.icon, 110, 138);
        if (label && p === 0) {
            ctx.font = "bold 17px 'Be Vietnam Pro', sans-serif";
            ctx.fillStyle = "rgba(255,255,255,.85)";
            ctx.fillText(String(label).slice(0, 16), 110, 184);
        }
        ctx.restore();
    }
    const url = ctx.canvas.toDataURL("image/png");
    GHOST_CACHE[typeKey] = url;
    return url;
}

const EMPTY_SPRITE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

// ============================================================
//  TẢI / LỌC ẢNH
// ============================================================
let spriteLoadJobs = 0;
function notifySprite() {
    if (typeof window !== "undefined" && window.__onSpritesReady) { try { window.__onSpritesReady(); } catch (e) { } }
}

function tryLoad(src) {
    return new Promise(res => {
        if (typeof Image === "undefined") return res({ ok: false });
        const img = new Image();
        img.onload = () => res({ ok: true, w: img.naturalWidth || 0, h: img.naturalHeight || 0, src });
        img.onerror = () => res({ ok: false });
        img.src = src;
    });
}
function sheetFromSize(w, h) {
    if (!w || !h) return "single";
    return (w / h) >= 1.3 ? "sheet" : "single";
}

// ⭐ FIX CHÍNH: nếu có card image -> return sớm, KHÔNG probe monster, KHÔNG vẽ canvas
function initAssets(index) {
    if (!index || typeof document === "undefined") return;
    Object.keys(index).forEach(id => {
        const entry = index[id];
        if (!ID_REGISTRY[id]) ID_REGISTRY[id] = { name: entry.name, type: entry.type };
        else {
            ID_REGISTRY[id].name = entry.name;
            ID_REGISTRY[id].type = entry.type;
        }
        if (typeof Image === "undefined") return;

        spriteLoadJobs++;
        (async () => {
            // ============================================================
            //  1) PROBE CARD IMAGE — luôn chạy
            // ============================================================
            let cardUrl = CARD_URLS[id] || null;
            if (!cardUrl) {
                const cands = [
                    CARD_IMAGE_PATH + id + ".png",
                    CARD_IMAGE_PATH + id + ".jpg",
                    CARD_IMAGE_PATH + id + ".webp"
                ];
                for (const f of cands) {
                    const r = await tryLoad(f);
                    if (r && r.ok) { cardUrl = f; break; }
                }
            }
            if (cardUrl) {
                CARD_URLS[id] = cardUrl;
                ID_REGISTRY[id] = Object.assign(ID_REGISTRY[id] || {}, { card: cardUrl });
                console.log(`[assets] ${id}: ✅ CARD ${cardUrl}`);
            } else {
                console.log(`[assets] ${id}: không có CARD image`);
            }
            CARD_READY[id] = true;
            notifySprite();

            // ============================================================
            //  2) PROBE MONSTER IMAGE — luôn chạy, KHÔNG skip dù có card
            // ============================================================
            let monsterUrl = SPRITE_URLS[id] || null;
            let monsterSheet = SPRITE_META[id] || "sheet";
            if (!monsterUrl) {
                const cands = [
                    MONSTER_IMAGE_PATH + id + ".png",
                    MONSTER_IMAGE_PATH + id + ".jpg",
                    MONSTER_IMAGE_PATH + id + ".webp"
                ];
                for (const f of cands) {
                    const r = await tryLoad(f);
                    if (r && r.ok) {
                        monsterUrl = f;
                        monsterSheet = sheetFromSize(r.w, r.h);
                        break;
                    }
                }
            }
            if (monsterUrl) {
                SPRITE_URLS[id] = monsterUrl;
                SPRITE_META[id] = monsterSheet;
                ID_REGISTRY[id] = Object.assign(ID_REGISTRY[id] || {}, { monster: monsterUrl, sheet: monsterSheet });
                console.log(`[assets] ${id}: ✅ MONSTER ${monsterUrl} (${monsterSheet})`);
                spriteLoadJobs--;
                notifySprite();
                return; // có monster rồi thì không cần vẽ canvas
            }

            // ============================================================
            //  3) VẼ CANVAS — chỉ khi KHÔNG có monster
            //     (kể cả có card hay không)
            // ============================================================
            if (entry.art) {
                try {
                    SPRITE_TMP[id] = buildSpriteFromSpec(entry.art);
                    SPRITE_META[id] = "sheet";
                    console.log(`[assets] ${id}: ✅ VẼ CANVAS từ art spec`);
                } catch (e) { console.error(`[assets] ${id}: draw failed`, e); }
            }

            spriteLoadJobs--;
            notifySprite();
        })();
    });
    notifySprite();
}
function getSprite(id, index) {
    if (SPRITE_URLS[id]) return SPRITE_URLS[id];
    if (SPRITE_TMP[id]) return SPRITE_TMP[id];
    const entry = index && index[id];
    if (entry) {
        if (entry.art) {
            try {
                const u = buildSpriteFromSpec(entry.art);
                SPRITE_TMP[id] = u;
                return u;
            } catch (e) { }
        }
        try { return buildTypeGhost(entry.type, entry.name); } catch (e) { }
    }
    return EMPTY_SPRITE;
}