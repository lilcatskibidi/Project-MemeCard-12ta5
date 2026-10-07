// game.js
// ============================================================
//  POKÉ DUEL — game loop, profile/ID, network, AI, animation
//  V4: Fix hybrid skill + VFX riêng theo hệ + passive system
// ============================================================
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- DOM refs ----------
const EL = {};
["screen-lobby", "screen-roll", "screen-prep", "screen-battle",
    "roll-stage", "roll-status", "roll-pity-badge", "roll-pity-count",
    "btn-roll-confirm", "btn-roll-reroll",
    "roster-grid", "team-slots", "type-chart", "btn-confirm-team", "prep-status", "btn-prep-back",
    "cards-fan", "btn-ai", "btn-create", "btn-join", "room-input", "room-id-container", "room-id-display",
    "copy-btn", "status-text", "trainer-card",
    "scene", "sprite-player", "sprite-enemy", "hud-player", "hud-enemy",
    "action-menu", "msg", "msg-arrow", "turn-badge", "center-banner",
    "btn-log", "btn-mute",
    "ov-switch", "switch-list", "switch-title", "switch-desc", "btn-switch-cancel",
    "ov-log", "log-list", "btn-log-close",
    "ov-result", "result-title", "result-sub", "btn-rematch", "btn-home",
    "fx-flash"].forEach(id => { EL[id] = $(id); });

// ---------- STATE ----------
let mode = null;
let isHost = false;
let mySide = 0;
let peer = null, conn = null;

let M = null;
let view = null;
let picks = [];
let prepId = null;
let pendingTeam = [null, null];
let pendingChoice = [null, null];
let forcedChoice = [null, null];
let myTurnReady = false;
let menuMode = "root";
let busy = false;
let battleOver = false;
let switchKind = null;
let queue = [];
let playbackRunning = false;
let logLines = [];
let currentScreen = "lobby";
let oppName = "";
let autoPlay = false;
let assetsReady = false;
let rollMonsters = [];
let rollPickedIdx = -1;

// ============================================================
//  PROFILE
// ============================================================
const PROFILE_KEY = "pokeduel_profile_v1";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
    let s = "PK";
    for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return s;
}
function loadProfile() {
    try {
        const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
        if (p && p.code) return { name: (p.name || "").slice(0, 16), code: p.code, avatar: p.avatar || "🎒" };
    } catch (e) { }
    return { name: "", code: genCode(), avatar: "🎒" };
}
function saveProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) { }
}
function normCode(raw) {
    let s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.indexOf("POKEDUEL") === 0) s = s.slice(8);
    if (s.indexOf("PK") === 0 && s.length > 8) s = s.slice(0, 8);
    return s;
}
function peerIdFor(code) { return "pokeduel-" + normCode(code); }
function rndId() { return Math.random().toString(36).slice(2, 8); }
let profile = (typeof localStorage !== "undefined") ? loadProfile() : { name: "", code: genCode(), avatar: "🎒" };

// ============================================================
//  SFX
// ============================================================
const SFX = (() => {
    let ctx = null, muted = false;
    const A = () => {
        if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
    };
    function tone(f1, f2, dur, type, vol, delay) {
        if (muted) return;
        const c = A(); if (!c) return;
        type = type || "square"; vol = vol || 0.05; delay = delay || 0;
        const t = c.currentTime + delay;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f1, t);
        if (f2 && f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + dur + 0.03);
    }
    function noise(dur, vol, freq) {
        if (muted) return;
        const c = A(); if (!c) return;
        const len = Math.floor(c.sampleRate * dur);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = c.createBufferSource(); src.buffer = buf;
        const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq;
        const g = c.createGain(); g.gain.value = vol;
        src.connect(f); f.connect(g); g.connect(c.destination);
        src.start();
    }
    return {
        set muted(v) { muted = v; }, get muted() { return muted; },
        click: () => tone(780, 520, 0.06, "square", 0.045),
        select: () => { tone(560, 900, 0.07, "square", 0.05); tone(900, 1300, 0.08, "square", 0.04, 0.06); },
        back: () => tone(420, 240, 0.09, "square", 0.045),
        charge: () => tone(320, 880, 0.3, "sawtooth", 0.045),
        shoot: () => tone(900, 240, 0.32, "square", 0.05),
        hit: () => { noise(0.16, 0.09, 1600); tone(190, 60, 0.18, "sawtooth", 0.07); },
        superHit: () => { noise(0.24, 0.11, 2200); tone(280, 55, 0.26, "square", 0.08); },
        shield: () => tone(760, 1400, 0.2, "triangle", 0.05),
        heal: () => { tone(620, 880, 0.14, "sine", 0.05); tone(880, 1320, 0.18, "sine", 0.05, 0.1); },
        faint: () => tone(420, 55, 0.55, "sawtooth", 0.06),
        turn: () => tone(600, 780, 0.07, "sine", 0.035),
        stun: () => { tone(880, 220, 0.3, "square", 0.05); tone(660, 180, 0.3, "square", 0.05, 0.15); },
        reflect: () => tone(1200, 400, 0.25, "triangle", 0.06),
        roll: () => { tone(300, 600, 0.1, "square", 0.05); tone(500, 900, 0.15, "square", 0.05, 0.12); },
        passive: () => { tone(880, 1320, 0.15, "sine", 0.05); tone(1320, 1760, 0.2, "sine", 0.04, 0.15); },
        buff: () => { tone(660, 990, 0.12, "square", 0.05); tone(990, 1320, 0.15, "square", 0.05, 0.1); },
        debuff: () => { tone(880, 440, 0.15, "sawtooth", 0.05); tone(440, 220, 0.2, "sawtooth", 0.05, 0.12); },
        win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.17, "square", 0.06, i * 0.14)),
        lose: () => [400, 340, 270, 190].forEach((f, i) => tone(f, f * 0.9, 0.24, "triangle", 0.06, i * 0.18))
    };
})();

// ============================================================
//  HELPERS
// ============================================================
function showScreen(name) {
    ["lobby", "roll", "prep", "battle"].forEach(s => {
        const el = EL["screen-" + s];
        if (el) el.classList.toggle("active", s === name);
    });
    currentScreen = name;
    window.scrollTo(0, 0);
}
function oppSide() { return 1 - mySide; }
function spriteOf(side) { return side === mySide ? EL["sprite-player"] : EL["sprite-enemy"]; }
function who(side) { return side === mySide ? "Bạn" : "Đối thủ"; }
function tag(side) {
    return side === mySide
        ? { text: "[BẠN] ", style: "color:#4ade80;font-weight:800" }
        : { text: "[ĐỐI THỦ] ", style: "color:#ff8fa3;font-weight:800" };
}
function plainOf(parts) { return typeof parts === "string" ? parts : parts.map(p => p.text).join(""); }
function spriteUrl(id) { return getSprite(id, MONSTER_INDEX); }
function spriteOpts(id, fainted) {
    return {
        id: id,
        url: spriteUrl(id),
        fainted: !!fainted,
        real: (typeof hasRealSprite === "function") && hasRealSprite(id),
        sheet: (typeof isSheetSprite === "function") ? isSheetSprite(id) : true
    };
}
function setStatus(t) { if (EL["status-text"]) EL["status-text"].textContent = t; }

// ============================================================
//  SKILL HELPERS
// ============================================================
const EFFECT_ICON = {
    expose: "⚠️", burn: "🔥", poison: "☠️",
    stun: "💫", freeze: "❄️", paralyze: "⚡", confuse: "😵",
    heal: "💚", buff_atk: "⚔️", buff_def: "🛡",
    debuff_atk: "📉", debuff_def: "💔",
    shield: "🛡", drain: "🩸", reflect: "🔮"
};

function isAttackMove(mv) {
    return mv && (mv.kind === "attack" || (!mv.kind && mv.dmg));
}
function isGuardMove(mv) {
    return mv && (mv.kind === "guard" || (!mv.kind && mv.shield));
}
function isStatusMove(mv) {
    return mv && (mv.kind === "status" || (!mv.kind && (mv.heal || mv.effect)));
}
function isPassiveMove(mv) {
    return mv && mv.kind === "passive";
}

// ============================================================
//  MESSAGE / BANNER / LOG
// ============================================================
async function say(parts, speed) {
    if (typeof parts === "string") parts = [{ text: parts }];
    const el = EL.msg;
    if (!el) return;
    logAdd(plainOf(parts));
    el.innerHTML = "";
    EL["msg-arrow"].classList.remove("on");
    const spans = parts.map(p => {
        const s = document.createElement("span");
        if (p.style) s.setAttribute("style", p.style);
        if (p.cls) s.className = p.cls;
        el.appendChild(s); return s;
    });
    const total = Math.max(1, parts.reduce((a, p) => a + p.text.length, 0));
    const per = speed !== undefined ? speed : Math.min(34, Math.max(6, 850 / total));
    let done = 0;
    for (let i = 0; i < parts.length; i++) {
        const txt = parts[i].text;
        for (let j = 0; j < txt.length; j++) {
            spans[i].textContent = txt.slice(0, j + 1);
            done++;
            if (done % 2 === 0) await sleep(per);
        }
    }
    EL["msg-arrow"].classList.add("on");
}
function setMsg(text) {
    if (!EL.msg) return;
    EL.msg.innerHTML = typeof text === "string" ? text : plainOf(text);
    EL["msg-arrow"].classList.add("on");
}
function banner(text) {
    const el = EL["center-banner"];
    if (!el) return;
    const s = el.querySelector("span");
    s.textContent = text;
    s.animate([
        { opacity: 0, transform: "scale(.55)" },
        { opacity: 1, transform: "scale(1)", offset: 0.22 },
        { opacity: 1, transform: "scale(1)", offset: 0.72 },
        { opacity: 0, transform: "scale(1.18)" }
    ], { duration: 1150, easing: "ease-out" });
}
function flash(color) {
    const f = EL["fx-flash"];
    if (!f) return;
    f.style.background = color || "#fff";
    f.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.25 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
}
function logAdd(text) {
    logLines.push(text);
    if (logLines.length > 300) logLines.shift();
    renderLog();
}
function renderLog() {
    const box = EL["log-list"];
    if (!box) return;
    box.innerHTML = "";
    logLines.forEach(t => {
        const p = document.createElement("p");
        p.textContent = "> " + t;
        if (t.startsWith("---")) p.className = "t";
        box.appendChild(p);
    });
    box.scrollTop = box.scrollHeight;
}

// ============================================================
//  LOBBY
// ============================================================
function renderTrainerCard() {
    Render.trainerCard(EL["trainer-card"], profile);
    const inp = $("trainer-name");
    if (inp) {
        inp.addEventListener("input", () => {
            profile.name = inp.value.slice(0, 16); saveProfile();
            const b = EL["trainer-card"].querySelector(".reg-badge");
            if (b) b.textContent = profile.name.trim() ? "ĐÃ ĐĂNG KÝ" : "CHƯA ĐẶT TÊN";
        });
        inp.addEventListener("blur", () => { profile.name = inp.value.trim().slice(0, 16); saveProfile(); });
    }
    const rg = $("btn-regen");
    if (rg) rg.addEventListener("click", () => {
        profile.code = genCode(); saveProfile();
        const c = $("trainer-code"); if (c) c.textContent = profile.code;
        SFX.back(); setStatus("Đã tạo mã mới: " + profile.code);
    });
    const cp = $("btn-copy-code");
    if (cp) cp.addEventListener("click", () => {
        const id = profile.code;
        const done = () => { setStatus("Đã sao chép mã " + id); SFX.select(); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(id).then(done).catch(() => copyTextFallback(id, done));
        } else copyTextFallback(id, done);
    });
}
function renderLobbyFan() {
    Render.fan(EL["cards-fan"], ["hac_hoi_phong", "hoa_dim_long", "huyen_quy", "tuat_khoai_tay"]);
}

// ---------- FRIENDS ----------
const FRIEND_KEY = "pokeduel_friends_v1";
function loadFriends() {
    try {
        const a = JSON.parse(localStorage.getItem(FRIEND_KEY));
        if (Array.isArray(a)) return a.filter(x => x && x.code).slice(0, 30);
    } catch (e) { }
    return [];
}
function saveFriends(list) {
    try { localStorage.setItem(FRIEND_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) { }
}
let friends = (typeof localStorage !== "undefined") ? loadFriends() : [];
function rememberFriend(code, name) {
    code = normCode(code);
    if (!code || code === profile.code) return;
    friends = friends.filter(f => f.code !== code);
    friends.unshift({ code, name: String(name || "").slice(0, 16), at: Date.now() });
    saveFriends(friends);
    renderFriends("");
}
function renderFriends(filter) {
    const box = $("friend-list");
    if (!box) return;
    const q = String(filter || "").toUpperCase().trim();
    const list = friends.filter(f =>
        !q || f.code.indexOf(q) >= 0 || (f.name || "").toUpperCase().indexOf(q) >= 0);
    if (!list.length) {
        box.innerHTML = `<div class="friend-empty">${friends.length ? "Không khớp mã nào — thử từ khác." : "Chưa lưu ID nào. Khi bạn vào phòng ai, mã đó tự lưu ở đây."}</div>`;
        return;
    }
    box.innerHTML = "";
    list.forEach(f => {
        const b = document.createElement("button");
        b.className = "friend-row";
        b.innerHTML = `<span class="friend-code"></span><span class="friend-name"></span><span class="friend-go">Vào →</span>`;
        b.querySelector(".friend-code").textContent = f.code;
        b.querySelector(".friend-name").textContent = f.name || "Bạn bè";
        b.addEventListener("click", () => {
            SFX.click();
            const inp = $("room-input");
            if (inp) inp.value = f.code;
            joinByCode(f.code);
        });
        const del = document.createElement("span");
        del.className = "friend-del";
        del.textContent = "✕";
        del.title = "Xóa";
        del.addEventListener("click", e => {
            e.stopPropagation();
            friends = friends.filter(x => x.code !== f.code);
            saveFriends(friends);
            renderFriends($("friend-search") ? $("friend-search").value : "");
        });
        b.appendChild(del);
        box.appendChild(b);
    });
}
function closePeer() {
    try { if (conn) conn.close(); } catch (e) { }
    try { if (peer) peer.destroy(); } catch (e) { }
    conn = null; peer = null;
}
function copyTextFallback(t, ok) {
    try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        ok && ok();
    } catch (e) { setStatus("Không sao chép được — hãy ghi nhớ mã: " + t); }
}
function joinByCode(raw) {
    const code = normCode(raw);
    if (!code) { setStatus("Nhập mã đăng ký của bạn bè (vd: PKXXXXXX)"); return; }
    if (code === profile.code) { setStatus("Đây là mã của chính bạn — gửi mã này cho bạn bè để họ vào."); return; }
    SFX.click();
    closePeer();
    mode = "p2p"; isHost = false; mySide = 1;
    setStatus("Đang tìm nhân vật " + code + "...");
    if (typeof Peer === "undefined") { setStatus("PeerJS chưa tải xong — kiểm tra mạng rồi thử lại."); return; }
    try { peer = new Peer(); }
    catch (e) { setStatus("PeerJS không tải được — kiểm tra mạng."); return; }
    peer.on("open", () => { conn = peer.connect(peerIdFor(code), { reliable: true }); setupConnection(); });
    peer.on("error", err => {
        if (err && err.type === "peer-unavailable") setStatus("Không tìm thấy nhân vật nào có mã " + code + " (bạn ấy chưa bấm Tạo Phòng?)");
        else setStatus("Không kết nối được — thử lại.");
    });
    rememberFriend(code, "");
}

function bindLobby() {
    EL["btn-ai"].addEventListener("click", () => {
        if (!assetsReady) { setStatus("Đang tải thẻ, đợi 1 chút..."); return; }
        SFX.select();
        closePeer();
        mode = "ai"; isHost = true; mySide = 0;
        setStatus("Chế độ đấu với Máy — roll thẻ nào!");
        enterRoll();
    });
    EL["btn-create"].addEventListener("click", () => {
        SFX.click();
        closePeer();
        mode = "p2p";
        if (typeof Peer === "undefined") { setStatus("PeerJS chưa tải xong — kiểm tra mạng rồi thử lại."); return; }
        setStatus("Đang mở phòng với mã " + profile.code + "...");
        try { peer = new Peer(peerIdFor(profile.code)); }
        catch (e) { setStatus("PeerJS không tải được — kiểm tra mạng."); return; }
        peer.on("open", () => {
            isHost = true; mySide = 0;
            EL["room-id-container"].style.display = "flex";
            EL["room-id-display"].textContent = profile.code;
            setStatus("Đã đăng ký " + profile.code + " — gửi mã này cho bạn bè!");
        });
        peer.on("connection", c => { conn = c; setupConnection(); });
        peer.on("error", err => {
            if (err && err.type === "unavailable-id")
                setStatus("Mã " + profile.code + " đang có người mở phòng — bấm ↻ để tạo mã khác.");
            else setStatus("Lỗi tạo phòng — thử lại.");
        });
    });
    EL["btn-join"].addEventListener("click", () => joinByCode(EL["room-input"].value));
    EL["room-input"].addEventListener("keydown", e => { if (e.key === "Enter") joinByCode(EL["room-input"].value); });
    const fs = $("friend-search");
    if (fs) fs.addEventListener("input", () => renderFriends(fs.value));
    EL["copy-btn"].addEventListener("click", () => {
        const id = EL["room-id-display"].textContent;
        if (!id || id === "----") return;
        const done = () => {
            EL["copy-btn"].textContent = "Đã sao chép!";
            EL["copy-btn"].classList.add("copied");
            setTimeout(() => { EL["copy-btn"].textContent = "Sao chép mã"; EL["copy-btn"].classList.remove("copied"); }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(id).then(done).catch(() => copyTextFallback(id, done));
        } else copyTextFallback(id, done);
    });
}

function setupConnection() {
    conn.on("open", () => {
        setStatus("Đã kết nối! Roll thẻ trước nào.");
        sendAny({ type: "profile", name: profile.name || "Huấn Luyện Viên", code: profile.code });
        enterRoll();
    });
    conn.on("data", handleData);
    conn.on("close", () => { setStatus("Đối thủ đã rời trận"); logAdd("--- Đối thủ ngắt kết nối ---"); });
}
function sendAny(obj) { if (mode === "p2p" && conn) { try { conn.send(obj); } catch (e) { } } }
function broadcast(obj) { if (mode === "p2p" && isHost && conn) { try { conn.send(obj); } catch (e) { } } }
function send(obj) { if (mode === "p2p" && !isHost && conn) { try { conn.send(obj); } catch (e) { } } }

function handleData(d) {
    if (!d || !d.type) return;
    switch (d.type) {
        case "profile":
            oppName = String(d.name || "").slice(0, 16);
            if (d.code) rememberFriend(d.code, oppName);
            if (M) renderAll();
            break;
        case "prep":
            if (d.prepId !== prepId || currentScreen !== "prep") enterPrep(d.prepId);
            break;
        case "rematchReq":
            if (isHost) {
                enterRoll(); broadcast({ type: "roll" });
            }
            break;
        case "roll":
            if (!isHost) enterRoll();
            break;
        case "team":
            if (mode === "p2p" && isHost && d.prepId === prepId) {
                pendingTeam[oppSide()] = d.ids;
                if (currentScreen === "prep")
                    EL["prep-status"].innerHTML = 'Đối thủ đã xác nhận đội hình — bạn hãy bấm xác nhận <span class="wait-dots"></span>';
                tryStartBattle();
            }
            break;
        case "battle":
            if (!isHost) enterBattle(d.state);
            break;
        case "choice":
            if (isHost) { pendingChoice[oppSide()] = d.choice; tryAdvance(); }
            break;
        case "forced":
            if (isHost) { forcedChoice[oppSide()] = d.index; checkForced(); }
            break;
        case "state":
            if (!isHost) receiveState(d);
            break;
    }
}

// ============================================================
//  ROLL SCREEN
// ============================================================
function rollMonstersFallback(count) {
    const result = [];
    for (let i = 0; i < count; i++) {
        const m = MONSTER_ROSTER[Math.floor(Math.random() * MONSTER_ROSTER.length)];
        result.push(m);
    }
    return result;
}

function enterRoll() {
    if (!assetsReady) { setStatus("Đang tải thẻ, đợi chút..."); return; }
    rollMonsters = (typeof rollMonsterPool === "function")
        ? rollMonsterPool(ROLL_CONFIG.ROLL_COUNT)
        : rollMonstersFallback(ROLL_CONFIG.ROLL_COUNT);
    rollPickedIdx = -1;
    picks = [];
    showScreen("roll");
    renderRoll(true);
    updateRollPityBadge();
    setStatus("Roll thẻ — chọn 1 con để bắt đầu!");
}
function updateRollPityBadge() {
    const badge = EL["roll-pity-badge"];
    const count = EL["roll-pity-count"];
    if (!badge || !count) return;
    const pity = (typeof getPityCounter === "function") ? getPityCounter() : 0;
    if (pity > 0) {
        badge.style.display = "flex";
        count.textContent = pity + " / " + ROLL_CONFIG.PITY_THRESHOLD;
    } else {
        badge.style.display = "none";
    }
}

function renderRoll(animate) {
    if (!EL["roll-stage"]) return;
    if (typeof Render.rollStage !== "function") {
        console.error("[roll] Render.rollStage chưa load");
        return;
    }
    Render.rollStage(EL["roll-stage"], rollMonsters, {
        onPick: (m, cardEl, i) => pickRollCard(m, cardEl, i),
        animate: animate === true
    });

    if (rollPickedIdx >= 0) {
        const cards = document.querySelectorAll("#roll-stage .pcard");
        cards.forEach((c, i) => {
            if (i === rollPickedIdx) c.classList.add("picked");
            else c.classList.add("dimmed");
        });
        EL["btn-roll-confirm"].disabled = false;
        const picked = rollMonsters[rollPickedIdx];
        if (picked) EL["roll-status"].innerHTML = `Đã chọn: <b>${picked.name}</b> (R${picked.rarity || 1})`;
    } else {
        EL["btn-roll-confirm"].disabled = true;
        EL["roll-status"].innerHTML = "Nhấn vào thẻ để chọn";
    }

    if (typeof Render.forceRefreshCardArt === "function") {
        Render.forceRefreshCardArt(EL["roll-stage"]);
    }
}

function pickRollCard(m, cardEl, i) {
    SFX.select();
    document.querySelectorAll("#roll-stage .pcard").forEach(c => {
        c.classList.remove("picked");
        c.classList.remove("dimmed");
    });
    cardEl.classList.add("picked");
    document.querySelectorAll("#roll-stage .pcard").forEach(c => {
        if (c !== cardEl) c.classList.add("dimmed");
    });

    rollPickedIdx = i;
    EL["btn-roll-confirm"].disabled = false;
    EL["roll-status"].innerHTML = `Đã chọn: <b>${m.name}</b> (R${m.rarity || 1})`;
    cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function confirmRoll() {
    if (rollPickedIdx < 0) return;
    const picked = rollMonsters[rollPickedIdx];
    if (!picked) return;
    SFX.select();
    picks = [picked.id];
    setStatus(`Đã chọn ${picked.name} — chọn thêm 2 con nữa!`);
    enterPrep(mode === "p2p" && isHost ? rndId() : null);
}

function reroll() {
    SFX.roll();
    const exclude = rollMonsters.map(m => m && m.id).filter(Boolean);
    rollMonsters = (typeof rollMonsterPool === "function")
        ? rollMonsterPool(ROLL_CONFIG.ROLL_COUNT, exclude.length ? exclude : null)
        : rollMonstersFallback(ROLL_CONFIG.ROLL_COUNT);
    rollPickedIdx = -1;
    renderRoll(true);
    updateRollPityBadge();
    setStatus("Đã roll lại!");
}

function bindRoll() {
    if (EL["btn-roll-confirm"]) {
        EL["btn-roll-confirm"].addEventListener("click", confirmRoll);
    }
    if (EL["btn-roll-reroll"]) {
        EL["btn-roll-reroll"].addEventListener("click", reroll);
    }
}

// ============================================================
//  PREP
// ============================================================
function enterPrep(id) {
    prepId = id || (isHost ? rndId() : prepId);
    if (!picks) picks = [];
    pendingTeam = [null, null]; forcedChoice = [null, null];
    pendingChoice = [null, null]; battleOver = false; myTurnReady = false; menuMode = "root";
    queue = []; busy = false; playbackRunning = false;
    closeAllOverlays();
    logLines = []; renderLog();
    showScreen("prep");
    renderPrep();
    EL["btn-confirm-team"].disabled = picks.length < BALANCE.TEAM_SIZE;
    const remaining = BALANCE.TEAM_SIZE - picks.length;
    if (picks.length > 0 && remaining > 0) {
        const names = picks.map(id => (MONSTER_INDEX[id] && MONSTER_INDEX[id].name) || id).join(", ");
        EL["prep-status"].innerHTML = `Đã roll: <b style="color:#ffd75f">${names}</b><br>Chọn thêm <b>${remaining}</b> con nữa`;
    } else {
        EL["prep-status"].innerHTML = "Chọn đủ 3 quái để bắt đầu";
    }
    if (mode === "p2p" && isHost) sendAny({ type: "prep", prepId });
}
let rosterQuery = "";
function renderPrep() {
    Render.roster(EL["roster-grid"], picks, togglePick, rosterQuery);
    Render.teamSlots(EL["team-slots"], picks, id => { SFX.back(); togglePick(id); });
    Render.typeChart(EL["type-chart"]);

    if (typeof Render.forceRefreshCardArt === "function") {
        Render.forceRefreshCardArt(EL["roster-grid"]);
    }
}
function togglePick(id) {
    const i = picks.indexOf(id);
    if (i >= 0) picks.splice(i, 1);
    else if (picks.length < BALANCE.TEAM_SIZE) picks.push(id);
    else { SFX.back(); return; }
    SFX.click();
    renderPrep();
    const full = picks.length === BALANCE.TEAM_SIZE;
    EL["btn-confirm-team"].disabled = !full;
    if (full) {
        EL["prep-status"].innerHTML = "Đội hình đủ 3 con — sẵn sàng chiến đấu!";
    } else {
        const remaining = BALANCE.TEAM_SIZE - picks.length;
        EL["prep-status"].innerHTML = `Chọn thêm <b>${remaining}</b> con nữa`;
    }
}
function aiTeam() {
    const rest = MONSTER_ROSTER.map(m => m.id).filter(id => picks.indexOf(id) < 0);
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
    }
    const need = BALANCE.TEAM_SIZE;
    if (rest.length >= need) return rest.slice(0, need);
    const all = MONSTER_ROSTER.map(m => m.id);
    while (rest.length < need) rest.push(all[Math.floor(Math.random() * all.length)]);
    return rest.slice(0, need);
}
function confirmTeam() {
    if (picks.length !== BALANCE.TEAM_SIZE) return;
    SFX.select();
    pendingTeam[mySide] = picks.slice();
    EL["btn-confirm-team"].disabled = true;
    EL["prep-status"].innerHTML = 'Đã xác nhận! Đợi đối thủ <span class="wait-dots"></span>';
    if (mode === "ai") { pendingTeam[1] = aiTeam(); tryStartBattle(); }
    else { send({ type: "team", ids: pendingTeam[mySide], prepId }); tryStartBattle(); }
}
function tryStartBattle() {
    if (!isHost) return;
    if (!pendingTeam[0] || !pendingTeam[1]) return;
    const state = {
        phase: "battle", turn: 1, winner: null,
        active: [0, 0], needSwitch: [false, false],
        teams: [pendingTeam[0].map(makeFighter), pendingTeam[1].map(makeFighter)]
    };
    broadcast({ type: "battle", state });
    enterBattle(state);
}

// ============================================================
//  BATTLE — VIEW / RENDER
// ============================================================
function viewSnap() {
    return [0, 1].map(s => ({
        active: M.active[s],
        hp: M.teams[s].map(f => f.hp),
        shield: M.teams[s].map(f => f.shield),
        fainted: M.teams[s].map(f => f.fainted)
    }));
}
function syncView() { view = viewSnap(); }

function chipsFor(f, hp) {
    const chips = [];
    if (f.shield > 0) chips.push({ cls: "shield", text: "🛡 KHIÊN " + f.shield });
    if (f.reflect > 0) chips.push({ cls: "reflect", text: "🔮 PHẢN " + Math.round(f.reflect * 100) + "%" });
    if (f.dot) chips.push({
        cls: f.dot.label === "burn" ? "burn" : "poison",
        text: (f.dot.label === "burn" ? "🔥 CHÁY " : "☠️ ĐỘC ") + f.dot.dmg + " (" + f.dot.turns + ")"
    });
    if (f.exposeTurns > 0) chips.push({ cls: "expose", text: "⚠️ KHƠI MỞ" });
    if (f.stunTurns > 0) chips.push({ cls: "stun", text: "💫 CHOÁNG (" + f.stunTurns + ")" });
    if (f.freezeTurns > 0) chips.push({ cls: "freeze", text: "❄️ ĐÓNG BĂNG (" + f.freezeTurns + ")" });
    if (f.buffAtk > 0) chips.push({ cls: "", text: "⚔️ ATK +" + Math.round(f.buffAtk * 100) + "%" });
    if (f.buffDef > 0) chips.push({ cls: "", text: "🛡 DEF +" + Math.round(f.buffDef * 100) + "%" });
    if (f.debuffAtk > 0) chips.push({ cls: "", text: "📉 ATK -" + Math.round(f.debuffAtk * 100) + "%" });
    if (f.debuffDef > 0) chips.push({ cls: "", text: "💔 DEF -" + Math.round(f.debuffDef * 100) + "%" });
    if (f.energyBonus > 0) chips.push({ cls: "", text: "⚡ +" + f.energyBonus + " ENERGY" });
    if (hp <= 0) chips.push({ cls: "", text: "✕ GỤC" });
    return chips;
}
function advInfo(atkType, defType) {
    const mu = typeMultiplier(atkType, defType);
    if (mu > 1) return { text: "🔥 HỆ LỢI THẾ ×1.5", cls: "good" };
    if (mu < 1) return { text: "❄ BẤT LỢI ×0.5", cls: "bad" };
    return { text: "CÂN BẰNG ×1", cls: "even" };
}
function renderHud(side) {
    if (!M || !view) return;
    const pos = side === mySide ? "player" : "enemy";
    const st = M.teams[side], v = view[side];
    const f = st[v.active];
    const foe = M.teams[1 - side][M.active[1 - side]];
    const hp = Math.max(0, v.hp[v.active]);
    const adv = advInfo(f.type, foe.type);
    const trainer = side === mySide
        ? (profile.name || "BẠN")
        : (mode === "ai" ? "MÁY TÍNH" : (oppName || "ĐỐI THỦ"));
    Render.hud(pos, {
        monster: f.name,
        trainer: trainer + (side === mySide ? " · BẠN" : " · ĐỐI THỦ"),
        typeKey: f.type,
        hp, maxHp: f.maxHp,
        shield: v.shield[v.active] || 0,
        chips: chipsFor(f, hp),
        pips: st.map(c => c.fainted),
        advText: adv.text, advCls: adv.cls
    });
}
function renderSprites() {
    if (!M || !view) return;
    for (const side of [0, 1]) {
        const v = view[side], f = M.teams[side][v.active];
        const sideName = (side === mySide) ? "player" : "enemy";
        Render.sprite(spriteOf(side), spriteOpts(f.id, v.hp[v.active] <= 0), sideName);
    }
}
function renderAll() { renderHud(0); renderHud(1); renderSprites(); }

// ---------- MENU ----------
function basicMove(f) {
    return {
        name: "Đòn Thường", kind: "attack", type: f.type, dmg: 40, cost: 0,
        pp: Infinity, currentPp: Infinity, desc: "Đòn đánh cơ bản, không tốn PP."
    };
}
function lockText() {
    if (battleOver) return "Trận đã kết thúc";
    if (busy) return "Đang xử lý lượt...";
    if (M && M.phase === "forced") {
        if (M.needSwitch[mySide]) return "Chọn quái vật thay thế!";
        return "Đợi đối thủ chọn quái thay thế...";
    }
    if (myTurnReady) return "Đã chọn! Đợi đối thủ...";
    return "Chờ...";
}
function menuSpec() {
    if (!M || battleOver || busy || M.phase !== "battle" || myTurnReady)
        return { kind: "locked", text: lockText(), sub: mode === "ai" ? "AI đang tính..." : "Đang chờ đối thủ" };

    const f = M.teams[mySide][M.active[mySide]];
    const foe = M.teams[oppSide()][M.active[oppSide()]];

    if (menuMode === "moves") {
        const toSpec = (mv, i) => {
            let power = "—";
            if (mv.dmg) power = "💥" + mv.dmg;
            else if (mv.shield) power = "🛡" + mv.shield;
            else if (mv.heal) power = "💚+" + mv.heal;
            else if (mv.reflect) power = "🔮" + Math.round(mv.reflect * 100) + "%";
            else if (mv.effect) power = EFFECT_ICON[mv.effect] || "✨";
            else if (mv.kind === "passive") power = "♾️ PASSIVE";

            let eff = null;
            if (isAttackMove(mv) && mv.dmg) eff = advInfo(mv.type, foe.type);

            const isPassive = mv.kind === "passive";

            return {
                i, name: mv.name, typeKey: mv.type,
                kind: mv.kind || (mv.dmg ? "attack" : mv.shield ? "guard" : "status"),
                power,
                noPp: isPassive || mv.currentPp <= 0,
                pp: mv.pp === Infinity ? "∞ PP" : (isPassive ? "PASSIVE" : mv.currentPp + "/" + mv.pp + " PP"),
                desc: mv.desc, eff,
                isPassive
            };
        };
        const moves = f.moves.map(toSpec);
        const b = basicMove(f);
        moves.push(Object.assign(toSpec(b, -1), { pp: "∞ PP" }));
        return { kind: "moves", moves };
    }
    return { kind: "root", shield: f.shield, logCount: logLines.length };
}
function refreshMenu() {
    if (!M) return;
    Render.menu(EL["action-menu"], Object.assign(menuSpec(), {
        onAct: (kind, idx) => {
            if (kind === "fight") { SFX.click(); menuMode = "moves"; refreshMenu(); }
            else if (kind === "switch") { SFX.click(); openSwitch("normal"); }
            else if (kind === "log") { SFX.click(); EL["ov-log"].classList.add("show"); }
            else if (kind === "back") { SFX.back(); menuMode = "root"; refreshMenu(); }
            else if (kind === "move") {
                const f = M.teams[mySide][M.active[mySide]];
                if (idx >= 0 && f.moves[idx] && f.moves[idx].kind === "passive") return;
                SFX.select();
                submitChoice({ kind: "attack", moveIdx: idx });
            }
        },
        onHover: i => {
            const ff = M.teams[mySide][M.active[mySide]];
            const mv = i === -1 ? basicMove(ff) : ff.moves[i];
            if (mv) setMsg("<b>" + mv.name + "</b> — " + mv.desc);
        }
    }));
}

// ---------- SWITCH ----------
function openSwitch(kind) {
    switchKind = kind;
    EL["switch-title"].textContent = kind === "forced" ? "QUÁI ĐÃ GỤC — CHỌN THAY THẾ" : "ĐỔI BÀI";
    EL["switch-desc"].textContent = kind === "forced"
        ? "Quái active đã gục. Chọn quái còn sống để tiếp tục (không tốn lượt)."
        : "Đổi bài tốn 1 lượt: quái mới sẽ ra sân ngay và có thể chịu đòn từ đối thủ.";
    EL["btn-switch-cancel"].style.display = kind === "forced" ? "none" : "";
    const team = M.teams[mySide], v = view[mySide];
    const foe = M.teams[oppSide()][M.active[oppSide()]];
    Render.switchRows(EL["switch-list"],
        team.map((f, i) => ({
            index: i, f, hp: Math.max(0, v.hp[i]),
            dead: f.fainted, active: i === M.active[mySide],
            disabled: f.fainted || i === M.active[mySide],
            matchup: advInfo(f.type, foe.type).text
        })),
        i => {
            SFX.select();
            closeSwitch();
            if (switchKind === "forced") submitForced(i);
            else submitChoice({ kind: "switch", to: i });
        });
    EL["ov-switch"].classList.add("show");
}
function closeSwitch() { if (EL["ov-switch"]) EL["ov-switch"].classList.remove("show"); }
function closeAllOverlays(keepResult) {
    closeSwitch();
    if (EL["ov-log"]) EL["ov-log"].classList.remove("show");
    if (!keepResult && EL["ov-result"]) EL["ov-result"].classList.remove("show");
}

// ============================================================
//  CHOICE / PROTOCOL
// ============================================================
function submitChoice(choice) {
    if (!M || busy || battleOver || M.phase !== "battle" || myTurnReady) return;
    if (choice.kind === "switch") {
        if (choice.to === M.active[mySide] || M.teams[mySide][choice.to].fainted) return;
    } else if (choice.kind === "attack" && choice.moveIdx >= 0) {
        const mv = M.teams[mySide][M.active[mySide]].moves[choice.moveIdx];
        if (!mv || mv.currentPp <= 0 || mv.kind === "passive") return;
    }
    myTurnReady = true;
    menuMode = "root";
    pendingChoice[mySide] = choice;
    refreshMenu();
    if (mode === "ai") {
        setMsg("Bạn đã chọn. <b>Đối thủ đang suy nghĩ</b>...");
        setTimeout(() => { pendingChoice[oppSide()] = aiChoose(oppSide()); tryAdvance(); }, 650);
    } else {
        send({ type: "choice", choice });
        setMsg("Bạn đã chọn. <b>Đợi đối thủ</b>...");
        tryAdvance();
    }
}
function tryAdvance() {
    if (!isHost || busy || playbackRunning || !M || M.phase !== "battle") return;
    if (pendingChoice[0] && pendingChoice[1]) {
        const c0 = pendingChoice[0], c1 = pendingChoice[1];
        pendingChoice = [null, null];
        const events = resolveTurn(c0, c1);
        broadcast({ type: "state", state: M, events });
        enqueuePlayback(M, events);
    }
}
function submitForced(i) {
    if (!M || !M.needSwitch[mySide]) return;
    forcedChoice[mySide] = i;
    if (mode === "p2p") send({ type: "forced", index: i });
    checkForced();
}
function checkForced() {
    if (!isHost || !M || M.phase !== "forced") return;
    if (busy || playbackRunning) return;
    const need = [0, 1].filter(s => M.needSwitch[s]);
    if (need.every(s => forcedChoice[s] != null)) applyForced();
}
function applyForced() {
    const events = [];
    for (const s of [0, 1]) {
        if (M.needSwitch[s] && forcedChoice[s] != null) {
            events.push({ t: "switch", side: s, from: M.active[s], to: forcedChoice[s], forced: true });
            M.active[s] = forcedChoice[s];
        }
    }
    forcedChoice = [null, null];
    M.needSwitch = [false, false];
    M.phase = "battle";
    M.turn++;
    broadcast({ type: "state", state: M, events });
    enqueuePlayback(M, events);
}
function receiveState(d) {
    enqueuePlayback(d.state, d.events);
}
function enqueuePlayback(state, events) {
    queue.push({ state, events: events || [] });
    pumpPlayback();
}
async function pumpPlayback() {
    if (playbackRunning) return;
    playbackRunning = true;
    try {
        while (queue.length) {
            const d = queue.shift();
            if (d.state) M = d.state;
            await runTurn(d.events || []);
        }
    } catch (e) {
        console.error(e);
        logAdd("--- Lỗi phát lại lượt — đã mở khóa menu ---");
    } finally {
        busy = false;
        playbackRunning = false;
        if (queue.length) {
            pumpPlayback();
            return;
        }
        if (M && M.phase === "battle" && !battleOver) {
            myTurnReady = false;
            refreshMenu();
        }
        if (isHost && M) {
            if (M.phase === "forced") checkForced();
            else if (M.phase === "battle" && !battleOver) tryAdvance();
        }
    }
}
function updateTurnBadge() {
    const b = EL["turn-badge"];
    if (!b || !M) return;
    b.textContent = M.phase === "forced" ? "CHỌN QUÁI THAY THẾ" : "LƯỢT " + M.turn;
    b.classList.add("show");
    clearTimeout(updateTurnBadge._t);
    updateTurnBadge._t = setTimeout(() => b.classList.remove("show"), 1600);
}

// ============================================================
//  RESOLVE (host)
// ============================================================
function aliveIdx(side) { return M.teams[side].map((f, i) => i).filter(i => !M.teams[side][i].fainted); }

function tickStatus(f) {
    if (f.stunTurns > 0) f.stunTurns--;
    if (f.freezeTurns > 0) f.freezeTurns--;
    if (f.paralyzeTurns > 0) f.paralyzeTurns--;
    if (f.confuseTurns > 0) f.confuseTurns--;
    if (f.buffAtkTurns > 0) { f.buffAtkTurns--; if (f.buffAtkTurns === 0) f.buffAtk = 0; }
    if (f.buffDefTurns > 0) { f.buffDefTurns--; if (f.buffDefTurns === 0) f.buffDef = 0; }
    if (f.debuffAtkTurns > 0) { f.debuffAtkTurns--; if (f.debuffAtkTurns === 0) f.debuffAtk = 0; }
    if (f.debuffDefTurns > 0) { f.debuffDefTurns--; if (f.debuffDefTurns === 0) f.debuffDef = 0; }
    if (f.energyBonus > 0) f.energyBonus = 0;
}

function resolveTurn(ch0, ch1) {
    const chs = [ch0, ch1];
    const events = [];

    for (const s of [0, 1]) {
        if (chs[s].kind === "switch") {
            const to = chs[s].to;
            if (to !== M.active[s] && !M.teams[s][to].fainted) {
                events.push({ t: "switch", side: s, from: M.active[s], to });
                M.active[s] = to;
                const nf = M.teams[s][to];
                nf.reflect = 0;
                nf.stunTurns = 0;
            }
        }
    }

    let order = [0, 1];
    const pri0 = chs[0].kind === "attack" && chs[0].moveIdx >= 0
        ? (M.teams[0][M.active[0]].moves[chs[0].moveIdx].priority || 0)
        : 0;
    const pri1 = chs[1].kind === "attack" && chs[1].moveIdx >= 0
        ? (M.teams[1][M.active[1]].moves[chs[1].moveIdx].priority || 0)
        : 0;
    if (pri1 > pri0) order = [1, 0];
    else if (pri1 === pri0) {
        const spd0 = M.teams[0][M.active[0]].spd, spd1 = M.teams[1][M.active[1]].spd;
        if (spd1 > spd0 || (spd1 === spd0 && Math.random() < 0.5)) order = [1, 0];
    }

    for (const s of order) {
        const atkF = M.teams[s][M.active[s]];
        const defF = M.teams[1 - s][M.active[1 - s]];
        if (atkF.fainted || defF.fainted) continue;

        if (atkF.stunTurns > 0 || atkF.freezeTurns > 0) {
            events.push({ t: "stun", side: s, name: atkF.name, kind: atkF.freezeTurns > 0 ? "freeze" : "stun" });
            continue;
        }

        const ch = chs[s];
        if (ch.kind !== "attack") continue;

        let move = ch.moveIdx === -1 ? basicMove(atkF) : atkF.moves[ch.moveIdx];
        if (!move || (move.currentPp !== undefined && move.currentPp <= 0)) move = basicMove(atkF);
        if (move.currentPp !== undefined && isFinite(move.currentPp)) move.currentPp--;

        if (move.kind === "passive") continue;

        if (atkF.confuseTurns > 0 && Math.random() < 0.3) {
            const selfDmg = Math.round((move.dmg || 40) * 0.4);
            atkF.hp = Math.max(0, atkF.hp - selfDmg);
            events.push({ t: "confuse", side: s, dmg: selfDmg, hpAfter: atkF.hp });
            if (atkF.hp <= 0) { atkF.fainted = true; events.push({ t: "faint", side: s, target: M.active[s] }); }
            continue;
        }

        // ===== HYBRID SKILL EXECUTION =====
        const hasDamage = move.dmg && move.dmg > 0;
        const hasShield = move.shield && move.shield > 0;
        const hasHeal = move.heal && move.heal > 0;
        const hasEffect = !!move.effect;
        const hasBuffSelf = !!move.buffSelf;

        // 1) Damage
        if (hasDamage) {
            const ev = applyAttack(s, move);
            events.push(ev);
            if (ev.faint) events.push({ t: "faint", side: ev.targetSide, target: ev.target });
            if (ev.attackerFaint) events.push({ t: "faint", side: s, target: M.active[s] });
        }

        // 2) Shield
        if (hasShield && !atkF.fainted) {
            atkF.shield += move.shield;
            atkF.shieldTurns = BALANCE.SHIELD_TURNS;
            if (move.reflect) atkF.reflect = move.reflect;
            events.push({
                t: "guard", side: s, moveName: move.name,
                amount: move.shield, shieldAfter: atkF.shield,
                reflect: move.reflect || 0
            });
        }

        // 3) Heal
        if (hasHeal && !atkF.fainted) {
            const before = atkF.hp;
            atkF.hp = Math.min(atkF.maxHp, atkF.hp + move.heal);
            events.push({ t: "heal", side: s, moveName: move.name, amount: atkF.hp - before, hpAfter: atkF.hp });
        }

        // 4) Buff self
        if (hasBuffSelf && !atkF.fainted) {
            const b = move.buffSelf;
            if (b.stat === "dmg") {
                atkF.buffAtk = b.value;
                atkF.buffAtkTurns = b.turns || 1;
                events.push({ t: "buff", side: s, stat: "atk", value: atkF.buffAtk, turns: atkF.buffAtkTurns });
            } else if (b.stat === "def") {
                atkF.buffDef = b.value;
                atkF.buffDefTurns = b.turns || 1;
                events.push({ t: "buff", side: s, stat: "def", value: atkF.buffDef, turns: atkF.buffDefTurns });
            }
        }

        // 5) Effect on enemy khi không gây dmg
        if (hasEffect && !hasDamage) {
            const chance = (move.chance != null ? move.chance : 1);
            const success = Math.random() < chance;

            if (move.effect === "stun") {
                if (success) {
                    defF.stunTurns = (defF.stunTurns || 0) + (move.turns || 1) + 1;
                    events.push({ t: "effect_stun", side: 1 - s, target: M.active[1 - s], name: defF.name });
                } else events.push({ t: "effect_miss", side: 1 - s, name: defF.name, effect: "stun" });
            }
            if (move.effect === "expose") {
                if (success) {
                    defF.exposeTurns = BALANCE.EXPOSE_TURNS + 1;
                    events.push({ t: "effect_expose", side: 1 - s, target: M.active[1 - s] });
                } else events.push({ t: "effect_miss", side: 1 - s, name: defF.name, effect: "expose" });
            }
        }

        // 6) Buff/Debuff stat cũ
        if (move.effect === "buff_atk" && !atkF.fainted) {
            atkF.buffAtk = (move.value || 0.2);
            atkF.buffAtkTurns = move.turns || 3;
            events.push({ t: "buff", side: s, stat: "atk", value: atkF.buffAtk, turns: atkF.buffAtkTurns });
        }
        if (move.effect === "buff_def" && !atkF.fainted) {
            atkF.buffDef = (move.value || 0.2);
            atkF.buffDefTurns = move.turns || 3;
            events.push({ t: "buff", side: s, stat: "def", value: atkF.buffDef, turns: atkF.buffDefTurns });
        }
        if (move.effect === "debuff_atk" && !defF.fainted) {
            defF.debuffAtk = (move.value || 0.2);
            defF.debuffAtkTurns = move.turns || 3;
            events.push({ t: "debuff", side: 1 - s, stat: "atk", value: defF.debuffAtk, turns: defF.debuffAtkTurns });
        }
        if (move.effect === "debuff_def" && !defF.fainted) {
            defF.debuffDef = (move.value || 0.2);
            defF.debuffDefTurns = move.turns || 3;
            events.push({ t: "debuff", side: 1 - s, stat: "def", value: defF.debuffDef, turns: defF.debuffDefTurns });
        }
    }

    const someoneAttacked =
        (chs[0].kind === "attack" && (chs[0].moveIdx === -1 || (M.teams[0][M.active[0]].moves[chs[0].moveIdx] && isAttackMove(M.teams[0][M.active[0]].moves[chs[0].moveIdx]))))
        || (chs[1].kind === "attack" && (chs[1].moveIdx === -1 || (M.teams[1][M.active[1]].moves[chs[1].moveIdx] && isAttackMove(M.teams[1][M.active[1]].moves[chs[1].moveIdx]))));
    if (!someoneAttacked) {
        for (const s of [0, 1]) {
            const f = M.teams[s][M.active[s]];
            if (f.fainted) continue;
            const d = Math.min(BALANCE.STALL_DAMAGE, f.hp);
            f.hp -= d;
            events.push({ t: "stall", side: s, target: M.active[s], dmg: d, hpAfter: f.hp });
            if (f.hp <= 0) { f.fainted = true; events.push({ t: "faint", side: s, target: M.active[s] }); }
        }
    }

    for (const s of [0, 1]) {
        const f = M.teams[s][M.active[s]];
        if (f.fainted) continue;

        if (f.dot && f.dot.turns > 0) {
            const d = Math.min(f.dot.dmg, f.hp);
            f.hp -= d; f.dot.turns--;
            events.push({ t: "dot", side: s, target: M.active[s], dmg: d, hpAfter: f.hp, label: f.dot.label });
            if (f.dot.turns <= 0) f.dot = null;
            if (f.hp <= 0) { f.fainted = true; events.push({ t: "faint", side: s, target: M.active[s] }); continue; }
        }

        if (f.shieldTurns > 0) { f.shieldTurns--; if (f.shieldTurns === 0) f.shield = 0; }
        if (f.exposeTurns > 0) f.exposeTurns--;
        tickStatus(f);
    }

    const a0 = aliveIdx(0), a1 = aliveIdx(1);
    M.needSwitch = [false, false];
    if (!a0.length || !a1.length) {
        M.phase = "end";
        M.winner = (!a0.length && !a1.length) ? "draw" : (a0.length ? 0 : 1);
        events.push({ t: "end", winner: M.winner });
        return events;
    }
    for (const s of [0, 1]) {
        if (M.teams[s][M.active[s]].fainted && aliveIdx(s).length) M.needSwitch[s] = true;
    }
    if (M.needSwitch[0] || M.needSwitch[1]) M.phase = "forced";
    else { M.phase = "battle"; M.turn++; }
    return events;
}

function applyAttack(side, move) {
    const atkF = M.teams[side][M.active[side]];
    const defSide = 1 - side;
    const defF = M.teams[defSide][M.active[defSide]];

    const hits = Math.max(1, move.multiHit || 1);
    let totalDmg = 0, totalAbsorbed = 0, anyCrit = false, anySuper = false, anyResist = false;
    let passiveTriggered = false;

    for (let h = 0; h < hits; h++) {
        const mult = typeMultiplier(move.type, defF.type);
        if (mult > 1) anySuper = true;
        if (mult < 1) anyResist = true;

        let dmg = Math.max(1, Math.round(move.dmg * mult));

        if (atkF.buffAtk) dmg = Math.round(dmg * (1 + atkF.buffAtk));
        if (atkF.debuffAtk) dmg = Math.round(dmg * (1 - atkF.debuffAtk));

        const crit = Math.random() < (BALANCE.CRIT_CHANCE + (move.critBonus || 0));
        if (crit) { dmg = Math.round(dmg * BALANCE.CRIT_MULT); anyCrit = true; }

        const exposed = defF.exposeTurns > 0;
        if (exposed) dmg = Math.round(dmg * BALANCE.EXPOSE_MULT);

        if (defF.buffDef) dmg = Math.round(dmg * (1 - defF.buffDef));
        if (defF.debuffDef) dmg = Math.round(dmg * (1 + defF.debuffDef));

        const fixedResist = defF.resistFixed || 0;
        if (fixedResist > 0) dmg = Math.max(1, dmg - fixedResist);

        // ⭐ PASSIVE: giảm sát thương nhận vào
        if (defF.damageReduction > 0) {
            const before = dmg;
            dmg = Math.max(1, Math.round(dmg * (1 - defF.damageReduction)));
            if (before !== dmg) passiveTriggered = true;
        }

        // ⭐ PASSIVE: nhận thêm sát thương
        if (defF.extraDamageTaken > 0) {
            dmg += defF.extraDamageTaken;
            passiveTriggered = true;
        }

        // ⭐ PASSIVE: energy_on_hit
        if (defF.passiveEffect === "energy_on_hit") {
            defF.energyBonus = (defF.energyBonus || 0) + 1;
        }

        let absorbed = 0;
        if (defF.shield > 0) {
            absorbed = Math.min(defF.shield, dmg);
            defF.shield -= absorbed;
            dmg -= absorbed;
        }

        dmg = Math.min(dmg, defF.hp);
        defF.hp -= dmg;
        totalDmg += dmg;
        totalAbsorbed += absorbed;

        if (defF.hp <= 0) break;
    }

    const ev = {
        t: "attack", side, targetSide: defSide, target: M.active[defSide],
        attacker: atkF.name,
        move: { name: move.name, type: move.type, kind: "attack", cost: move.cost || 1 },
        mult: anySuper ? 1.5 : anyResist ? 0.5 : 1,
        crit: anyCrit, exposed: defF.exposeTurns > 0,
        dmg: totalDmg, absorbed: totalAbsorbed,
        hits,
        hpAfter: defF.hp, shieldAfter: defF.shield,
        effect: move.effect || null, faint: false,
        passiveTriggered: passiveTriggered,
        defId: defF.id,
        atkId: atkF.id
    };

    if (move.effect === "expose") { defF.exposeTurns = BALANCE.EXPOSE_TURNS + 1; ev.exposeApplied = true; }
    if ((move.effect === "burn" || move.effect === "poison") && move.dot) {
        defF.dot = { dmg: move.dot.dmg, turns: move.dot.turns, label: move.effect };
        ev.dotApplied = { dmg: move.dot.dmg, turns: move.dot.turns, label: move.effect };
    }
    if (move.effect === "stun") {
        const chance = (move.chance != null ? move.chance : 1);
        if (Math.random() < chance) {
            defF.stunTurns = (defF.stunTurns || 0) + (move.turns || 1) + 1;
            ev.stunApplied = true;
        } else ev.stunMissed = true;
    }
    if (move.effect === "freeze") {
        const chance = (move.chance != null ? move.chance : 1);
        if (Math.random() < chance) {
            defF.freezeTurns = (defF.freezeTurns || 0) + (move.turns || 1) + 1;
            ev.freezeApplied = true;
        } else ev.freezeMissed = true;
    }
    if (move.effect === "paralyze") {
        const chance = (move.chance != null ? move.chance : 1);
        if (Math.random() < chance) {
            defF.paralyzeTurns = (defF.paralyzeTurns || 0) + (move.turns || 2);
            ev.paralyzeApplied = true;
        } else ev.paralyzeMissed = true;
    }
    if (move.effect === "confuse") {
        const chance = (move.chance != null ? move.chance : 1);
        if (Math.random() < chance) {
            defF.confuseTurns = (defF.confuseTurns || 0) + (move.turns || 2);
            ev.confuseApplied = true;
        } else ev.confuseMissed = true;
    }

    if (move.drain) {
        const heal = (typeof move.drain === "number")
            ? move.drain
            : Math.round(totalDmg * BALANCE.DRAIN_RATIO);
        atkF.hp = Math.min(atkF.maxHp, atkF.hp + heal);
        ev.drain = heal;
    }

    if (defF.reflect > 0 && totalDmg > 0) {
        const reflectDmg = Math.round(totalDmg * defF.reflect);
        atkF.hp = Math.max(0, atkF.hp - reflectDmg);
        ev.reflectDmg = reflectDmg;
        ev.reflectSource = defF.name;
        if (atkF.hp <= 0) { atkF.fainted = true; ev.attackerFaint = true; }
    }

    if (defF.hp <= 0) { defF.fainted = true; ev.faint = true; }
    return ev;
}

// ============================================================
//  VFX SYSTEM — Animation theo hệ
// ============================================================
function getSceneRect(side) {
    const scene = EL.scene;
    if (!scene) return null;
    const el = spriteOf(side !== undefined ? side : mySide);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const rs = scene.getBoundingClientRect();
    return { x: r.left - rs.left + r.width / 2, y: r.top - rs.top + r.height / 2 };
}

function spawnVFX(html, x, y, duration) {
    const scene = EL.scene;
    if (!scene) return;
    const d = document.createElement("div");
    d.className = "vfx-layer";
    d.innerHTML = html;
    d.style.left = x + "px";
    d.style.top = y + "px";
    scene.appendChild(d);
    setTimeout(() => { try { d.remove(); } catch (e) { } }, duration || 1000);
}

const TYPE_VFX = {
    FIRE: (x, y) => spawnVFX(`
        <div class="vfx-fire">
            <div class="flame f1"></div><div class="flame f2"></div>
            <div class="flame f3"></div><div class="flame f4"></div>
            <div class="flame f5"></div>
        </div>`, x, y, 900),
    WATER: (x, y) => spawnVFX(`
        <div class="vfx-water">
            <div class="drop d1"></div><div class="drop d2"></div>
            <div class="drop d3"></div><div class="drop d4"></div>
            <div class="wave"></div>
        </div>`, x, y, 900),
    GRASS: (x, y) => spawnVFX(`
        <div class="vfx-grass">
            <div class="leaf l1">🍃</div><div class="leaf l2">🍃</div>
            <div class="leaf l3">🍃</div><div class="leaf l4">🍃</div>
            <div class="vine"></div>
        </div>`, x, y, 900),
    DARK_WIND: (x, y) => spawnVFX(`
        <div class="vfx-dark">
            <div class="dark-orb o1"></div><div class="dark-orb o2"></div>
            <div class="dark-orb o3"></div>
            <div class="wind w1"></div><div class="wind w2"></div>
        </div>`, x, y, 900),
    LIGHT: (x, y) => spawnVFX(`
        <div class="vfx-light">
            <div class="ray r1"></div><div class="ray r2"></div>
            <div class="ray r3"></div><div class="ray r4"></div>
            <div class="star">✨</div>
        </div>`, x, y, 900),
    GROUND: (x, y) => spawnVFX(`
        <div class="vfx-ground">
            <div class="rock r1">🪨</div><div class="rock r2">🪨</div>
            <div class="rock r3">🪨</div><div class="crack"></div>
        </div>`, x, y, 900),
    DRAGON: (x, y) => spawnVFX(`
        <div class="vfx-dragon">
            <div class="dragon-breath"></div>
            <div class="dragon-spark s1">✦</div>
            <div class="dragon-spark s2">✦</div>
            <div class="dragon-spark s3">✦</div>
        </div>`, x, y, 1000),
    UNDEAD: (x, y) => spawnVFX(`
        <div class="vfx-undead">
            <div class="skull k1">💀</div>
            <div class="skull k2">💀</div>
            <div class="skull k3">💀</div>
            <div class="purple-aura"></div>
        </div>`, x, y, 1000)
};

function playTypeVFX(typeKey, side) {
    const pos = getSceneRect(side !== undefined ? side : oppSide());
    if (!pos) return;
    const fn = TYPE_VFX[typeKey];
    if (fn) fn(pos.x, pos.y);
}

function playShieldVFX(side) {
    const pos = getSceneRect(side);
    if (!pos) return;
    spawnVFX(`<div class="vfx-shield">
        <div class="hex"></div><div class="hex"></div><div class="hex"></div>
    </div>`, pos.x, pos.y, 1200);
}

function playHealVFX(side) {
    const el = spriteOf(side);
    const scene = EL.scene;
    if (!el || !scene) return;
    const r = el.getBoundingClientRect();
    const rs = scene.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
        const d = document.createElement("div");
        d.className = "vfx-heal-particle";
        d.textContent = "✚";
        d.style.left = (r.left - rs.left + r.width / 2 + (Math.random() - 0.5) * 100) + "px";
        d.style.top = (r.top - rs.top + r.height) + "px";
        d.style.animationDelay = (i * 0.06) + "s";
        scene.appendChild(d);
        setTimeout(() => { try { d.remove(); } catch (e) { } }, 1400);
    }
}

function playBuffVFX(side) {
    const pos = getSceneRect(side);
    if (!pos) return;
    spawnVFX(`<div class="vfx-buff">
        <div class="arrow-up">▲</div><div class="arrow-up">▲</div><div class="arrow-up">▲</div>
    </div>`, pos.x, pos.y, 1000);
}

function playDebuffVFX(side) {
    const pos = getSceneRect(side);
    if (!pos) return;
    spawnVFX(`<div class="vfx-debuff">
        <div class="arrow-down">▼</div><div class="arrow-down">▼</div><div class="arrow-down">▼</div>
    </div>`, pos.x, pos.y, 1000);
}

function playPassiveVFX(side, passiveId) {
    const pos = getSceneRect(side);
    if (!pos) return;
    let inner;
    if (passiveId === "long_the_luc_that") {
        inner = `<div class="aura purple"></div><div class="passive-text">VẢY RỒNG</div>`;
    } else if (passiveId === "kho_lau_cot_de") {
        inner = `<div class="aura red"></div><div class="passive-text">XƯƠNG SƯỜN</div>`;
    } else {
        inner = `<div class="aura purple"></div><div class="passive-text">PASSIVE</div>`;
    }
    spawnVFX(`<div class="vfx-passive">${inner}</div>`, pos.x, pos.y, 1200);
}

// ============================================================
//  PLAYBACK
// ============================================================
async function runTurn(events) {
    busy = true;
    playStall._said = false;
    closeSwitch();
    battleOver = (M.phase === "end");
    updateTurnBadge();
    refreshMenu();
    try {
        for (const ev of events) await playEvent(ev);
        syncView(); renderAll();
    } finally {
        busy = false;
        myTurnReady = false;
        refreshMenu();
    }

    if (M.phase === "end") { closeAllOverlays(true); showResult(); return; }

    if (M.phase === "forced") {
        if (M.needSwitch[mySide]) {
            await say("Quái của bạn đã gục — chọn quái thay thế!");
            openSwitch("forced");
            scheduleForcedAI();
            if (autoPlay) setTimeout(() => { if (M && M.needSwitch[mySide] && currentScreen === "battle") submitForced(randomAlive(mySide)); }, 500);
        } else {
            await say("Đối thủ đang chọn quái thay thế...");
            scheduleForcedAI();
        }
        return;
    }
    startTurn();
}
function scheduleForcedAI() {
    if (mode === "ai" && M.needSwitch[oppSide()]) {
        setTimeout(() => {
            if (M && M.needSwitch[oppSide()]) {
                forcedChoice[oppSide()] = aiPickSwitch(oppSide(), null, true);
                checkForced();
            }
        }, 750);
    }
}
function randomAlive(side) {
    const a = aliveIdx(side).filter(i => i !== M.active[side]);
    return a.length ? a[Math.floor(Math.random() * a.length)] : M.active[side];
}
function startTurn() {
    myTurnReady = false; menuMode = "root";
    refreshMenu();
    banner("LƯỢT " + M.turn);
    SFX.turn();
    if (autoPlay) setTimeout(autoAct, 550);
}
function autoAct() {
    if (!M || M.phase !== "battle" || myTurnReady || busy || battleOver) return;
    const f = M.teams[mySide][M.active[mySide]];
    if (Math.random() < 0.18) {
        const a = aliveIdx(mySide).filter(i => i !== M.active[mySide]);
        if (a.length) { submitChoice({ kind: "switch", to: a[Math.floor(Math.random() * a.length)] }); return; }
    }
    const opts = [];
    f.moves.forEach((m, i) => {
        if (m.currentPp > 0 && m.kind !== "passive") opts.push({ i, w: isAttackMove(m) ? 4 : 1 });
    });
    opts.push({ i: -1, w: 4 });
    let total = opts.reduce((a, o) => a + o.w, 0), r = Math.random() * total, pick = opts[0];
    for (const o of opts) { r -= o.w; if (r <= 0) { pick = o; break; } }
    submitChoice({ kind: "attack", moveIdx: pick.i });
}

function playEvent(ev) {
    switch (ev.t) {
        case "switch": return playSwitch(ev);
        case "attack": return playAttack(ev);
        case "guard": return playGuard(ev);
        case "heal": return playHeal(ev);
        case "dot": return playDot(ev);
        case "stall": return playStall(ev);
        case "faint": return playFaint(ev);
        case "end": return playEnd(ev);
        case "stun": return playStun(ev);
        case "confuse": return playConfuse(ev);
        case "buff": return playBuff(ev);
        case "debuff": return playDebuff(ev);
        case "effect_stun": return playEffectStun(ev);
        case "effect_expose": return playEffectExpose(ev);
        case "effect_miss": return playEffectMiss(ev);
        default: return sleep(150);
    }
}

async function playSwitch(ev) {
    const el = spriteOf(ev.side);
    const f = M.teams[ev.side][ev.to];
    await say([tag(ev.side), {
        text: ev.forced ? ` tung ra ${f.name} thay thế!` : `đổi sang ${f.name}!`
    }]);
    SFX.back();
    el.classList.remove("fainted");
    const dir = ev.side === mySide ? 70 : -70;
    await el.animate(
        [{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: `translateY(${dir}px) scale(.7)` }],
        { duration: 240, easing: "ease-in" }).finished.catch(() => { });

    view[ev.side].active = ev.to;
    renderHud(ev.side);
    const sideName = (ev.side === mySide) ? "player" : "enemy";
    Render.sprite(el, spriteOpts(f.id, false), sideName);
    el.animate(
        [{ opacity: 0, transform: `translateY(${dir}px) scale(.7)` }, { opacity: 1, transform: "none" }],
        { duration: 340, easing: "cubic-bezier(.2,.9,.3,1.4)" }).finished.catch(() => { });
    await sleep(340);
}

async function playAttack(ev) {
    const atkEl = spriteOf(ev.side), defEl = spriteOf(ev.targetSide);
    const T = TYPES[ev.move.type] || { color: "#fff" };

    await say([tag(ev.side), { text: `${ev.attacker} dùng ${ev.move.name}!` }], 14);
    SFX.charge();

    atkEl.classList.add(ev.side === mySide ? "atk-p" : "atk-e");
    await sleep(230);

    SFX.shoot();
    // VFX theo hệ — hiện tại vị trí defender
    playTypeVFX(ev.move.type, ev.targetSide);
    if (ev.move.kind === "attack") await shoot(atkEl, defEl, T.color);
    await sleep(170);
    atkEl.classList.remove("atk-p", "atk-e");

    const isSuper = ev.mult > 1, isResist = ev.mult < 1;
    defEl.classList.add("hit");
    (isSuper ? SFX.superHit : SFX.hit)();
    flash(isSuper ? "rgba(255,215,95,.75)" : "rgba(255,255,255,.35)");

    if (ev.absorbed > 0) popupAt(ev.targetSide, "🛡 " + ev.absorbed, "crit");
    if (ev.dmg > 0) popupAt(ev.targetSide, "-" + ev.dmg + (ev.hits > 1 ? " x" + ev.hits : ""), ev.crit ? "crit" : "");
    if (ev.crit) popupAt(ev.targetSide, "CRIT!", "crit");

    // Passive VFX
    if (ev.passiveTriggered && ev.defId) {
        playPassiveVFX(ev.targetSide, ev.defId);
        SFX.passive();
        const pname = ev.defId === "long_the_luc_that" ? "Vảy Rồng Bất Hoại" : (ev.defId === "kho_lau_cot_de" ? "Xương Sườn Nhạy Cảm" : "Passive");
        await say([{ text: `✨ ${pname} kích hoạt!`, cls: "eff" }]);
    }

    view[ev.targetSide].hp[ev.target] = ev.hpAfter;
    view[ev.targetSide].shield[ev.target] = ev.shieldAfter;
    renderHud(ev.targetSide);
    await sleep(430);
    defEl.classList.remove("hit");

    if (ev.absorbed > 0 && ev.dmg === 0) await say("Khiên đã hấp thụ toàn bộ sát thương!");
    if (ev.crit) await say([{ text: "💥 CHÍ MẠNG! Sát thương tăng mạnh.", cls: "crit" }]);
    if (ev.exposed) await say([{ text: "⚠️ " + (ev.targetSide === mySide ? "Quái của bạn" : "Đối thủ") + " bị KHƠI MỞ — nhận thêm sát thương.", cls: "crit" }]);
    if (isSuper) await say([{ text: "Rất hiệu quả!", cls: "eff" }]);
    else if (isResist) await say([{ text: "Không hiệu quả lắm...", cls: "noeff" }]);
    if (ev.dotApplied) await say([{
        text: (ev.dotApplied.label === "burn" ? "🔥 Bị CHÁY" : "☠️ Bị ĐỘC") +
            ` — ${ev.dotApplied.dmg} sát thương mỗi lượt (${ev.dotApplied.turns} lượt).`, cls: "eff"
    }]);
    if (ev.stunApplied) await say([{ text: "💫 Đối thủ bị CHOÁNG!", cls: "crit" }]);
    if (ev.freezeApplied) await say([{ text: "❄️ Đối thủ bị ĐÓNG BĂNG!", cls: "crit" }]);
    if (ev.paralyzeApplied) await say([{ text: "⚡ Đối thủ bị TÊ LIỆT!", cls: "crit" }]);
    if (ev.confuseApplied) await say([{ text: "😵 Đối thủ bị HỖN LOẠN!", cls: "crit" }]);
    if (ev.drain) {
        const cur = view[ev.side].hp[M.active[ev.side]];
        view[ev.side].hp[M.active[ev.side]] = Math.min(M.teams[ev.side][M.active[ev.side]].maxHp, cur + ev.drain);
        renderHud(ev.side);
        SFX.heal(); playHealVFX(ev.side); popupAt(ev.side, "+" + ev.drain, "heal");
        await say([{ text: `🩸 ${ev.attacker} hút ${ev.drain} HP!`, cls: "eff" }]);
    }
    if (ev.reflectDmg) {
        SFX.reflect();
        await say([{ text: `🔮 ${ev.reflectSource} phản đòn ${ev.reflectDmg} sát thương lên ${ev.attacker}!`, cls: "crit" }]);
        view[ev.side].hp[M.active[ev.side]] = Math.max(0, view[ev.side].hp[M.active[ev.side]] - ev.reflectDmg);
        renderHud(ev.side);
        popupAt(ev.side, "-" + ev.reflectDmg, "crit");
        if (ev.attackerFaint) {
            view[ev.side].hp[M.active[ev.side]] = 0;
            view[ev.side].fainted[M.active[ev.side]] = true;
            renderHud(ev.side);
            await say([{ text: `💀 ${ev.attacker} tự gục vì phản đòn!`, cls: "crit" }]);
        }
    }
}

async function playGuard(ev) {
    const el = spriteOf(ev.side);
    let text = `${ev.moveName}! Tạo khiên ${ev.amount} điểm.`;
    if (ev.reflect) text += ` (Phản đòn ${Math.round(ev.reflect * 100)}%)`;
    await say([tag(ev.side), { text }]);
    SFX.shield();
    playShieldVFX(ev.side);
    view[ev.side].shield[M.active[ev.side]] = ev.shieldAfter;
    renderHud(ev.side);
    popupAt(ev.side, "🛡", "heal");
    if (ev.reflect) popupAt(ev.side, "🔮", "heal");
    el.animate([{ filter: "drop-shadow(0 14px 12px rgba(0,0,0,.45))" },
    { filter: "drop-shadow(0 0 30px #6cc7ff) brightness(1.7)" },
    { filter: "drop-shadow(0 14px 12px rgba(0,0,0,.45))" }], { duration: 520 });
    await sleep(520);
}
async function playHeal(ev) {
    await say([tag(ev.side), { text: `${ev.moveName}! Hồi phục ${ev.amount} HP.` }]);
    SFX.heal();
    playHealVFX(ev.side);
    view[ev.side].hp[M.active[ev.side]] = ev.hpAfter;
    renderHud(ev.side);
    popupAt(ev.side, "+" + ev.amount, "heal");
    await sleep(560);
}
async function playDot(ev) {
    const el = spriteOf(ev.side);
    await say([tag(ev.side), {
        text: ev.label === "burn" ? `bị thiêu đốt — mất ${ev.dmg} HP!` : `trúng độc — mất ${ev.dmg} HP!`
    }]);
    SFX.hit();
    el.classList.add("hit");
    view[ev.side].hp[ev.target] = ev.hpAfter;
    renderHud(ev.side);
    popupAt(ev.side, "-" + ev.dmg, "");
    await sleep(420);
    el.classList.remove("hit");
}
async function playStall(ev) {
    const el = spriteOf(ev.side);
    if (!playStall._said) {
        playStall._said = true;
        await say([{ text: "Trận đấu lâm vào bế tắc — cả hai chịu " + ev.dmg + " sát thương!", cls: "noeff" }]);
    }
    SFX.hit();
    el.classList.add("hit");
    view[ev.side].hp[ev.target] = ev.hpAfter;
    renderHud(ev.side);
    popupAt(ev.side, "-" + ev.dmg, "");
    await sleep(380);
    el.classList.remove("hit");
}
async function playFaint(ev) {
    const el = spriteOf(ev.side);
    SFX.faint();
    el.classList.add("fainted");
    const name = M.teams[ev.side][ev.target].name;
    view[ev.side].hp[ev.target] = 0;
    view[ev.side].fainted[ev.target] = true;
    renderHud(ev.side);
    await say([tag(ev.side), { text: `${name} đã gục!` }]);
    await sleep(300);
}
async function playEnd(ev) {
    if (ev.winner === "draw") await say([{ text: "Cả hai cùng gục — HÒA!", cls: "crit" }]);
    else if (ev.winner === mySide) await say([{ text: "Toàn bộ quái của đối thủ đã gục — BẠN THẮNG!", cls: "eff" }]);
    else await say([{ text: "Toàn bộ quái của bạn đã gục — BẠN THUA!", cls: "crit" }]);
    await sleep(450);
}
async function playStun(ev) {
    await say([tag(ev.side), {
        text: ev.kind === "freeze"
            ? `${ev.name} bị đóng băng — không thể hành động!`
            : `${ev.name} bị choáng váng — mất lượt!`,
        cls: "noeff"
    }]);
    SFX.stun();
    const el = spriteOf(ev.side);
    el.animate([
        { transform: "rotate(0deg)" },
        { transform: "rotate(-8deg)" },
        { transform: "rotate(8deg)" },
        { transform: "rotate(-8deg)" },
        { transform: "rotate(0deg)" }
    ], { duration: 600, easing: "ease-in-out" });
    await sleep(600);
}
async function playConfuse(ev) {
    await say([tag(ev.side), { text: `${M.teams[ev.side][M.active[ev.side]].name} bị hỗn loạn — tự đánh mình mất ${ev.dmg} HP!`, cls: "crit" }]);
    SFX.hit();
    const el = spriteOf(ev.side);
    el.animate([
        { transform: "translateX(0)" },
        { transform: "translateX(-15px) rotate(-10deg)" },
        { transform: "translateX(15px) rotate(10deg)" },
        { transform: "translateX(0)" }
    ], { duration: 500 });
    popupAt(ev.side, "-" + ev.dmg, "crit");
    view[ev.side].hp[M.active[ev.side]] = ev.hpAfter;
    renderHud(ev.side);
    await sleep(500);
}
async function playBuff(ev) {
    const statName = ev.stat === "atk" ? "tấn công" : "phòng thủ";
    await say([tag(ev.side), { text: `${ev.side === mySide ? "Bạn" : "Đối thủ"} tăng ${statName} +${Math.round(ev.value * 100)}% (${ev.turns} lượt)!`, cls: "eff" }]);
    SFX.buff();
    playBuffVFX(ev.side);
    popupAt(ev.side, "⬆️ " + statName.toUpperCase(), "heal");
    await sleep(500);
}
async function playDebuff(ev) {
    const statName = ev.stat === "atk" ? "tấn công" : "phòng thủ";
    await say([tag(ev.side), { text: `${ev.side === mySide ? "Bạn" : "Đối thủ"} bị giảm ${statName} -${Math.round(ev.value * 100)}% (${ev.turns} lượt)!`, cls: "crit" }]);
    SFX.debuff();
    playDebuffVFX(ev.side);
    popupAt(ev.side, "⬇️ " + statName.toUpperCase(), "crit");
    await sleep(500);
}
async function playEffectStun(ev) {
    await say([tag(1 - ev.side), { text: `${ev.name} bị CHOÁNG!`, cls: "crit" }]);
    SFX.stun();
    playTypeVFX("LIGHT", ev.side);
    await sleep(500);
}
async function playEffectExpose(ev) {
    await say([tag(1 - ev.side), { text: `${(1 - ev.side) === mySide ? "Quái của bạn" : "Đối thủ"} bị KHƠI MỞ!`, cls: "crit" }]);
    SFX.debuff();
    playDebuffVFX(ev.side);
    await sleep(500);
}
async function playEffectMiss(ev) {
    await say([{ text: `Hiệu ứng ${ev.effect} lên ${ev.name} đã trượt...`, cls: "noeff" }]);
    await sleep(300);
}

// ---------- VFX BASIC ----------
function popupAt(side, text, cls) {
    const el = spriteOf(side), scene = EL.scene;
    if (!el || !scene) return;
    const r = el.getBoundingClientRect(), rs = scene.getBoundingClientRect();
    const d = document.createElement("div");
    d.className = "damage-pop " + (cls || "");
    d.textContent = text;
    d.style.left = (r.left - rs.left + r.width * 0.5 - 20) + "px";
    d.style.top = (r.top - rs.top + r.height * 0.18) + "px";
    scene.appendChild(d);
    d.animate([
        { transform: "translateY(0) scale(.7)", opacity: 0 },
        { transform: "translateY(-18px) scale(1.15)", opacity: 1, offset: 0.25 },
        { transform: "translateY(-62px) scale(1)", opacity: 0 }
    ], { duration: 950, easing: "ease-out" }).finished.then(() => { try { d.remove(); } catch (e) { } }).catch(() => { });
}
function shoot(fromEl, toEl, color) {
    const scene = EL.scene;
    if (!scene) return Promise.resolve();
    const r1 = fromEl.getBoundingClientRect(), r2 = toEl.getBoundingClientRect(), rs = scene.getBoundingClientRect();
    const p = document.createElement("div");
    p.className = "proj";
    p.style.color = color;
    p.style.background = `radial-gradient(circle at 34% 30%, #fff, ${color} 58%, ${shade(color, -0.45)})`;
    p.style.left = (r1.left - rs.left + r1.width / 2 - 23) + "px";
    p.style.top = (r1.top - rs.top + r1.height / 2 - 23) + "px";
    scene.appendChild(p);
    const dx = (r2.left - r1.left) + (r2.width - r1.width) / 2;
    const dy = (r2.top - r1.top) + (r2.height - r1.height) / 2;
    return p.animate([
        { transform: "translate(0,0) scale(.5) rotate(0deg)" },
        { transform: `translate(${dx * .5}px, ${dy * .5 - 40}px) scale(1.15) rotate(220deg)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(.85) rotate(420deg)` }
    ], { duration: 460, easing: "cubic-bezier(.35,.05,.6,1)" }).finished.then(() => { try { p.remove(); } catch (e) { } }).catch(() => { });
}

// ============================================================
//  AI
// ============================================================
function bestAttackOf(attacker, defender) {
    let best = null;
    attacker.moves.forEach(m => {
        if (!isAttackMove(m) || m.currentPp <= 0 || !m.dmg) return;
        const mult = typeMultiplier(m.type, defender.type);
        const dmg = Math.round(m.dmg * mult);
        if (!best || dmg > best.dmg) best = { m, dmg, mult };
    });
    const bMult = typeMultiplier(attacker.type, defender.type);
    const bDmg = Math.round(40 * bMult);
    if (!best || best.dmg < bDmg) best = { m: basicMove(attacker), dmg: bDmg, mult: bMult };
    return best;
}
function aiPickSwitch(side, threat, force) {
    const me = M.teams[side];
    const cur = M.active[side];
    const alive = me.map((f, i) => i).filter(i => !me[i].fainted && i !== cur);
    if (!alive.length) return cur;
    let best = cur, bestScore = -1;
    alive.forEach(i => {
        const c = me[i];
        const mult = threat ? typeMultiplier(threat.m.type, c.type) : 1;
        const score = (c.hp / c.maxHp) * 100 + (1 / mult) * 45 + c.spd * 1.2 + (force ? 20 : 0);
        if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
}
function aiChoose(side) {
    const me = M.teams[side], foe = M.teams[1 - side];
    const f = me[M.active[side]], tf = foe[M.active[1 - side]];
    if (M.needSwitch[side]) return { kind: "switch", to: aiPickSwitch(side, null, true) };

    const threat = bestAttackOf(tf, f);
    const hpR = f.hp / f.maxHp;
    const alive = me.map((x, i) => i).filter(i => !me[i].fainted);

    if (alive.length > 1 && hpR < 0.42 && (threat.dmg >= f.hp || threat.mult > 1) && Math.random() < 0.7) {
        const to = aiPickSwitch(side, threat, false);
        if (to !== M.active[side]) return { kind: "switch", to };
    }
    const healIdx = f.moves.findIndex(m => m.heal && m.currentPp > 0 && m.kind !== "passive");
    if (healIdx >= 0 && hpR < 0.45 && Math.random() < 0.85) return { kind: "attack", moveIdx: healIdx };
    const guardIdx = f.moves.findIndex(m => m.shield && m.currentPp > 0 && m.kind !== "passive");
    if (guardIdx >= 0 && f.shield === 0 && (hpR < 0.4 || threat.dmg > f.hp * 0.45) && Math.random() < 0.75)
        return { kind: "attack", moveIdx: guardIdx };

    const opts = [];
    f.moves.forEach((m, i) => {
        if (!isAttackMove(m) || m.currentPp <= 0 || m.kind === "passive") return;
        const mult = typeMultiplier(m.type, tf.type);
        let score = (m.dmg || 40) * mult;
        if (m.effect === "expose") score += 22;
        if (m.effect === "burn" || m.effect === "poison") score += 26;
        if (m.effect === "stun") score += 35 * (m.chance != null ? m.chance : 1);
        if (m.effect === "freeze") score += 45;
        if (m.drain) score += 15;
        if (m.reflect) score += 30;
        if (m.shield && !m.dmg) score += 18;
        if (m.heal && !m.dmg) score += 22;
        if (m.multiHit) score *= (1 + (m.multiHit - 1) * 0.5);
        score *= (0.85 + Math.random() * 0.3);
        opts.push({ i, score });
    });
    opts.push({ i: -1, score: 40 * typeMultiplier(f.type, tf.type) * (0.85 + Math.random() * 0.3) });
    opts.sort((a, b) => b.score - a.score);
    const pick = (Math.random() < 0.78 || opts.length < 2) ? opts[0] : opts[1];
    return { kind: "attack", moveIdx: pick.i };
}

// ============================================================
//  ENTER BATTLE / RESULT
// ============================================================
function enterBattle(state) {
    M = state;
    mySide = isHost ? 0 : 1;
    battleOver = false; busy = false; queue = []; playbackRunning = false;
    pendingChoice = [null, null]; forcedChoice = [null, null];
    myTurnReady = false; menuMode = "root";
    closeAllOverlays();
    showScreen("battle");
    syncView(); renderAll();
    const sp = EL["sprite-player"], se = EL["sprite-enemy"];
    if (sp) { sp.classList.remove("fainted", "atk-p", "hit"); sp.classList.add("enter-p"); }
    if (se) { se.classList.remove("fainted", "atk-e", "hit"); se.classList.add("enter-e"); }
    setTimeout(() => { if (sp) sp.classList.remove("enter-p"); if (se) se.classList.remove("enter-e"); }, 500);
    updateTurnBadge();
    const mine = M.teams[mySide][M.active[mySide]].name;
    const theirs = M.teams[oppSide()][M.active[oppSide()]].name;
    banner("TRẬN ĐẤU BẮT ĐẦU");
    (async () => {
        await sleep(650);
        await say([tag(mySide), { text: ` tung ra ${mine}! ` }, tag(oppSide()), { text: ` tung ra ${theirs}!` }]);
        startTurn();
    })();
}
function showResult() {
    battleOver = true;
    const draw = M.winner === "draw";
    const win = !draw && M.winner === mySide;
    const t = EL["result-title"], s = EL["result-sub"];
    if (draw) { t.textContent = "HÒA!"; t.classList.remove("lose"); s.textContent = "Cả hai cùng gục — không ai giành chiến thắng."; }
    else if (win) { t.textContent = "CHIẾN THẮNG!"; t.classList.remove("lose"); s.textContent = "Đội hình của bạn đã hạ gục toàn bộ đối thủ."; SFX.win(); }
    else { t.textContent = "THUA RỒI..."; t.classList.add("lose"); s.textContent = "Đội hình của bạn đã gục hết — thử đổi chiến thuật nhé!"; SFX.lose(); }
    setTimeout(() => { EL["ov-result"].classList.add("show"); SFX.select(); }, 700);
}
function requestRematch() {
    EL["ov-result"].classList.remove("show");
    if (mode === "ai") { enterRoll(); return; }
    if (mode === "p2p") {
        if (isHost) { enterRoll(); broadcast({ type: "roll" }); }
        else { send({ type: "rematchReq" }); setStatus("Đợi đối thủ muốn đấu lại..."); }
        return;
    }
    enterRoll();
}

// ============================================================
//  BIND / BOOT
// ============================================================
function bindBattle() {
    EL["btn-log"].addEventListener("click", () => { SFX.click(); EL["ov-log"].classList.add("show"); });
    EL["btn-log-close"].addEventListener("click", () => { SFX.back(); EL["ov-log"].classList.remove("show"); });
    EL["btn-switch-cancel"].addEventListener("click", () => { SFX.back(); closeSwitch(); menuMode = "root"; refreshMenu(); });
    EL["btn-mute"].addEventListener("click", () => {
        SFX.muted = !SFX.muted;
        EL["btn-mute"].textContent = SFX.muted ? "🔇" : "🔊";
        SFX.click();
    });
    EL["btn-rematch"].addEventListener("click", () => { SFX.select(); requestRematch(); });
    EL["btn-home"].addEventListener("click", () => location.reload());
}
function bindPrep() {
    EL["btn-confirm-team"].addEventListener("click", confirmTeam);
    EL["btn-prep-back"].addEventListener("click", () => { SFX.back(); location.reload(); });
    const rs = $("roster-search");
    if (rs) rs.addEventListener("input", () => { rosterQuery = rs.value; renderPrep(); });
}

function applyDebugHooks() {
    const q = (typeof location !== "undefined" && location.search) ? new URLSearchParams(location.search) : new URLSearchParams("");
    const hash = (typeof location !== "undefined" && location.hash) || "";

    if (q.get("debug")) {
        window.__errs = [];
        window.addEventListener("error", e => window.__errs.push((e.message || "") + " @" + String(e.filename || "").split("/").pop() + ":" + e.lineno));
        window.addEventListener("unhandledrejection", e => window.__errs.push("promise: " + ((e.reason && e.reason.message) || e.reason)));
        const delay = parseInt(q.get("debug"), 10) || 2500;
        setTimeout(() => {
            const out = {
                errs: window.__errs, screen: currentScreen, phase: M && M.phase, turn: M && M.turn,
                winner: M && M.winner, battleOver, busy, queueLen: queue.length,
                pending: pendingChoice, forced: forcedChoice, myTurnReady, menuMode, autoPlay,
                needSwitch: M && M.needSwitch, active: M && M.active, teamLens: M && M.teams.map(t => t.length),
                hp: M && M.teams.map(t => t.map(f => f.hp)),
                rollCount: rollMonsters.length, rollPicked: rollPickedIdx
            };
            const pre = document.createElement("pre");
            pre.id = "debug-out";
            pre.textContent = JSON.stringify(out, null, 1);
            document.body.appendChild(pre);
        }, delay);
    }

    const wantDemo = hash.indexOf("demo") >= 0 || !!q.get("demo");
    if (wantDemo) {
        autoPlay = !!(q.get("autoplay") || hash.indexOf("autoplay") >= 0);
        mode = "ai"; isHost = true; mySide = 0;
        enterRoll();
        setTimeout(() => {
            if (rollMonsters.length && q.get("prep") !== "1") {
                rollPickedIdx = 0;
                picks = [rollMonsters[0].id];
                const others = MONSTER_ROSTER.filter(m => m.id !== picks[0]).slice(0, 2);
                others.forEach(m => picks.push(m.id));
                enterPrep();
                if (q.get("prep") !== "1") {
                    setTimeout(() => confirmTeam(), 500);
                }
            }
        }, 300);
    }
}

function boot() {
    bindLobby(); bindRoll(); bindPrep(); bindBattle();
    window.__onSpritesReady = () => {
        if (currentScreen === "lobby") renderLobbyFan();
        if (currentScreen === "roll") renderRoll(false);
        if (currentScreen === "prep") renderPrep();
        if (currentScreen === "battle" && M) {
            renderSprites();
            renderHud(0); renderHud(1);
        }
    };
    if (typeof initAssets === "function") {
        initAssets(MONSTER_INDEX);
    }
    renderTrainerCard();
    renderLobbyFan();
    renderFriends("");
    setStatus("Đang tải thẻ...");
    applyDebugHooks();
    setTimeout(() => {
        assetsReady = true;
        setStatus("Xin chào " + (profile.name || "huấn luyện viên") + "! Mã đăng ký: " + profile.code);
    }, 1500);
}
if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
}