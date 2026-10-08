// world.js
// ============================================================
//  WORLD — Vùng đất, Wild Encounter, Capture
// ============================================================
const WORLD_ZONES = [
    {
        id: "dong_co_xanh",
        name: "Đồng Cỏ Xanh",
        icon: "🌿",
        desc: "Vùng đất yên bình, quái yếu, dễ bắt cho người mới.",
        minLevel: 1,
        maxLevel: 8,
        unlockLevel: 0,       // level player cần để mở
        bg: "linear-gradient(180deg, #7dd3fc 0%, #86efac 60%, #4ade80 100%)",
        wildPool: [
            { id: "thanh_moc_vien", weight: 30 },
            { id: "tuat_khoai_tay", weight: 25 },
            { id: "huyen_quy", weight: 20 },
            { id: "hoa_dim_long", weight: 15 },
            { id: "hac_hoi_phong", weight: 10 }
        ],
        reward: { coins: 50, exp: 30 },
        captureBaseRate: 0.5
    },
    {
        id: "nui_lua",
        name: "Núi Lửa",
        icon: "🔥",
        desc: "Nơi ở của rồng lửa và các quái hệ FIRE mạnh mẽ.",
        minLevel: 5,
        maxLevel: 15,
        unlockLevel: 5,
        bg: "linear-gradient(180deg, #fca5a5 0%, #f97316 50%, #7c2d12 100%)",
        wildPool: [
            { id: "hoa_dim_long", weight: 30 },
            { id: "lieu_diem_dieu", weight: 25 },
            { id: "thiet_giap_nguu", weight: 20 },
            { id: "long_the_luc_that", weight: 5 },
            { id: "tuat_khoai_tay", weight: 20 }
        ],
        reward: { coins: 120, exp: 80 },
        captureBaseRate: 0.35
    },
    {
        id: "rung_toi",
        name: "Rừng Tối",
        icon: "🌑",
        desc: "Vùng đất bị nguyền rủa — nơi vong linh và bóng tối ngự trị.",
        minLevel: 10,
        maxLevel: 25,
        unlockLevel: 10,
        bg: "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 50%, #0a0e24 100%)",
        wildPool: [
            { id: "kho_lau_cot_de", weight: 30 },
            { id: "vo_anh_bao", weight: 25 },
            { id: "hac_hoi_phong", weight: 25 },
            { id: "than_quang_su", weight: 15 },
            { id: "long_the_luc_that", weight: 5 }
        ],
        reward: { coins: 250, exp: 200 },
        captureBaseRate: 0.2
    }
];

// ============================================================
//  PLAYER PROGRESS — level player = level quái cao nhất
// ============================================================
function getPlayerLevel() {
    if (!DEX) return 1;
    const ids = getOwnedIds();
    if (!ids.length) return 1;
    return Math.max(...ids.map(id => DEX.monsters[id].level || 1));
}

function isZoneUnlocked(zoneId) {
    const zone = WORLD_ZONES.find(z => z.id === zoneId);
    if (!zone) return false;
    return getPlayerLevel() >= zone.unlockLevel;
}

// ============================================================
//  WILD ENCOUNTER
// ============================================================
function rollWildMonster(zoneId) {
    const zone = WORLD_ZONES.find(z => z.id === zoneId);
    if (!zone) return null;

    // Weighted random
    const total = zone.wildPool.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    let picked = zone.wildPool[0];
    for (const w of zone.wildPool) {
        r -= w.weight;
        if (r <= 0) { picked = w; break; }
    }

    // Random level trong khoảng
    const level = zone.minLevel + Math.floor(Math.random() * (zone.maxLevel - zone.minLevel + 1));

    // Build wild monster
    const base = MONSTER_INDEX[picked.id];
    if (!base) return null;

    // Tạo dex entry tạm cho wild (không lưu Dex)
    const wild = {
        ...base,
        level,
        exp: 0,
        expToNext: 0,
        hp: Math.floor(base.hp * (1 + 0.08 * (level - 1))),
        maxHp: Math.floor(base.hp * (1 + 0.08 * (level - 1))),
        spd: (base.spd || 5) + Math.floor((level - 1) / 5),
        moves: base.moves.filter(mv => {
            // Wild chỉ có 1-2 chiêu đầu
            const idx = base.moves.indexOf(mv);
            return idx < 2 && mv.kind !== "passive";
        }),
        isWild: true,
        zoneId
    };

    // Nếu quái có passive, giữ passive
    const passive = base.moves.find(mv => mv.kind === "passive");
    if (passive) wild.moves.push(passive);

    return wild;
}

// ============================================================
//  CAPTURE
// ============================================================
function calcCaptureRate(hpCurrent, hpMax, zoneBaseRate, hasBall) {
    const hpPct = hpCurrent / hpMax;
    // HP càng thấp → rate càng cao
    let rate = (1 - hpPct) * 0.7 + 0.3;
    rate *= zoneBaseRate * 2; // scale theo vùng
    if (hasBall) rate += 0.2;
    return Math.max(0.05, Math.min(0.95, rate));
}

function tryCapture(wildMonster, zoneId, hasBall) {
    const zone = WORLD_ZONES.find(z => z.id === zoneId);
    const baseRate = zone ? zone.captureBaseRate : 0.3;
    const rate = calcCaptureRate(wildMonster.hp, wildMonster.maxHp, baseRate, hasBall);
    return { success: Math.random() < rate, rate };
}

// ============================================================
//  BATTLE RESULT
// ============================================================
function handleWildWin(zoneId, wildMonster, wasCaptured) {
    const zone = WORLD_ZONES.find(z => z.id === zoneId);
    if (!zone || !DEX) return { exp: 0, coins: 0, captured: false };

    const rewards = { exp: 0, coins: 0, captured: false };

    // Reward coins + exp
    rewards.coins = zone.reward.coins;
    rewards.exp = zone.reward.exp;
    DEX.currency.coins += rewards.coins;

    // Nếu capture được
        if (wasCaptured) {
        const isNew = !DEX.monsters[wildMonster.id];
        if (isNew) {
            DEX.monsters[wildMonster.id] = createDexEntry(wildMonster.id, wildMonster.level);
            DEX.stats.totalCaptures++;
            rewards.captured = true;
            rewards.isNew = true;
            rewards.capturedId = wildMonster.id;   // ⭐ THÊM
        } else {
            addExp(wildMonster.id, 30);
            rewards.duplicate = true;
        }
    }

    // +exp cho quái trong team
    const team = getTeam().filter(x => x);
    const expPerMonster = Math.floor(rewards.exp / Math.max(1, team.length));
    const levelUps = [];
    team.forEach(id => {
        const r = addExp(id, expPerMonster);
        if (r.leveled) {
            levelUps.push({ id, levels: r.levels, newLevel: DEX.monsters[id].level });
        }
    });
    rewards.levelUps = levelUps;
    rewards.expPerMonster = expPerMonster;

    saveDex();
    return rewards;
}

// ============================================================
//  WORLD MAP RENDER DATA
// ============================================================
function getZoneEncounterCount(zoneId) {
    // Có thể dùng sau này để track số lần đã vào vùng
    return 0;
}