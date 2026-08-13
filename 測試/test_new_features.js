// 驗證 2026-08-13 新功能：295 路線、直達站牌開關、置頂固定
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
check('295 有 destWalk 20', gu.routes.find(r => r.name === '295').destWalk === 20);

// 2) ROUTE_STOPS 有 295 站序
check('ROUTE_STOPS[295][1] 古亭#6→辛亥#16', ROUTE_STOPS['295'] && ROUTE_STOPS['295'][1]['捷運古亭站(和平)'] === 6 && ROUTE_STOPS['295'][1]['自來水處(辛亥)'] === 16);

// 3) findBusCandidates：合成 295 dir1 ETA → 有候選
const fakeEta = [
    { Direction: 1, StopName: { Zh_tw: '捷運古亭站(和平)' }, EstimateTime: 300, PlateNumb: 'ABC-123', StopStatus: 0 },
    { Direction: 0, StopName: { Zh_tw: '捷運古亭站(和平)' }, EstimateTime: 120, PlateNumb: 'XYZ', StopStatus: 0 }, // 反方向要忽略
];
const cands = findBusCandidates(fakeEta, '295', '捷運古亭站(和平)', '自來水處(辛亥)');
check('295 候選只取 dir1', cands.length === 1 && cands[0].etaSec === 300);

// 4) 開關：預設隱藏 MORNING_DIRECT（植物園/和平中華路口）；桂林路不受影響
check('getShowDirect 預設 false', getShowDirect() === false);
check('MORNING_GUILIN 已刪除龍山寺直達（無 direct 欄位）', !('direct' in MORNING_GUILIN) && !('boardStop' in MORNING_GUILIN));
check('MORNING_GUILIN 保留 673', !!MORNING_GUILIN.guilin673 && MORNING_GUILIN.guilin673.name === '673');
const fakeResults = [
    { type: 'mrt-bus', grpIndex: 2, cardTitle: '🚇 古亭站5號出口 ➔ 🚌 295 公車', routeLabel: '295', total: 30, arrive: 0 },
    { type: 'direct', grpIndex: 0, cardTitle: '🚌 907 直達（植物園站牌，免換捷運）', routeLabel: '907', total: 25, arrive: 0 },
    { type: 'guilin-direct', grpIndex: 1, cardTitle: '🚗 桂林路 ➔ 🚌 673 直達（桂林路站）', routeLabel: '673', total: 28, arrive: 0 },
];
currentMode = 'morning';
// renderUI 用（需要有 routesApp 元素）
renderUI(fakeResults, '08:00', {});
const shown = el('routesApp').innerHTML;
check('開關關閉時不顯示 植物園', !shown.includes('植物園'));
check('開關關閉時仍顯示 桂林路(673)', shown.includes('桂林路 ➔ 🚌 673'));
check('開關關閉時仍顯示 古亭 295', shown.includes('古亭站5號出口 ➔ 🚌 295'));

// 5) 置頂：釘選 植物園 卡片後（開關開啟）它在最前面
store.set('commute_show_direct', '1');
store.set('commute_pins', JSON.stringify(['🚌 907 直達（植物園站牌，免換捷運）']));
renderUI(fakeResults, '08:00', {});
const html2 = el('routesApp').innerHTML;
const idxPlant = html2.indexOf('植物園站牌');
const idxGu = html2.indexOf('古亭站5號出口');
check('釘選的植物園卡片排在古亭前面', idxPlant >= 0 && idxGu >= 0 && idxPlant < idxGu);
check('釘選卡片顯示 pinned 樣式', html2.includes('pin-btn pinned'));

// 6) togglePin 切換（模擬點按鈕）
const btn = { getAttribute: k => (k === 'data-pin' ? '🚇 古亭站5號出口 ➔ 🚌 295 公車' : null) };
togglePin(btn);
const pinsAfter = JSON.parse(store.get('commute_pins'));
check('togglePin 新增釘選', pinsAfter.includes('🚇 古亭站5號出口 ➔ 🚌 295 公車'));

// 7) UI 有勾選框
check('HTML 有 showDirectToggle 勾選框', html.includes('id="showDirectToggle"'));

console.log(`\n結果: ${pass} 過 / ${fail} 掛`);
process.exit(fail ? 1 : 0);
