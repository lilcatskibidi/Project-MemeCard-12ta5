// config.js
const TYPES = {
    DARK_WIND: {
        name: "Bóng Tối / Gió", icon: "🌑",
        color: "#8b6cff", glow: "#c4b5fd", dark: "#2b1d63",
        grad: ["#4c2f9e", "#160f3d"],
        superAgainst: ["LIGHT", "GRASS"],
        resistAgainst: ["DARK_WIND"]
    },
    FIRE: {
        name: "Lửa", icon: "🔥",
        color: "#ff7a3d", glow: "#ffb54d", dark: "#7a2a0e",
        grad: ["#c2410c", "#3b0f04"],
        superAgainst: ["GRASS", "UNDEAD"],
        resistAgainst: ["WATER", "FIRE", "DRAGON"]
    },
    WATER: {
        name: "Nước", icon: "💧",
        color: "#4aa8ff", glow: "#8fd3ff", dark: "#0d3b66",
        grad: ["#1d6fd1", "#062246"],
        superAgainst: ["FIRE", "GROUND"],
        resistAgainst: ["WATER", "GRASS", "DRAGON"]
    },
    GRASS: {
        name: "Cỏ", icon: "🌿",
        color: "#5fd36a", glow: "#a3f0a8", dark: "#14501f",
        grad: ["#1f8a3b", "#052b11"],
        superAgainst: ["WATER", "GROUND"],
        resistAgainst: ["GRASS", "FIRE", "DRAGON"]
    },
    LIGHT: {
        name: "Ánh Sáng", icon: "✨",
        color: "#ffd75f", glow: "#fff0b3", dark: "#7a5a06",
        grad: ["#d9a407", "#4a3002"],
        superAgainst: ["DARK_WIND", "UNDEAD"],
        resistAgainst: ["LIGHT", "DRAGON"]
    },
    GROUND: {
        name: "Đất", icon: "🪨",
        color: "#a16207", glow: "#fbbf24", dark: "#3f2107",
        grad: ["#92620a", "#2a1503"],
        superAgainst: ["FIRE", "LIGHT"],
        resistAgainst: ["GROUND"]
    },
    // ============================================================
    //  HỆ MỚI: DRAGON (Rồng)
    // ============================================================
    DRAGON: {
        name: "Rồng", icon: "🐉",
        color: "#2f9e44", glow: "#a3f0a8", dark: "#0d4a1f",
        grad: ["#1f8a3b", "#052b11"],
        superAgainst: ["FIRE", "WATER", "GRASS"],
        resistAgainst: ["DRAGON", "GROUND"]
    },
    // ============================================================
    //  HỆ MỚI: UNDEAD (Vong Linh / Xương)
    // ============================================================
    UNDEAD: {
        name: "Vong Linh / Xương", icon: "💀",
        color: "#4c1d95", glow: "#c4b5fd", dark: "#1e1b4b",
        grad: ["#5b21b6", "#1e1b4b"],
        superAgainst: ["DARK_WIND", "GROUND"],
        resistAgainst: ["UNDEAD", "GRASS"]
    }
};

const TYPE_CHART_ORDER = ["FIRE", "WATER", "GRASS", "DARK_WIND", "LIGHT", "GROUND", "DRAGON", "UNDEAD"];

const BALANCE = {
    CRIT_CHANCE: 0.12,
    CRIT_MULT: 1.6,
    EXPOSE_MULT: 1.3,
    EXPOSE_TURNS: 1,
    SHIELD_TURNS: 2,
    DRAIN_RATIO: 0.5,
    TEAM_SIZE: 3,
    SWITCH_COST_TURNS: 0,
    STALL_DAMAGE: 12,
    SHIELD_MULT: 0.5
};

// ============================================================
//  ROLL SYSTEM
// ============================================================
const ROLL_CONFIG = {
    ROLL_COUNT: 6,
    PICK_COUNT: 1,
    RARITY_WEIGHT: { 1: 60, 2: 30, 3: 10 },
    PITY_THRESHOLD: 20,
    HOLO_RARITY_MIN: 2,
    ROLL_ANIM_DURATION: 1200
};

const STARTER_DECK = ["hac_hoi_phong", "hoa_dim_long", "tuat_khoai_tay"];