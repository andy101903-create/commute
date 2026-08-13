# -*- coding: utf-8 -*-
# 1) 295/949 古亭→自來水處(辛亥) 可行性
# 2) 自來水處(辛亥)→基隆長興街口 步行距離（OSRM）
import urllib.request, urllib.parse, json, time, ssl

BASE = 'https://tdx.transportdata.tw/api/basic/v2'

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    raw = urllib.request.urlopen(req, timeout=45).read().decode('utf-8', errors='replace')
    try:
        return json.loads(raw)
    except Exception:
        return {'_raw': raw[:200]}

def stops_of(route):
    url = BASE + '/Bus/StopOfRoute/City/Taipei?$filter=' + urllib.parse.quote(f"RouteName/Zh_tw eq '{route}'") + '&$format=JSON'
    return get(url)

# 收集 295/949 的 古亭 / 自來水處(辛亥) / 基隆長興街口 位置與順序
info = {}
for rn in ['295', '949']:
    d = stops_of(rn)
    for rec in d if isinstance(d, list) else []:
        dr = rec.get('Direction')
        stops = rec.get('Stops') or []
        seqmap = {}
        for i, s in enumerate(stops):
            nm = (s.get('StopName') or {}).get('Zh_tw', '')
            pos = (s.get('StopPosition') or {}).get('PositionLat'), (s.get('StopPosition') or {}).get('PositionLon')
            seqmap[nm] = (i, pos)
        g = [k for k in seqmap if '古亭' in k]
        w = [k for k in seqmap if '自來水處(辛亥)' in k]
        if g and w:
            for gk in g:
                gi, _ = seqmap[gk]
                for wk in w:
                    wi, _ = seqmap[wk]
                    ok = gi < wi
                    info[f'{rn} dir{dr} {gk}->{wk}'] = (ok, gi, wi, seqmap[gk][1], seqmap[wk][1])
                    print(f'{rn} dir{dr}: {gk}#{gi} -> {wk}#{wi} 可行={ok}')

# 座標：基隆長興街口（參考）
d = stops_of('907')
for rec in d if isinstance(d, list) else []:
    for s in rec.get('Stops') or []:
        nm = (s.get('StopName') or {}).get('Zh_tw', '')
        if nm == '基隆長興街口':
            p = s.get('StopPosition') or {}
            print('基隆長興街口 座標:', p.get('PositionLat'), p.get('PositionLon'))
            raise SystemExit
