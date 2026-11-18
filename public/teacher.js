'use strict';
(()=>{
 const key=new URLSearchParams(location.hash.replace(/^#/, '')).get('key')||'';
 let roomData=null,joinAddress='',busy=false;
 const teacherApi=(path,method='GET')=>api('/api/rooms/'+code+'/'+path,{method,headers:{'X-Teacher-Key':key}});
 const fatal=(text)=>{$('fatal').textContent=text;$('fatal').classList.remove('hidden');$('dashboard').classList.add('hidden')};
 if(!/^[A-Z2-9]{6}$/.test(code)||!key){fatal('Thiếu mã phòng hoặc khóa của giáo viên. Hãy tạo phòng mới từ trang chủ.');return}
 function linkOrigin(){
  try {const u=new URL($('joinUrl').value);return u.origin}catch(e){return location.origin}
 }
 function setQR(){const origin=linkOrigin();joinAddress=origin+'/join?room='+encodeURIComponent(code);$('joinUrl').value=joinAddress;$('qr').src='/api/rooms/'+code+'/qr.svg?origin='+encodeURIComponent(origin)}
 function decorateStatus(s){$('status').textContent=statusName(s);$('status').className='status-chip '+(s==='active'?'live':s==='closed'?'closed':'');$('startBtn').disabled=s!=='lobby';$('closeBtn').disabled=s==='closed';$('roomHelp').textContent=s==='lobby'?'Học sinh có thể vào phòng; khi cả lớp sẵn sàng, bấm “Bắt đầu cho lớp”.':s==='active'?'Đang nhận câu trả lời và tính điểm trực tiếp.':'Phòng đã đóng. Kết quả vẫn hiển thị trên bảng điều khiển.'}
 function buildRows(snapshot){
  const tbody=$('studentRows');tbody.replaceChildren();
  const players=[...snapshot.players].sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  if(!players.length)emptyRow(tbody,5,'Chưa có học sinh nào vào phòng. Hãy chiếu mã QR cho lớp.');
  players.forEach(p=>{
   const tr=document.createElement('tr');addTextCell(tr,p.name,'name-cell');const td=addTextCell(tr,statusName(p.status));td.innerHTML='';const tag=document.createElement('span');tag.textContent=statusName(p.status);tag.className='tag-pill '+(p.status==='finished'?'done':p.status==='waiting'?'waiting':'');td.appendChild(tag);
   const prog=addTextCell(tr,`${p.answers}/12`);const bar=document.createElement('div');bar.className='inline-bar';const span=document.createElement('i');span.style.width=(p.answers/12*100)+'%';bar.appendChild(span);prog.appendChild(bar);
   addTextCell(tr,p.score,'rank-strong');addTextCell(tr,`${p.correct}/${p.answers}`);tbody.appendChild(tr)
  });
  const err=$('errorRows');err.replaceChildren();snapshot.stats.forEach(t=>{
   const tr=document.createElement('tr');addTextCell(tr,t.number);addTextCell(tr,t.part);addTextCell(tr,t.attempted);addTextCell(tr,t.correct,'good-flag');addTextCell(tr,t.wrong,t.wrong?'weak-flag':'');addTextCell(tr,t.timeout,t.timeout?'weak-flag':'');addTextCell(tr,t.wrongNames.join(', ')||'–');err.appendChild(tr)
  });
  const rank=$('rankingRows');rank.replaceChildren();if(!snapshot.ranking.length)emptyRow(rank,6,'Chưa có kết quả.');
  snapshot.ranking.forEach((p,i)=>{const tr=document.createElement('tr');addTextCell(tr,(i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)) );addTextCell(tr,p.name,'name-cell');addTextCell(tr,p.score,'rank-strong');addTextCell(tr,p.correct+'/12');addTextCell(tr,seconds(p.answerMs));addTextCell(tr,p.answers+'/12');rank.appendChild(tr)})
 }
 function paint(data){roomData=data;$('classTitle').textContent=data.room.title;$('roomCode').textContent=code;decorateStatus(data.room.status);$('joined').textContent=data.totals.joined;$('playing').textContent=data.totals.playing;$('finished').textContent=data.totals.finished;$('answered').textContent=data.totals.answered;buildRows(data);$('dashboard').classList.remove('hidden');$('liveLabel').textContent='● Cập nhật lúc '+new Date().toLocaleTimeString('vi-VN')}
 async function refresh(){if(busy||document.hidden)return;busy=true;try{const s=await teacherApi('teacher');paint(s);$('fatal').classList.add('hidden')}catch(e){fatal(e.message)}finally{busy=false}}
 async function init(){
  $('roomCode').textContent=code;
  try {const config=await api('/api/config');let origin=location.origin;
   if(['localhost','127.0.0.1'].includes(location.hostname) && config.lanIp && !config.lanIp.startsWith('127.')){
     origin='http://'+config.lanIp+':'+location.port;
     $('networkHelp').textContent='Đang dùng địa chỉ Wi-Fi trong cùng mạng. Nếu học sinh quét không vào được, kiểm tra tường lửa hoặc thay ô link bằng địa chỉ HTTPS đã đăng web.'
   }else if(['localhost','127.0.0.1'].includes(location.hostname)){
     $('networkHelp').textContent='Địa chỉ localhost chỉ mở được trên máy giáo viên. Để học sinh quét QR từ điện thoại, cần dùng IP Wi-Fi của máy cô hoặc triển khai lên Internet.'
   }
   $('joinUrl').value=origin+'/join?room='+code;setQR()
  }catch(e){$('joinUrl').value=location.origin+'/join?room='+code;setQR()}
  await refresh();setInterval(refresh,1600);
 }
 $('joinUrl').addEventListener('change',setQR);
 $('copy').addEventListener('click',async()=>{setQR();try{await navigator.clipboard.writeText(joinAddress);$('copy').textContent='Đã sao chép!'}catch(e){$('joinUrl').select();$('copy').textContent='Chọn để sao chép'}setTimeout(()=>$('copy').textContent='Sao chép',1800)});
 $('downloadQR').addEventListener('click',async()=>{setQR();try{const res=await fetch($('qr').src);const img=await res.blob();const url=URL.createObjectURL(img);const a=document.createElement('a');a.href=url;a.download='QR_Tham_tu_duong_tron_'+code+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e){alert('Không tải được mã QR: '+e.message)}});
 $('startBtn').addEventListener('click',async()=>{if(!confirm('Bắt đầu phòng? Tất cả học sinh đã tham gia có thể bắt đầu lượt chơi.'))return;try{paint(await teacherApi('start','POST'))}catch(e){alert(e.message)}});
 $('closeBtn').addEventListener('click',async()=>{if(!confirm('Kết thúc phòng ngay? Học sinh sẽ không thể tiếp tục làm bài.'))return;try{paint(await teacherApi('close','POST'))}catch(e){alert(e.message)}});
 $('exportBtn').addEventListener('click',async()=>{try{const res=await fetch('/api/rooms/'+code+'/export.csv',{headers:{'X-Teacher-Key':key}});if(!res.ok)throw new Error('Không xuất được kết quả.');const data=await res.blob(),url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download='Ket_qua_Tham_tu_duong_tron_'+code+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e){alert(e.message)}});
 document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));['progressSection','errorsSection','rankSection'].forEach(x=>$(x).classList.toggle('hidden',x!==t.dataset.panel))}));
 init();
})();
