"""拆分 data.js - gujiData 是对象 {} 不是数组 []"""
import json, os, re

SRC = '/Users/yonghan/Documents/trae_projects/test2/web-app/data.js'
OUT_DIR = '/Users/yonghan/Documents/trae_projects/test2/web-app'

with open(SRC, 'r', encoding='utf-8') as f:
    c = f.read()

# 在 analyze_data2.py 中看到：gujiData: 1.4M~73.6M (208MB)
# 变量声明是 "gujiData = {" 而不是 "const gujiData = ["
guji_start = c.find('gujiData ')
print(f'gujiData 起始字符位置: {guji_start}')

# 确认声明格式
decl = c[guji_start:guji_start+30]
print(f'声明前30字: {repr(decl)}')

# 找到 { 的位置
obj_start = c.find('{', guji_start)
print(f'{{ 位置: {obj_start} (偏移 {obj_start-guji_start})')

# 用状态机找到配对的 }
depth = 0; in_s = False; esc = False; obj_end = obj_start
while obj_end < len(c):
    ch = c[obj_end]
    if esc: esc = False
    elif ch == '\\' and in_s: esc = True
    elif ch == '"': in_s = not in_s
    elif not in_s:
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0: break
    obj_end += 1

print(f'}} 位置: {obj_end}')
inner = c[obj_start:obj_end+1]
print(f'gujiData JSON: {len(inner)} 字符, {len(inner.encode("utf-8"))/1024/1024:.0f}MB')

try:
    guji_obj = json.loads(inner)
    print(f'gujiData 顶层键数: {len(guji_obj)}')
    for k in guji_obj:
        if isinstance(guji_obj[k], dict):
            print(f'  {k}: {len(guji_obj[k])} 子键')
        elif isinstance(guji_obj[k], list):
            print(f'  {k}: {len(guji_obj[k])} 项')
        else:
            print(f'  {k}: {type(guji_obj[k]).__name__}')
except Exception as e:
    print(f'JSON 解析失败: {e}')
    import sys; sys.exit(1)

# 按顶层键拆分 - 史部(199MB)需要进一步划分
keys = list(guji_obj.keys())
print(f'\n顶层键: {keys}')
print(f'  经部: {len(json.dumps(guji_obj["经部"], ensure_ascii=False).encode("utf-8"))/1024/1024:.0f}MB ({len(guji_obj["经部"])} 子键)')
print(f'  史部: {len(json.dumps(guji_obj["史部"], ensure_ascii=False).encode("utf-8"))/1024/1024:.0f}MB ({len(guji_obj["史部"])} 子键)')
print(f'  子部: {len(json.dumps(guji_obj["子部"], ensure_ascii=False).encode("utf-8"))/1024/1024:.0f}MB ({len(guji_obj["子部"])} 子键)')
print(f'  集部: {len(json.dumps(guji_obj["集部"], ensure_ascii=False).encode("utf-8"))/1024/1024:.0f}MB ({len(guji_obj["集部"])} 子键)')

# 史部子键
shi_keys = list(guji_obj["史部"].keys())
print(f'\n史部子键: {shi_keys}')
shikey_sizes = []
for k in shi_keys:
    sz = len(json.dumps(guji_obj["史部"][k], ensure_ascii=False).encode('utf-8'))
    shikey_sizes.append((k, sz))
    print(f'  {k}: {sz/1024/1024:.0f}MB')

# 分3份，每份 < 100MB
# 按大小累积分组
groups = []  # list of list of keys
current = []
current_size = 0
for k, sz in shikey_sizes:
    if current_size + sz > 100 * 1024 * 1024 and current:
        groups.append(current)
        current = [k]
        current_size = sz
    else:
        current.append(k)
        current_size += sz
if current:
    groups.append(current)

print(f'\n史部分为 {len(groups)} 组:')
for i, g in enumerate(groups):
    gsize = sum(sz for k, sz in shikey_sizes if k in g)
    print(f'  第{i+1}组: {g} ({gsize/1024/1024:.0f}MB)')

# 总文件数：referencePoems... + gujiData(经/子/集) + gujiData史部(第1组) + gujiData史部(第2/3组)
# 简化：Part1 = referencePoems + 函数 + gujiData(经/子/集)
#       Part2 = gujiData史部前N组  
#       Part3 = gujiData史部后M组 + mingjuList + 剩余函数

before = c[:guji_start]
after = c[obj_end+1:]

# Part1: 经+子+集 = 8MB
p1_obj = {"经部": guji_obj["经部"], "子部": guji_obj["子部"], "集部": guji_obj["集部"]}
p1_json = json.dumps(p1_obj, ensure_ascii=False)

# 史部第一组
shi1 = {k: guji_obj["史部"][k] for k in groups[0]}
shi1_json = json.dumps(shi1, ensure_ascii=False)

# 剩余史部组
remaining_obj = {"史部": {}}
for g in groups[1:]:
    for k in g:
        remaining_obj["史部"][k] = guji_obj["史部"][k]
remaining_json = json.dumps(remaining_obj, ensure_ascii=False)

# 构建最终文件
p1 = before + f'var gujiData = {p1_json};\n'
# 史部第一组追加到 gujiData
p2 = f'gujiData["史部"] = Object.assign({{}}, gujiData["史部"], {shi1_json});\n'
# 剩余史部 + mingjuList + 函数
p3 = f'Object.assign(gujiData["史部"], {remaining_json}["史部"]);\n' + after

for name, content in [('data_part1.js', p1), ('data_part2.js', p2), ('data_part3.js', p3)]:
    sz = len(content.encode('utf-8'))
    print(f'{name}: {sz/1024/1024:.0f}MB')
    
with open(os.path.join(OUT_DIR, 'data_part1.js'), 'w', encoding='utf-8') as f:
    f.write(p1)
with open(os.path.join(OUT_DIR, 'data_part2.js'), 'w', encoding='utf-8') as f:
    f.write(p2)
with open(os.path.join(OUT_DIR, 'data_part3.js'), 'w', encoding='utf-8') as f:
    f.write(p3)
