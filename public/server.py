#!/usr/bin/env python3
"""Tham tu duong tron classroom server. Python stdlib HTTP + qrcode SVG."""
from __future__ import annotations
import csv
import io
import json
import os
import re
import secrets
import socket
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import qrcode
from qrcode.image.svg import SvgPathImage

BASE = Path(__file__).resolve().parent
PUBLIC = BASE / 'public'
DATA = Path(os.environ.get('QUIZ_DATA_FILE', str(BASE / 'data' / 'rooms.json')))
PORT = int(os.environ.get('PORT', '8080'))
LOCK = threading.RLock()
PARTS = ['tam', 'bankinh', 'duongkinh', 'daycung', 'tieptuyen', 'chuvi']
NAMES = {'tam':'Tâm','bankinh':'Bán kính','duongkinh':'Đường kính','daycung':'Dây cung','tieptuyen':'Tiếp tuyến','chuvi':'Chu vi'}
EXPLAIN = {
 'tam':'O là tâm đường tròn.',
 'bankinh':'OA là bán kính, nối tâm O với điểm A trên đường tròn.',
 'duongkinh':'BC là đường kính: hai đầu trên đường tròn và đi qua tâm O.',
 'daycung':'DE là dây cung được vẽ chéo: nối hai điểm trên đường tròn.',
 'tieptuyen':'Đường thẳng t là tiếp tuyến tại T, chỉ tiếp xúc với đường tròn ở T.',
 'chuvi':'Chu vi là độ dài đường bao quanh hình tròn.'
}
TASKS = [
 {'part':'tam', 'options':['Dây cung','Tâm','Bán kính','Đường kính']},
 {'part':'bankinh', 'options':['Tiếp tuyến','Dây cung','Bán kính','Đường kính']},
 {'part':'duongkinh', 'options':['Bán kính','Đường kính','Tiếp tuyến','Dây cung']},
 {'part':'daycung', 'options':['Dây cung','Chu vi','Đường kính','Bán kính']},
 {'part':'tieptuyen', 'options':['Chu vi','Dây cung','Bán kính','Tiếp tuyến']},
 {'part':'chuvi', 'options':['Bán kính','Tiếp tuyến','Chu vi','Tâm']},
 {'part':'bankinh'},{'part':'chuvi'},{'part':'tam'},{'part':'daycung'},{'part':'duongkinh'},{'part':'tieptuyen'}
]
ROOMS = {}
CODES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def ms(): return int(time.time() * 1000)
def iso(): return datetime.now(timezone.utc).isoformat(timespec='seconds')

def load():
    global ROOMS
    if DATA.exists():
        try:
            raw = json.loads(DATA.read_text(encoding='utf-8'))
            ROOMS = raw if isinstance(raw, dict) else {}
        except (ValueError, OSError):
            ROOMS = {}


def persist():
    DATA.parent.mkdir(parents=True, exist_ok=True)
    temp = DATA.with_name(DATA.name + '.tmp')
    temp.write_text(json.dumps(ROOMS, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    os.replace(temp, DATA)


def room_for(code):
    return ROOMS.get(code.upper())


def public_room(room):
    return {'code':room['code'],'title':room['title'],'status':room['status'], 'seconds':room['seconds'],'playerCount':len(room['players'])}


def player_for(room, token):
    for p in room['players'].values():
        if secrets.compare_digest(token, p['token']): return p
    return None


def order_players(room):
    return sorted(room['players'].values(), key=lambda p:(-p['score'],-p['correct'],p['answerMs'],p['name'].casefold()))


def safe_player(p):
    return {'id':p['id'],'name':p['name'],'status':p['status'],'index':p['index'], 'score':p['score'],'correct':p['correct'],'answerMs':p['answerMs'],'answers':len(p['answers'])}


def compute_stats(room):
    out=[]
    for idx, task in enumerate(TASKS):
        group=[(p,a) for p in room['players'].values() for a in p['answers'] if a['index']==idx]
        wrong=[p['name'] for p,a in group if not a['correct']]
        out.append({'number':idx+1,'part':NAMES[task['part']],
            'attempted':len(group),'correct':sum(a['correct'] for p,a in group),
            'wrong':len(wrong),'timeout':sum(a['timeout'] for p,a in group),
            'wrongNames':wrong[:12]})
    return out


def teacher_snapshot(room):
    players=[safe_player(p) for p in room['players'].values()]
    ranked=[safe_player(p) for p in order_players(room)]
    return {'room':public_room(room),'players':players,'ranking':ranked,'stats':compute_stats(room),'serverNow':ms(),
        'totals':{'joined':len(players),'finished':sum(p['status']=='finished' for p in players),
        'playing':sum(p['status'] in ('playing','feedback') for p in players),
        'answered':sum(len(p['answers']) for p in room['players'].values())}}


def mark_timeout(room, p):
    if p['status']=='playing' and ms()-p['qStartedAt'] >= room['seconds']*1000:
        append_answer(room,p,False,True,room['seconds']*1000)
        return True
    return False


def append_answer(room,p,correct,timeout,elapsed):
    idx=p['index']; task=TASKS[idx]
    if correct:
        points=100+max(0,int((room['seconds']*1000-elapsed)/(room['seconds']*1000)*50))
    else: points=0
    p['answers'].append({'index':idx,'correct':bool(correct),'timeout':bool(timeout),
          'elapsedMs':int(elapsed),'points':int(points),'part':task['part']})
    p['score']+=points
    p['correct']+=int(correct)
    p['answerMs']+=int(elapsed)
    p['status']='feedback'


def player_snapshot(room,p):
    question=None; last=None
    if p['status'] in ('playing','feedback') and p['index']<len(TASKS):
        task=TASKS[p['index']]
        question={'index':p['index'],'round':1 if p['index']<6 else 2,
            'part':task['part'] if p['index']<6 else None,
            'options':task.get('options',[]),
            'prompt':'Bộ phận tô màu cam là gì?' if p['index']<6 else 'Hãy chạm vào: '+NAMES[task['part']],
            'startedAt':p['qStartedAt'],'seconds':room['seconds']}
    if p['status']=='feedback' and p['answers']:
        last=dict(p['answers'][-1]);last['explanation']=EXPLAIN[TASKS[p['index']]['part']]
        last['correctName']=NAMES[TASKS[p['index']]['part']]
    return {'room':public_room(room),'player':safe_player(p),'question':question,'feedback':last,'serverNow':ms()}


class Handler(BaseHTTPRequestHandler):
    server_version='ThamTuCircle/2.0'
    def log_message(self, fmt, *args):
        if not self.path.startswith('/api/rooms/') or '/teacher' not in self.path:
            print('[%s] %s'%(iso(),fmt%args),flush=True)

    def send_blob(self, status, content, ctype, cache='no-store', more=None):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', cache)
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('X-Frame-Options','SAMEORIGIN')
        if more:
            for k,v in more.items():self.send_header(k,v)
        self.end_headers()
        try:self.wfile.write(content)
        except (BrokenPipeError,ConnectionResetError): pass

    def send_json(self, status, obj):
        self.send_blob(status, json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('utf-8'),'application/json; charset=utf-8')

    def fail(self, status, message):
        self.send_json(status, {'error':message})

    def parse_body(self):
        length=int(self.headers.get('Content-Length','0'))
        if length>10000 or length<0: raise ValueError('Dữ liệu quá dài.')
        raw=self.rfile.read(length)
        data=json.loads(raw or '{}')
        if not isinstance(data,dict):raise ValueError('Dữ liệu không đúng định dạng.')
        return data

    def require_room(self, code):
        room=room_for(code)
        if not room:self.fail(404,'Không tìm thấy mã phòng.');return None
        return room

    def require_teacher(self, room):
        token=self.headers.get('X-Teacher-Key','')
        if not token or not secrets.compare_digest(token, room['teacherKey']):
            self.fail(403,'Bạn không có quyền quản lý phòng này.');return False
        return True

    def require_player(self,room):
        p=player_for(room,self.headers.get('X-Player-Token',''))
        if p is None:self.fail(403,'Phiên học sinh không hợp lệ. Hãy tham gia lại.');return None
        return p

    def do_GET(self):
        path=urlsplit(self.path).path
        query=parse_qs(urlsplit(self.path).query)
        if path=='/api/health':return self.send_json(200,{'ok':True,'rooms':len(ROOMS)})
        if path=='/api/config':
            lan=''
            try:
                s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.connect(('192.0.2.1',80));lan=s.getsockname()[0];s.close()
            except OSError: pass
            return self.send_json(200, {'lanIp':lan,'port':PORT})
        match=re.fullmatch(r'/api/rooms/([A-Z2-9]{6})/(public|teacher|player|qr\.svg|export\.csv)',path)
        if match:
            code,op=match.groups()
            with LOCK:
                room=self.require_room(code)
                if not room:return
                if op=='public':return self.send_json(200,public_room(room))
                if op=='teacher':
                    if not self.require_teacher(room):return
                    changed=any(mark_timeout(room,p) for p in room['players'].values())
                    if changed:persist()
                    return self.send_json(200,teacher_snapshot(room))
                if op=='player':
                    p=self.require_player(room)
                    if not p:return
                    if mark_timeout(room,p):persist()
                    return self.send_json(200,player_snapshot(room,p))
                if op=='export.csv':
                    if not self.require_teacher(room):return
                    stream=io.StringIO(); writer=csv.writer(stream)
                    writer.writerow(['Ho va ten','Trang thai','Diem','So cau dung','Da tra loi','Thoi gian tra loi (giay)'] + ['Cau %d'%i for i in range(1,13)])
                    for p in order_players(room):
                        a_map={a['index']:a for a in p['answers']}
                        writer.writerow([p['name'],p['status'],p['score'],p['correct'],len(p['answers']),round(p['answerMs']/1000,2)]+[('Dung' if a_map[i]['correct'] else ('Het gio' if a_map[i]['timeout'] else 'Sai')) if i in a_map else '' for i in range(12)])
                    data=stream.getvalue().encode('utf-8-sig')
                    return self.send_blob(200,data,'text/csv; charset=utf-8',more={'Content-Disposition':f'attachment; filename="Ket_qua_duong_tron_{code}.csv"'})
                if op=='qr.svg':
                    origin=query.get('origin',[''])[0].strip()
                    # A QR is for a complete URL; its host can be a local network IP or a public HTTPS domain.
                    u=urlsplit(origin)
                    if u.scheme not in ('http','https') or not u.netloc or len(origin)>260 or u.username or u.password:
                        return self.fail(400,'Địa chỉ phòng không hợp lệ.')
                    url=origin.rstrip('/')+'/join?room='+code
                    image=qrcode.make(url,image_factory=SvgPathImage,box_size=7,border=2)
                    b=io.BytesIO();image.save(b)
                    return self.send_blob(200,b.getvalue(),'image/svg+xml; charset=utf-8')
        pages={'/':'index.html','/teacher':'teacher.html','/join':'student.html',
            '/assets/style.css':'style.css','/assets/shared.js':'shared.js',
            '/assets/teacher.js':'teacher.js','/assets/student.js':'student.js'}
        file=pages.get(path)
        if not file:return self.fail(404,'Không tìm thấy trang.')
        p=PUBLIC/file
        try:
            content=p.read_bytes()
            ctype=('text/html; charset=utf-8' if file.endswith('.html') else
                   'text/css; charset=utf-8' if file.endswith('.css') else 'application/javascript; charset=utf-8')
            return self.send_blob(200,content,ctype,cache='no-cache')
        except FileNotFoundError:return self.fail(404,'Không tìm thấy tài nguyên.')

    def do_POST(self):
        path=urlsplit(self.path).path
        try: data=self.parse_body()
        except (ValueError, json.JSONDecodeError) as exc:return self.fail(400,str(exc))
        with LOCK:
            if path=='/api/rooms':
                title=str(data.get('title','Lớp Toán 7')).strip()[:72] or 'Lớp Toán 7'
                try:seconds=int(data.get('seconds',15))
                except (ValueError, TypeError):return self.fail(400,'Thời gian phải là số hợp lệ.')
                if seconds not in (15,20,30):return self.fail(400,'Thời gian mỗi câu phải là 15, 20 hoặc 30 giây.')
                for _ in range(20):
                    code=''.join(secrets.choice(CODES) for i in range(6))
                    if code not in ROOMS:break
                else:return self.fail(503,'Không tạo được mã phòng. Vui lòng thử lại.')
                key=secrets.token_urlsafe(32)
                room={'code':code,'teacherKey':key,'title':title,'seconds':seconds,'status':'lobby', 'createdAt':iso(),'players':{}}
                ROOMS[code]=room;persist()
                return self.send_json(201,{'code':code,'teacherKey':key,'room':public_room(room)})
            m=re.fullmatch(r'/api/rooms/([A-Z2-9]{6})/(join|start|close|begin|answer|next)',path)
            if not m:return self.fail(404,'Không tìm thấy thao tác.')
            code,op=m.groups();room=self.require_room(code)
            if not room:return
            if op in ('start','close'):
                if not self.require_teacher(room):return
                if op=='start':
                    if room['status']!='lobby':return self.fail(409,'Phòng đã bắt đầu hoặc đã đóng.')
                    room['status']='active'
                else:room['status']='closed'
                persist();return self.send_json(200,teacher_snapshot(room))
            if op=='join':
                if room['status']=='closed':return self.fail(409,'Phòng đã kết thúc.')
                name=' '.join(str(data.get('name','')).strip().split())
                if len(name)<2 or len(name)>60 or any(ord(c)<32 for c in name):
                    return self.fail(400,'Nhập họ tên từ 2 đến 60 ký tự.')
                if len(room['players'])>=150:return self.fail(409,'Phòng đã đủ 150 học sinh.')
                if any(p['name'].casefold()==name.casefold() for p in room['players'].values()):
                    return self.fail(409,'Tên này đã có trong phòng. Hãy thêm lớp hoặc số thứ tự.')
                pid=secrets.token_hex(7)
                token=secrets.token_urlsafe(28)
                p={'id':pid,'token':token,'name':name,'status':'waiting','index':0,'qStartedAt':0,
                   'score':0,'correct':0,'answerMs':0,'answers':[],'joinedAt':iso()}
                room['players'][pid]=p;persist()
                return self.send_json(201,{'token':token,'player':safe_player(p),'room':public_room(room)})
            p=self.require_player(room)
            if not p:return
            if room['status']!='active':return self.fail(409,'Phòng chưa bắt đầu hoặc đã đóng.')
            if op=='begin':
                if p['status']!='waiting':return self.fail(409,'Học sinh đã bắt đầu lượt chơi.')
                p['status']='playing';p['qStartedAt']=ms()
                persist();return self.send_json(200,player_snapshot(room,p))
            if op=='answer':
                if p['status']!='playing':return self.fail(409,'Câu hỏi đã được trả lời hoặc chưa bắt đầu.')
                elapsed=ms()-p['qStartedAt']
                if elapsed>=room['seconds']*1000:
                    append_answer(room,p,False,True,room['seconds']*1000)
                else:
                    task=TASKS[p['index']]
                    value=str(data.get('value',''))
                    # Only accept allowed choices for round 1, and identified parts for round 2.
                    if p['index']<6:
                        if value not in task['options']:return self.fail(400,'Lựa chọn không hợp lệ.')
                        ok=value==NAMES[task['part']]
                    else:
                        if value not in PARTS:return self.fail(400,'Vị trí chọn không hợp lệ.')
                        ok=value==task['part']
                    append_answer(room,p,ok,False,max(0,elapsed))
                persist();return self.send_json(200,player_snapshot(room,p))
            if op=='next':
                if p['status']!='feedback':return self.fail(409,'Em cần trả lời câu hiện tại trước.')
                p['index']+=1
                if p['index']>=len(TASKS):p['status']='finished';p['qStartedAt']=0
                else:p['status']='playing';p['qStartedAt']=ms()
                persist();return self.send_json(200,player_snapshot(room,p))


def main():
    load()
    server=ThreadingHTTPServer(('0.0.0.0',PORT),Handler)
    server.daemon_threads=True
    print(f'Tham tu duong tron listening on http://localhost:{PORT}',flush=True)
    try:server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
