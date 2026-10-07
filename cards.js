// cards.js
const MOVE_KIND = { ATTACK: "attack", GUARD: "guard", STATUS: "status" };

function costIcons(type, n) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(type);
    return arr;
}

const MONSTER_ROSTER = [
    {
        id: "hac_hoi_phong",
        name: "Hắc Hợi Phong",
        subtitle: "Pokémon Heo Đen Hủy Diệt",
        type: "DARK_WIND",
        hp: 180, spd: 5, rarity: 2, dex: "001/180",
        flavor: "“Không cần đẹp trai, chỉ cần mập mạnh. Hắc Hợi Phong là hiện thân của sự cốt cán và bất khả chiến bại!”",
        art: { shape: "beast", body: "#3d3d4a", belly: "#5a5a68", accent: "#8b6cff", aura: "#8b6cff" },
        moves: [
            { name: "Hắc Mỡ Tướng Quân", kind: "attack", type: "DARK_WIND", dmg: 120, cost: 2, pp: 5, desc: "Dùng thân hình mỡ đen giáng mạnh xuống, tạo ra sóng xung kích, gây sát thương lớn lên tất cả đối thủ." },
            { name: "Mỡ Đen Đàn Hồi", kind: "guard", type: "DARK_WIND", shield: 90, cost: 2, pp: 8, desc: "Lớp mỡ béo rung lên như một tấm đệm, hấp thụ 50% sát thương nhận vào trong 2 lượt tiếp theo." },
            { name: "Mõm Đen Khẩu Chiến", kind: "attack", type: "DARK_WIND", dmg: 100, effect: "expose", cost: 3, pp: 3, desc: "Vươn mõm lè lưỡi xả vô mồm, khiến đối thủ bị khiêu khích, giảm 20% phòng thủ trong 1 lượt." }
        ]
    },
    {
        id: "tuat_khoai_tay",
        name: "Tuất Khoai Tây",
        subtitle: "Pokémon Thần Tuất",
        type: "GROUND",
        hp: 220, spd: 6, rarity: 1, dex: "017/220",
        flavor: "“Một Tuất Khoai Tây đừng mạnh, đẽ xoay về hình bạo vì pokimo nhanh về vương quốc.”",
        art: { shape: "beast", body: "#a16207", belly: "#d4a373", accent: "#fbbf24", aura: "#fbbf24" },
        resistFixed: 30,
        moves: [
            { name: "Khoai Tây Nghiền", kind: "attack", type: "GROUND", dmg: 110, cost: 3, pp: 4, drain: 40, desc: "Nện tảng khoai tây nghiền, đè bẹp kẻ địch và hồi phục 40 HP." },
            { name: "Tuất Ảnh Truy Hồn", kind: "attack", type: "GROUND", dmg: 70, cost: 2, pp: 6, effect: "stun", chance: 0.35, desc: "Cắn lén từ phía sau, 35% gây choáng 1 lượt." },
            { name: "Khoai Tây Lốc Xoáy", kind: "guard", type: "GROUND", shield: 70, cost: 2, pp: 6, reflect: 0.35, desc: "Triệu hồi lốc khoai tây: tạo khiên 70 và phản 35% sát thương nhận vào." }
        ]
    },
    {
        id: "hoa_dim_long",
        name: "Hỏa Diệm Long",
        subtitle: "Rồng Lửa Tấn Công",
        type: "FIRE",
        hp: 165, spd: 7, rarity: 2, dex: "014/180",
        flavor: "“Hơi thở của nó có thể nung chảy cả núi đá. Nóng, nhanh và không bao giờ lùi bước.”",
        art: { shape: "dragon", body: "#d94f2b", belly: "#f7c877", accent: "#ffb54d", wings: true, aura: "#ff7a3d" },
        moves: [
            { name: "Hỏa Long Hỏa Tuyến", kind: "attack", type: "FIRE", dmg: 110, cost: 2, pp: 5, desc: "Phun luồng lửa hình rồng, công phá trực diện." },
            { name: "Hỏa Tinh Thuẫn", kind: "guard", type: "FIRE", shield: 75, cost: 1, pp: 8, desc: "Lớp tro lửa kết thành khiên, chặn sát thương 2 lượt." },
            { name: "Thiêu Đốt Lửa", kind: "attack", type: "FIRE", dmg: 70, effect: "burn", dot: { dmg: 30, turns: 2 }, cost: 2, pp: 6, desc: "Đốt cháy mục tiêu: mất 30 HP mỗi lượt trong 2 lượt." }
        ]
    },
    {
        id: "huyen_quy",
        name: "Huyền Quy",
        subtitle: "Rùa Thủy Phòng Thủ",
        type: "WATER",
        hp: 220, spd: 3, rarity: 2, dex: "027/180",
        flavor: "“Mai của nó tồn tại hơn nghìn năm. Chịu đòn giỏi hơn bất kỳ ai trong đội.”",
        art: { shape: "turtle", body: "#2f7ec2", belly: "#bfe6ff", accent: "#1b5c96", aura: "#4aa8ff" },
        moves: [
            { name: "Huyền Thủy Pháo", kind: "attack", type: "WATER", dmg: 115, cost: 3, pp: 5, desc: "Bắn cột nước nén áp, xuyên thủng phòng tuyến." },
            { name: "Huyền Quy Giáp", kind: "guard", type: "WATER", shield: 110, cost: 2, pp: 8, desc: "Thu mình vào mai, khiên bền nhất trong tất cả." },
            { name: "Trùy Xuyên Thủy", kind: "attack", type: "WATER", dmg: 85, effect: "expose", cost: 2, pp: 5, desc: "Mũi nước nhọn gây lỗ hổng, mục tiêu nhận thêm 30% sát thương." }
        ]
    },
    {
        id: "than_quang_su",
        name: "Thần Quang Sư",
        subtitle: "Sư Tử Ánh Sáng",
        type: "LIGHT",
        hp: 175, spd: 6, rarity: 3, dex: "042/180",
        flavor: "“Ánh sáng của nó xua tan bóng tối, và hồi phục những vết thương.”",
        art: { shape: "lion", body: "#f2c14e", belly: "#fff3cf", accent: "#ffd75f", aura: "#ffd75f" },
        moves: [
            { name: "Quang Minh Chùy Kích", kind: "attack", type: "LIGHT", dmg: 105, cost: 2, pp: 5, desc: "Cú chùy ánh sáng giáng xuống, khắc chế bóng tối." },
            { name: "Thánh Quang Hộ Thể", kind: "guard", type: "LIGHT", shield: 85, cost: 2, pp: 7, desc: "Vầng sáng bao quanh cơ thể, chặn sát thương 2 lượt." },
            { name: "Tái Sinh Chi Quang", kind: "status", type: "LIGHT", heal: 75, cost: 2, pp: 4, desc: "Hồi phục 75 HP. Không gây sát thương — dùng để hồi máu rồi đổi bài." }
        ]
    },
    {
        id: "doc_dinh_xa",
        name: "Độc Đỉnh Xà",
        subtitle: "Rắn Hổ Mang Độc",
        type: "GRASS",
        hp: 170, spd: 8, rarity: 2, dex: "058/180",
        flavor: "“Chỉ một nhát cắn cũng đủ khiến đối thủ rụng rời. Độc ngấm theo từng lượt.”",
        art: { shape: "serpent", body: "#3fa85a", belly: "#d9f5b8", accent: "#1f7a3b", aura: "#5fd36a" },
        moves: [
            { name: "Độc Đỉnh Phần Kích", kind: "attack", type: "GRASS", dmg: 95, effect: "poison", dot: { dmg: 28, turns: 3 }, cost: 2, pp: 6, desc: "Cắn xả độc: mục tiêu mất 28 HP mỗi lượt trong 3 lượt." },
            { name: "Xà Giáp Hộ Tâm", kind: "guard", type: "GRASS", shield: 80, cost: 2, pp: 8, desc: "Vảy cứng cuộn quanh người, chặn sát thương 2 lượt." },
            { name: "Si Mệnh Ngoạm", kind: "attack", type: "GRASS", dmg: 135, cost: 3, pp: 3, desc: "Ngoạm toàn lực — sát thương cực lớn nhưng tốn nhiều lượt dùng." }
        ]
    },
    {
        id: "vo_anh_bao",
        name: "Vô Ảnh Báo",
        subtitle: "Báo Mèo Ẩn Ảnh",
        type: "DARK_WIND",
        hp: 155, spd: 10, rarity: 3, dex: "073/180",
        flavor: "“Nhanh đến mức đối thủ chỉ thấy một bóng mờ trước khi gục ngã.”",
        art: { shape: "panther", body: "#4a3b6b", belly: "#b9a6e8", accent: "#8b6cff", aura: "#a78bfa" },
        moves: [
            { name: "Ảnh Trảm", kind: "attack", type: "DARK_WIND", dmg: 100, cost: 2, pp: 6, desc: "Vung vuốt ánh sáng mờ, chém nhanh liên hoàn." },
            { name: "Ảnh Hộ Thể", kind: "guard", type: "DARK_WIND", shield: 60, cost: 1, pp: 8, desc: "Phân thân thành bóng tối, hấp thụ sát thương 2 lượt." },
            { name: "Ám Sát Vô Thanh", kind: "attack", type: "DARK_WIND", dmg: 145, critBonus: 0.3, cost: 3, pp: 2, desc: "Đòn ám sát chí mạng: tỉ lệ bạo kích +30%, nhưng chỉ dùng 2 lần." }
        ]
    },
    {
        id: "thiet_giap_nguu",
        name: "Thiết Giáp Ngưu",
        subtitle: "Trâu Đất Phòng Ngự",
        type: "GROUND",
        hp: 240, spd: 2, rarity: 1, dex: "081/180",
        flavor: "“Lớp giáp đất dày khiến mọi đòn đánh đều như gãi ngứa. Chậm mà chắc.”",
        art: { shape: "beast", body: "#7a5a36", belly: "#d4a373", accent: "#fbbf24", aura: "#fbbf24" },
        moves: [
            { name: "Địa Chấn Húc", kind: "attack", type: "GROUND", dmg: 95, cost: 2, pp: 6, desc: "Húc mạnh gây chấn động mặt đất." },
            { name: "Thiết Giáp Thuẫn", kind: "guard", type: "GROUND", shield: 120, cost: 2, pp: 7, desc: "Dựng giáp đất dày, khiên cực lớn." },
            { name: "Đại Địa Hồi Phục", kind: "status", type: "GROUND", heal: 60, cost: 2, pp: 4, desc: "Hấp thụ linh khí đất, hồi 60 HP." }
        ]
    },
    {
        id: "lieu_diem_dieu",
        name: "Liễu Diệm Điểu",
        subtitle: "Chim Lửa Tốc Độ",
        type: "FIRE",
        hp: 150, spd: 9, rarity: 2, dex: "092/180",
        flavor: "“Đôi cánh lửa lướt qua bầu trời, để lại vệt cháy rực rỡ.”",
        art: { shape: "dragon", body: "#e86a2b", belly: "#ffd6a3", accent: "#ffb54d", wings: true, aura: "#ff7a3d" },
        moves: [
            { name: "Hỏa Vũ Tiễn", kind: "attack", type: "FIRE", dmg: 90, cost: 2, pp: 6, multiHit: 2, desc: "Bắn 2 luồng lửa liên tiếp." },
            { name: "Hỏa Dực Hộ Thân", kind: "guard", type: "FIRE", shield: 65, cost: 1, pp: 8, desc: "Xòe cánh lửa tạo khiên nhanh." },
            { name: "Bạo Viêm Kích", kind: "attack", type: "FIRE", dmg: 130, cost: 3, pp: 3, desc: "Tụ lửa nổ tung — sát thương lớn." }
        ]
    },
    {
        id: "bich_hai_kinh",
        name: "Bích Hải Kình",
        subtitle: "Cá Voi Biển Sâu",
        type: "WATER",
        hp: 250, spd: 2, rarity: 3, dex: "105/180",
        flavor: "“Sóng thần chỉ là cái vẫy đuôi của nó. Bể chứa HP di động.”",
        art: { shape: "turtle", body: "#1d5f8a", belly: "#bfe3ff", accent: "#8fd3ff", aura: "#4aa8ff" },
        moves: [
            { name: "Hải Triều Cuồng Nộ", kind: "attack", type: "WATER", dmg: 120, cost: 3, pp: 4, desc: "Triệu hồi sóng thần nghiền nát đối thủ." },
            { name: "Thâm Hải Giáp", kind: "guard", type: "WATER", shield: 100, cost: 2, pp: 7, desc: "Lớp nước sâu hấp thụ sát thương." },
            { name: "Thủy Liệu Thuật", kind: "status", type: "WATER", heal: 80, cost: 2, pp: 4, desc: "Dòng nước chữa lành, hồi 80 HP." }
        ]
    },
    {
        id: "kim_quang_ho",
        name: "Kim Quang Hổ",
        subtitle: "Hổ Ánh Sáng",
        type: "LIGHT",
        hp: 175, spd: 7, rarity: 2, dex: "118/180",
        flavor: "“Mỗi bước chân đều tỏa hào quang. Công thủ toàn diện.”",
        art: { shape: "beast", body: "#d9a407", belly: "#fff0b3", accent: "#ffd75f", aura: "#ffd75f" },
        moves: [
            { name: "Quang Trảo Liên Kích", kind: "attack", type: "LIGHT", dmg: 85, cost: 2, pp: 6, multiHit: 2, desc: "Cào 2 nhát sáng chói liên tiếp." },
            { name: "Kim Quang Thuẫn", kind: "guard", type: "LIGHT", shield: 90, cost: 2, pp: 7, desc: "Hào quang vàng tạo khiên vững chắc." },
            { name: "Thánh Quang Trị Liệu", kind: "status", type: "LIGHT", heal: 65, cost: 2, pp: 4, desc: "Hồi 65 HP bằng ánh sáng thánh." }
        ]
    },
	    // ============================================================
    //  LONG THỂ LỰC THẤT — Pokémon Long Thần (DRAGON / FIRE)
    // ============================================================
    {
        id: "long_the_luc_that",
        name: "Long Thể Lực Thất",
        subtitle: "Pokémon Long Thần",
        type: "DRAGON",
        hp: 220, spd: 6, rarity: 3, dex: "017/220",
        flavor: "“Một long nhân dũng mãnh bảo vệ vương quốc.”",
        art: { shape: "dragon", body: "#2f9e44", belly: "#a3f0a8", accent: "#fbbf24", wings: true, aura: "#5fd36a" },
        moves: [
            {
                name: "Long Chiến",
                kind: "attack",
                type: "DRAGON",
                dmg: 210,
                cost: 3,
                pp: 4,
                effect: "expose",
                desc: "Gây sát thương lớn cho kẻ địch và tăng 30% sát thương cho chiêu sau."
            },
            {
                name: "Long Nhân Hợp Nhất",
                kind: "guard",
                type: "GRASS",
                shield: 150,
                cost: 2,
                pp: 6,
                heal: 50,
                desc: "Tạo ra lá chắn bất tử vảy rồng và hồi phục 50 HP."
            },
            {
                name: "Vảy Rồng Bất Hoại",
                kind: "guard",
                type: "DRAGON",
                shield: 0,
                cost: 1,
                pp: 5,
                passive: true,
                desc: "Mỗi khi bị tấn công, giảm 50% sát thương và tăng 1 năng lượng trong lượt sau."
            }
        ]
    },
    // ============================================================
    //  KHÔ LÂU CỐT ĐẾ — Vạn Cốt Thị Quân (UNDEAD)
    // ============================================================
    {
        id: "kho_lau_cot_de",
        name: "Khô Lâu Cốt Đế",
        subtitle: "Vạn Cốt Thị Quân",
        type: "UNDEAD",
        hp: 180, spd: 5, rarity: 2, dex: "002/180",
        flavor: "“Không cần đẹp trai, chỉ cần mạnh. Khô Lâu Cốt Đế là hiện thân của sự thù hận và sức mạnh vĩnh hằng!”",
        art: { shape: "beast", body: "#4c1d95", belly: "#a78bfa", accent: "#c4b5fd", aura: "#8b5cf6" },
        moves: [
            {
                name: "Gặm Xương",
                kind: "attack",
                type: "UNDEAD",
                dmg: 120,
                cost: 2,
                pp: 5,
                drain: 40,
                desc: "Sử dụng hàm răng xương bén nhọn nghiền nát xương đối thủ, hồi phục HP cho bản thân."
            },
            {
                name: "Bước Nhảy KingKong",
                kind: "guard",
                type: "UNDEAD",
                shield: 90,
                cost: 2,
                pp: 6,
                effect: "stun",
                chance: 0.4,
                desc: "Nhảy lên cao và giảm mạnh xuống, tạo ra sóng chấn động. Đối thủ bị tê liệt."
            },
            {
                name: "Xương Sườn Nhạy Cảm",
                kind: "guard",
                type: "UNDEAD",
                shield: 0,
                cost: 1,
                pp: 5,
                passive: true,
                desc: "Mỗi lần bị tấn công, 'Khô Lâu Cốt Đế' nhận thêm 10 sát thương, nhưng được tăng 1 năng lượng trong lượt sau."
            }
        ]
    },
    {
        id: "thanh_moc_vien",
        name: "Thanh Mộc Viên",
        subtitle: "Vượn Cỏ Linh Hoạt",
        type: "GRASS",
        hp: 165, spd: 8, rarity: 1, dex: "124/180",
        flavor: "“Nhảy nhót trong rừng sâu, roi mây quất đâu trúng đó.”",
        art: { shape: "serpent", body: "#2f9e44", belly: "#d9f5b8", accent: "#5fd36a", aura: "#5fd36a" },
        moves: [
            { name: "Đằng Tiên Quất", kind: "attack", type: "GRASS", dmg: 85, cost: 2, pp: 6, desc: "Roi mây quất mạnh liên hồi." },
            { name: "Mộc Giáp", kind: "guard", type: "GRASS", shield: 70, cost: 1, pp: 8, desc: "Vỏ cây cứng tạo khiên nhanh." },
            { name: "Quang Hợp", kind: "status", type: "GRASS", heal: 70, cost: 2, pp: 4, desc: "Hấp thụ nắng, hồi 70 HP." }
        ]
    }
];

function findMonster(id) {
    return MONSTER_ROSTER.find(m => m.id === id);
}

const MONSTER_INDEX = {};
MONSTER_ROSTER.forEach(m => { MONSTER_INDEX[m.id] = m; });

function makeFighter(id) {
    const t = findMonster(id);
    if (!t) return null;
    return {
        id: t.id, name: t.name, subtitle: t.subtitle, type: t.type,
        hp: t.hp, maxHp: t.hp, spd: t.spd, rarity: t.rarity,
        art: t.art, flavor: t.flavor, dex: t.dex,
        resistFixed: t.resistFixed || 0,
        moves: t.moves.map(m => ({ ...m, currentPp: m.pp })),
        shield: 0, shieldTurns: 0,
        exposeTurns: 0,
        stunTurns: 0, freezeTurns: 0, paralyzeTurns: 0, confuseTurns: 0,
        buffAtk: 0, buffAtkTurns: 0,
        buffDef: 0, buffDefTurns: 0,
        debuffAtk: 0, debuffAtkTurns: 0,
        debuffDef: 0, debuffDefTurns: 0,
        reflect: 0,
        dot: null,
        fainted: false
    };
}

function typeMultiplier(moveType, defType) {
    const T = TYPES[moveType];
    if (!T) return 1;
    if (T.superAgainst.includes(defType)) return 1.5;
    if (T.resistAgainst.includes(defType)) return 0.5;
    return 1;
}

function weaknessOf(typeKey) {
    return Object.keys(TYPES).filter(t => TYPES[t].superAgainst.includes(typeKey));
}
function resistanceOf(typeKey) {
    return Object.keys(TYPES).filter(t => TYPES[t].resistAgainst.includes(typeKey));
}

// ============================================================
//  RARITY + ROLL SYSTEM
// ============================================================
function getMonsterByRarity(rarity) {
    return MONSTER_ROSTER.filter(m => (m.rarity || 1) === rarity);
}

function getRandomMonsterByRarity(rarity) {
    const pool = getMonsterByRarity(rarity);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

let _pityCounter = 0;
function getPityCounter() { return _pityCounter; }   // ← ĐÃ THÊM

function rollOneMonster(forceRarity) {
    const weights = ROLL_CONFIG.RARITY_WEIGHT;
    let rarity = forceRarity;
    let pityHit = false;

    if (!rarity) {
        _pityCounter++;
        if (_pityCounter >= ROLL_CONFIG.PITY_THRESHOLD) {
            rarity = 3;
            pityHit = true;
        }
    }

    if (!rarity) {
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (const [rKey, w] of Object.entries(weights)) {
            r -= w;
            if (r <= 0) { rarity = parseInt(rKey); break; }
        }
        if (!rarity) rarity = 1;
    }

    let pool = getMonsterByRarity(rarity);
    if (!pool.length) {
        pool = MONSTER_ROSTER.slice();
        pityHit = false;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];
    if (pityHit || (picked && (picked.rarity || 1) === 3)) _pityCounter = 0;
    return picked;
}

function rollMonsterPool(count, excludeIds) {
    count = count || ROLL_CONFIG.ROLL_COUNT;
    const exclude = new Set(excludeIds || []);
    const rolled = [];
    const usedIds = new Set();
    const maxTries = count * 30;
    let tries = 0;

    while (rolled.length < count && tries < maxTries) {
        tries++;
        const m = rollOneMonster();
        if (!m || exclude.has(m.id) || usedIds.has(m.id)) continue;
        rolled.push(m);
        usedIds.add(m.id);
    }

    if (rolled.length < count) {
        const rest = MONSTER_ROSTER.filter(m => !exclude.has(m.id) && !usedIds.has(m.id));
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
        }
        while (rolled.length < count && rest.length) {
            const m = rest.pop();
            rolled.push(m);
            usedIds.add(m.id);
        }
    }

    while (rolled.length < count) {
        rolled.push(MONSTER_ROSTER[Math.floor(Math.random() * MONSTER_ROSTER.length)]);
    }

    return rolled;
}