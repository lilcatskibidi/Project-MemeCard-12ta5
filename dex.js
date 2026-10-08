// dex.js
// ============================================================
//  DEX SYSTEM — Bộ sưu tập quái của player
//  Lưu localStorage, quản lý level/exp/moves, save/load
// ============================================================
const DEX_KEY = "ta5bachquai_dex_v1";
const DEX_VERSION = 1;

// Cấu hình EXP
const EXP_CONFIG = {
    BASE_EXP: 50,          // exp cơ bản khi thắng
    LEVEL_MULT: 1.5,       // exp cần cho level tiếp = 100 * level^1.5
    MAX_LEVEL: 50,
    // Stats tăng mỗi level (% của base)
    HP_GROWTH: 0.08,
    ATK_GROWTH: 0.05,
    DEF_GROWTH: 0.04,
    SPD_PER_5LV: 1
};

// Starter mặc định (3 quái hệ khác nhau)
const STARTER_IDS = ["hac_hoi_phong", "hoa_dim_long", "huyen_quy"];

// ============================================================
//  DEX OBJECT
// ============================================================
let DEX = null;

function createEmptyDex() {
    return {
        version: DEX_VERSION,
        monsters: {},        // { id: { level, exp, moves, wins, losses, capturedAt, stars } }
        team: [null, null, null],   // team hiện tại (3 slot)
        currency: { coins: 500, gems: 3 },
        stats: {
            totalBattles: 0,
            totalWins: 0,
            totalLosses: 0,
            totalCaptures: 0,
            created: Date.now()
        }
    };
}

function loadDex() {
    try {
        const raw = localStorage.getItem(DEX_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || d.version !== DEX_VERSION) return null;
        return d;
    } catch (e) {
        console.warn("[dex] load failed:", e);
        return null;
    }
}

function saveDex() {
    if (!DEX) return;
    try {
        localStorage.setItem(DEX_KEY, JSON.stringify(DEX));
    } catch (e) {
        console.warn("[dex] save failed:", e);
    }
}

// ============================================================
//  KHỞI TẠO DEX LẦN ĐẦU — TẶNG STARTER
// ============================================================
function initDex() {
    let d = loadDex();
    if (!d) {
        d = createEmptyDex();
        // Tặng 3 starter
        STARTER_IDS.forEach(id => {
            if (MONSTER_INDEX[id]) {
                d.monsters[id] = createDexEntry(id, 5);
                d.stats.totalCaptures++;
            }
        });
        // Set team mặc định = 3 starter
        d.team = STARTER_IDS.slice(0, 3);
        console.log("[dex] Khởi tạo Dex mới với 3 starter:", STARTER_IDS);
    }
    DEX = d;
    saveDex();
    return DEX;
}

function createDexEntry(id, level) {
    const m = MONSTER_INDEX[id];
    if (!m) return null;
    level = Math.max(1, Math.min(EXP_CONFIG.MAX_LEVEL, level || 1));
    return {
        id,
        level,
        exp: 0,
        expToNext: expForLevel(level + 1),
        capturedAt: Date.now(),
        wins: 0,
        losses: 0,
        stars: 0,           // sao nâng cấp (sau này)
        unlockedMoves: getUnlockedMoveIndices(id, level)
    };
}

// ============================================================
//  EXP / LEVEL
// ============================================================
function expForLevel(level) {
    // exp cần để đạt level này = 100 * level^1.5
    return Math.floor(100 * Math.pow(level, EXP_CONFIG.LEVEL_MULT));
}

function expForBattle(attackerLevel, defenderLevel, isBoss) {
    const diff = Math.max(-5, Math.min(10, defenderLevel - attackerLevel));
    let base = EXP_CONFIG.BASE_EXP * (1 + diff * 0.15);
    if (isBoss) base *= 3;
    return Math.floor(base);
}

function addExp(id, amount) {
    if (!DEX || !DEX.monsters[id]) return { leveled: false, levels: 0 };
    const e = DEX.monsters[id];
    if (e.level >= EXP_CONFIG.MAX_LEVEL) return { leveled: false, levels: 0 };

    e.exp += amount;
    let levels = 0;
    while (e.exp >= e.expToNext && e.level < EXP_CONFIG.MAX_LEVEL) {
        e.exp -= e.expToNext;
        e.level++;
        levels++;
        e.expToNext = expForLevel(e.level + 1);
        // Mở khóa chiêu mới theo level
        e.unlockedMoves = getUnlockedMoveIndices(id, e.level);
    }
    saveDex();
    return { leveled: levels > 0, levels };
}

function getUnlockedMoveIndices(id, level) {
    const m = MONSTER_INDEX[id];
    if (!m) return [];
    // Chiêu unlock theo level: chiêu 0 = lv1, chiêu 1 = lv5, chiêu 2 = lv10
    const thresholds = [1, 5, 10, 15, 20, 25, 30];
    const moves = m.moves || [];
    const unlocked = [];
    moves.forEach((mv, i) => {
        // Passive luôn unlock
        if (mv.kind === "passive") { unlocked.push(i); return; }
        if (level >= (thresholds[i] || (i + 1) * 5)) unlocked.push(i);
    });
    return unlocked;
}

// ============================================================
//  STATS CALCULATION (level scale)
// ============================================================
function getDexStats(id) {
    const e = DEX && DEX.monsters[id];
    const base = MONSTER_INDEX[id];
    if (!base) return null;
    const lv = e ? e.level : 1;
    const lvBonus = lv - 1;

    const hp = Math.floor(base.hp * (1 + EXP_CONFIG.HP_GROWTH * lvBonus));
    const spd = (base.spd || 5) + Math.floor(lvBonus / 5) * EXP_CONFIG.SPD_PER_5LV;

    return {
        hp,
        maxHp: hp,
        spd,
        level: lv,
        exp: e ? e.exp : 0,
        expToNext: e ? e.expToNext : expForLevel(2)
    };
}

function getDexMonsterFull(id) {
    const base = MONSTER_INDEX[id];
    const entry = DEX && DEX.monsters[id];
    if (!base || !entry) return null;

    const stats = getDexStats(id);
    const unlocked = entry.unlockedMoves || getUnlockedMoveIndices(id, entry.level);

    // Chỉ lấy moves đã unlock
    // Dùng loadout nếu có, không thì 3 chiêu đầu
let activeMoves;
if (entry.loadout && entry.loadout.length) {
    activeMoves = entry.loadout
        .filter(i => unlocked.includes(i))
        .map(i => base.moves[i])
        .filter(Boolean);
} else {
    activeMoves = base.moves.filter((mv, i) => unlocked.includes(i)).slice(0, 3);
}

    return {
        ...base,
        level: entry.level,
        exp: entry.exp,
        expToNext: entry.expToNext,
        hp: stats.hp,
        maxHp: stats.maxHp,
        spd: stats.spd,
        moves: activeMoves,
        unlockedMoves: unlocked
    };
}

// ============================================================
//  TEAM MANAGEMENT
// ============================================================
function setTeam(ids) {
    if (!DEX) return false;
    const valid = ids.filter(id => id && DEX.monsters[id]).slice(0, BALANCE.TEAM_SIZE);
    while (valid.length < BALANCE.TEAM_SIZE) valid.push(null);
    DEX.team = valid;
    saveDex();
    return true;
}

function getTeam() {
    if (!DEX) return [null, null, null];
    return DEX.team.slice();
}

function hasMonster(id) {
    return !!(DEX && DEX.monsters[id]);
}

function getOwnedIds() {
    if (!DEX) return [];
    return Object.keys(DEX.monsters);
}

// ============================================================
//  CAPTURE (dùng cho giai đoạn 2, giờ để sẵn)
// ============================================================
function captureMonster(id, level) {
    if (!DEX) return false;
    if (DEX.monsters[id]) {
        // Đã có → +exp
        addExp(id, 30);
        return false;
    }
    DEX.monsters[id] = createDexEntry(id, level || 5);
    DEX.stats.totalCaptures++;
    saveDex();
    return true;
}

// ============================================================
//  STATS TRACKING
// ============================================================
function recordBattle(win, myTeamIds) {
    if (!DEX) return;
    DEX.stats.totalBattles++;
    if (win) DEX.stats.totalWins++;
    else DEX.stats.totalLosses++;

    // +exp cho từng quái trong team
    if (myTeamIds) {
        myTeamIds.forEach(id => {
            if (id && DEX.monsters[id]) {
                if (win) DEX.monsters[id].wins++;
                else DEX.monsters[id].losses++;
            }
        });
    }
    saveDex();
}

// ============================================================
//  UTILS
// ============================================================
function resetDex() {
    localStorage.removeItem(DEX_KEY);
    DEX = null;
    initDex();
}

function exportDex() {
    return JSON.stringify(DEX, null, 2);
}

function importDex(json) {
    try {
        const d = JSON.parse(json);
        if (!d || d.version !== DEX_VERSION) return false;
        DEX = d;
        saveDex();
        return true;
    } catch (e) { return false; }
}
// ============================================================
//  GIAI ĐOẠN 3: EVOLUTION + SKILL LOADOUT
// ============================================================

// Bảng evolution — quái nào tiến hóa thành gì ở level nào
const EVOLUTION_CHAIN = {
    "hac_hoi_phong": { to: "kho_lau_cot_de", level: 20, statBonus: { hp: 1.3, spd: 1.2 } },
    "tuat_khoai_tay": { to: "thiet_giap_nguu", level: 20, statBonus: { hp: 1.4, spd: 1.0 } },
    "hoa_dim_long": { to: "lieu_diem_dieu", level: 20, statBonus: { hp: 1.2, spd: 1.3 } },
    "huyen_quy": { to: "bich_hai_kinh", level: 20, statBonus: { hp: 1.4, spd: 1.0 } },
    "thanh_moc_vien": { to: "doc_dinh_xa", level: 18, statBonus: { hp: 1.2, spd: 1.2 } }
};

function canEvolve(id) {
    if (!DEX || !DEX.monsters[id]) return null;
    const evo = EVOLUTION_CHAIN[id];
    if (!evo) return null;
    const entry = DEX.monsters[id];
    if (entry.level < evo.level) return null;
    if (DEX.monsters[evo.to]) return { ...evo, alreadyOwned: true };
    return evo;
}

function evolveMonster(id) {
    if (!DEX || !DEX.monsters[id]) return null;
    const evo = EVOLUTION_CHAIN[id];
    if (!evo) return null;
    const entry = DEX.monsters[id];
    if (entry.level < evo.level) return null;

    // Tạo entry mới cho form tiến hóa
    const newEntry = createDexEntry(evo.to, entry.level);
    newEntry.exp = entry.exp;
    newEntry.wins = entry.wins;
    newEntry.losses = entry.losses;
    newEntry.evolvedFrom = id;
    DEX.monsters[evo.to] = newEntry;

    // Xóa form cũ
    delete DEX.monsters[id];

    // Cập nhật team nếu có
    DEX.team = DEX.team.map(t => t === id ? evo.to : t);

    DEX.stats.totalCaptures++;
    saveDex();
    return { from: id, to: evo.to, level: entry.level };
}

// Skill loadout: chọn 3 chiêu từ pool
function setMoveLoadout(id, indices) {
    if (!DEX || !DEX.monsters[id]) return false;
    const base = MONSTER_INDEX[id];
    if (!base) return false;
    const entry = DEX.monsters[id];
    const unlocked = entry.unlockedMoves || getUnlockedMoveIndices(id, entry.level);
    const valid = indices.filter(i => unlocked.includes(i)).slice(0, 3);
    if (valid.length < 1) return false;
    entry.loadout = valid;
    saveDex();
    return true;
}

function getMoveLoadout(id) {
    const entry = DEX && DEX.monsters[id];
    const base = MONSTER_INDEX[id];
    if (!entry || !base) return [];
    const unlocked = entry.unlockedMoves || getUnlockedMoveIndices(id, entry.level);
    if (entry.loadout && entry.loadout.length) {
        return entry.loadout.filter(i => unlocked.includes(i)).map(i => base.moves[i]).filter(Boolean);
    }
    // Default: 3 chiêu đầu đã unlock
    return base.moves.filter((mv, i) => unlocked.includes(i)).slice(0, 3);
}