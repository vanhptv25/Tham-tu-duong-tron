'use strict';
(()=>{
 let token=sessionStorage.getItem('circle_game_player_'+code)||'';
 let view=null,ticking=null,lastDraw='',soundEnabled=true,audio=null,offset=0,answerPending=false;
 const endpoint='/api/rooms/'+code;
 const authApi=(op,method='GET',data)=>api(endpoint+'/'+op,{method,headers:{'X-Player-Token':token},...(data?{body:JSON.stringify(data)}:{})});
 function failure(message){$('fatal').textContent=message;$('fatal').classList.remove('hidden');showOnly(['entry','waiting','game','finished'],'NO_SECTION')}
 function ensureAudio(){if(!soundEnabled)return null;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;try{if(!audio)audio=new C();if(audio.state==='suspended')audio.resume();return audio}catch(e){return null}}
 function beep(f,t,d,type,vol){const c=ensureAudio();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(c.destination);o.start(t);o.stop(t+d+.02)}
 function sound(ok){const c=ensureAudio();if(!c)return;const t=c.currentTime+.02;if(ok){beep(660,t,.12,'triangle',.04);beep(880,t+.12,.17,'triangle',.05)}else{beep(330,t,.12,'sawtooth',.035);beep(220,t+.12,.2,'sawtooth',.03)}}
 function glow(part,focus){document.querySelectorAll('#scene [data-part]').forEach(el=>{const match=el.dataset.part===part;el.classList.toggle('dim',focus&&!match);el.classList.toggle('active',focus&&match&&part!=='tam'&&part!=='chuvi');el.classList.toggle('active-center',focus&&match&&part==='tam');if(part==='chuvi'&&match&&focus){el.setAttribute('style','stroke:#ef8e31;stroke-width:7;fill:#fff9ee')}else{el.removeAttribute('style')}})}
 function clock(){if(!view||!view.question||view.player.status!=='playing')return;const q=view.question;const used=Date.now()-offset-q.startedAt;const left=Math.max(0,q.seconds*1000-used);$('timerLabel').textContent=seconds(left);$('timerBar').style.width=(left/(q.seconds*1000)*100).toFixed(1)+'%';$('timerLabel').closest('.metric').classList.toggle('warning',left<=5000);if(left<=0&&!answerPending){answerPending=true;authApi('player').then(paint).catch(()=>{}).finally(()=>{answerPending=false})}}
 function newQuestion(q){
  $('chapter').textContent=q.round===1?'CHẶNG 1 · GỌI TÊN':'CHẶNG 2 · CHẠM ĐÚNG VỊ TRÍ';
  $('question').textContent=q.prompt;$('questionSub').textContent=q.round===1?'Nhìn hình, chọn tên của bộ phận tô cam.':'Chạm trực tiếp lên hình vào bộ phận được gọi tên.';
  $('boardHint').textContent=q.round===1?'Bộ phận được tô cam':'Tìm đúng bộ phận trên hình';
  $('options').replaceChildren();$('feedback').replaceChildren();$('nextBtn').classList.add('hidden');
  $('touchInstruction').classList.toggle('hidden',q.round===1);glow(q.part,q.round===1);
  if(q.round===1)q.options.forEach((name,i)=>{const b=document.createElement('button');b.className='choice';const k=document.createElement('span');k.className='key';k.textContent=String.fromCharCode(65+i);b.append(k,document.createTextNode(name));b.onclick=()=>respond(name);$('options').appendChild(b)});
 }
 async function respond(value){if(answerPending||!view||view.player.status!=='playing')return;answerPending=true;try{const result=await authApi('answer','POST',{value});paint(result)}catch(e){try{paint(await authApi('player'))}catch(err){alert(e.message)}}finally{answerPending=false}}
 function feedback(state){const f=state.feedback;if(!f)return;glow(f.part,true);
  const key=state.player.index+':'+f.correct+':'+f.timeout;
  if(lastDraw!==key)sound(f.correct);
  lastDraw=key;
  document.querySelectorAll('#options .choice').forEach(b=>{b.disabled=true;if(b.textContent.includes(f.correctName))b.classList.add('correct')});
  const box=document.createElement('div');box.className='feedbackbox '+(f.correct?'':'bad');const title=document.createElement('b');title.textContent=f.correct?'✅ Chính xác! +'+f.points+' điểm':f.timeout?'⏰ Hết giờ!':'💡 Chưa đúng!';const more=document.createElement('div');more.textContent=f.explanation+' · Trả lời trong '+seconds(f.elapsedMs);box.append(title,more);$('feedback').replaceChildren(box);$('touchInstruction').classList.add('hidden');$('nextBtn').classList.remove('hidden');$('nextBtn').textContent=state.player.index===11?'XEM KẾT QUẢ 🏆':'CÂU TIẾP THEO →'
 }
 function paint(state){
  view=state;offset=Date.now()-state.serverNow;$('roomBadge').textContent='Phòng '+code;
  const p=state.player;showOnly(['entry','waiting','game','finished'],p.status==='waiting'?'waiting':p.status==='finished'?'finished':state.room.status==='closed'?'finished':'game');
  if(p.status==='waiting'){
   $('waitingName').textContent=p.name;
   const ready=state.room.status==='active';$('waitNotice').textContent=ready?'Cô đã mở phòng! Em có thể bắt đầu.':state.room.status==='closed'?'Phòng đã kết thúc.':'Đang chờ cô bắt đầu phòng...';$('waitNotice').classList.toggle('go',ready);$('beginBtn').classList.toggle('hidden',!ready);return
  }
  if(p.status==='finished'||state.room.status==='closed'){
   $('finishName').textContent=(state.room.status==='closed'&&p.status!=='finished'?'Cô đã kết thúc lượt chơi. ':'')+'Học sinh: '+p.name;
   $('finalScore').textContent=p.score;$('finalCorrect').textContent=p.correct+'/'+p.answers;$('finalTime').textContent=seconds(p.answerMs);return
  }
  $('studentLabel').textContent=p.name;$('scoreLabel').textContent=p.score;$('countLabel').textContent=(p.index+1)+'/12';$('progressFill').style.width=(p.answers/12*100)+'%';
  const renderKey=p.index+':'+p.status;
  if(renderKey!==lastQuestion){lastQuestion=renderKey;if(p.status==='playing'){lastDraw='';newQuestion(state.question)}else{feedback(state)}}
  clock()
 }
 let lastQuestion='';
 async function initial(){
  if(!/^[A-Z2-9]{6}$/.test(code))return failure('Mã phòng không hợp lệ. Hãy trở lại trang chủ và nhập đúng mã phòng của cô.');
  $('roomBadge').textContent='Phòng '+code;
  try{const r=await api(endpoint+'/public');$('entryDetail').textContent=r.title+' · '+r.seconds+' giây/câu · '+statusName(r.status);if(r.status==='closed'&&!token)return failure('Phòng đã kết thúc. Hãy xin mã phòng mới của cô.');
   if(token){try{paint(await authApi('player'))}catch(e){token='';sessionStorage.removeItem('circle_game_player_'+code);showOnly(['entry','waiting','game','finished'],'entry')}}
   else showOnly(['entry','waiting','game','finished'],'entry');
  }catch(e){failure(e.message)}
  setInterval(sync,1600)
 }
 async function sync(){if(!token||answerPending||document.hidden)return;
  try{
   if(!view||view.player.status==='waiting'||view.player.status==='playing'||view.room.status==='active'){
    const r=await authApi('player');if(!view||r.player.status!==view.player.status||r.player.index!==view.player.index||r.room.status!==view.room.status){paint(r)}else{offset=Date.now()-r.serverNow;view=r}
   }
  }catch(e){$('roomBadge').textContent='Mất kết nối – thử lại...'}
 }
 $('joinForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('studentName').value.trim();if(!name)return;ensureAudio();$('joinBtn').disabled=true;$('joinError').textContent='';try{const data=await api(endpoint+'/join',{method:'POST',body:JSON.stringify({name})});token=data.token;sessionStorage.setItem('circle_game_player_'+code,token);paint(await authApi('player'))}catch(e){$('joinError').textContent=e.message}finally{$('joinBtn').disabled=false}});
 $('beginBtn').addEventListener('click',async()=>{ensureAudio();$('beginBtn').disabled=true;try{paint(await authApi('begin','POST'))}catch(e){alert(e.message)}finally{$('beginBtn').disabled=false}});
 $('nextBtn').addEventListener('click',async()=>{if(answerPending)return;answerPending=true;$('nextBtn').disabled=true;try{paint(await authApi('next','POST'))}catch(e){alert(e.message)}finally{answerPending=false;$('nextBtn').disabled=false}});
 document.querySelectorAll('[data-hit]').forEach(x=>x.addEventListener('click',()=>{if(view&&view.player.status==='playing'&&view.question.round===2)respond(x.dataset.hit)}));
 $('soundBtn').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('soundBtn').textContent=soundEnabled?'🔊 Âm thanh':'🔈 Tắt tiếng';if(soundEnabled)ensureAudio()});
 document.addEventListener('keydown',e=>{if(!view)return;if(view.player.status==='feedback'&&e.key==='Enter'){$('nextBtn').click();return}if(view.player.status==='playing'&&view.question.round===1&&'1234'.includes(e.key)){const b=$('options').querySelectorAll('.choice')[Number(e.key)-1];b?.click()}});
 ticking=setInterval(clock,90);initial()
})();
