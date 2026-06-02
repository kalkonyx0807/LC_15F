let DATA = {
    sinners: ["이상", "파우스트", "돈키호테", "료슈", "뫼르소", "홍루", "히스클리프", "이스마엘", "로쟈", "싱클레어", "오티스", "그레고르"],
    categories: ["화상", "출혈", "진동", "파열", "침잠", "호흡", "충전", "참격", "관통", "타격", "탄환", "혈찬", "버림", "기타"],
    sortOrder: ["화상", "출혈", "진동", "파열", "침잠", "호흡", "충전"],
    kwColors: { "화상": "#ff0000", "출혈": "#ff5900", "진동": "#ffc800", "파열": "#01ff09", "침잠": "#00e1ff", "호흡": "#3437fe", "충전": "#820095", "혈찬": "#6a0505", "탄환": "#3c3c3c", "버림": "#4a2c00"}
};

let slots = [], activeIdx = 0, giftSortAsc = false, collapsedCats = new Set();
let isResCol = false;

async function loadAllData() {
    try {
        const [resIds, resGifts, resPacks, resGuides] = await Promise.all([
            fetch('data/identities.json'),
            fetch('data/gifts.json'),
            fetch('data/packs.json'),
            fetch('data/guides.json')
        ]);
        DATA.identities = await resIds.json();
        const giftsRaw = await resGifts.json();
        DATA.allGifts = Array.isArray(giftsRaw) ? giftsRaw : Object.values(giftsRaw).flat();
        DATA.packs = await resPacks.json();
        DATA.guides = await resGuides.json();
        init();
    } catch (e) {
        console.error("Data Load Error:", e);
        document.getElementById('active-slot-name-display').innerText = "LOAD ERROR";
    }
}

function init() {
    const saved = localStorage.getItem('limbus_md_v18_final');
    slots = saved ? JSON.parse(saved) : [createNewSlot("새 편성")];
    if (!slots[activeIdx]) activeIdx = 0;
    DATA.categories.forEach(cat => collapsedCats.add(cat));
    refreshUI();
}

function createNewSlot(name) {
    return { name, is7Man: true, party: Array.from({length: 12}, () => ({ sinner: "", idName: "", s1_count: 3, s2_count: 2, s3_count: 1 })), floors: Array.from({length: 15}, () => ({ pack: "" })), gifts: [] };
}

function refreshUI() {
    renderSlots(); renderParty(); renderFloors(); renderGifts(); renderGuides(); updateExportCode();
    document.getElementById('active-slot-name-display').innerText = slots[activeIdx].name;
    document.getElementById('deployment-toggle').checked = slots[activeIdx].is7Man;
}

// --- 슬롯 관리 ---
function renameSlot(i) {
    const n = prompt("새 편성 이름을 입력하세요:", slots[i].name);
    if (n && n.trim() !== "") { slots[i].name = n.trim(); saveToLocal(); refreshUI(); }
}

function renderSlots() {
    const list = document.getElementById('slot-list'); if(!list) return;
    list.innerHTML = '';
    slots.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = `flex items-center gap-2 p-2 rounded mb-1 cursor-pointer transition ${activeIdx === i ? 'active-slot' : 'bg-stone-900/40 text-stone-500'}`;
        div.draggable = true;
        div.onclick = () => { activeIdx = i; refreshUI(); };
        div.ondblclick = (e) => { e.stopPropagation(); renameSlot(i); };
        div.ondragstart = (e) => e.dataTransfer.setData('idx', i);
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            const from = parseInt(e.dataTransfer.getData('idx'));
            const moved = slots.splice(from, 1)[0];
            slots.splice(i, 0, moved);
            activeIdx = i; saveToLocal(); refreshUI();
        };
        div.innerHTML = `<i class="fas fa-grip-vertical text-[9px] text-stone-700"></i><span class="flex-1 truncate font-bold">${s.name}</span><button onclick="event.stopPropagation(); deleteSlot(${i})" class="text-stone-600 hover:text-red-500"><i class="fas fa-trash"></i></button>`;
        list.appendChild(div);
    });
}

// --- 기프트 렌더링 (로마 숫자 + 등급 색상 + 설명 제거 완료) ---
function renderGifts() {
    const q = document.getElementById('gift-search').value.toLowerCase(), cont = document.getElementById('gift-inventory'); if(!cont) return;
    cont.innerHTML = '';
    const roman = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
    const unifiedColor = "var(--limbus-gold)";
    
    const selectedIds = slots[activeIdx].gifts, replacedIds = new Set(), usedRes = new Set();
    selectedIds.forEach(id => {
        const g = DATA.allGifts.find(x => x.id === id); if(!g) return;
        if(g.replaces) g.replaces.forEach(rid => replacedIds.add(rid));
        if(g.consumes) g.consumes.forEach(r => usedRes.add(r));
    });

    const sorted = [...DATA.allGifts].sort((a,b) => giftSortAsc ? a.grade - b.grade : b.grade - a.grade);
    DATA.categories.forEach(cat => {
        const filtered = sorted.filter(g => g.cats.includes(cat) && g.name.includes(q)); if (filtered.length === 0) return;
        const isCol = collapsedCats.has(cat);
        const head = document.createElement('div'); head.className = 'flex justify-between bg-stone-900/80 p-1.5 rounded cursor-pointer mt-2 px-2 hover:bg-stone-800';
        head.onclick = () => { isCol ? collapsedCats.delete(cat) : collapsedCats.add(cat); renderGifts(); };
        head.innerHTML = `<span class="text-[10px] font-bold" style="color:${DATA.kwColors[cat] || '#888'}">${cat}</span><i class="fas fa-chevron-${isCol?'down':'up'} text-[8px]"></i>`;
        cont.appendChild(head);

        if(!isCol) filtered.forEach(g => {
            const div = document.createElement('div');
            const isChecked = selectedIds.includes(g.id), isRep = replacedIds.has(g.id), isBlock = g.consumes && !isChecked && g.consumes.some(r => usedRes.has(r)), isUnav = isRep || isBlock;
            div.className = `has-tooltip flex items-center p-1.5 mb-0.5 rounded bg-stone-900/40 hover:bg-stone-800 grade-${g.grade} ${isChecked ? 'bg-red-900/20' : ''} ${isUnav ? 'opacity-30 grayscale pointer-events-none' : ''}`;
            
            div.innerHTML = `<label class="flex items-center gap-2 flex-1 ${isUnav?'cursor-not-allowed':'cursor-pointer'}">
                <input type="checkbox" onchange="toggleGift('${g.id}')" ${isChecked?'checked':''} ${isUnav?'disabled':''}>
                <span class="truncate">${g.img?`<img src="${g.img}" class="w-4 h-4 mr-1 inline">`:''}${g.name} <span class="text-[8px] font-bold ml-1" style="color:${unifiedColor}">${roman[g.grade]||g.grade}</span>
            </label><div class="tooltip"><b>[${g.name}]</b>${isRep?'[재료사용됨] ':''}${isBlock?'[자원선점] ':''}${g.desc||''}</div>`;
            cont.appendChild(div);
        });
    });
}

// --- 기프트 판별 및 통계 ---
function getStats() {
    const s = slots[activeIdx], actKw = {}, totKw = {}, actFac = {}, totFac = {};
    const limit = s.is7Man ? 7 : 6;
    const excluded = ["탄환", "혈찬", "버림"];
    s.party.forEach((p, i) => {
        if (!p.idName || !DATA.identities[p.sinner]) return;
        const id = DATA.identities[p.sinner].find(x => x.name === p.idName); if (!id) return;
        const uKws = new Set();
        ["s1", "s2", "s3"].forEach(sk => { if (p[sk + "_count"] > 0 && id[sk] && id[sk].keywords) id[sk].keywords.forEach(k => { if (!excluded.includes(k)) uKws.add(k); }); });
        uKws.forEach(k => { totKw[k] = (totKw[k] || 0) + 1; if (i < limit) actKw[k] = (actKw[k] || 0) + 1; });
        const idFacs = Array.isArray(id.faction) ? id.faction : (id.faction ? [id.faction] : []);
        idFacs.forEach(f => { totFac[f] = (totFac[f] || 0) + 1; if (i < limit) actFac[f] = (actFac[f] || 0) + 1; });
    });
    return { actKw, totKw, actFac, totFac };
}

function checkGiftStatus(g, p, idx, stats) {
    const s = slots[activeIdx]; if (!s.gifts.includes(g.id) || !p.idName) return 0;
    const id = DATA.identities[p.sinner]?.find(x => x.name === p.idName); if (!id) return 0;
    const idFacs = Array.isArray(id.faction) ? id.faction : (id.faction ? [id.faction] : []);
    const hasAnyKw = (kwList) => [id.s1, id.s2, id.s3].some(sk => sk && sk.keywords && kwList.some(k => sk.keywords.includes(k)));
    const getGlobalKwCount = (kwList) => s.party.filter(m => { const mId = DATA.identities[m.sinner]?.find(x => x.name === m.idName); return mId && [mId.s1, mId.s2, mId.s3].some(sk => sk && sk.keywords && kwList.some(k => sk.keywords.includes(k))); }).length;
    let isBase = false; const tKws = g.kws || (g.kw ? [g.kw] : []), tFacs = g.factions || (g.faction ? [g.faction] : []);
    switch (g.type) {
        case "active_kw": isBase = stats.actKw[g.kw] >= g.min && hasAnyKw([g.kw]); break;
        case "total_kw": isBase = stats.totKw[g.kw] >= g.min && hasAnyKw([g.kw]); break;
        case "total_kw_multi": isBase = getGlobalKwCount(tKws) >= (g.min || 1) && hasAnyKw(tKws); break;
        case "active_faction": isBase = stats.actFac[g.faction] >= g.min && idFacs.includes(g.faction); break;
        case "total_faction": isBase = stats.totFac[g.faction] >= g.min && idFacs.includes(g.faction); break;
        case "faction_list": const matchedF = tFacs.find(f => idFacs.includes(f)); isBase = matchedF && (stats.totFac[matchedF] >= (g.min || 1)); break;
        case "sk_type": let sc = 0; ["s1", "s2", "s3"].forEach(sk => { if (p[sk + '_count'] > 0 && id[sk] && id[sk].type === g.atk) sc++; }); isBase = sc >= g.min; break;
        case "sk_slot_type": const skK = "s" + g.targetSkill; isBase = id[skK] && id[skK].type === g.atk && p[skK + "_count"] > 0; break;
        case "position": isBase = Array.isArray(g.targetSlot) ? g.targetSlot.includes(idx) : idx === g.targetSlot; break;
    }
    if (!isBase) return 0;
    if (g.extras && Array.isArray(g.extras)) {
        const isEx = g.extras.some(ex => {
            if (ex.type === "faction") return idFacs.includes(ex.val);
            if (ex.type === "faction_list") return ex.factions.some(f => idFacs.includes(f));
            if (ex.type === "sk_type") { let ec=0; ["s1","s2","s3"].forEach(sk => { if(p[sk+'_count']>0 && id[sk].type === ex.atk) ec++; }); return ec >= (ex.min || 1); }
            if (ex.type === "sk_slot_type") { const esk = "s" + ex.targetSkill; return id[esk] && id[esk].type === ex.atk && p[esk+"_count"] > 0; }
            if (ex.type === "kw" || ex.type === "active_kw") return hasAnyKw([ex.val]);
            if (ex.type === "global_kw_count") return getGlobalKwCount(ex.kws || [ex.kw]) >= ex.min;
            if (ex.type === "active_kw_count") return (stats.actKw[ex.kw] || 0) >= ex.min;
            return false;
        });
        if (isEx) return 2;
    }
    return 1;
}

// --- UI 렌더링 보조 ---
function renderParty() {
    const s = slots[activeIdx], stats = getStats(), actCont = document.getElementById('active-party'), resCont = document.getElementById('reserve-party'), limit = s.is7Man ? 7 : 6;
    if(!actCont) return; actCont.innerHTML = ''; resCont.innerHTML = '';
    const sortedKw = DATA.sortOrder.filter(k => stats.actKw[k]);
    document.getElementById('total-summary').innerHTML = sortedKw.map(k => `<span class="kw-summary-item" style="color:${DATA.kwColors[k]}">${k} ${stats.actKw[k]}</span>`).join('');
    const inUse = s.party.map(x => x.sinner).filter(Boolean);
    s.party.forEach((p, i) => {
        const isRes = i >= limit, div = document.createElement('div');
        div.className = `flex items-center gap-2 p-1.5 rounded border border-stone-900 ${isRes ? 'bg-stone-950/20' : 'bg-stone-900/40'}`;
        const idList = DATA.identities[p.sinner] || [], idData = (p.idName && idList) ? idList.find(x => x.name === p.idName) : null;
        const sinners = DATA.sinners.filter(sn => sn === p.sinner || !inUse.includes(sn));
        const giftTags = idData ? DATA.allGifts.map(g => { const st = checkGiftStatus(g, p, i, stats); return st > 0 ? `<span class="${st===2?'gift-extra':'gift-active'} px-1.5 rounded text-[8px] mr-0.5 whitespace-nowrap">${g.name}</span>` : ''; }).join('') : '';
        div.innerHTML = `<span class="w-4 text-center font-mono text-stone-700 text-[9px]">${i+1}</span>
            <select onchange="updateSinner(${i}, this.value)" class="w-16 bg-black text-stone-300 rounded text-[10px] outline-none"><option value="">수감자</option>${sinners.map(sn => `<option value="${sn}" ${p.sinner===sn?'selected':''}>${sn}</option>`).join('')}</select>
            <select onchange="updateId(${i}, this.value)" class="w-24 bg-black text-stone-300 rounded text-[10px] outline-none"><option value="">인격</option>${idList.map(id => `<option value="${id.name}" ${p.idName===id.name?'selected':''}>${id.name}</option>`).join('')}</select>
            <div class="flex gap-4 px-2 border-l border-stone-800">${idData ? ["s1","s2","s3"].map(sk => `<div class="flex flex-col items-center"><div class="flex gap-1 text-[8px] leading-none mb-1"><span class="sin-${idData[sk].sin}">${idData[sk].sin}</span><span class="atk-type">${idData[sk].type}</span></div><input type="number" value="${p[sk+'_count']}" min="0" max="6" onchange="updateSk(${i},'${sk}_count',this.value)"><div class="flex gap-0.5 mt-0.5">${(idData[sk].keywords || []).map(k => `<span class="text-[7px]" style="color:${DATA.kwColors[k]}">${k}</span>`).join('')}</div></div>`).join('') : '<div class="text-stone-800 text-[9px] py-2 italic">인격을 선택해주세요</div>'}</div>
            <div class="flex-1 flex justify-end items-center gap-0.5 overflow-hidden">${giftTags}</div>`;
        (isRes ? resCont : actCont).appendChild(div);
    });
}

function renderFloors() {
    const list = document.getElementById('floor-list'); if(!list) return; list.innerHTML = '';
    const selectedPacks = slots[activeIdx].floors.map(f => f.pack).filter(p => p !== "");
    for(let i=1; i<=15; i++) {
        const floorData = slots[activeIdx].floors[i-1], packs = DATA.packs[i] || [], curPack = packs.find(p => p.name === floorData.pack);
        let opts = `<option value="">팩 선택</option>`;
        packs.forEach(pk => { const isOut = selectedPacks.includes(pk.name) && pk.name !== floorData.pack; opts += `<option value="${pk.name}" ${floorData.pack===pk.name?'selected':''} ${isOut?'disabled':''}>${pk.name}${isOut?' (선택됨)':''}</option>`; });
        list.innerHTML += `<div class="bg-stone-900 border border-stone-800 p-1.5 rounded shadow-inner"><div class="text-[10px] text-stone-500 font-bold mb-1 border-b border-stone-800 pb-0.5">${i}F</div><select onchange="updateFloor(${i-1}, this.value)" class="w-full bg-black text-[11px] text-stone-300 outline-none mb-1 cursor-pointer">${opts}</select><div class="text-[11px] text-yellow-400 font-bold leading-normal mt-1">${(curPack?.gifts || []).filter(g => g.trim()!=="").map(g => `• ${g}`).join('<br>')}</div></div>`;
    }
}

function renderGuides() {
    const cont = document.getElementById('guide-container'); if(!cont || !DATA.guides) return;
    cont.innerHTML = DATA.guides.map(item => `<div class="group"><h4 class="text-stone-200 font-bold mb-1 text-[11px]"><span class="w-1 h-3 bg-red-900 rounded-full inline-block mr-1"></span>${item.title}</h4><div class="pl-3 border-l border-stone-800">${item.content}</div></div>`).join('');
}

// --- 기타 유틸리티 ---
function toggleSidebar(side) {
    const isMobile = window.innerWidth <= 768;
    const sb = document.getElementById(side + '-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const icon = document.getElementById(side + '-icon');
    if (isMobile) {
        const isActive = sb.classList.toggle('active');
        overlay.classList.toggle('active', isActive);
        if (side === 'left') icon.className = isActive ? "fas fa-times" : "fas fa-bars";
        else icon.className = isActive ? "fas fa-times" : "fas fa-box-open";
    } else {
        sb.classList.toggle('collapsed');
    }
}

function closeAllSidebars() {
    document.getElementById('left-sidebar').classList.remove('active');
    document.getElementById('right-sidebar').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
    document.getElementById('left-icon').className = "fas fa-bars";
    document.getElementById('right-icon').className = "fas fa-box-open";
}

function toggleReserve() { isResCol = !isResCol; document.getElementById('reserve-party').style.maxHeight = isResCol ? '0' : '1000px'; document.getElementById('reserve-icon').className = isResCol ? "fas fa-chevron-down" : "fas fa-chevron-up"; }
function updateSinner(i, v) { slots[activeIdx].party[i].sinner = v; slots[activeIdx].party[i].idName = ""; refreshUI(); saveToLocal(); }
function updateId(i, v) { slots[activeIdx].party[i].idName = v; refreshUI(); saveToLocal(); }
function updateSk(i, f, v) { slots[activeIdx].party[i][f] = parseInt(v); refreshUI(); saveToLocal(); }
function updateFloor(i, v) { slots[activeIdx].floors[i].pack = v; renderFloors(); saveToLocal(); }
function updateDeployment(v) { slots[activeIdx].is7Man = v; refreshUI(); saveToLocal(); }
function toggleGift(id) { const list = slots[activeIdx].gifts; const idx = list.indexOf(id); if(idx > -1) list.splice(idx, 1); else list.push(id); saveToLocal(); refreshUI(); }
function toggleSort() { giftSortAsc = !giftSortAsc; renderGifts(); }
function addNewSlot() { const n = prompt("새 편성 이름:"); if(n) { slots.push(createNewSlot(n)); activeIdx = slots.length-1; refreshUI(); saveToLocal(); } }
function deleteSlot(i) { if(slots.length > 1 && confirm("삭제하시겠습니까?")) { slots.splice(i,1); activeIdx=0; refreshUI(); saveToLocal(); }}
function updateExportCode() { document.getElementById('out-code').value = btoa(encodeURIComponent(JSON.stringify(slots[activeIdx]))); }
function copyExportCode() { const el = document.getElementById('out-code'); el.select(); document.execCommand('copy'); alert("복사됨"); }
function importCode(asNew) { try { const data = JSON.parse(decodeURIComponent(atob(document.getElementById('in-code').value))); if(asNew) { slots.push(data); activeIdx = slots.length-1; } else slots[activeIdx] = data; document.getElementById('in-code').value = ''; refreshUI(); saveToLocal(); } catch(e) { alert("코드오류"); } }
function saveToLocal() { localStorage.setItem('limbus_md_v18_final', JSON.stringify(slots)); }

function resetPart(type) {
    if(!confirm("정말 초기화하시겠습니까?")) return;
    const s = slots[activeIdx];
    if(type === 'party' || type === 'all') s.party = Array.from({length: 12}, () => ({ sinner: "", idName: "", s1_count: 3, s2_count: 2, s3_count: 1 }));
    if(type === 'gifts' || type === 'all') s.gifts = [];
    if(type === 'floors' || type === 'all') s.floors = Array.from({length: 15}, () => ({ pack: "" }));
    saveToLocal(); refreshUI();
}

window.onload = loadAllData;