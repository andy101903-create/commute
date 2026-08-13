// 驗證 2026-08-13 功能：295 路線、無步行方案（懶人版）、置頂固定
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const PROJECT = path.dirname(BASE);

const elements = {};
function el(id) {
    if (!elements[id]) elements[id] = {
        value: '', innerText: '', textContent: '',
        innerHTML: '', style: {}, classList: { toggle() {}, add() {}, remove() {} },
        addEventListener() {}, appendChild() {},
    };
    return elements[id];
}
global.document = {
    getElementById: el,
    querySelector: () => null,
};
const store = new Map();
global.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
};
global.setInterval = () => {};
global.setTimeout = setTimeout;

const html = fs.readFileSync(path.join(PROJECT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
// 頂層 const/let 轉成 globalThis（eval 作用域限制），函式宣告會自動外洩
const src = m[1]
    .replace(/^const (\w+) = /gm, 'globalThis.$1 = ')
    .replace(/^let (\w+) = /gm, 'globalThis.$1 = ')
    .replace(/^let (\w+);/gm, 'globalThis.$1 = undefined;');
eval(src);

let pass = 0, fail = 0;
function check(name, cond) {
    console.log((cond ? '✅' : '❌') + ' ' + name);
    if (cond) pass++; else fail++;
}

// 1) 295 已加入古亭站群組（MORNING_BUS[2] = 古亭）
const gu = MORNING_BUS.find(g => g.stationId === 'G09');
check('古亭站群組有 295', gu && gu.routes.some(r => r.name === '295' && r.dest === '自來水處(辛亥)'));
check('295 有 destWalk 8', gu.routes.find(r => r.name === '295').destWalk === 8);

// 2) ROUTE_STOPS 有 295 站序
check('ROUTE_STOPS[295][1] 古亭#6→辛亥#16', ROUTE_STOPS['295'] && ROUTE_STOPS['295'][1]['捷運古亭站(和平)'] === 6 && ROUTE_STOPS['295'][1]['自來水處(辛亥)'] === 16);

// 3) findBusCandidates：合成 295 dir1 ETA → 有候選
const fakeEta = [
    { Direction: 1, StopName: { Zh_tw: '捷運古亭站(和平)' }, EstimateTime: 300, PlateNumb: 'ABC-123', StopStatus: 0 },
    { Direction: 0, StopName: { Zh_tw: '捷運古亭站(和平)' }, EstimateTime: 120, PlateNumb: 'XYZ', StopStatus: 0 }, // 反方向要忽略
];
const cands = findBusCandidates(fakeEta, '295', '捷運古亭站(和平)', '自來水處(辛亥)');
check('295 候選只取 dir1', cands.length === 1 && cands[0].etaSec === 300);

// 4) 懶人版（2026-08-13）：所有步行方案已刪除
check('MORNING_DIRECT 已刪除', typeof MORNING_DIRECT === 'undefined');
check('MORNING_WALK_MRT 已刪除', typeof MORNING_WALK_MRT === 'undefined');
check('MORNING_GUILIN 已刪除', typeof MORNING_GUILIN === 'undefined');
check('EVENING_WALK_MRT 已刪除', typeof EVENING_WALK_MRT === 'undefined');
check('WALK 無 boatShanWalk/walkOnly', typeof WALK.boatShanWalk === 'undefined' && typeof WALK.walkOnly === 'undefined');
check('HTML 無 showDirectToggle 勾選框', !html.includes('showDirectToggle'));
check('HTML 無桂林路方案字樣', !html.includes('桂林路起點') && !html.includes('MORNING_GUILIN'));
check('保留長興街口→大門 7 分', WALK.destFromChangxing === 7);

// 5) computeMorning 只產 mrt-bus（無 direct/walk/guilin）
(async () => {
    const fakeEta2 = [
        { Direction: 1, StopName: { Zh_tw: '捷運古亭站(和平)' }, EstimateTime: 300, PlateNumb: 'ABC-123', StopStatus: 0 },
    ];
    const morning = await computeMorning(8 * 60 + 10, {}, { '295': fakeEta2 });
    const types = new Set(morning.map(r => r.type));
    check('去程只產 mrt-bus 方案', types.size === 1 && types.has('mrt-bus'));

    // 6) 置頂固定：釘選 295 卡後它在最前面
    const fakeResults = [
        { type: 'mrt-bus', grpIndex: 2, cardTitle: '🚇 古亭站5號出口 ➔ 🚌 295 公車', routeLabel: '295', total: 30, arrive: 0 },
        { type: 'mrt-bus', grpIndex: 0, cardTitle: '🚇 公館站1號出口 ➔ 🚌 907 公車', routeLabel: '907', total: 25, arrive: 0 },
    ];
    store.set('commute_pins', JSON.stringify(['🚇 古亭站5號出口 ➔ 🚌 295 公車']));
    currentMode = 'morning';
    renderUI(fakeResults, '08:00', {});
    const html2 = el('routesApp').innerHTML;
    // 只看卡片區（排除 🏆 最快組合橫幅——橫幅永遠顯示真最快，與置頂無關）
    const cardArea = html2.slice(html2.indexOf('route-card'));
    const idx295 = cardArea.indexOf('古亭站5號出口');
    const idx907 = cardArea.indexOf('公館站1號出口');
    check('釘選的 295 卡排在 907 前', idx295 >= 0 && idx907 >= 0 && idx295 < idx907);
    check('釘選卡片顯示 pinned 樣式', html2.includes('pin-btn pinned'));

    // 7) togglePin 切換（模擬點按鈕）
    const btn = { getAttribute: k => (k === 'data-pin' ? '🚇 古亭站5號出口 ➔ 🚌 295 公車' : null) };
    togglePin(btn);
    const pinsAfter = JSON.parse(store.get('commute_pins'));
    check('togglePin 取消釘選', !pinsAfter.includes('🚇 古亭站5號出口 ➔ 🚌 295 公車'));

    // 8) 版面減法（2026-08-13）：同站路線收合、時間格 2 盒、無卡底描述
    check('同站其他路線收進「同站還有 N 條」', html2.includes('同站還有') && html2.includes('<details'));
    check('時間格已移除「地表到達」盒', !html2.includes('地表到達'));
    check('卡底描述段落已移除', !html2.includes('font-size:0.85rem; color:#555'));

    console.log(`\n結果: ${pass} 過 / ${fail} 掛`);
    process.exit(fail ? 1 : 0);
})();
