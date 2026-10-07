// render.js
// ============================================================
//  HIỂN THỊ — dùng cropSpriteStyle/applyCrop/getSprite từ assets.js
// ============================================================
const Render = (() => {

    const spriteOfId = (id) => {
        if (typeof getSprite === "function") return getSprite(id, MONSTER_INDEX);
        return "";
    };
    const rarityStars = n => "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function $(id) { return document.getElementById(id); }
    function setText(id, v) { const e = $(id); if (e) e.textContent = v; }

    // ============================================================
    //  STYLE — CHỈ trả về background-image, KHÔNG set element
    // ============================================================
    function cropStyle(id, view, side, kind) {
        kind = kind || "sprite";

        if (kind === "card") {
            const cardUrl = (typeof getCardImage === "function") ? getCardImage(id) : "";
            if (cardUrl) {
                return `background-image:${cssUrl(cardUrl)};` +
                       `background-repeat:no-repeat;` +
                       `background-size:cover;` +
                       `background-position:center;`;
            }
            const spUrl = spriteOfId(id);
            if (spUrl) {
                return `background-image:${cssUrl(spUrl)};` +
                       `background-repeat:no-repeat;` +
                       `background-size:contain;` +
                       `background-position:center;`;
            }
            return "";
        }

        if (typeof cropSpriteStyle === "function") {
            const s = cropSpriteStyle(id, view, side);
            if (s) return s;
        }

        const url = spriteOfId(id);
        if (!url) return "";
        const isSheet = (typeof isSheetSprite === "function") ? isSheetSprite(id) : false;
        const base = `background-image:${cssUrl(url)};background-repeat:no-repeat;`;
        if (!isSheet) return base + "background-size:contain;background-position:center;";
        let v = view;
        if (v === "auto") v = (side === "player") ? "back" : "front";
        const pos = (v === "back") ? "100% 50%" : "0% 50%";
        return base + `background-size:200% 100%;background-position:${pos};`;
    }

    // ============================================================
    //  CARD
    // ============================================================
function card(m, opts) {
    opts = opts || {};
    const T = TYPES[m.type] || { grad: ["#333", "#111"], icon: "?", name: "?" };

    // ⭐ NẾU CÓ ẢNH CARD → HIỂN THỊ CẢ THẺ BẰNG ẢNH
    const cardUrl = (typeof getCardImage === "function") ? getCardImage(m.id) : "";
    if (cardUrl) {
        return `
    <article class="pcard pcard-image ${opts.holo ? "holo" : ""} ${opts.selected ? "sel" : ""} ${opts.dim ? "dim" : ""} has-card"
    data-id="${m.id}" data-rarity="${m.rarity || 1}" style="--tc1:${T.grad[0]};--tc2:${T.grad[1]}">
        ${opts.order ? `<div class="order-badge">${opts.order}</div>` : ""}
        <img src="${cardUrl}" alt="${esc(m.name)}" class="pcard-fullimg">
    </article>`;
    }

    // ⭐ KHÔNG CÓ ẢNH CARD → RENDER HTML CARD NHƯ CŨ
    const weak = weaknessOf(m.type)[0];
    const res = resistanceOf(m.type)[0];
    const artStyle = cropStyle(m.id, "front", null, "card");
    const artClass = "part-sprite";

    const artBadge = `<div class="part-hp">SPD ${m.spd}</div>`;
    const idChip = `<span class="pid" title="ID nhân vật">ID ${esc(m.id)}</span>`;

    const moves = (m.moves || []).map(mv => {
        const cls = mv.kind === "guard" ? "guard" : mv.kind === "status" ? "status" : "";
        const cost = `<span class="pcost">${Array.from({ length: Math.max(1, mv.cost || 1) },
            () => `<i style="background:${(TYPES[mv.type] || T).color}"></i>`).join("")}</span>`;
        const val = mv.dmg ? `<span class="ad">${mv.dmg}</span>`
            : mv.shield ? `<span class="ad blue">🛡${mv.shield}</span>`
                : `<span class="ad green">+${mv.heal}</span>`;
        return `<div class="pattack ${cls}">${cost}<span class="an">${esc(mv.name)}</span>${val}
            <span class="pdesc">${esc(mv.desc)}</span></div>`;
    }).join("");

    const bonus = opts.matchup ? `<div class="matchup ${opts.matchup.cls}">${opts.matchup.text}</div>` : "";

    return `
<article class="pcard ${opts.holo ? "holo" : ""} ${opts.selected ? "sel" : ""} ${opts.dim ? "dim" : ""}"
data-id="${m.id}" data-rarity="${m.rarity || 1}" style="--tc1:${T.grad[0]};--tc2:${T.grad[1]}">
    ${opts.order ? `<div class="order-badge">${opts.order}</div>` : ""}
    <div class="pcard-inner">
        <div class="phead">
            <span class="pstage">BASIC</span>
            <span class="pname">${esc(m.name)}</span>
            <span class="php"><small>HP</small>${m.hp}</span>
            <span class="ptype-icon">${T.icon}</span>
        </div>
        <div class="psub">${esc(m.subtitle || "")} · ${T.name}</div>
        <div class="part">
            ${artBadge}
            <div class="${artClass}" style="${artStyle}"></div>
            ${bonus}
        </div>
        <div class="pattacks">${moves}</div>
        <div class="pfoot">
            <span>Yếu điểm <b>${weak ? TYPES[weak].icon + " ×2" : "—"}</b></span>
            <span>Kháng cự <b>${res ? TYPES[res].icon + " ×½" : "—"}</b></span>
            <span class="rarity">${rarityStars(m.rarity || 2)}</span>
        </div>
        <div class="pflavor">${esc(m.flavor || "")}</div>
        <div class="pcode"><span>◆ POKÉ DUEL &nbsp; ${esc(m.dex || "")}</span>${idChip}<span>${m.rarity ? "R" + m.rarity : ""}</span></div>
    </div>
</article>`;
}
    function thumbStyle(id) {
        const s = cropStyle(id, "front", null, "sprite");
        if (!s) return "background:linear-gradient(135deg,#2c3875,#141a3d);";
        return s;
    }

    function fan(el, ids) {
        if (!el) return;
        el.innerHTML = ids.map(id => {
            const m = MONSTER_INDEX[id];
            return m ? card(m, { holo: true }) : "";
        }).join("");
    }

    function roster(el, picks, onPick, query) {
        if (!el) return;
        const q = String(query || "").trim().toLowerCase();
        const list = MONSTER_ROSTER.filter(m => {
            if (!q) return true;
            return m.id.toLowerCase().indexOf(q) >= 0
                || (m.name || "").toLowerCase().indexOf(q) >= 0
                || (m.subtitle || "").toLowerCase().indexOf(q) >= 0
                || (m.dex || "").toLowerCase().indexOf(q) >= 0
                || (TYPES[m.type] && TYPES[m.type].name.toLowerCase().indexOf(q) >= 0);
        });
        if (!list.length) {
            el.innerHTML = `<div class="friend-empty" style="grid-column:1/-1;padding:28px">Không có nhân vật khớp "${esc(query)}".</div>`;
            return;
        }
        el.innerHTML = list.map(m => {
            const idx = picks.indexOf(m.id);
            let matchup = null;
            if (picks[0] && idx < 0) {
                const first = MONSTER_INDEX[picks[0]];
                const mu = typeMultiplier(m.type, first.type);
                if (m.type !== first.type && mu !== 1) matchup = mu > 1
                    ? { cls: "good", text: "🔒 " + TYPES[m.type].icon + " khắc " + TYPES[first.type].icon + " ×2" }
                    : { cls: "bad", text: "⚖️ " + TYPES[m.type].icon + " bị " + TYPES[first.type].icon + " khắc ×½" };
            }
            return card(m, { selected: idx >= 0, order: idx >= 0 ? idx + 1 : 0, holo: idx >= 0, matchup, dim: idx < 0 && picks.length >= 3 });
        }).join("");
        Array.from(el.children).forEach(elm => elm.addEventListener("click", () => onPick && onPick(elm.dataset.id)));
    }

    function teamSlots(el, picks, onRemove) {
        if (!el) return;
        const slots = [];
        for (let i = 0; i < BALANCE.TEAM_SIZE; i++) {
            const id = picks[i];
            if (!id) {
                slots.push(`<div class="tslot"><span class="pos">${i + 1}</span>
                    <span style="color:#5f6899;font-size:.8rem">— trống —</span></div>`);
            } else {
                const m = MONSTER_INDEX[id];
                const active = i === 0;
                slots.push(`<div class="tslot filled ${active ? "active-slot" : ""}">
                    <span class="pos">${i + 1}</span>
                    <span class="thumb" style="${thumbStyle(id)}"></span>
                    <span class="tinfo"><span class="tn">${esc(m.name)}</span>
                        <span class="thp">${TYPES[m.type].icon} HP ${m.hp} · SPD ${m.spd}${active ? " · <b style='color:#ffd75f'>ACTIVE</b>" : ""}</span></span>
                    <button class="rm" data-rm="${id}" title="Bỏ chọn">✕</button></div>`);
            }
        }
        el.innerHTML = slots.join("");
        Array.from(el.querySelectorAll("[data-rm]")).forEach(b =>
            b.addEventListener("click", e => { e.stopPropagation(); onRemove && onRemove(b.dataset.rm); }));
    }

    function typeChart(el) {
        if (!el) return;
        el.innerHTML = TYPE_CHART_ORDER.map(k => {
            const T = TYPES[k];
            const sup = T.superAgainst.map(s => TYPES[s].icon).join("");
            return `<span title="${T.name}">${T.icon} ➜ ${sup || "—"}</span>`;
        }).join(" ") +
            `<div style="margin-top:6px;color:#8a93c7;line-height:1.5">Hệ mạnh gây <b style="color:#ffd75f">150%</b>, hệ bị khắc chỉ gây <b style="color:#9aa3d0">50%</b>.</div>`;
    }

    function hud(pos, d) {
        const T = TYPES[d.typeKey] || { color: "#666", icon: "?" };
        setText("name-" + pos, d.monster);
        const tr = $("tr-" + pos);
        if (tr) tr.textContent = d.trainer || "";
        const te = $("type-" + pos);
        if (te) { te.textContent = T.icon + " " + T.name; te.style.background = T.color; }
        const hp = Math.max(0, d.hp), mx = Math.max(1, d.maxHp);
        const pct = (hp / mx) * 100;
        const fill = $("hpfill-" + pos);
        if (fill) { fill.style.width = pct + "%"; fill.style.background = hpColor(pct); }
        setText("hpnum-" + pos, hp + " / " + mx);
        setText("shield-" + pos, d.shield > 0 ? "🛡 " + d.shield : "");
        const chips = $("chips-" + pos);
        if (chips) chips.innerHTML = (d.chips || []).map(c => `<span class="chip ${c.cls || ""}">${c.text}</span>`).join("");
        const pips = $("pips-" + pos);
        if (pips) pips.innerHTML = (d.pips || []).map((down, i) =>
            `<span class="pip ${down ? "down" : ""}" title="Quái ${i + 1}"></span>`).join("");
        const adv = $("adv-" + pos);
        if (adv) { adv.textContent = d.advText || ""; adv.className = "adv " + (d.advCls || ""); }
        const root = $("hud-" + pos);
        if (root) root.classList.toggle("faint", hp <= 0);
    }

    function sprite(el, d, side) {
        if (!el) return;
        const id = d.id || "";
        const view = (side === "player") ? "back" : "front";

        if (id && typeof applyCrop === "function" && typeof getSprite === "function" && getSprite(id, null)) {
            applyCrop(el, id, view, side);
        } else {
            const url = d.url || (id && typeof getSprite === "function" ? getSprite(id, null) : "");
            if (!url || url === "none") {
                el.style.backgroundImage = "none";
                el.classList.remove("hidden");
                el.classList.toggle("fainted", !!d.fainted);
                return;
            }
            el.style.backgroundImage = cssUrl(url);
            el.style.backgroundRepeat = "no-repeat";
            const isSheet = id && (typeof isSheetSprite === "function") ? isSheetSprite(id) : false;
            if (!isSheet) {
                el.style.backgroundSize = "contain";
                el.style.backgroundPosition = "center";
            } else {
                el.style.backgroundSize = "200% 100%";
                el.style.backgroundPosition = (view === "back") ? "100% 50%" : "0% 50%";
            }
        }

        el.classList.remove("hidden");
        el.classList.toggle("fainted", !!d.fainted);
    }

    function hpColor(pct) {
        if (pct > 50) return "linear-gradient(180deg,#7dffb0,#28c76f)";
        if (pct > 20) return "linear-gradient(180deg,#ffe08a,#f7a928)";
        return "linear-gradient(180deg,#ff9aa8,#e11d48)";
    }

    function menu(el, spec) {
        if (!el) return;
        el.innerHTML = "";
        if (spec.kind === "locked") {
            const b = mkBtn({ cls: "", label: spec.text, sub: spec.sub || "Đang chờ..." });
            b.disabled = true; b.style.gridColumn = "1 / -1";
            el.appendChild(b);
            return;
        }
        if (spec.kind === "root") {
            el.appendChild(mkBtn({ cls: "fight", label: "⚔️ ĐẤU", sub: "Chọn kỹ năng", onClick: spec.onAct && (() => spec.onAct("fight")) }));
            el.appendChild(mkBtn({ cls: "switch", label: "🔁 ĐỔI BÀI", sub: "Tốn 1 lượt", onClick: spec.onAct && (() => spec.onAct("switch")) }));
            const b3 = mkBtn({ cls: "", label: "🛡 " + (spec.shield > 0 ? "Khiên " + spec.shield : "Chưa có khiên"), sub: "Trạng thái quái active" });
            b3.disabled = true;
            el.appendChild(b3);
            el.appendChild(mkBtn({ cls: "", label: "📖 NHẬT KÝ", sub: (spec.logCount || 0) + " dòng", onClick: spec.onAct && (() => spec.onAct("log")) }));
            return;
        }
        spec.moves.forEach(mv => {
            const b = document.createElement("button");
            const kindCls = mv.kind === "attack" ? " fight" : " guard";
            b.className = "act" + kindCls + (mv.noPp ? " disabled-move" : "");
            b.disabled = !!mv.noPp;
            const T = TYPES[mv.typeKey] || { color: "#888", icon: "?" };
            b.innerHTML = `<span class="big" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <i class="type-dot" style="background:${T.color}"></i>${esc(mv.name)}
                    ${mv.eff ? `<span class="eff-badge ${mv.eff.cls}">${mv.eff.text}</span>` : ""}</span>
                <span class="sub"><span>${mv.power} · ${T.icon}${T.name}</span>
                <span class="pp-badge">${mv.pp}</span></span>`;
            b.addEventListener("click", () => spec.onAct && spec.onAct("move", mv.i));
            b.addEventListener("mouseenter", () => spec.onHover && spec.onHover(mv.i));
            el.appendChild(b);
        });
        const back = mkBtn({ cls: "", label: "◀ QUAY LẠI", sub: "", onClick: spec.onAct && (() => spec.onAct("back")) });
        back.style.gridColumn = "1 / -1";
        el.appendChild(back);
    }
    function mkBtn({ cls, label, sub, onClick }) {
        const b = document.createElement("button");
        b.className = "act " + (cls || "");
        b.innerHTML = `<span class="big">${label}</span>${sub ? `<span class="sub">${sub}</span>` : ""}`;
        if (onClick) b.addEventListener("click", onClick);
        return b;
    }

    function switchRows(el, rows, onPick) {
        if (!el) return;
        el.innerHTML = rows.map(r => {
            const f = r.f, T = TYPES[f.type];
            return `<button class="sw-row" data-i="${r.index}" ${r.disabled ? "disabled" : ""}>
            <span class="thumb" style="${thumbStyle(f.id)}"></span>
            <span class="info">
                <span class="n">${esc(f.name)} ${T.icon} <span class="type-pill" style="background:${T.color}">${T.name}</span></span>
                <span class="m">${r.hp}/${f.maxHp} HP · SPD ${f.spd}${f.shield ? " · 🛡" + f.shield : ""}${r.matchup ? " · " + r.matchup : ""}</span>
                <span class="mini-hp"><i style="width:${Math.max(0, (r.hp / f.maxHp) * 100)}%"></i></span>
            </span>
            <span class="sw-tag ${r.active ? "on" : ""}">${r.disabled && !r.active ? "GỤC" : r.active ? "ĐANG RA SÂN" : "CHỌN"}</span>
        </button>`;
        }).join("");
        Array.from(el.children).forEach(b => b.addEventListener("click", () => {
            if (b.disabled) return;
            onPick && onPick(+b.dataset.i);
        }));
    }

    function trainerCard(el, profile) {
        if (!el) return;
        const named = !!(profile.name && profile.name.trim());
        el.innerHTML = `
        <div class="avatar">${profile.avatar || "🎒"}</div>
        <div class="tinfo">
            <input id="trainer-name" maxlength="16" placeholder="Tên Huấn Luyện Viên" value="${esc(profile.name)}">
            <div class="tid">MÃ ĐĂNG KÝ <b id="trainer-code">${esc(profile.code)}</b>
                <button type="button" id="btn-copy-code" title="Sao chép mã">📋</button>
                <button type="button" id="btn-regen" title="Tạo mã mới">↻</button>
                <span class="reg-badge">${named ? "ĐÃ ĐĂNG KÝ" : "CHƯA ĐẶT TÊN"}</span></div>
        </div>`;
    }

    // ============================================================
    //  ROLL SCREEN — sau khi render, FORCE update background-image
    //  để fix timing bug: ảnh load xong nhưng DOM đã render trước đó
    // ============================================================
    function rollStage(el, monsters, opts) {
        opts = opts || {};
        if (!el) return;
        el.innerHTML = "";
        monsters.forEach((m, i) => {
            const html = card(m, {
                holo: (m.rarity || 1) >= ROLL_CONFIG.HOLO_RARITY_MIN,
                selected: false
            });
            const wrap = document.createElement("div");
            wrap.innerHTML = html;
            const cardEl = wrap.firstElementChild;
            cardEl.setAttribute("data-rarity", m.rarity || 1);
            cardEl.setAttribute("data-id", m.id);
            if (opts.animate) {
                cardEl.style.animationDelay = (i * 0.08) + "s";
                cardEl.classList.add("rolling");
            }
            cardEl.addEventListener("click", () => {
                if (opts.onPick) opts.onPick(m, cardEl, i);
            });
            el.appendChild(cardEl);
        });

        // Force update background-image ngay sau render
        forceRefreshCardArt(el);
        // Và update lại sau 100ms, 500ms, 1500ms phòng ảnh load chậm
        [100, 500, 1500].forEach(t => setTimeout(() => forceRefreshCardArt(el), t));
    }

    // Force gán background-image cho mọi .part-sprite trong container
function forceRefreshCardArt(container) {
    if (!container) return;
    const cards = container.querySelectorAll(".pcard");
    cards.forEach(cardEl => {
        const id = cardEl.dataset.id;
        if (!id) return;
        
        const cardUrl = (typeof getCardImage === "function") ? getCardImage(id) : "";
        const isCurrentlyImage = cardEl.classList.contains("pcard-image");
        
        // Nếu có ảnh card + card hiện tại đang là HTML → re-render thành ảnh
        if (cardUrl && !isCurrentlyImage) {
            const m = MONSTER_INDEX[id];
            if (!m) return;
            
            // Giữ lại các class trạng thái
            const isSelected = cardEl.classList.contains("sel");
            const isDimmed = cardEl.classList.contains("dim");
            const isHolo = cardEl.classList.contains("holo");
            const orderBadge = cardEl.querySelector(".order-badge");
            const orderNum = orderBadge ? orderBadge.textContent : null;
            
            // Tạo card mới
            const wrap = document.createElement("div");
            wrap.innerHTML = card(m, {
                holo: isHolo,
                selected: isSelected,
                dim: isDimmed,
                order: orderNum
            });
            const newCard = wrap.firstElementChild;
            
            // Copy event listeners? Không được — thay hẳn element
            cardEl.replaceWith(newCard);
            
            // ⚠️ Phải rebind sự kiện click cho card mới (nếu là roll stage)
            if (container.id === "roll-stage") {
                newCard.addEventListener("click", () => {
                    const idx = rollMonsters.findIndex(x => x.id === id);
                    if (idx >= 0 && typeof pickRollCard === "function") {
                        pickRollCard(rollMonsters[idx], newCard, idx);
                    }
                });
            }
            // ⚠️ Phải rebind sự kiện click cho roster (nếu là prep)
            else if (container.id === "roster-grid") {
                newCard.addEventListener("click", () => {
                    if (typeof togglePick === "function") togglePick(id);
                });
            }
        }
    });
}    return {
        card, fan, roster, teamSlots, typeChart,
        hud, sprite, menu, switchRows, trainerCard,
        rollStage,
        forceRefreshCardArt,
        hpColor, rarityStars, thumbStyle, cropStyle
    };
})();