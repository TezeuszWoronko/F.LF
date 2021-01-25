import json
import re
import os

types = {
    0: 'character',
    1: 'lightweapon',
    2: 'heavyweapon',
    3: 'specialattack',
    4: 'effect',
    5: 'broken',
    6: 'beer'
}

def map_type(obj_id, obj_type, file_name):
    obj = {
        'id': obj_id,
        'type': types[obj_type],
        'file': f"data/{file_name.replace('.dat', '.js')}"
    }
    if obj_type == 0:
        obj['name'] = file_name.replace('.dat', '')
        obj['pic'] = f"sprite/{file_name.replace('.dat', '_f.png')}"
    return obj


with open('data.txt') as f:

    for line in f:
        if '<object_end' in line:
            break
        if not line.startswith('id: '):
            continue
        prev = line.split('id:')[1].strip()
        char_id, prev = prev.split('type:')
        char_id = int(char_id.strip())
        type_id, prev = prev.split('file:')
        type_id = int(type_id.strip())
        file_name = prev.strip().split('\\')[-1].split('#')[0].strip()
        print(json.dumps(map_type(char_id, type_id, file_name)) + ',')
        # print(char_id, type_id, file_name, )
        