'use strict';
// Additional shed controls; preserve the original register, group settings and pen picker.
const originalCalfIcon=calfIcon,originalGroupButtons=groupButtons,originalPenCalfPicker=penCalfPicker;
calfIcon=function(type){
 if(type!=='Mixed')return originalCalfIcon(type);
 return '<svg class="calf-icon" viewBox="0 0 32 24" aria-hidden="true"><path fill="#171c19" d="M6 9 4 6 2 7l3 5 1 5 2 1v5h3l1-5h7l1 5h3l1-7 4-1 3-3-1-4-3-1-1-3-3 2-2 3H6z"/><path fill="#fff" d="M6 9 4 6 2 7l3 5 1 5 2 1v5h3l1-5h5V8h-5z"/><circle cx="27" cy="10" r=".85" fill="#fff"/></svg>';
};
groupButtons=function(z){
 if(tab!=='Map'||mapPage!=='shed'||editing)return originalGroupButtons(z);
 if(z.strawStorage)return '';
 const groups=data.groups.filter(g=>g.zone===z.id),count=groups.reduce((n,g)=>n+groupHeadcount(g),0);
 if(!count)return '';
 const types=[...new Set(groups.filter(g=>groupHeadcount(g)>0).map(groupType))];
 return '<span class="group pen-headcount">'+calfIcon(types.length===1?types[0]:'Mixed')+'<span>'+count+'</span></span>';
};
penCalfPicker=function(zoneId,keepMultiple=false){
 originalPenCalfPicker(zoneId,keepMultiple);
 const dialog=$('dialog');
 if(!dialog.open||!by(data.zones,zoneId))return;
 const action=document.createElement('button');
 action.type='button';action.textContent='Show Calves in Pen';action.className='primary';
 action.addEventListener('click',()=>showPenCalvesEnhanced(zoneId));
 dialog.querySelector('form')?.insertBefore(action,dialog.querySelector('#pen-calf-results'));
};
function showPenCalvesEnhanced(zoneId){
 const zone=by(data.zones,zoneId);if(!zone||zone.kind!=='Pen'||zone.strawStorage)return;
 const ids=new Set(data.groups.filter(g=>g.zone===zoneId).map(g=>g.id));
 const calves=data.calves.filter(c=>ids.has(c.group)&&!c.weaned&&!c.deathDate).sort((a,b)=>String(a.tag).localeCompare(String(b.tag),undefined,{numeric:true}));
 const items=calves.map(c=>'<div class="card row pen-list-row" data-list-calf="'+esc(c.id)+'" data-source-pen="'+esc(zoneId)+'"><strong>Calf '+esc(c.tag)+'</strong><small>Hold to move</small></div>').join('');
 show(zone.name+' · '+calves.length+' calves','<p class="hint">Hold a calf, drag onto another pen and release to move it.</p>'+(items||'<p>No individual calves recorded in this pen yet.</p>')+'<button type="button" id="back-to-pen-picker">Back to Add Calf</button>');
 $('back-to-pen-picker').onclick=()=>penCalfPicker(zoneId);
}
let enhancedHold=null,enhancedDrag=null;
function clearEnhancedHold(){if(enhancedHold?.timer)clearTimeout(enhancedHold.timer);enhancedHold=null}
document.addEventListener('pointerdown',e=>{
 const item=e.target.closest('[data-list-calf]');
 if(!item||!e.isPrimary||e.button!==0)return;
 clearEnhancedHold();
 const pointer=e.pointerId,x=e.clientX,y=e.clientY,calfId=item.dataset.listCalf,sourcePen=item.dataset.sourcePen;
 enhancedHold={pointer,x,y};
 enhancedHold.timer=setTimeout(()=>{
  enhancedHold=null;
  if(!by(data.calves,calfId))return;
  enhancedDrag={pointer,calfId,sourcePen,x,y};
  if($('dialog').open)$('dialog').close();
  try{$('view').setPointerCapture(pointer)}catch{}
  const ghost=document.createElement('div');ghost.className='ghost';
  ghost.textContent='Calf '+by(data.calves,calfId).tag;
  document.body.append(ghost);enhancedDrag.ghost=ghost;
  ghost.style.left=x+'px';ghost.style.top=y+'px';
 },380);
},true);
document.addEventListener('pointermove',e=>{
 if(enhancedHold?.pointer===e.pointerId&&Math.hypot(e.clientX-enhancedHold.x,e.clientY-enhancedHold.y)>12)clearEnhancedHold();
 if(!enhancedDrag||enhancedDrag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopImmediatePropagation();
 enhancedDrag.x=e.clientX;enhancedDrag.y=e.clientY;
 enhancedDrag.ghost.style.left=e.clientX+'px';enhancedDrag.ghost.style.top=e.clientY+'px';
 const dest=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]')?.dataset.zone;
 const target=by(data.zones,dest);
 document.querySelectorAll('#board polygon.target').forEach(p=>p.classList.remove('target'));
 if(target?.kind==='Pen'&&!target.strawStorage&&dest!==enhancedDrag.sourcePen)
  [...document.querySelectorAll('#board polygon[data-zone]')].find(p=>p.dataset.zone===dest)?.classList.add('target');
},true);
for(const eventName of ['pointerup','pointercancel'])document.addEventListener(eventName,e=>{
 if(enhancedHold?.pointer===e.pointerId)clearEnhancedHold();
 if(!enhancedDrag||enhancedDrag.pointer!==e.pointerId)return;
 e.stopImmediatePropagation();e.preventDefault();
 const current=enhancedDrag;enhancedDrag=null;current.ghost.remove();
 document.querySelectorAll('#board polygon.target').forEach(p=>p.classList.remove('target'));
 if(eventName!=='pointerup')return;
 const dest=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]')?.dataset.zone;
 const target=by(data.zones,dest),calf=by(data.calves,current.calfId),oldGroup=calf&&by(data.groups,calf.group);
 if(!target||target.kind!=='Pen'||target.strawStorage||dest===current.sourcePen||!calf||calf.weaned||calf.deathDate){
  say('Calf not moved. Drop onto a different pen.');return;
 }
 const candidates=data.groups.filter(g=>g.zone===dest);
 const receiving=candidates.find(g=>g.autoPenGroup)||candidates.find(g=>groupType(g)===(calf.type==='Beef'?'Beef':'Dairy'))||candidates[0];
 const groupId=receiving?.id??id(),groupName=receiving?.name??('Pen group - '+target.name);
 commit(next=>{
  const c=by(next.calves,calf.id),from=by(next.groups,c.group);
  if(from?.headcount!=null)from.headcount=Math.max(0,from.headcount-1);
  let to=by(next.groups,groupId);
  if(!to){to={id:groupId,name:groupName,type:c.type==='Beef'?'Beef':c.type==='Mixed'?'Mixed':'Dairy',zone:dest,autoPenGroup:true};next.groups.push(to)}
  if(to.headcount!=null)to.headcount+=1;
  c.group=groupId;
  next.moves.push({group:groupName,from:by(next.zones,from?.zone)?.name??'Ungrouped',to:target.name,count:1,at:new Date().toISOString()});
 },'Calf '+calf.tag+' moved to '+target.name+'.');
},true);
