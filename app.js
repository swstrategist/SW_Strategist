let battlesData = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    result: 'win',
    offense: ['', '', ''],
    defense: ['', '', '']
}));

let currentBattleIndex = 0;
let guildName1 = '';
let guildName2 = '';

function init() {
    renderPills();
    renderEditorForm();
    renderReportCards();
    updateScoreBadge();
    updateGuildDisplay();
}

function onGuildInput() {
    guildName1 = document.getElementById('guild-name-1-input').value;
    guildName2 = document.getElementById('guild-name-2-input').value;
    updateGuildDisplay();
}

function updateGuildDisplay() {
    requestRender();
}

function renderPills() {
    const container = document.getElementById('pills-container');
    container.innerHTML = '';
    battlesData.forEach((b, idx) => {
        const isSelected = idx === currentBattleIndex;
        const btn = document.createElement('button');
        btn.onclick = () => selectBattle(idx);
        btn.className = `pill ${
            isSelected
                ? 'pill-sel'
                : b.result === 'win'
                    ? 'pill-win'
                    : 'pill-loss'
        }`;
        btn.innerText = `#${b.id}`;
        container.appendChild(btn);
    });
}

function selectBattle(index) {
    currentBattleIndex = index;
    renderPills();
    renderEditorForm();
}

function setResult(res) {
    battlesData[currentBattleIndex].result = res;
    renderPills();
    renderEditorForm();
    renderReportCards();
    updateScoreBadge();
}

function renderEditorForm() {
    const b = battlesData[currentBattleIndex];
    document.getElementById('current-battle-num').innerText = b.id;
    document.getElementById('current-battle-title').innerText = `#${b.id}`;

    const winBtn = document.getElementById('btn-res-win');
    const lossBtn = document.getElementById('btn-res-loss');

    winBtn.className = 'seg-btn' + (b.result === 'win' ? ' on-win' : '');
    lossBtn.className = 'seg-btn' + (b.result === 'loss' ? ' on-loss' : '');

    renderTeamInputs('offense-monsters-form', 'offense', b.offense);
    renderTeamInputs('defense-monsters-form', 'defense', b.defense);
}

function renderTeamInputs(containerId, teamType, monstersArr) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    monstersArr.forEach((mName, slotIdx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative flex items-center gap-2';

        const mObj = findMonster(mName);
        const imgUrl = mObj ? mObj.img : 'https://i.imgur.com/zobLe0B.png';

        wrapper.innerHTML = `
            <div class="monster-card-avatar">
                <img src="${imgUrl}" alt="${mName}">
            </div>
            <div class="relative flex-1">
                <input type="text" 
                    value="${mName}" 
                    placeholder="Monstre ${slotIdx + 1}"
                    class="sw-input w-full px-3 py-1.5 text-xs">
                <div class="autocomplete-dropdown hidden absolute left-0 right-0 top-full mt-1 rounded-xl"></div>
            </div>
        `;

        const inputEl = wrapper.querySelector('input');
        const dropdownEl = wrapper.querySelector('.autocomplete-dropdown');

        inputEl.oninput = (e) => {
            updateMonsterAvatar(wrapper, e.target.value);
            onMonsterInput(e.target.value, teamType, slotIdx, dropdownEl);
        };

        container.appendChild(wrapper);
    });
}

const DEFAULT_MONSTER_IMG = 'https://i.imgur.com/zobLe0B.png';

// Met à jour la petite image à côté du champ dès que le nom change :
// si le nom ne correspond à aucun monstre (ou est vidé), on remet l'image par défaut.
function updateMonsterAvatar(wrapper, name) {
    const img = wrapper.querySelector('.monster-card-avatar img');
    if (!img) return;
    const mObj = findMonster(name);
    img.src = mObj ? mObj.img : DEFAULT_MONSTER_IMG;
    img.alt = name;
}

function onMonsterInput(val, teamType, slotIdx, dropdown) {
    battlesData[currentBattleIndex][teamType][slotIdx] = val;

    if (!val.trim()) {
        dropdown.classList.add('hidden');
        renderReportCards();
        return;
    }

    const matches = (() => { const q = normalizeName(val); return LOCAL_MONSTER_DATABASE.filter(m => m.key.includes(q)).slice(0, 5); })();

    if (matches.length === 0) {
        dropdown.classList.add('hidden');
    } else {
        dropdown.innerHTML = '';
        matches.forEach(m => {
            const item = document.createElement('div');
            item.className = 'ac-item px-3 py-1.5 cursor-pointer flex items-center gap-2 text-xs font-bold';
            item.innerHTML = `<img src="${m.img}" class="w-5 h-5 rounded object-cover"><span>${m.name}</span>`;
            item.onclick = () => {
                battlesData[currentBattleIndex][teamType][slotIdx] = m.name;
                renderEditorForm();
                renderReportCards();
            };
            dropdown.appendChild(item);
        });
        dropdown.classList.remove('hidden');
    }

    renderReportCards();
}

/* =====================================================================
   RENDU DU COMPTE-RENDU (canvas)
   L'aperçu ET le PNG téléchargé viennent du même dessin : ce que tu vois
   est exactement ce que tu exportes, sans décalage de texte.
   ===================================================================== */
const REPORT = { W: 1136, SCALE: 2, PAD: 22, GAP: 10, COLS: 5, HEADER_H: 91 };
const FONT = '"Nunito", "Segoe UI", Arial, sans-serif';
const FONT_DISPLAY = '"Cinzel", "Trajan Pro", Georgia, serif';
const FA_FONT = '"Font Awesome 6 Free"';
const FA_KHANDA = '\uf666';
const LOGO_URL = 'https://i.imgur.com/3FQVVBq.png';

const COLORS = {
    bgTop: '#0e1436', bgBottom: '#060916', dot: 'rgba(140,156,255,0.10)',
    frame: 'rgba(240,191,85,0.55)', frameInner: 'rgba(240,191,85,0.16)',
    panel: 'rgba(7,10,28,0.92)', panelLine: 'rgba(240,191,85,0.40)',
    gold: '#f0bf55', goldHi: '#ffe49a',
    rune: '#33427f', ink: '#e6e9ff', mist: '#9aa5d6', mistDim: '#6573a8',
    white: '#ffffff',
    win: '#52dba5', winRgb: '82,219,165',
    loss: '#ff5d6c', lossRgb: '255,93,108'
};

/* ---------- Images (chargées avec CORS pour pouvoir exporter) ---------- */
const imageCache = new Map();

function getImage(url) {
    if (!url) return null;
    let entry = imageCache.get(url);
    if (!entry) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        entry = { img, state: 'loading' };
        entry.promise = new Promise(resolve => {
            img.onload = () => { entry.state = 'ok'; resolve(); requestRender(); };
            img.onerror = () => { entry.state = 'error'; resolve(); requestRender(); };
        });
        img.src = url;
        imageCache.set(url, entry);
    }
    return entry;
}

function waitForImages() {
    return Promise.all([...imageCache.values()].map(e => e.promise));
}

async function loadFonts() {
    try {
        await Promise.all([
            document.fonts.load('700 10px "Nunito"', 'AaÈè#?-'),
            document.fonts.load('800 10px "Nunito"', 'AaÈè#?-'),
            document.fonts.load('900 10px "Nunito"', 'AaÈè#?-'),
            document.fonts.load('700 10px "Cinzel"', 'AaÈÉ#?-'),
            document.fonts.load('900 10px "Cinzel"', 'AaÈÉ#?-'),
            document.fonts.load('900 12px ' + FA_FONT, FA_KHANDA)
        ]);
    } catch (e) { /* on dessine quand même avec les polices de secours */ }
}

/* ---------- Petits outils de dessin ---------- */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function fillStrokeRect(ctx, x, y, w, h, r, fill, stroke) {
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function measureText(ctx, s, o) {
    ctx.font = `${o.weight || 700} ${o.size}px ${o.family || FONT}`;
    const sp = o.spacing || 0;
    if (!sp) return ctx.measureText(s).width;
    return [...s].reduce((a, c) => a + ctx.measureText(c).width + sp, 0) - sp;
}

/* Texte centré verticalement sur `cy` d'après la hauteur des capitales :
   le texte est donc pile au milieu de sa boîte, quelle que soit la police. */
function drawText(ctx, s, x, cy, o) {
    const w = measureText(ctx, s, o);
    const sp = o.spacing || 0;
    ctx.font = `${o.weight || 700} ${o.size}px ${o.family || FONT}`;
    ctx.fillStyle = o.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const cap = ctx.measureText('H').actualBoundingBoxAscent || o.size * 0.7;
    const baseline = cy + cap / 2;
    let sx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    if (!sp) {
        ctx.fillText(s, sx, baseline);
    } else {
        for (const c of s) { ctx.fillText(c, sx, baseline); sx += ctx.measureText(c).width + sp; }
    }
    return w;
}

function drawCover(ctx, img, x, y, size) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.min(iw, ih);
    ctx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, x, y, size, size);
}

function wrapName(ctx, name, maxW) {
    ctx.font = `700 9px ${FONT}`;
    const lines = [];
    let cur = '';
    for (const raw of name.split(/\s+/).filter(Boolean)) {
        let word = raw;
        while (ctx.measureText(word).width > maxW && word.length > 1) {
            let i = word.length;
            while (i > 1 && ctx.measureText(word.slice(0, i)).width > maxW) i--;
            if (cur) { lines.push(cur); cur = ''; }
            lines.push(word.slice(0, i));
            word = word.slice(i);
        }
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width <= maxW) cur = test;
        else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines;
}

/* ---------- Ornements ---------- */
function drawDiamond(ctx, cx, cy, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function goldRule(ctx, x1, x2, y, alpha) {
    const g = ctx.createLinearGradient(x1, 0, x2, 0);
    g.addColorStop(0, 'rgba(240,191,85,0)');
    g.addColorStop(0.5, `rgba(240,191,85,${alpha})`);
    g.addColorStop(1, 'rgba(240,191,85,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x1, y, x2 - x1, 1);
}

/* ---------- Dessin d'un monstre (icône + nom) ---------- */
function drawMonster(ctx, name, lines, cx, iconY, namesTop, LH) {
    const size = 32, x = cx - size / 2;
    const mObj = findMonster(name);

    if (!name) {
        fillStrokeRect(ctx, x, iconY, size, size, 7, 'rgba(18,25,58,0.7)', 'rgba(51,66,127,0.55)');
        drawText(ctx, '?', cx, iconY + size / 2, { size: 10, weight: 800, color: COLORS.mistDim, align: 'center' });
        drawText(ctx, '-', cx, namesTop + LH / 2, { size: 9, weight: 700, color: COLORS.mistDim, align: 'center' });
        return;
    }

    fillStrokeRect(ctx, x, iconY, size, size, 7, '#10163a', null);
    const entry = mObj ? getImage(mObj.img) : null;
    if (entry && entry.state === 'ok') {
        ctx.save();
        roundRect(ctx, x, iconY, size, size, 7);
        ctx.clip();
        drawCover(ctx, entry.img, x, iconY, size);
        ctx.restore();
    } else if (!entry || entry.state === 'error') {
        drawText(ctx, name.charAt(0).toUpperCase(), cx, iconY + size / 2, { size: 13, weight: 800, color: COLORS.mist, align: 'center' });
    }
    // cadre doré + liseré intérieur sombre (effet biseau)
    fillStrokeRect(ctx, x + 2, iconY + 2, size - 4, size - 4, 5, null, 'rgba(0,0,0,0.4)');
    fillStrokeRect(ctx, x, iconY, size, size, 7, null, 'rgba(240,191,85,0.85)');

    lines.forEach((line, j) => {
        drawText(ctx, line, cx, namesTop + j * LH + LH / 2, { size: 9, weight: 700, color: COLORS.ink, align: 'center' });
    });
}

function drawTeam(ctx, label, names, lines, bx, by, bw, bh, LH) {
    fillStrokeRect(ctx, bx, by, bw, bh, 8, 'rgba(4,6,20,0.7)', 'rgba(51,66,127,0.6)');
    drawDiamond(ctx, bx + 12, by + 14, 3, COLORS.gold);
    drawText(ctx, label, bx + 21, by + 14, { size: 9, weight: 900, color: COLORS.gold, spacing: 0.45 });
    const centerX = bx + bw / 2;
    const iconY = by + 28;
    const namesTop = iconY + 32 + 4;
    names.forEach((n, k) => {
        drawMonster(ctx, (n || '').trim(), lines[k], centerX + (k - 1) * 62, iconY, namesTop, LH);
    });
}

/* ---------- Dessin complet ---------- */
const measureCtx = document.createElement('canvas').getContext('2d');

function drawReport(canvas) {
    const { W, SCALE: S, PAD, GAP, COLS, HEADER_H } = REPORT;
    const LH = 11;

    // 1) Mise en forme des noms (retour à la ligne) -> hauteur des lignes de cartes
    const wrapped = battlesData.map(b => ({
        off: b.offense.map(n => wrapName(measureCtx, (n || '').trim(), 56)),
        def: b.defense.map(n => wrapName(measureCtx, (n || '').trim(), 56))
    }));
    const rows = Math.ceil(battlesData.length / COLS);
    const rowMaxLines = [];
    for (let r = 0; r < rows; r++) {
        let max = 1;
        wrapped.slice(r * COLS, (r + 1) * COLS).forEach(w => {
            [...w.off, ...w.def].forEach(l => { max = Math.max(max, l.length); });
        });
        rowMaxLines.push(max);
    }
    const blockH = r => 72 + LH * rowMaxLines[r];
    const cardH = r => 46 + blockH(r) * 2 + 8 + 11;

    let H = HEADER_H;
    const rowY = [];
    for (let r = 0; r < rows; r++) { rowY.push(H); H += cardH(r) + (r < rows - 1 ? GAP : 0); }
    H += PAD;

    canvas.width = Math.round(W * S);
    canvas.height = Math.round(H * S);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 2) Fond, halo, trame et cadre doré
    const R = 12;
    ctx.save();
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, R);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.clip();
    const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.55);
    glow.addColorStop(0, 'rgba(110,88,230,0.30)');
    glow.addColorStop(1, 'rgba(110,88,230,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    for (let y = 12; y < H; y += 24) {
        for (let x = 12; x < W; x += 24) drawDiamond(ctx, x, y, 1.6, COLORS.dot);
    }
    ctx.restore();

    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, R);
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.frame;
    ctx.stroke();
    roundRect(ctx, 5.5, 5.5, W - 11, H - 11, R - 4);
    ctx.strokeStyle = COLORS.frameInner;
    ctx.stroke();
    [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(([dx, dy]) => drawDiamond(ctx, dx, dy, 3.5, COLORS.gold));

    // 3) En-tête
    const logo = getImage(LOGO_URL);
    fillStrokeRect(ctx, PAD, PAD, 40, 40, 8, '#10163a', null);
    if (logo && logo.state === 'ok') {
        ctx.save();
        roundRect(ctx, PAD, PAD, 40, 40, 8);
        ctx.clip();
        drawCover(ctx, logo.img, PAD, PAD, 40);
        ctx.restore();
    }
    fillStrokeRect(ctx, PAD, PAD, 40, 40, 8, null, 'rgba(240,191,85,0.9)');

    const titleGrad = ctx.createLinearGradient(0, PAD + 5, 0, PAD + 21);
    titleGrad.addColorStop(0, '#fff3c4');
    titleGrad.addColorStop(1, COLORS.gold);
    drawText(ctx, 'SUMMONERS WAR', PAD + 52, PAD + 13, { size: 15, weight: 900, family: FONT_DISPLAY, color: titleGrad, spacing: 1.2 });
    drawText(ctx, 'COMPTE-RENDU SIÈGE', PAD + 52, PAD + 30, { size: 10, weight: 800, color: COLORS.mist, spacing: 1 });

    const wins = battlesData.filter(b => b.result === 'win').length;
    const losses = battlesData.filter(b => b.result === 'loss').length;
    const scoreStr = `${wins} W - ${losses} L`;
    const g1 = guildName1.trim() || 'Guilde 1';
    const g2 = guildName2.trim() || 'Guilde 2';

    const BH = 32, BY = PAD + 4, BPAD = 14, BGAP = 8;
    const scoreOpt = { size: 12, weight: 900, color: COLORS.goldHi };
    const nameOpt = { size: 12, weight: 900, color: COLORS.gold };
    const vsOpt = { size: 10, weight: 700, color: COLORS.mistDim };
    const iconOpt = { size: 12, weight: 900, family: FA_FONT, color: COLORS.gold };

    const scoreW = measureText(ctx, scoreStr, scoreOpt) + BPAD * 2;
    const scoreX = W - PAD - scoreW;
    fillStrokeRect(ctx, scoreX, BY, scoreW, BH, 8, COLORS.panel, COLORS.panelLine);
    drawText(ctx, scoreStr, scoreX + scoreW / 2, BY + BH / 2, { ...scoreOpt, align: 'center' });

    const iconW = measureText(ctx, FA_KHANDA, iconOpt);
    const g1W = measureText(ctx, g1, nameOpt);
    const vsW = measureText(ctx, 'VS', vsOpt);
    const g2W = measureText(ctx, g2, nameOpt);
    const guildW = BPAD * 2 + iconW + BGAP + g1W + BGAP + vsW + BGAP + g2W;
    const guildX = scoreX - 8 - guildW;
    fillStrokeRect(ctx, guildX, BY, guildW, BH, 8, COLORS.panel, COLORS.panelLine);
    let gx = guildX + BPAD;
    const cyBadge = BY + BH / 2;
    drawText(ctx, FA_KHANDA, gx, cyBadge, iconOpt); gx += iconW + BGAP;
    drawText(ctx, g1, gx, cyBadge, nameOpt); gx += g1W + BGAP;
    drawText(ctx, 'VS', gx, cyBadge, vsOpt); gx += vsW + BGAP;
    drawText(ctx, g2, gx, cyBadge, nameOpt);

    // séparateur doré
    goldRule(ctx, PAD, W - PAD, PAD + 40 + 12, 0.55);
    drawDiamond(ctx, W / 2, PAD + 40 + 12.5, 3, COLORS.gold);

    // 4) Cartes des combats
    const cardW = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
    battlesData.forEach((b, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = PAD + col * (cardW + GAP);
        const y = rowY[row];
        const h = cardH(row);
        const isWin = b.result === 'win';
        const rgb = isWin ? COLORS.winRgb : COLORS.lossRgb;
        const accent = isWin ? COLORS.win : COLORS.loss;

        const cardFill = ctx.createLinearGradient(0, y, 0, y + h);
        cardFill.addColorStop(0, 'rgba(24,32,72,0.95)');
        cardFill.addColorStop(1, 'rgba(9,13,34,0.95)');
        fillStrokeRect(ctx, x, y, cardW, h, 10, cardFill, `rgba(${rgb},0.55)`);

        // bande d'en-tête teintée selon le résultat + filet supérieur
        ctx.save();
        roundRect(ctx, x + 0.5, y + 0.5, cardW - 1, h - 1, 10);
        ctx.clip();
        const band = ctx.createLinearGradient(0, y, 0, y + 38);
        band.addColorStop(0, `rgba(${rgb},0.22)`);
        band.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = band;
        ctx.fillRect(x, y, cardW, 38);
        ctx.fillStyle = accent;
        ctx.fillRect(x, y, cardW, 2);
        ctx.restore();

        const ix = x + 11, iw = cardW - 22, midY = y + 21;
        const numTxt = `#${b.id}`;
        const numOpt = { size: 10, weight: 900, color: accent };
        const numW = measureText(ctx, numTxt, numOpt) + 16;
        fillStrokeRect(ctx, ix, y + 11, numW, 20, 5, `rgba(${rgb},0.2)`, `rgba(${rgb},0.5)`);
        drawText(ctx, numTxt, ix + numW / 2, midY, { ...numOpt, align: 'center' });
        drawText(ctx, isWin ? 'VICTOIRE' : 'DÉFAITE', ix + numW + 8, midY, { size: 11, weight: 700, family: FONT_DISPLAY, color: accent, spacing: 0.7 });

        goldRule(ctx, ix, ix + iw, y + 37, 0.35);

        const bh = blockH(row);
        const top1 = y + 46;
        drawTeam(ctx, 'ATTAQUE', b.offense, wrapped[i].off, ix, top1, iw, bh, LH);
        drawTeam(ctx, 'DEFENSE', b.defense, wrapped[i].def, ix, top1 + bh + 8, iw, bh, LH);
    });
}

let renderQueued = false;
function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
        renderQueued = false;
        const canvas = document.getElementById('report-canvas');
        if (canvas) drawReport(canvas);
    });
}

function renderReportCards() {
    requestRender();
}

function updateScoreBadge() {
    const wins = battlesData.filter(b => b.result === 'win').length;
    const losses = battlesData.filter(b => b.result === 'loss').length;

    document.getElementById('counter-win').innerText = wins;
    document.getElementById('counter-loss').innerText = losses;
    requestRender();
}

function prevBattle() {
    if (currentBattleIndex > 0) selectBattle(currentBattleIndex - 1);
}

function nextBattle() {
    if (currentBattleIndex < 9) selectBattle(currentBattleIndex + 1);
}

function resetAllData() {
    battlesData = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        result: 'win',
        offense: ['', '', ''],
        defense: ['', '', '']
    }));
    guildName1 = '';
    guildName2 = '';
    document.getElementById('guild-name-1-input').value = '';
    document.getElementById('guild-name-2-input').value = '';
    currentBattleIndex = 0;
    init();
    showToast('Toutes les données ont été réinitialisées');
}

async function exportAsPNG() {
    const canvas = document.getElementById('report-canvas');
    await loadFonts();
    drawReport(canvas);          // lance le chargement des images manquantes
    await waitForImages();
    drawReport(canvas);          // dessin final, tout est chargé

    canvas.toBlob(blob => {
        if (!blob) { showToast("Export impossible, réessaie dans un instant"); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'compte-rendu-sw.png';
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 3000);
}

window.onload = async () => {
    init();
    await loadFonts();
    requestRender();
};
