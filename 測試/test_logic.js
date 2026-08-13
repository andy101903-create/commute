// 測試：以 TDX 真實快照資料（2026-08-12 19:31 抓取）驗證修復後的計算邏輯
// 修復內容：公車方向改用 ROUTE_STOPS 站序表、捷運改用 StationTimeTable 時刻表
// 用法：node 測試/test_logic.js
const fs = require('fs');
const path = require('path');

const BASE = __dirname; // 測試/ 資料夾
const PROJECT = path.dirname(BASE);

// ---- DOM / browser stubs ----
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
global.localStorage = (() => {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
})();
global.setInterval = () => {};
global.setTimeout = setTimeout;

// 出發時間 = 現在（模擬 App 真實使用：自動跟隨現在）
const now = new Date();
el('depTime').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
el('walkCalib').value = '1.0';

// ---- 載入網頁裡的真正 JS ----
const html = fs.readFileSync(path.join(PROJECT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('script not found'); process.exit(1); }
eval(m[1]);

// ---- 載入快照資料（不再打 API，避免限流）----
const snap = JSON.parse(fs.readFileSync(path.join(BASE, 'tdx_snapshot.json'), 'utf8'));
const sched = JSON.parse(fs.readFileSync(path.join(BASE, 'sched_processed.json'), 'utf8'));

const routeNames = ['1', '907', '棕12', '棕22', '673', '綠11', '基隆路幹線', '254', '295副', '295', '907通勤'];
const etaCache = {};
for (const rn of routeNames) {
    etaCache[rn] = snap.bus.filter(r => (r.RouteName || {}).Zh_tw === rn);
    console.log(`route ${rn}: ${etaCache[rn].length} records`);
}

const nowMin = now.getHours() * 60 + now.getMinutes();
console.log(`\n現在時間: ${now.toLocaleTimeString('zh-TW', { hour12: false })} (min=${nowMin})`);

// ===== 1) 捷運時刻表 → 下一班（findNextTrain）=====
console.log('\n===== 1) 捷運下一班（時刻表）=====');
console.log('小南門 G11 南向 → 公館 G07:', JSON.stringify(findNextTrain(sched, 'G', 'G11', 'G07', 1, +1)));
console.log('小南門 G11 南向 → 台電大樓 G08:', JSON.stringify(findNextTrain(sched, 'G', 'G11', 'G08', 1, +1)));
console.log('小南門 G11 南向 → 古亭 G09:', JSON.stringify(findNextTrain(sched, 'G', 'G11', 'G09', 1, +1)));
console.log('公館 G07 北向 → 中正紀念堂 G10:', JSON.stringify(findNextTrain(sched, 'G', 'G07', 'G10', 0, -1)));
console.log('台電大樓 G08 北向 → G10:', JSON.stringify(findNextTrain(sched, 'G', 'G08', 'G10', 0, -1)));
console.log('古亭 G09 北向 → G10:', JSON.stringify(findNextTrain(sched, 'G', 'G09', 'G10', 0, -1)));
console.log('★桂林 龍山寺 BL10 東向 → 西門 BL11:', JSON.stringify(findNextTrain(sched, 'BL', 'BL10', 'BL11', 0, +1)));
console.log('★桂林 西門 G12 南向 → 公館 G07:', JSON.stringify(findNextTrain(sched, 'G', 'G12', 'G07', 1, +1)));

// ===== 2) 公車候選班次（比對台北等公車同源 ETA）=====
console.log('\n===== 2) 公車候選班次（正確方向）=====');
const cases = [
    ['去程 捷運公館站', '捷運公館站', '基隆長興街口'],
    ['去程 捷運公館站(綠11)', '捷運公館站', '自來水事業處'],
    ['去程 捷運台電大樓站', '捷運台電大樓站', '基隆長興街口'],
    ['去程 捷運古亭站(和平) 907', '捷運古亭站(和平)', '基隆長興街口'],
    ['去程 植物園', '植物園', '基隆長興街口'],
    ['去程 和平中華路口', '和平中華路口', '基隆長興街口'],
    ['回程 基隆長興街口', '基隆長興街口', '捷運公館站'],
    ['回程 自來水事業處(綠11)', '自來水事業處', '捷運公館站'],
    ['回程 長興街口→台電大樓', '基隆長興街口', '捷運台電大樓站'],
    ['回程 長興街口→古亭(杭州)', '基隆長興街口', '捷運古亭站(杭州)'],
    ['★桂林 桂林路站 673', '桂林路', '基隆長興街口'],
    ['★新 古亭站 295 → 自來水處(辛亥)', '捷運古亭站(和平)', '自來水處(辛亥)'],
    ['★新 公館圓環站 基隆路幹線/254', '公館', '基隆長興街口'],
    ['★新 古亭站 295副/907通勤', '捷運古亭站(和平)', '基隆長興街口'],
    ['★新 植物園 907通勤', '植物園', '基隆長興街口'],
];
for (const [label, board, dest] of cases) {
    const lines = [];
    for (const rn of routeNames) {
        const cands = findBusCandidates(etaCache[rn], rn, board, dest);
        if (!cands.length) continue;
        const show = cands.slice(0, 3).map(c => c.etaSec === null ? `無即時(status=${c.status})` : `${Math.ceil(c.etaSec / 60)}分${c.etaSec % 60}秒`).join(' / ');
        lines.push(`${rn}: ${show}`);
    }
    console.log(`◆ ${label}`);
    lines.forEach(l => console.log('   ' + l));
}

// ===== 3) 完整排名 =====
(async () => {
    const results = await computeMorning(nowMin, sched, etaCache);
    results.sort((a, b) => a.total - b.total);
    console.log('\n===== 3) 去程排名（現在出發）=====');
    results.forEach((r, i) => {
        console.log(`${i + 1}. [${Math.round(r.total)}分 → ${minToTimeStr(r.arrive)}] ${r.cardTitle}${r.est ? ' (⚠️推估)' : ' (即時)'}${r.missed ? ' (❌錯過)' : ''}`);
    });

    currentMode = 'evening';
    const evResults = await computeEvening(nowMin, sched, etaCache);
    evResults.sort((a, b) => a.total - b.total);
    console.log('\n===== 4) 回程排名（現在出發）=====');
    evResults.forEach((r, i) => {
        console.log(`${i + 1}. [${Math.round(r.total)}分 → ${minToTimeStr(r.arrive)}] ${r.cardTitle}${r.est ? ' (⚠️推估)' : ' (即時)'}${r.missed ? ' (❌錯過)' : ''}`);
    });
    currentMode = 'morning';
})();
