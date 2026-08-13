# -*- coding: utf-8 -*-
# 949 完整雙向站序（重新細查）
import urllib.request, urllib.parse, json

BASE = 'https://tdx.transportdata.tw/api/basic/v2'
url = BASE + '/Bus/StopOfRoute/City/Taipei?$filter=' + urllib.parse.quote("RouteName/Zh_tw eq '949'") + '&$format=JSON'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
d = json.loads(urllib.request.urlopen(req, timeout=45).read().decode('utf-8'))

print('回傳筆數:', len(d))
for rec in d:
    dr = rec.get('Direction')
    rname = (rec.get('RouteName') or {}).get('Zh_tw', '')
    sub = rec.get('SubRouteName') or {}
    stops = [(s.get('StopName') or {}).get('Zh_tw', '') for s in (rec.get('Stops') or [])]
    print(f'\n===== 949 dir{dr} ({len(stops)}站) SubRouteName={sub.get("Zh_tw","")} =====')
    print('完整站序:')
    for i, n in enumerate(stops):
        mark = ''
        if '古亭' in n or '辛亥' in n or '自來水' in n or '台電' in n:
            mark = '  <<<'
        print(f'  {i}: {n}{mark}')
