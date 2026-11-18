'use strict';
const $=id=>document.getElementById(id);
const getParams=()=>new URLSearchParams(location.search);
const code=(getParams().get('room')||'').toUpperCase();
async function api(url,opts={}){
 const response=await fetch(url,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
 let value;try {value=await response.json()}catch(e){throw new Error('Máy chủ không phản hồi đúng định dạng.')}
 if(!response.ok)throw new Error(value.error||'Không thể kết nối máy chủ.');return value;
}
function escapeText(str){return String(str||'')}
function statusName(status){return ({lobby:'Chờ bắt đầu',active:'Đang diễn ra',closed:'Đã kết thúc',waiting:'Chờ',playing:'Đang làm',feedback:'Đã trả lời',finished:'Hoàn thành'})[status]||status}
function seconds(ms){return (ms/1000).toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1})+' s'}
function showOnly(ids,active){ids.forEach(x=>$(x).classList.toggle('hidden',x!==active))}
function addTextCell(tr,value,cls){const td=document.createElement('td');td.textContent=String(value);if(cls)td.className=cls;tr.appendChild(td);return td}
function emptyRow(tbody,cols,msg){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=cols;td.textContent=msg;td.className='empty-table';tr.appendChild(td);tbody.appendChild(tr)}
