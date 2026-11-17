
'use strict';
const key='calf-paddock-v1';
const defaults={version:1,zones:[
 {id:'yard',name:'Arrival yard',kind:'Yard'},{id:'pen1',name:'Pen 1',kind:'Pen'},{id:'pen2',name:'Pen 2',kind:'Pen'},
 {id:'north',name:'North paddock',kind:'Paddock'},{id:'south',name:'South paddock',kind:'Paddock'},{id:'sick',name:'Sick pen',kind:'Pen'}
],groups:[],calves:[],moves:[]};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>crypto.randomUUID();
const today=()=>new Date().toLocaleDateString('sv-SE');
const by=(rows,key)=>rows.find(row=>row.id===key);
let penHoldTimer=null,penHoldStart=null,penHoldTriggered=false,calfDrag=null,penMultiAdd=false;
let storageLoadFailed=false;
let data=structuredClone(defaults),tab='Map',editing=false,query='',drag,mapPage='farm',draft,shedPlacement,shedDrag;
try {const saved=localStorage.getItem(key);if(saved)data=JSON.parse(saved)} catch {storageLoadFailed=true;say('Saved records could not be loaded. They have been left untouched. Use Records to restore a backup.');}
cleanShedLocations(data);
mapPage=farmHome();
function cleanShedLocations(records){
 const name=z=>z.name.trim().toLowerCase().replace(/\s+/g,' ');
 records.zones=records.zones.filter(z=>{
  if(z.kind!=='Pen')return true;
  if(z.id==='sick')return records.groups.some(g=>g.zone===z.id);
  if(z.shape||!['pen 11','pen 12'].includes(name(z)))return true;
  const outlined=records.zones.filter(other=>other.kind==='Pen'&&other.shape&&name(other)===name(z));
  if(outlined.length!==1)return true;
  for(const group of records.groups){
   if(group.zone===z.id)group.zone=outlined[0].id;
  }
  return false;
 });
}
function farmHome(){return data.shedOutline||data.zones.some(z=>z.separateImage)?'overview':'farm'}
const shedFootprint=()=>({id:'shed-footprint',name:'Shed',shape:data.shedOutline});
function say(message){$('status').textContent=message}
function commit(change,message){
 const next=structuredClone(data);
 change(next);
 cleanShedLocations(next);
 try{localStorage.setItem(key,JSON.stringify(next))}catch{say('Could not save. Check your browser storage.');return false}
 data=next;render();say(message);return true;
}
function button(label,action,value='',primary=false){return '<button type="button" data-action="'+esc(action)+'" data-id="'+esc(value)+'"'+(primary?' class="primary"':'')+'>'+esc(label)+'</button>'}
function option(value,label,selected){return '<option value="'+esc(value)+'"'+(value===selected?' selected':'')+'>'+esc(label)+'</option>'}
function field(label,html){return '<label>'+esc(label)+html+'</label>'}
function input(name,value='',props=''){return '<input name="'+name+'" value="'+esc(value)+'" '+props+'>'}
function select(name,options){return '<select name="'+name+'">'+options+'</select>'}
function outstanding(c){return c.health.filter(h=>h.follow && !h.done)}
function due(h){return h.follow<=today()}
function groupCalves(g){return data.calves.filter(c=>c.group===g && !c.weaned&&!c.deathDate)}
function groupHeadcount(g){return g.headcount??groupCalves(g.id).length}
function addDays(date,days){
 const value=new Date(date+'T00:00:00Z');
 value.setUTCDate(value.getUTCDate()+days);
 return value.toISOString().slice(0,10);
}
function vaccinationWindow(g){
 if(!g.firstVaccinated||g.vaccinated>g.firstVaccinated)return null;
 return [addDays(g.firstVaccinated,28),addDays(g.firstVaccinated,42)];
}
function vaccinationStart(g){return g.vaccinationDue||vaccinationWindow(g)?.[0]||''}
function vaccinationDue(g){const start=vaccinationStart(g);return Boolean(start&&start<=today())}
function vaccinationLabel(g){
 const window=vaccinationWindow(g);
 if(g.vaccinationDue)return g.vaccinationDue;
 return window?window.join(' to '):'';
}
function vaccinationStatus(g){
 const window=vaccinationWindow(g);
 if(!g.vaccinationDue&&window&&today()>window[1])return 'Vaccination window passed';
 return vaccinationDue(g)?'Vaccination due':'Vaccination scheduled';
}
function render(){
 $('nav').innerHTML=['Map','Calves','Follow-ups','Records'].map(name=>'<button data-action="tab" data-id="'+name+'" aria-pressed="'+(name===tab)+'">'+name+'</button>').join('');
 const view=$('view');
 if(tab==='Map'){
  const count=data.calves.flatMap(outstanding).filter(due).length+data.groups.filter(vaccinationDue).length;
  const home=farmHome();
  const overview=mapPage==='overview';
  const farmZones=data.zones.filter(z=>z.kind!=='Pen');
  const zones=overview?overviewZones(farmZones):data.zones.filter(z=>mapFor(z)===mapPage);
  const section=mapPage==='shed'?'shed':home;
  const farmAreas=[['overview','Overview'],['farm','Main paddocks map'],...farmZones.filter(z=>z.separateImage).map(z=>[mapFor(z),z.name])];
  const locationRows=mapPage==='farm'?data.zones.filter(z=>z.kind!=='Pen'):zones;
  const image=mapPage==='shed'?null:data.images?.[mapPage];
  const unplaced=zones.filter(z=>!z.shape);
  view.innerHTML=farmRecoverySummary()+'<div class="stats"><span>'+data.groups.length+' groups</span><span>'+(data.groups.reduce((total,g)=>total+groupHeadcount(g),0)+data.calves.filter(c=>!c.group&&!c.weaned&&!c.deathDate).length)+' active calves</span><span>'+count+' checks due</span></div><h2>Farm map</h2><div class="actions map-tabs">'+mapTabs([[home,'Paddocks & yards'],['shed','Shed pens']],section)+'</div>'+
   (section!=='shed'&&home==='overview'?'<div class="actions map-tabs" role="group" aria-label="Paddocks and yards maps">'+mapTabs(farmAreas,mapPage)+'</div>':'')+
   '<p class="hint">'+(editing?(overview?'Drag a paddock or shed to move it. Drag its corner to resize. Changes save when you release.':'Draw or edit an outline for each location. You can add a reference image to this view.') :'Drag a group onto a pen or paddock, or tap it and choose a destination from any map. In the shed, press and hold a pen to find and add an existing calf.')+'</p><div class="actions">'+button('Add group','group','',true)+button(editing?'Done editing':'Edit layout','layout')+(editing&&!overview?button('Add location','zone')+(mapPage==='shed'?button('Align selected pens','align-selected-shed-pens')+(data.shedPenShapesBeforeSquare?button('Undo pen alignment','undo-square-shed-pens'):''):'')+(mapPage==='shed'?'':button(image?'Replace reference image':'Add reference image','image')+(image?button('Remove image','remove-image'):'')):'')+'</div>'+
   (overview?'<p class="hint">North is up · Distances are schematic</p>':'')+
   (overview||editing||image||zones.some(z=>z.shape)?drawBoard(zones,image,overview?1.25:undefined):'')+
   (editing&&!overview?'<h3>Locations</h3>'+
    (mapPage==='shed'?'<div class="card row"><strong>Shed footprint</strong>'+button(data.shedOutline?'Edit shed outline':'Draw shed outline','outline','shed-footprint')+'</div>':'')+
    locationRows.map(z=>'<div class="card row"><strong>'+esc(z.name)+'</strong><div>'+
    (mapFor(z)===mapPage?button('Edit details','zone',z.id)+(mapPage==='shed'&&z.kind==='Pen'&&(z.strawStorage||/^Pen\s*\d+$/i.test(z.name))?button(z.strawStorage?'Restore pen':'Change to straw','toggle-straw',z.id):'')+button(z.shape?'Edit outline':'Draw outline','outline',z.id)+(!draft&&mapPage==='farm'&&!z.shape?button('Add separate image','separate-image',z.id):''):button('Open map','map-page',mapFor(z)))+
    '</div></div>').join(''):'')+
   (unplaced.length?'<h3>'+ (zones.some(z=>z.shape)?'Locations without outlines':'Locations')+'</h3><div class="map">'+unplaced.map(z=>'<section class="zone" data-zone="'+esc(z.id)+'" data-kind="'+esc(z.kind)+'"><small>'+esc(z.kind)+'</small><h3>'+esc(z.name)+'</h3>'+groupButtons(z)+'</section>').join('')+'</div>':'');
 }else if(tab==='Calves'){
  view.innerHTML='<h2>Calf register</h2><div class="actions">'+button('Add calf','calf','',true)+button('Assign calf range','assign-range')+(data.lastCalfRangeAssignment?button('Undo last range assignment','undo-range'):'')+button('Import daily note','import-calves')+button('2026 register details','register-details')+'</div>'+registerSummary()+'<input class="search" id="search" placeholder="Search ear tags" aria-label="Search ear tags" value="'+esc(query)+'"><div id="calf-list"></div>';renderCalves();
 }else if(tab==='Follow-ups'){
  const tasks=data.calves.flatMap(c=>outstanding(c).map(h=>({c,h}))).sort((a,b)=>a.h.follow.localeCompare(b.h.follow));
  const vaccinations=data.groups.filter(vaccinationStart).sort((a,b)=>vaccinationStart(a).localeCompare(vaccinationStart(b)));
  const groupTasks=vaccinations.map(g=>'<article class="card"><div class="row"><strong>'+esc(groupType(g)+' Group '+groupNumber(g)+' · '+g.name)+'</strong>'+button('Open group','open-group',g.id)+'</div><p class="'+(vaccinationDue(g)?'alert':'')+'">'+esc(vaccinationStatus(g)+' · '+vaccinationLabel(g))+'</p></article>').join('');
  view.innerHTML='<h2>Health follow-ups</h2><p class="hint">Due and upcoming calf checks and group vaccinations.</p>'+(groupTasks+tasks.map(({c,h})=>'<article class="card"><div class="row"><strong>Tag '+esc(c.tag)+'</strong>'+button('Open calf','open-calf',c.id)+'</div><p class="'+(due(h)?'alert':'')+'">'+(due(h)?'Due · ':'Scheduled · ')+esc(h.follow)+'</p><p>'+esc(h.note)+'</p>'+button('Mark checked','checked',c.id+'|'+h.id)+'</article>').join('')||'<p class="hint">No open follow-ups.</p>');
 }else{
  view.innerHTML='<h2>Records and backup</h2><p class="hint">Records live in this browser. Export a backup to keep a copy or transfer to another device.</p><div class="actions">'+button('Export backup','export','',true)+button('Restore backup','restore')+button('Recover paddocks and groups','recover-farm')+'</div>'+farmRecoverySummary()+registerSummary()+'<h2>Deceased calves ('+data.calves.filter(c=>c.deathDate).length+')</h2>'+(data.calves.filter(c=>c.deathDate).sort((a,b)=>b.deathDate.localeCompare(a.deathDate)).map(c=>'<article class="card row"><div><strong>Tag '+esc(c.tag)+'</strong><p>'+esc(c.deathDate+' · '+(c.deathCause||'Cause not recorded'))+'</p></div>'+button('Edit record','edit-death',c.id)+'</article>').join('')||'<p class="hint">No deceased calves recorded.</p>')+'<h2>Group moves</h2>'+(data.moves.map((move,index)=>({move,index})).reverse().map(({move:m,index})=>'<article class="card"><strong>'+esc(m.group)+'</strong><p>'+esc(m.from)+' → '+esc(m.to)+' · '+m.count+' calves</p><small>'+esc(new Date(m.at).toLocaleString('en-AU'))+'</small><div class="actions">'+button('Delete move','delete-move',index)+'</div></article>').join('')||'<p class="hint">No group moves recorded.</p>');
 }
}
function mapTabs(pages,active){
 return pages.map(([page,name])=>'<button type="button" data-action="map-page" data-id="'+esc(page)+'" aria-pressed="'+(page===active)+'">'+esc(name)+'</button>').join('');
}
function mapFor(z){return z.mapArea??(z.separateImage?'location:'+z.id:z.kind==='Pen'?'shed':'farm')}
const groupTypes=['Dairy','Beef','Mixed'];
function groupType(g){
 return g.type??(/\bbeef\b/i.test(g.name)?'Beef':'Dairy');
}
function typeField(type){
 return field('Calf type',select('type',groupTypes.map(t=>option(t,t,type)).join('')));
}
function calfIcon(type){
 if(type==='Mixed')return calfIcon('Beef')+calfIcon('Dairy');
 const markings=type==='Dairy'?'<path fill="#fff" d="M9 8h5l2 3-2 5H9l-2-3zm9 0h5l1 3-3 3-4-2z"/>':'';
 return '<svg class="calf-icon" viewBox="0 0 32 24" aria-hidden="true"><path fill="#171c19" d="M6 9 4 6 2 7l3 5 1 5 2 1v5h3l1-5h7l1 5h3l1-7 4-1 3-3-1-4-3-1-1-3-3 2-2 3H6z"/>'+markings+'<circle cx="27" cy="10" r=".85" fill="#fff"/></svg>';
}
function groupNumber(g){
 const type=groupType(g);
 return data.groups.filter(group=>groupType(group)===type).indexOf(g)+1;
}
function groupButtons(z){
 if(z.strawStorage)return '';
 return data.groups.filter(g=>g.zone===z.id).map(g=>{
  const calves=groupCalves(g.id),checks=calves.flatMap(outstanding).filter(due).length;
  const type=groupType(g);
  const number=groupNumber(g);
  const vaccineAlert=vaccinationDue(g);
  const details=type+' Group '+number+' · '+g.name+' · '+groupHeadcount(g)+' calves'+(checks?' · '+checks+' checks due':'')+(vaccineAlert?' · '+vaccinationStatus(g):'');
  const calfChips=tab==='Map'&&mapPage==='shed'&&!editing?calves.map(c=>'<button type="button" class="calf-drag-chip" data-calf-drag="'+esc(c.id)+'" data-action="open-calf" data-id="'+esc(c.id)+'" title="Drag calf '+esc(c.tag)+' to dead calf bucket">'+esc(c.tag)+'</button>').join(''):'';
  return '<button type="button" class="group" data-action="open-group" data-group="'+esc(g.id)+'" data-id="'+esc(g.id)+'" title="'+esc(details)+'" aria-label="'+esc(details)+'">'+calfIcon(type)+'<span>'+number+'</span>'+(vaccineAlert?'<span class="alert" aria-hidden="true">!</span>':'')+'</button>'+calfChips;
 }).join('');
}
function pointsAttr(points){return points.map(([x,y])=>x+','+y).join(' ')}
function position([x,y]){return 'left:'+(x/10)+'%;top:'+(y/10)+'%'}
function labelPoint(shape){
 let area=0,centerX=0,centerY=0;
 shape.forEach(([x1,y1],i)=>{
  const [x2,y2]=shape[(i+1)%shape.length];
  const cross=x1*y2-x2*y1;
  area+=cross;
  centerX+=(x1+x2)*cross;
  centerY+=(y1+y2)*cross;
 });
 const centroid=area?[centerX/(3*area),centerY/(3*area)]:null;
 const ys=shape.map(p=>p[1]), min=Math.min(...ys),max=Math.max(...ys);
 const rows=[.5,.25,.75,.1,.9].map(fraction=>min+(max-min)*fraction);
 if(centroid)rows.unshift(centroid[1]);
 let best=[shape[0][0],shape[0][1]],width=0;
 for(const y of rows){
  const crossings=[];
  shape.forEach(([x1,y1],i)=>{
   const [x2,y2]=shape[(i+1)%shape.length];
   if((y1>y)!==(y2>y))crossings.push(x1+(x2-x1)*(y-y1)/(y2-y1));
  });
  crossings.sort((a,b)=>a-b);
  for(let i=0;i+1<crossings.length;i+=2){
   if(y===centroid?.[1]&&centroid[0]>crossings[i]&&centroid[0]<crossings[i+1])return centroid;
   const span=crossings[i+1]-crossings[i];
   if(span>width){width=span;best=[crossings[i]+span/2,y]}
  }
 }
 return best;
}
function overviewZones(zones){
 const main=zones.filter(z=>mapFor(z)==='farm');
 const separate=zones.filter(z=>z.separateImage);
 const south=separate.find(z=>z.id==='south'||z.name.trim().toLowerCase()==='south paddock');
 const calf=separate.find(z=>z.name.trim().toLowerCase()==='calf paddock')??separate.find(z=>z!==south)??south;
 const southZones=south?zones.filter(z=>mapFor(z)===mapFor(south)):[];
 if(southZones.length>1){
  const southern=fitOutlines(southZones,mapFor(south),[25,385,650,585]);
  const areas=southern.filter(z=>z.shape).map(z=>outlineArea(z.shape)).sort((a,b)=>a-b);
  const typicalArea=areas[Math.floor(areas.length/2)];
  const northern=fitOutlines(main,'farm',[105,45,470,270]).map(z=>{
   if(z.id!=='north'||!z.shape||!typicalArea)return z;
   const scale=Math.min(1,Math.sqrt(typicalArea/(outlineArea(z.shape))));
   const [cx,cy]=labelPoint(z.shape);
   return {...z,shape:z.shape.map(([x,y])=>[cx+(x-cx)*scale+40,cy+(y-cy)*scale-25])};
  });
  const right=separate.filter(z=>z!==south&&z!==calf);
  const northOutline=by(northern,'north')?.shape;
  const northY=northOutline?labelPoint(northOutline)[1]:150;
  const calfY=(northY+700)/2;
  const calfPage=calf&&calf!==south?mapFor(calf):null;
  const calfZones=calfPage?fitOutlines(zones.filter(z=>mapFor(z)===calfPage),calfPage,[650,calfY-190,285,290]):[];
  const height=390/Math.max(1,right.length);
  return [...northern,...southern,...calfZones,...right.flatMap((z,i)=>{
   const page=mapFor(z);
   return fitOutlines(zones.filter(location=>mapFor(location)===page),page,[695,575+i*height,280,height*.96]);
  })];
 }
 const others=separate.filter(z=>z!==calf);
 const columns=Math.min(3,others.length);
 return [
  ...fitOutlines(main,'farm',[25,40,515,others.length?505:560]).map(z=>
   z.id==='north'&&z.shape?{...z,shape:z.shape.map(([x,y])=>[x+40,y-25])}:z
  ),
  ...fitOutlines(calf?zones.filter(z=>mapFor(z)===mapFor(calf)):[],calf&&mapFor(calf),[545,others.length?500:525,430,others.length?240:420]),
  ...others.flatMap((z,i)=>{
   const width=930/columns;
   const height=210/Math.ceil(others.length/columns);
   return fitOutlines(zones.filter(location=>mapFor(location)===mapFor(z)),mapFor(z),[35+i%columns*width,755+Math.floor(i/columns)*height,width-15,height*.92]);
  })
 ];
}
function outlineArea(shape){
 return Math.abs(shape.reduce((sum,[x,y],i)=>{
  const [nextX,nextY]=shape[(i+1)%shape.length];
  return sum+x*nextY-y*nextX;
 },0))/2;
}
function fitOutlines(zones,page,[left,top,width,height]){
 const points=zones.flatMap(z=>z.shape??[]);
 if(!points.length)return zones;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),minY=Math.min(...ys);
 const spanX=Math.max(...xs)-minX,spanY=Math.max(...ys)-minY;
 const aspect=(data.images?.[page]?.ratio??1.6)/1.25;
 const scale=Math.min(width/(spanX*aspect||1),height/(spanY||1));
 const x0=left+(width-spanX*aspect*scale)/2;
 const y0=top+(height-spanY*scale)/2;
 return zones.map(z=>z.shape?{...z,shape:z.shape.map(([x,y])=>[x0+(x-minX)*aspect*scale,y0+(y-minY)*scale])}:z);
}

function median(nums){const a=nums.slice().sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2}
function alignedShedShapes(pens){
 const boxes=pens.map(p=>{const xs=p.shape.map(v=>v[0]),ys=p.shape.map(v=>v[1]);return {id:p.id,l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)}});
 const rows=[];
 for(const p of boxes.slice().sort((a,b)=>(a.t+a.b)-(b.t+b.b))){
  const y=(p.t+p.b)/2,h=p.b-p.t;
  let row=rows.find(row=>Math.abs(y-median(row.map(q=>(q.t+q.b)/2)))<=Math.max(15,Math.min(h,median(row.map(q=>q.b-q.t)))*.38));
  if(!row){row=[];rows.push(row)}row.push(p);
 }
 for(const row of rows)if(row.length>1){const top=median(row.map(p=>p.t)),bottom=median(row.map(p=>p.b));for(const p of row){p.t=top;p.b=bottom}}
 const edges=boxes.flatMap(p=>[{p,k:'l',v:p.l},{p,k:'r',v:p.r}]).sort((a,b)=>a.v-b.v),clusters=[];
 for(const e of edges){let cluster=clusters.find(c=>Math.abs(median(c.map(v=>v.v))-e.v)<=15);if(!cluster){cluster=[];clusters.push(cluster)}cluster.push(e)}
 for(const c of clusters)if(c.length>1){const x=median(c.map(e=>e.v));for(const e of c)e.p[e.k]=x}
 return boxes.filter(p=>p.r>p.l+3&&p.b>p.t+3).map(p=>({id:p.id,shape:[[p.l,p.t],[p.r,p.t],[p.r,p.b],[p.l,p.b]]}));
}
function renumberShedPens(d){
 const pens=d.zones.filter(z=>z.kind==='Pen'&&(z.strawOrder!=null||/^Pen\s*\d+$/i.test(z.name)));
 for(const z of pens)if(z.strawOrder==null)z.strawOrder=Number(z.name.match(/\d+/)[0]);
 pens.sort((a,b)=>a.strawOrder-b.strawOrder);
 let n=1;for(const z of pens)z.name=z.strawStorage?'Straw':'Pen '+n++;
}

function shedFrame(outlines,aspect){
 const points=outlines.flat();
 if(!points.length)return [0,0,1000,1000];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const height=Math.min(1000,Math.max(120,(bottom-top)*1.26));
 const width=Math.min(1000,Math.max(120,(right-left)*1.26,height*.75/aspect));
 const x=Math.max(0,Math.min(1000-width,(left+right-width)/2));
 const y=Math.max(0,Math.min(1000-height,(top+bottom-height)/2));
 return [x,y,width,height];
}
function drawBoard(zones,image,aspect=image?.ratio??1.6){
 const footprint=shedFootprint();
 const shed=mapPage==='shed';
 const overview=mapPage==='overview';
 const active=draft&&(shed&&draft.id===footprint.id?footprint:by(zones,draft.id));
 const shedMarker=overview&&fitOutlines([footprint],'shed',[760,45,190,140])[0];
 const baseShed=shedMarker?.shape??(overview?[[760,45],[950,45],[950,185],[760,185]]:null);
 const baseLabel=baseShed?labelPoint(baseShed):[855,115];
 const offset=shedPlacement??data.shedPosition??[0,0];
 const movePoint=([x,y])=>[x+offset[0],y+offset[1]];
 const rawShell=baseShed?.map(movePoint)??(shed&&active?.id!==footprint.id?footprint.shape:null);
 const shell=overview?layoutShape('shed',rawShell):rawShell;
 const visible=zones.filter(z=>z.shape&&z.id!==active?.id).map(z=>overview?{...z,shape:layoutShape(z.id,z.shape)}:z);
 const focused=shed&&!editing&&!draft&&Boolean(shell||visible.length);
 const [x,y,width,height]=focused?shedFrame([shell??[],...visible.map(z=>z.shape)],aspect):[0,0,1000,1000];
 const frameAspect=aspect*width/height;
 const framePoint=([px,py])=>[(px-x)*1000/width,(py-y)*1000/height];
 const imageStyle=focused?' style="left:'+(-100*x/width)+'%;top:'+(-100*y/height)+'%;width:'+(100000/width)+'%;height:'+(100000/height)+'%"':'';
 const toolbar=active?'<p class="hint"><strong>'+esc(active.name)+'</strong> · '+(draft.vertex==null?'Tap the map to add corners, or tap a corner to move or remove it.':'Tap the new position for corner '+(draft.vertex+1)+'.')+'</p><div class="actions">'+button('Save outline','save-outline','',true)+button('Undo last corner','undo-point')+(draft.vertex==null?'':button('Remove selected corner','remove-point'))+button('Redraw','redraw')+button('Cancel','cancel-outline')+'</div>':'';
 const calfPaddock=shed&&!editing&&!draft?data.zones.find(z=>z.kind==='Paddock'&&z.name.trim().toLowerCase()==='calf paddock'):null;
 const paddockDrop=calfPaddock?'<div class="shed-north-area"><div class="north-caption">NORTH · OUTSIDE SHED</div><section class="calf-paddock-drop zone" data-zone="'+esc(calfPaddock.id)+'" data-kind="Paddock" aria-label="Calf Paddock · drop group here"><strong>Calf Paddock</strong><small>Drop groups here</small>'+groupButtons(calfPaddock)+'</section></div>':'';
 const deadBucket=shed&&!editing&&!draft?'<div class="dead-bucket-row"><section class="dead-bucket" id="dead-calf-bucket" aria-label="Deceased calf bucket"><span aria-hidden="true">🪣</span><strong>Dead calves</strong><small>Drop individual calf here</small></section></div>':'';
  return toolbar+paddockDrop+deadBucket+'<div class="board'+(active?' drawing':'')+(focused?' focused-shed':'')+'" id="board" data-map="'+mapPage+'" style="--aspect:'+frameAspect+'">'+(image?'<img alt="" src="'+esc(image.src)+'"'+imageStyle+'>':'')+
 '<svg viewBox="'+[x,y,width,height].join(' ')+'" preserveAspectRatio="none" aria-hidden="true">'+(shell?'<polygon class="shed-footprint"'+(overview?' id="overview-shed"':'')+' points="'+pointsAttr(shell)+'"/>':'')+visible.map(z=>'<polygon data-zone="'+esc(z.id)+'"'+(z.strawStorage?' class="straw-zone"':'')+' points="'+pointsAttr(z.shape)+'"/>').join('')+
 (active?'<'+(draft.points.length>=3?'polygon':'polyline')+' class="draft" points="'+pointsAttr(draft.points)+'"/>':'')+'</svg>'+
 (overview?'<div class="label shed-link" style="'+position(labelPoint(shell))+'">'+(editing?'<button type="button" data-layout-move="shed">Move shed</button>':button('Shed','map-page','shed'))+'</div>':'')+
 visible.map(z=>'<div class="label" data-zone="'+esc(z.id)+'" style="'+position(framePoint(labelPoint(z.shape)))+'"><span class="zone-name">'+esc(z.strawStorage?'STRAW':z.name)+'</span>'+(!draft?groupButtons(z):'')+'</div>').join('')+
 (overview&&editing?[...visible,{id:'shed',shape:shell}].filter(z=>z.shape).map(z=>layoutHandles(z)).join(''):'')+
 (active?draft.points.map((p,i)=>'<button type="button" class="vertex" data-action="vertex" data-id="'+i+'" aria-label="Move corner '+(i+1)+'" aria-pressed="'+(draft.vertex===i)+'" style="'+position(p)+'">'+'</button>').join(''):'')+'</div>';
}
function recordPoint(e,board){
 const r=board.getBoundingClientRect();
 const point=[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height].map(n=>Math.round(Math.min(1,Math.max(0,n))*1000));
 if(draft.vertex==null){
  if(draft.points.length>=100){say('This outline has reached 100 corners.');return}
  draft.points.push(point);
 }else{draft.points[draft.vertex]=point;draft.vertex=null}
 render();
}
function renderCalves(){
 $('calf-list').innerHTML=data.calves.filter(c=>c.tag.toLowerCase().includes(query.trim().toLowerCase())).map(c=>'<div class="card row"><div><strong>Tag '+esc(c.tag)+'</strong><p>'+esc(c.deathDate?'Deceased '+c.deathDate:c.weaned?'Weaned '+c.weaned:by(data.groups,c.group)?.name??'Ungrouped')+'</p><p>'+esc((c.type==='Beef'?'Beef':c.type==='Dairy'?'Friesian heifer':'Calf')+' · Born '+(c.birth||'unknown')+(c.birthBasis&&c.birthBasis!=='Dated note'?' (estimated)':''))+'</p></div>'+button('Open calf','open-calf',c.id)+'</div>').join('')||'<p class="hint">No matching calf records.</p>';
}
function show(title,body,onSave,saveLabel='Save'){
 const dialog=$('dialog');
 if(dialog.open)dialog.close();
 dialog.innerHTML='<h2>'+esc(title)+'</h2><form>'+body+'<div class="actions">'+(onSave?'<button class="primary">'+esc(saveLabel)+'</button>':'')+button(onSave?'Cancel':'Close','close')+'</div><p id="form-error" role="alert"></p></form>';
 dialog.querySelector('form').onsubmit=e=>{e.preventDefault();if(onSave?.(Object.fromEntries(new FormData(e.target))))dialog.close()};
 dialog.showModal();
}
function error(message){$('form-error').textContent=message;return false}
function move(groupId,zoneId,settings={}){
 const g=by(data.groups,groupId),z=by(data.zones,zoneId);
 if(!g||!z||g.zone===z.id)return false;
 const entry={group:g.name,from:by(data.zones,g.zone).name,to:z.name,count:settings.headcount===null?groupCalves(g.id).length:settings.headcount??groupHeadcount(g),at:new Date().toISOString()};
 return commit(d=>{const group=by(d.groups,groupId);Object.assign(group,settings,{zone:zoneId});d.moves.push(entry)},g.name+' moved to '+z.name+'.');
}

function recordDeceased(calfId,existing=false){
 const calf=by(data.calves,calfId);if(!calf)return;
 show((existing?'Edit deceased record · ':'Record deceased calf · ')+calf.tag,
 '<p>Calf '+esc(calf.tag)+' · history is retained.</p>'+
 field('Date of death',input('deathDate',calf.deathDate||today(),'type="date" required max="'+today()+'"'))+
 field('Cause of death','<textarea name="deathCause" required placeholder="Cause of death, or Unknown">'+esc(calf.deathCause??'')+'</textarea>'),v=>{
  if(!v.deathDate||v.deathDate>today())return error('Enter a date on or before today.');
  v.deathCause=v.deathCause.trim();
  if(!v.deathCause)return error('Enter a cause of death, or Unknown.');
  return commit(d=>{const c=by(d.calves,calfId);const wasActive=!c.deathDate&&!c.weaned;c.deathDate=v.deathDate;c.deathCause=v.deathCause;if(wasActive){const g=by(d.groups,c.group);if(g&&g.headcount!=null&&g.headcount>0)g.headcount--;}},'Deceased calf '+calf.tag+' recorded.');
 },existing?'Save changes':'Confirm deceased calf');
}
function penCalfPicker(zoneId,keepMultiple=false){
 const zone=by(data.zones,zoneId);
 if(!zone||zone.kind!=='Pen'||zone.strawStorage||editing)return;
 if(!keepMultiple)penMultiAdd=false;
 const body='<p>Search for an existing calf by ear tag. Selecting it adds the calf to the existing pen group in '+esc(zone.name)+'.</p>'+
  field('Calf number', '<input id="pen-calf-search" class="search" type="search" inputmode="numeric" autocomplete="off" placeholder="Enter calf ear tag" aria-label="Search calf number">')+
  '<label class="multi-pen-option"><input id="pen-multiple" type="checkbox"'+(penMultiAdd?' checked':'')+'> Add multiple calves</label>'+ '<div id="pen-calf-results" aria-live="polite"></div>';
 show('Add calf to '+zone.name,body);
 const inputEl=$('pen-calf-search');
 const renderMatches=()=>{
  const term=inputEl.value.trim().toLowerCase();
  const matches=term?data.calves.filter(c=>!c.weaned&&!c.deathDate&&String(c.tag).toLowerCase().includes(term)).slice(0,30):[];
  $('pen-calf-results').innerHTML=!term?'<p class="hint">Enter a calf number to search.</p>':
   matches.length?matches.map(c=>{
    const group=by(data.groups,c.group),location=group&&by(data.zones,group.zone);
    return '<div class="card row"><span><strong>Tag '+esc(c.tag)+'</strong><small> · '+esc(location?.name??'Ungrouped')+'</small></span>'+button('Add to pen','pen-assign-calf',zoneId+'|'+c.id)+'</div>';
   }).join(''):'<p class="hint">No matching active calf found.</p>';
 };
 $('pen-multiple').addEventListener('change',e=>{penMultiAdd=e.target.checked});
 inputEl.addEventListener('input',renderMatches);
 renderMatches();
 inputEl.focus();
}
function assignExistingCalfToPen(zoneId,calfId){
 const zone=by(data.zones,zoneId),calf=by(data.calves,calfId);
 if(!zone||zone.kind!=='Pen'||zone.strawStorage||!calf||calf.weaned||calf.deathDate){say('That active calf or pen is no longer available.');return}
 const original=by(data.groups,calf.group);
 if(original?.zone===zoneId){if(penMultiAdd)penCalfPicker(zoneId,true);else $('dialog').close();say('Calf '+calf.tag+' is already in '+zone.name+'.');return}
 const groupsInPen=data.groups.filter(g=>g.zone===zoneId);
 const target=groupsInPen.find(g=>g.autoPenGroup)||groupsInPen[0];
 const newGroupId=target?.id??id();
 const groupName=target?.name??('Pen group - '+zone.name);
 const saved=commit(d=>{
  const c=by(d.calves,calfId);
  if(!target)d.groups.push({id:newGroupId,name:groupName,type:c.type==='Beef'?'Beef':'Dairy',zone:zoneId,autoPenGroup:true});
  c.group=newGroupId;
  d.moves.push({group:groupName,from:original?by(data.zones,original.zone)?.name??'Unknown':'Ungrouped',to:zone.name,count:1,at:new Date().toISOString()});
 },'Calf '+calf.tag+' added to '+zone.name+' · '+groupName+'.');
 if(saved){if(penMultiAdd)penCalfPicker(zoneId,true);else $('dialog').close();}
}
function cancelPenHold(){if(penHoldTimer!==null)clearTimeout(penHoldTimer);penHoldTimer=null;penHoldStart=null}
document.addEventListener('pointerdown',e=>{
 if(tab!=='Map'||mapPage!=='shed'||editing||draft||!e.isPrimary||e.button!==0)return;
 if(e.target.closest('button:not(.group),[data-layout-resize],[data-layout-move]'))return;
 const target=e.target.closest('[data-zone]');
 const zone=target&&by(data.zones,target.dataset.zone);
 if(!zone||zone.kind!=='Pen'||zone.strawStorage)return;
 cancelPenHold();
 penHoldTriggered=false;
 penHoldStart={pointer:e.pointerId,x:e.clientX,y:e.clientY,zoneId:zone.id};
 penHoldTimer=setTimeout(()=>{
  const targetZone=penHoldStart?.zoneId;
  cancelPenHold();
  if(!targetZone)return;
  penHoldTriggered=true;
  drag=null;
  penCalfPicker(targetZone);
 },550);
});
document.addEventListener('pointermove',e=>{
 if(penHoldStart?.pointer===e.pointerId&&Math.hypot(e.clientX-penHoldStart.x,e.clientY-penHoldStart.y)>12)cancelPenHold();
});
for(const eventName of ['pointerup','pointercancel','scroll'])document.addEventListener(eventName,cancelPenHold,true);
document.addEventListener('contextmenu',e=>{
 const z=e.target.closest('[data-zone]');
 if(tab==='Map'&&mapPage==='shed'&&!editing&&z&&by(data.zones,z.dataset.zone)?.kind==='Pen'&&!by(data.zones,z.dataset.zone)?.strawStorage){
  e.preventDefault();
  if(!penHoldTriggered){cancelPenHold();penCalfPicker(z.dataset.zone)}
 }
});

function parseDailyNote(note,year){
 const rows=[],review=[],seen=new Set(data.calves.map(c=>c.tag.toLowerCase()));
 let birth='',truck=0,duplicates=0;
 for(const raw of note.split(/\r?\n/)){
  const line=raw.trim();
  if(!line)continue;
  const heading=line.match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}))?(?=$|[.\s])/);
  if(heading){
   const [,day,month,explicitYear]=heading;
   const date=(explicitYear??year)+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');
   const check=new Date(date+'T00:00:00Z');
   birth=Number.isFinite(+check)&&check.toISOString().slice(0,10)===date&&date<=today()?date:'';
   if(!birth)review.push(line);
   continue;
  }
  if(line.includes('🚛')){truck++;continue}
  const match=line.match(/^(\d+)\s*[-–—]\s*[HB]\d*\b[.\s]*(.*?)\s*(🐄|🥩)\uFE0F?\s*(\d+)(?:\s|\.|$)(.*)$/iu);
  if(!match||!birth){review.push(line);continue}
  const [,,before,icon,tag,after]=match;
  if(seen.has(tag)){duplicates++;continue}
  seen.add(tag);
  rows.push({tag,dam:'',birth,type:icon==='🐄'?'Dairy':'Beef',notes:[before.trim(),after.trim()].filter(Boolean).join(' ')});
 }
 return {rows,review,truck,duplicates};
}
function importCalves(){
 const groupOptions=type=>option('','Ungrouped','')+data.groups.filter(g=>[type,'Mixed'].includes(groupType(g))).map(g=>option(g.id,g.name,'')).join('');
 show('Import daily calf note',field('Daily note','<textarea name="note" required></textarea>')+
  field('Year for dates without a year',input('year',today().slice(0,4),'type="number" min="1900" max="'+today().slice(0,4)+'" required'))+
  field('Dairy group',select('dairy',groupOptions('Dairy')))+field('Beef group',select('beef',groupOptions('Beef'))),v=>{
  const {rows,review,truck,duplicates}=parseDailyNote(v.note,v.year);
  const summary='<p>'+rows.length+' ready · '+truck+' truck rows skipped · '+duplicates+' duplicate tags skipped</p>';
  const needsReview=review.length?'<h3>Skipped for review</h3><ul>'+review.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>':'';
  const list='<ul>'+rows.map(c=>'<li>'+esc(c.type+' '+c.tag+' · '+c.birth+(c.notes?' · '+c.notes:''))+'</li>').join('')+'</ul>';
  show('Preview calf import',summary+list+needsReview,rows.length?()=>{
   const existing=new Set(data.calves.map(c=>c.tag.toLowerCase()));
   const newRows=rows.filter(c=>!existing.has(c.tag.toLowerCase()));
   return commit(d=>{
    for(const calf of newRows)d.calves.push({...calf,id:id(),group:calf.type==='Dairy'?v.dairy:v.beef,weaned:'',health:[]});
   },newRows.length+' calf records added.');
  }:null,'Import '+rows.length+' calves');
  return false;
 },'Preview import');
}
function calfForm(c,group=c?.group??''){
 show(c?'Edit calf':'Add calf',field('Ear tag',input('tag',c?.tag,'required maxlength="40"'))+field('Birth date',input('birth',c?.birth||(!c?today():''),'type="date" max="'+today()+'"'))+field('Dam tag',input('dam',c?.dam,'maxlength="40"'))+field('Group',select('group',option('','Ungrouped',group)+data.groups.map(g=>option(g.id,g.name,group)).join('')))+field('Weaned date',input('weaned',c?.weaned,'type="date" max="'+today()+'"'))+field('Notes','<textarea name="notes">'+esc(c?.notes)+'</textarea>'),v=>{
  v.tag=v.tag.trim();
  if(!v.tag)return error('Enter an ear tag.');
  if(data.calves.some(r=>r.id!==c?.id && r.tag.toLowerCase()===v.tag.toLowerCase()))return error('That ear tag already exists.');
  if(v.birth&&v.weaned&&v.weaned<v.birth)return error('Weaning date must be on or after the birth date.');
  return commit(d=>{if(c)Object.assign(by(d.calves,c.id),v);else d.calves.push({...v,id:id(),health:[]})},'Calf saved.');
 });
}
document.addEventListener('input',e=>{if(e.target.id==='search'){query=e.target.value;renderCalves()}});
let vaccineSwipeX=null;
document.addEventListener('touchstart',e=>{
 const row=e.target.closest('.vaccine-swipe');if(!row)return;
 vaccineSwipeX={row,x:e.touches[0].clientX,y:e.touches[0].clientY};
},{passive:true});
document.addEventListener('touchend',e=>{
 if(!vaccineSwipeX)return;
 const {row,x,y}=vaccineSwipeX;vaccineSwipeX=null;
 const t=e.changedTouches[0],dx=t.clientX-x,dy=t.clientY-y;
 if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)row.classList.toggle('revealed',dx<0);
},{passive:true});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b){const board=e.target.closest('#board');if(draft&&board)recordPoint(e,board);return}
 const a=b.dataset.action,k=b.dataset.id;
 if(a==='tab'){cancelPenHold();draft=null;shedPlacement=null;tab=k;render();return}
 if(a==='close'){$('dialog').close();return}
 if(a==='layout'){draft=null;shedPlacement=null;editing=!editing;render();return}


 if(a==='align-selected-shed-pens'){
  const pens=data.zones.filter(z=>z.kind==='Pen'&&mapFor(z)==='shed'&&Array.isArray(z.shape)&&z.shape.length>=3)
    .sort((a,b)=>(Number(a.name.match(/\\d+/)?.[0])||999)-(Number(b.name.match(/\\d+/)?.[0])||999));
  if(pens.length<2){say('At least two drawn pens are needed for alignment.');return}
  const choices='<p>Choose the direction, then select only pens that should share the same edges. Unselected pens will not move.</p>'+
   '<fieldset style="margin:10px 0;padding:10px;border:1px solid #9aab99;border-radius:8px"><legend>Alignment direction</legend>'+
   '<label style="display:block;margin:5px 0"><input type="radio" name="shed-align-direction" value="horizontal" checked> Horizontal — line up top and bottom edges</label>'+
   '<label style="display:block;margin:5px 0"><input type="radio" name="shed-align-direction" value="vertical"> Vertical — line up left and right edges</label></fieldset>'+
   '<div class="shed-pen-choices">'+pens.map(z=>'<label><input type="checkbox" class="align-choice" value="'+esc(z.id)+'"> '+esc(z.name)+'</label>').join('')+'</div>'+
   '<p class="hint">Do not select pens across alleyways or pens that need to remain offset. Undo pen alignment restores the last adjustment.</p>';
  show('Align selected pens',choices,()=>{
   const selected=[...$('dialog').querySelectorAll('.align-choice:checked')].map(input=>input.value);
   if(selected.length<2)return error('Choose at least two pens to align.');
   const direction=$('dialog').querySelector('input[name="shed-align-direction"]:checked')?.value||'horizontal';
   const chosen=pens.filter(z=>selected.includes(z.id));
   const boxes=chosen.map(z=>{const xs=z.shape.map(p=>p[0]),ys=z.shape.map(p=>p[1]);return {id:z.id,left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)}});
   const top=median(boxes.map(b=>b.top)),bottom=median(boxes.map(b=>b.bottom));
   const left=median(boxes.map(b=>b.left)),right=median(boxes.map(b=>b.right));
   if(direction==='horizontal'&&bottom-top<4)return error('These outlines cannot be aligned horizontally.');
   if(direction==='vertical'&&right-left<4)return error('These outlines cannot be aligned vertically.');
   return commit(d=>{
    d.shedPenShapesBeforeSquare=chosen.map(z=>({id:z.id,shape:structuredClone(z.shape)}));
    for(const b of boxes){
     const z=by(d.zones,b.id);
     if(z)z.shape=direction==='vertical'
      ?[[left,b.top],[right,b.top],[right,b.bottom],[left,b.bottom]]
      :[[b.left,top],[b.right,top],[b.right,bottom],[b.left,bottom]];
    }
   },selected.length+' selected pens aligned '+(direction==='vertical'?'vertically':'horizontally')+'. Unselected pens unchanged.');
  },'Align selected pens');
  return;
 }
 if(a==='toggle-straw'){
  const z=by(data.zones,k);if(!z||z.kind!=='Pen')return;
  if(!z.strawStorage&&data.groups.some(g=>g.zone===k)){show('Move calves first','<p>Move any groups out of this pen before converting it to straw. This protects existing calf locations.</p>');return}
  const toStraw=!z.strawStorage;
  show(toStraw?'Change pen to straw?':'Restore numbered pen?','<p>'+esc(toStraw?'This area turns yellow, displays STRAW and later pen numbers decrease by one.':'This area becomes a pen again and pen numbers adjust.')+'</p>',()=>commit(d=>{
   const pens=d.zones.filter(p=>p.kind==='Pen'&&(p.strawOrder!=null||/^Pen\s*\d+$/i.test(p.name)));
   for(const p of pens)if(p.strawOrder==null)p.strawOrder=Number(p.name.match(/\d+/)[0]);
   by(d.zones,k).strawStorage=toStraw;renumberShedPens(d);
  },toStraw?'Area changed to straw.':'Straw area restored to a pen.'),toStraw?'Change to straw':'Restore pen');
  return;
 }
 if(a==='square-shed-pens'){
  const pens=data.zones.filter(z=>z.kind==='Pen'&&mapFor(z)==='shed'&&Array.isArray(z.shape)&&z.shape.length>=3);
  if(!pens.length){say('No drawn shed pens to straighten.');return}
  show('Square up shed pens?','<p>Make every drawn shed pen rectangular, with horizontal and vertical sides. Pen names, calves and groups are kept. You can undo this adjustment.</p>',()=>commit(d=>{
    d.shedPenShapesBeforeSquare=pens.map(z=>({id:z.id,shape:structuredClone(z.shape)}));
    pens.forEach(p=>{
      const xs=p.shape.map(v=>v[0]),ys=p.shape.map(v=>v[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      const target=by(d.zones,p.id);
      if(target)target.shape=[[left,top],[right,top],[right,bottom],[left,bottom]];
    });
  },'Shed pen outlines squared up.'),'Square up pens');
  return;
 }
 if(a==='undo-square-shed-pens'){
  if(!data.shedPenShapesBeforeSquare)return;
  commit(d=>{
    for(const original of d.shedPenShapesBeforeSquare){
      const pen=by(d.zones,original.id);
      if(pen)pen.shape=original.shape;
    }
    delete d.shedPenShapesBeforeSquare;
  },'Previous shed pen outlines restored.');
  return;
 }
 if(a==='save-shed-position'){
  if(!shedPlacement){say('Drag the shed to a new position first.');return}
  const offset=shedPlacement;shedPlacement=null;
  if(!commit(d=>{d.shedPosition=offset},'Shed position saved.'))shedPlacement=offset;
  return;
 }
 if(a==='map-page'){cancelPenHold();draft=null;shedPlacement=null;mapPage=k;render();return}
 if(a==='outline'){draft={id:k,points:structuredClone((k==='shed-footprint'?data.shedOutline:by(data.zones,k).shape)??[]),vertex:null};render();$('board').scrollIntoView({block:'nearest'});return}
 if(a==='vertex'){draft.vertex=draft.vertex===Number(k)?null:Number(k);render();return}
 if(a==='remove-point'){draft.points.splice(draft.vertex,1);draft.vertex=null;render();return}
 if(a==='undo-point'){draft.points.pop();draft.vertex=null;render();return}
 if(a==='redraw'){draft.points=[];draft.vertex=null;render();return}
 if(a==='cancel-outline'){draft=null;render();return}
 if(a==='save-outline'){
  const p=draft.points;
  const area=outlineArea(p);
  if(new Set(p.map(String)).size<3||area<10){say('Add at least three corners that enclose an area.');return}
  const saved=draft;draft=null;
  if(!commit(d=>{if(saved.id==='shed-footprint')d.shedOutline=saved.points;else by(d.zones,saved.id).shape=saved.points},'Outline saved.'))draft=saved;
  return;
 }
 if(a==='image'||a==='separate-image'){
  const picker=$('map-image');
  picker.dataset.page=mapPage;
  picker.dataset.zone=a==='separate-image'?k:'';
  picker.click();return;
 }
 if(a==='remove-image'){commit(d=>{delete d.images[mapPage]},'Reference image removed.');return}

 if(a==='delete-vaccination'){
  const [gid,name]=k.split('|');
  if(!['firstVaccinated','vaccinated'].includes(name))return;
  const group=by(data.groups,gid);
  if(!group||!group[name])return;
  show('Delete vaccination date?','<p>'+esc(name==='firstVaccinated'?'First vaccination':'Last vaccination')+' · '+esc(group[name])+'</p><p>This removes only this recorded date. Other group and calf records will be kept.</p>',()=>commit(d=>{by(d.groups,gid)[name]=''},'Vaccination date deleted.'),'Delete vaccination');
  return;
 }
 if(a==='vaccinated-today'){
  const form=b.form;
  const date=today();
  if(form.elements.firstVaccinated.value===date){say('The first dose is already recorded for today.');return}
  if(!form.elements.firstVaccinated.value)form.elements.firstVaccinated.value=date;
  form.elements.vaccinated.value=date;
  form.elements.vaccinationDue.value='';
  form.requestSubmit();
  return;
 }
 if(a==='calf'){calfForm(by(data.calves,k));return}
 if(a==='import-calves'){importCalves();return}
 if(a==='assign-range'){assignRangeForm(k);return}
 if(a==='undo-range'){undoRangeForm();return}
 if(a==='register-details'){showRegisterDetails();return}
 if(a==='retry-register'){if(!storageLoadFailed)loadRegister2026();return}
 if(a==='recover-farm'){recoverFarmForm();return}
 if(a==='farm-recovery-details'){showFarmRecovery();return}
 if(a==='add-group-calf'){calfForm(undefined,k);return}
 if(a==='edit-death'){recordDeceased(k,true);return}
 if(a==='record-death'){recordDeceased(k);return}
 if(a==='pen-assign-calf'){const [zoneId,calfId]=k.split('|');assignExistingCalfToPen(zoneId,calfId);return}
 if(a==='zone'){
  const z=by(data.zones,k);
  const mapArea=z?.mapArea??(!z&&mapPage.startsWith('location:')?mapPage:undefined);
  show(z?'Edit location':'Add location',field('Name',input('name',z?.name,'required maxlength="60"'))+field('Type',select('kind',(mapArea||z?.separateImage?['Paddock','Yard']:['Pen','Paddock','Yard']).map(v=>option(v,v,z?.kind??(mapPage==='shed'?'Pen':'Paddock'))).join(''))),v=>{
   v.name=v.name.trim();if(!v.name)return error('Enter a name.');
   if((mapArea||z?.separateImage)&&v.kind==='Pen')return error('Keep this location as a paddock or yard.');
   if(z?.shape && mapFor(z)!==mapFor({...z,...v}))return error('This location has an outline on its current map. Keep its current map type.');
   return commit(d=>{if(z)Object.assign(by(d.zones,k),v);else d.zones.push({...v,id:id(),...(mapArea?{mapArea}:{})})},'Map updated.');
  });return;
 }
 if(a==='group'){
  show('Add group',field('Group name',input('name','','required maxlength="60"'))+typeField('Dairy')+field('Starting location',select('zone',data.zones.map(z=>option(z.id,z.name,data.zones.find(r=>mapFor(r)===mapPage)?.id)).join(''))),v=>{
   v.name=v.name.trim();if(!v.name)return error('Enter a group name.');
   return commit(d=>d.groups.push({...v,id:id()}),'Group added. Add calves from the Calves tab.');
  });return;
 }
 if(a==='open-group'){
  const g=by(data.groups,k);if(!g)return;
  const calves=data.calves.filter(c=>c.group===k&&!c.deathDate);
  const tags=calves.map(c=>'<div class="card row"><span>Tag '+esc(c.tag)+(c.weaned?' · Weaned':'')+'</span>'+button('Open','open-calf',c.id)+(!c.weaned?button('Deceased','record-death',c.id):'')+'</div>').join('');
  const heading=groupType(g)+' Group '+groupNumber(g)+' · '+g.name;
  const summary='<p>'+esc(by(data.zones,g.zone).name)+' · '+groupHeadcount(g)+' calves</p>';
  const reminder=vaccinationStart(g)?'<p class="'+(vaccinationDue(g)?'alert':'hint')+'">'+esc(vaccinationStatus(g)+' · '+vaccinationLabel(g))+'</p>':'';
  const headcount=field('Headcount',input('headcount',g.headcount,'type="number" min="0" max="'+Number.MAX_SAFE_INTEGER+'" step="1" placeholder="'+groupCalves(k).length+'"'));
  const vaccinations=(!g.firstVaccinated||vaccinationWindow(g)?button(g.firstVaccinated?'Vaccinated today · booster':'Vaccinated today · first dose','vaccinated-today'):'')+
   field('First vaccination',input('firstVaccinated',g.firstVaccinated,'type="date" max="'+today()+'"'))+field('Last vaccinated',input('vaccinated',g.vaccinated,'type="date" max="'+today()+'"'))+field('Override next due date',input('vaccinationDue',g.vaccinationDue,'type="date"'))+'<p class="hint">With a first vaccination date, the app shows your 4–6 week booster window. Leave the override blank to use that window.</p>'+['firstVaccinated','vaccinated'].filter(name=>g[name]).map(name=>'<div class="vaccine-swipe" data-vaccine="'+name+'" data-group="'+esc(g.id)+'"><span>'+esc(name==='firstVaccinated'?'First vaccination':'Last vaccination')+' · '+esc(g[name])+'</span>'+button('Delete','delete-vaccination',g.id+'|'+name)+'</div>').join('')+'<p class="hint">Swipe a recorded vaccination left to reveal Delete, or tap Delete directly.</p>';
  const destination=field('Move to',select('destination',data.zones.map(z=>option(z.id,z.name,g.zone)).join('')));
  const register='<h3>Calf ear tags</h3>'+(tags||'<p class="hint">No individual calves recorded yet.</p>')+button('Add calf to group','add-group-calf',k)+button('Assign calf range','assign-range',k);
  show(heading,summary+reminder+headcount+'<p class="hint">Leave headcount blank to count the unweaned calves recorded in this group.</p>'+vaccinations+typeField(groupType(g))+destination+register,v=>{
   const settings={type:v.type,headcount:v.headcount===''?null:Number(v.headcount),firstVaccinated:v.firstVaccinated,vaccinated:v.vaccinated,vaccinationDue:v.vaccinationDue};
   if(settings.headcount!==null&&(!Number.isSafeInteger(settings.headcount)||settings.headcount<0))return error('Enter a whole headcount of zero or more.');
   if(settings.firstVaccinated&&settings.vaccinated&&settings.vaccinated<settings.firstVaccinated)return error('Last vaccination must be on or after the first vaccination.');
   if(settings.vaccinated&&settings.vaccinationDue&&settings.vaccinationDue<settings.vaccinated)return error('Set a new due date or clear the previous reminder.');
   if(v.destination!==g.zone)return move(k,v.destination,settings);
   return commit(d=>{Object.assign(by(d.groups,k),settings)},'Group details saved.');
  });return;
 }
 if(a==='open-calf'){
  const c=by(data.calves,k),g=by(data.groups,c.group);
  show('Calf '+c.tag,'<p>'+esc(c.deathDate?'Deceased '+c.deathDate+' · '+(c.deathCause||'Unknown'):c.weaned?'Weaned '+c.weaned:g?g.name+' · '+by(data.zones,g.zone).name:'Ungrouped')+'</p><p>Born '+esc(c.birth||'—')+' · Dam '+esc(c.dam||'—')+'</p>'+(c.birthBasis?'<p class="hint">'+esc(c.birthBasis)+'</p>':'')+'<p>'+esc(c.notes)+'</p><div class="actions">'+button('Log health entry','health',k,true)+button('Edit calf','calf',k)+(c.deathDate?button('Edit death details','edit-death',k):!c.weaned?button('Mark deceased','record-death',k):'')+'</div><h3>Health history</h3>'+(c.health.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(h=>'<article class="card"><strong>'+esc(h.date)+'</strong><p>'+esc(h.note)+'</p>'+(h.treatment?'<p>Treatment · '+esc(h.treatment)+'</p>':'')+(h.follow?'<p>Follow-up · '+esc(h.follow)+(h.done?' · Checked':'')+'</p>':'')+'</article>').join('')||'<p>No entries yet.</p>'));return;
 }
 if(a==='health'){
  show('Log health entry',field('Entry date',input('date',today(),'type="date" required max="'+today()+'"'))+field('Observation or reason','<textarea name="note" required></textarea>')+field('Treatment given','<textarea name="treatment" placeholder="Product, dose and time if applicable"></textarea>')+field('Follow-up date',input('follow','','type="date"')),v=>{
   if(!v.note.trim())return error('Enter an observation or reason.');
   if(v.follow&&v.follow<v.date)return error('Follow-up must be on or after the entry date.');
   return commit(d=>by(d.calves,k).health.push({...v,id:id(),done:false}),'Health entry saved.');
  });return;
 }
 if(a==='checked'){
  const [cid,hid]=k.split('|');
  commit(d=>{by(by(d.calves,cid).health,hid).done=true},'Follow-up checked.');return;
 }
 if(a==='export'){
  const backup=JSON.stringify(data,null,2);
  const filename='calf-paddock-'+today()+'.json';
  const url=URL.createObjectURL(new Blob([backup],{type:'application/json'}));
  show('Export backup','<p><a id="backup-download">Download backup file</a></p><details><summary>Copy backup as text</summary><p>Select all the text and copy it into a plain-text file if the download fails.</p><textarea id="backup-text" aria-label="Backup JSON" readonly rows="6"></textarea></details>');
  const link=$('backup-download');
  link.href=url;
  link.download=filename;
  $('backup-text').value=backup;
  $('dialog').addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});
  return;
 }
 if(a==='delete-move'){
  const index=Number(k);
  const entry=data.moves[index];
  if(!entry)return;
  show('Delete this move?','<p>'+esc(entry.group)+' · '+esc(entry.from)+' → '+esc(entry.to)+'</p><p>The group will stay in its current location.</p>',()=>
   commit(d=>d.moves.splice(index,1),'Move record deleted.'),'Delete move');
  return;
 }
 if(a==='restore')$('restore').click();
});
function validImage(image){
 return image && typeof image.src==='string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image.src)
  && image.src.length<=2500000 && Number.isFinite(image.ratio) && image.ratio>0;
}
$('map-image').onchange=async e=>{
 const picker=e.target, file=picker.files[0],page=picker.dataset.page,zoneId=picker.dataset.zone;
 picker.value='';if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>25000000){
  say('Choose a PNG, JPEG or WebP image up to 25 MB.');return;
 }
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const reference={src:canvas.toDataURL('image/jpeg',.8),ratio:canvas.width/canvas.height};
  if(!validImage(reference))throw Error();
  const zone=zoneId&&by(data.zones,zoneId);
  if(zoneId&&(!zone||zone.shape||mapFor(zone)!=='farm')){
   say('That location can no longer move to a separate image.');return;
  }
  const targetPage=zone?'location:'+zoneId:page;
  if(targetPage.startsWith('location:')&&!zone&&!data.zones.some(z=>mapFor(z)===targetPage))return;
  if(commit(d=>{
   if(zone)by(d.zones,zoneId).separateImage=true;
   d.images??={};d.images[targetPage]=reference;
  },'Reference image saved.')&&zone&&tab==='Map'&&editing&&mapPage===page&&!draft){
   mapPage=targetPage;render();
  }
 }catch{say('Could not load that reference image.')}finally{URL.revokeObjectURL(url)}
};
function validOutline(shape){
 return Array.isArray(shape)&&shape.length>=3&&shape.length<=100&&shape.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1000));
}
function validBackup(x){
 const unique=rows=>Array.isArray(rows)&&rows.every(r=>r&&typeof r.id==='string'&&r.id.length)&&new Set(rows.map(r=>r.id)).size===rows.length;
 const strings=(r,keys)=>keys.every(k=>typeof r[k]==='string');
 return x?.version===1
  &&(x.layout===undefined||(x.layout&&typeof x.layout==='object'&&!Array.isArray(x.layout)&&Object.values(x.layout).every(validOutline)))
  &&(x.shedPosition===undefined||(Array.isArray(x.shedPosition)&&x.shedPosition.length===2&&x.shedPosition.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000)))&&(x.shedOutline===undefined||validOutline(x.shedOutline))&&unique(x.zones)&&x.zones.length&&x.zones.every(z=>strings(z,['name'])&&['Yard','Pen','Paddock'].includes(z.kind)&&(z.separateImage===undefined||(z.separateImage===true&&z.kind!=='Pen'))&&(z.mapArea===undefined||(!z.separateImage&&z.kind!=='Pen'&&x.zones.some(owner=>owner.separateImage&&z.mapArea===mapFor(owner))))&&(z.shape===undefined||validOutline(z.shape)))
  &&(x.images===undefined||(x.images&&typeof x.images==='object'&&!Array.isArray(x.images)&&Object.entries(x.images).every(([k,v])=>(['farm','shed'].includes(k)||x.zones.some(z=>mapFor(z)===k))&&validImage(v))))
  &&unique(x.groups)&&x.groups.every(g=>strings(g,['name'])&&by(x.zones,g.zone)&&(g.type===undefined||groupTypes.includes(g.type))
   &&(g.headcount==null||(Number.isSafeInteger(g.headcount)&&g.headcount>=0))
   &&[g.firstVaccinated,g.vaccinated,g.vaccinationDue].every(value=>value===undefined||value===''||(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z')))))
  &&unique(x.calves)&&x.calves.every(c=>strings(c,['tag','birth','dam','group','weaned','notes'])&&(!c.group||by(x.groups,c.group))&&(c.deathDate===undefined||(typeof c.deathDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(c.deathDate)))&&(c.deathCause===undefined||typeof c.deathCause==='string')&&unique(c.health)&&c.health.every(h=>strings(h,['date','note','treatment','follow'])&&typeof h.done==='boolean'))
  &&Array.isArray(x.moves)&&x.moves.every(m=>m&&strings(m,['group','from','to','at'])&&Number.isInteger(m.count));
}
$('restore').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  const next=JSON.parse(await file.text());if(!validBackup(next))throw Error();
  show('Restore backup','<p>This will replace the current records with '+next.calves.length+' calf records and '+next.groups.length+' groups from the selected file.</p>',()=>{
   if(!commit(d=>{delete d.images;delete d.shedOutline;delete d.shedPosition;delete d.layout;Object.assign(d,next)},'Backup restored.'))return false;
   draft=null;mapPage=farmHome();editing=false;return true;
  });
 }catch{say('That file is not a valid Calf Paddock backup.')}
};
function previewShedPosition(x,y){
 const footprint=fitOutlines([shedFootprint()],'shed',[760,45,190,140])[0].shape;
 const label=footprint?labelPoint(footprint):[855,115];
 const points=[...(footprint??[]),[label[0]-65,label[1]-45],[label[0]+65,label[1]+45]];
 shedPlacement=[x,y].map((value,i)=>{
  const axis=points.map(point=>point[i]);
  return Math.round(Math.min(1000-Math.max(...axis),Math.max(-Math.min(...axis),value)));
 });
 const translate=([px,py])=>[px+shedPlacement[0],py+shedPlacement[1]];
 const handle=$('shed-handle');
 handle.parentElement.style.cssText=position(translate(label));
 if(footprint)$('overview-shed').setAttribute('points',pointsAttr(footprint.map(translate)));
}
document.addEventListener('keydown',e=>{
 const steps={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]};
 const step=steps[e.key];
 if(e.target.id!=='shed-handle'||!step)return;
 e.preventDefault();
 const [x,y]=shedPlacement??data.shedPosition??[0,0];
 previewShedPosition(x+step[0],y+step[1]);
});
document.addEventListener('pointerdown',e=>{
 if(e.target.id==='shed-handle'&&e.button===0&&e.isPrimary){
  const {width,height}=$('board').getBoundingClientRect();
  shedDrag={pointer:e.pointerId,x:e.clientX,y:e.clientY,width,height,offset:shedPlacement??data.shedPosition??[0,0],previous:shedPlacement};
  e.target.setPointerCapture(e.pointerId);
  return;
 }
 const calf=e.target.closest('[data-calf-drag]');
  if(calf&&mapPage==='shed'&&!editing&&e.button===0&&e.isPrimary){
   calfDrag={pointer:e.pointerId,x:e.clientX,y:e.clientY,calf:calf.dataset.calfDrag};return;
  }
  const el=e.target.closest('[data-group]');if(!el||e.button!==0||!e.isPrimary)return;
 drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,group:el.dataset.group};
});
document.addEventListener('pointermove',e=>{
 if(calfDrag?.pointer===e.pointerId){
  if(!calfDrag.ghost&&Math.hypot(e.clientX-calfDrag.x,e.clientY-calfDrag.y)>9){
   $('view').setPointerCapture(e.pointerId);
   calfDrag.ghost=document.createElement('div');calfDrag.ghost.className='ghost';
   calfDrag.ghost.textContent='Calf '+(by(data.calves,calfDrag.calf)?.tag??'');
   document.body.append(calfDrag.ghost);
  }
  if(calfDrag.ghost){
   calfDrag.ghost.style.left=e.clientX+'px';calfDrag.ghost.style.top=e.clientY+'px';
   $('dead-calf-bucket')?.classList.toggle('target',Boolean(document.elementFromPoint(e.clientX,e.clientY)?.closest('#dead-calf-bucket')));
  }
  return;
 }
 if(shedDrag?.pointer===e.pointerId){
  const {x,y,width,height,offset}=shedDrag;
  previewShedPosition(offset[0]+(e.clientX-x)*1000/width,offset[1]+(e.clientY-y)*1000/height);
  return;
 }
 if(!drag||drag.pointer!==e.pointerId)return;
 if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){
  $('view').setPointerCapture(e.pointerId);
  drag.ghost=document.createElement('div');drag.ghost.className='ghost';
  drag.ghost.setAttribute('aria-hidden','true');
  drag.ghost.innerHTML=calfIcon(groupType(by(data.groups,drag.group)));
  document.body.append(drag.ghost);
 }
 if(!drag.ghost)return;
 drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
 const hit=document.elementFromPoint(e.clientX,e.clientY);
 const page=hit?.closest('[data-action="map-page"]')?.dataset.id;
 if(page&&page!==mapPage){mapPage=page;if(page==='overview'){draft=null;shedPlacement=null;editing=false}render()}
 drag.target?.classList.remove('target');
 drag.target=hit?.closest('[data-zone]');
 drag.target?.classList.add('target');
});
let suppressClick=false;
document.addEventListener('click',e=>{if(suppressClick&&e.detail){e.stopImmediatePropagation();e.preventDefault();suppressClick=false}},true);
function finishDrag(e){
 if(calfDrag?.pointer===e.pointerId){
  const current=calfDrag;calfDrag=null;
  if(!current.ghost)return;
  current.ghost.remove();
  const bucket=document.elementFromPoint(e.clientX,e.clientY)?.closest('#dead-calf-bucket');
  $('dead-calf-bucket')?.classList.remove('target');
  if(e.type==='pointerup'){
   suppressClick=true;setTimeout(()=>{suppressClick=false},350);
   if(bucket)recordDeceased(current.calf);
  }
  return;
 }
 if(shedDrag?.pointer===e.pointerId){
  const previous=shedDrag.previous;
  shedDrag=null;
  if(e.type!=='pointerup'){
   shedPlacement=previous;
   render();
  }
  return;
 }
 if(!drag||e.pointerId!==drag.pointer)return;
 const current=drag;drag=null;
 if(!current.ghost)return;
 current.ghost.remove();current.target?.classList.remove('target');
 if(e.type!=='pointerup')return;
 suppressClick=true;setTimeout(()=>{suppressClick=false},350);
 const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]');
 if(target)move(current.group,target.dataset.zone);
}
document.addEventListener('pointerup',finishDrag);document.addEventListener('pointercancel',finishDrag);

let layoutDrag;
function layoutShape(id,shape){return data.layout?.[id]??shape}
function layoutHandles(z){
 const xs=z.shape.map(p=>p[0]),ys=z.shape.map(p=>p[1]);
 const x=Math.max(...xs),y=Math.max(...ys);
 return '<button class="layout-resize" data-layout-resize="'+esc(z.id)+'" aria-label="Resize '+esc(z.name??'shed')+'" style="'+position([x,y])+'">↘</button>';
}
document.addEventListener('pointerdown',e=>{
 if(!editing||mapPage!=='overview'||draft||e.button!==0||!e.isPrimary)return;
 const resize=e.target.closest('[data-layout-resize]');
 const move=e.target.closest('[data-layout-move]');
 const zone=e.target.closest('[data-zone]');
 if(!resize&&!move&&(!zone||e.target.closest('[data-group]')))return;
 const id=resize?.dataset.layoutResize??move?.dataset.layoutMove??zone.dataset.zone;
 const polygon=id==='shed'?$('overview-shed'):[...$('board').querySelectorAll('polygon[data-zone]')].find(p=>p.dataset.zone===id);
 if(!polygon)return;
 const shape=polygon.getAttribute('points').trim().split(/\s+/).map(p=>p.split(',').map(Number));
 const xs=shape.map(p=>p[0]),ys=shape.map(p=>p[1]);
 const box=$('board').getBoundingClientRect();
 layoutDrag={id,shape,resize:!!resize,x:e.clientX,y:e.clientY,box,left:Math.min(...xs),top:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),pointer:e.pointerId};
 e.preventDefault();e.stopImmediatePropagation();$('view').setPointerCapture(e.pointerId);
},true);
document.addEventListener('pointermove',e=>{
 const d=layoutDrag;if(!d||d.pointer!==e.pointerId)return;
 e.preventDefault();e.stopImmediatePropagation();
 const dx=(e.clientX-d.x)*1000/d.box.width,dy=(e.clientY-d.y)*1000/d.box.height;
 let points;
 if(d.resize){
  const minW=Math.min(d.width,Math.max(90,100000/d.box.width));
  const minH=Math.min(d.height,Math.max(75,75000/d.box.height));
  const w=Math.max(minW,Math.min(1000-d.left,d.width+dx));
  const h=Math.max(minH,Math.min(1000-d.top,d.height+dy));
  points=d.shape.map(([x,y])=>[d.left+(x-d.left)*w/(d.width||1),d.top+(y-d.top)*h/(d.height||1)]);
 }else{
  const mx=Math.max(-d.left,Math.min(1000-d.left-d.width,dx));
  const my=Math.max(-d.top,Math.min(1000-d.top-d.height,dy));
  points=d.shape.map(([x,y])=>[x+mx,y+my]);
 }
 d.next=points.map(p=>p.map(n=>Math.round(n)));
 data.layout??={};data.layout[d.id]=d.next;render();
},true);
function finishLayout(e){
 const d=layoutDrag;if(!d||d.pointer!==e.pointerId)return;
 layoutDrag=null;e.stopImmediatePropagation();
 if(e.type==='pointerup'&&d.next)commit(next=>{next.layout??={};next.layout[d.id]=d.next},'Layout saved.');
 else {data.layout??={};data.layout[d.id]=d.shape;render()}
 suppressClick=true;setTimeout(()=>{suppressClick=false},350);
}
document.addEventListener('pointerup',finishLayout,true);
document.addEventListener('pointercancel',finishLayout,true);

render();
recoverMissingFarm();
if(!storageLoadFailed)loadRegister2026();

function registerSummary(){
 const imported=data.calfRegisterImport;
 if(!imported)return '<div class="card"><p>The 2026 birth register has not loaded into this browser.</p>'+button('Load 2026 register','retry-register','',true)+'</div>';
 return '<div class="card"><strong>2026 birth register</strong><p>322 beef expected alive · 205 Friesian heifers expected alive</p><p class="alert">208 heifer tags are listed: three deceased heifers still need their tags identified.</p><p class="hint">New records are Ungrouped until their current pen or paddock is verified. Estimated birthdates are marked.</p>'+button('View import and deaths','register-details')+'</div>';
}
function showRegisterDetails(){
 const imported=data.calfRegisterImport;
 if(!imported){show('2026 calf register',registerSummary());return;}
 const deaths=imported.deaths.map(d=>'<li>'+esc((d.type==='Beef'?'Beef':'Friesian heifer')+' '+(d.tag==='Unknown'?'— tag unknown':d.tag)+' · '+d.date+' · '+d.notes)+'</li>').join('');
 show('2026 register imported','<p>'+imported.added+' new calves added · '+imported.matched+' existing tags matched · '+imported.filledBirths+' missing birthdates filled</p><p>Existing group assignments, recorded birthdates and health entries were kept.</p><p class="alert">Three heifer deaths have unknown tags. Those three calves remain among the 208 listed heifer tags until verified. Death tag 205 is provisionally treated as 6205.</p><h3>Recorded deaths</h3><ul>'+deaths+'</ul><p class="hint">The four known beef deaths and three known heifer death tags were excluded from the new records.</p>');
}
function loadRegister2026(){
 if(data.calfRegisterImport?.id===calfRegister2026.id)return;
 const result=mergeCalfRegister(data,calfRegister2026,id,new Date().toISOString());
 try{
  const backupKey=key+'-before-register-2026';
  if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,JSON.stringify(data));
  localStorage.setItem(key,JSON.stringify(result.next));
 }catch{
  say('The 2026 register could not be saved. Your existing records are unchanged. Export a backup and check available browser storage, then use Load 2026 register in Calves.');return;
 }
 data=result.next;tab='Calves';render();
 say('2026 register loaded: '+result.added+' calves added, '+result.matched+' existing tags matched. Three unidentified heifer deaths remain flagged.');
}

function assignRangeForm(selectedGroup=''){
 if(!data.groups.length){show('Create a group first','<p>Go to Map, tap Add group, give it a name and choose its pen or paddock. Then return to Calves → Assign calf range.</p>');return;}
 const options=option('','Choose a group',selectedGroup)+data.groups.map(g=>option(g.id,g.name+' · '+groupType(g),selectedGroup)).join('');
 show('Assign calf range','<p>Both end numbers are included. Only calves already in your register will be assigned.</p>'+field('First calf tag',input('start','','inputmode="numeric" pattern="[0-9]+" required placeholder="90"'))+field('Last calf tag',input('end','','inputmode="numeric" pattern="[0-9]+" required placeholder="170"'))+field('Destination group',select('target',options))+field('Calves to include',select('scope',option('all','All eligible calves in range','all')+option('ungrouped','Only Ungrouped calves','all')))+field('Group headcounts',select('recount',option('yes','Recount affected groups from calf records','yes')+option('no','Keep existing manual headcounts','yes'))),v=>{
  let plan;try{plan=planCalfRange(data,v.start,v.end,v.target,v.scope==='ungrouped')}catch(e){return error(e.message)}
  if(!plan.selected.length)return error('No calves to move. '+plan.already.length+' already in this group; '+plan.mismatched.length+' have a different calf type; '+plan.weaned.length+' weaned; '+plan.assignedSkipped.length+' already in other groups.');
  const affected=new Set([plan.target.id,...plan.selected.map(c=>c.group).filter(Boolean)]);
  const projected=applyCalfRange(data,plan,v.recount==='yes');
  const counts=[...affected].map(gid=>{const before=by(data.groups,gid),after=by(projected.groups,gid);const count=after.headcount??projected.calves.filter(c=>c.group===gid&&!c.weaned).length;return '<li>'+esc(before.name+': '+groupHeadcount(before)+' → '+count)+'</li>'}).join('');
  const reassigned=plan.selected.filter(c=>c.group).length;
  const summary='<p><strong>'+plan.selected.length+' calves → '+esc(plan.target.name)+'</strong></p><p>Tags '+plan.start+' to '+plan.end+' inclusive · '+reassigned+' moving from other groups</p><p>'+plan.already.length+' already in destination · '+plan.missingCount+' tags not in register · '+plan.mismatched.length+' different calf type skipped · '+plan.weaned.length+' weaned skipped · '+plan.assignedSkipped.length+' in other groups skipped</p><h3>Group headcounts after assignment</h3><ul>'+counts+'</ul>'+(v.recount==='yes'?'<p class="hint">Affected groups will count their recorded, unweaned calves. Any manual headcount is replaced.</p>':'<p class="hint">Manual headcounts are kept and may need adjusting.</p>')+(plan.selected.some(c=>c.type==='Dairy')&&data.calfRegisterImport?.unidentifiedDeaths?'<p class="alert">Three deceased heifers still have unknown tags; verify the selected heifers in the field.</p>':'')+'<details><summary>Selected calf tags</summary><p>'+esc(plan.selected.map(c=>c.tag).join(', '))+'</p></details>';
  show('Preview group assignment',summary,()=>{
   let next;try{next=applyCalfRange(data,plan,v.recount==='yes')}catch(e){return error(e.message)}
   return commit(d=>Object.assign(d,next),plan.selected.length+' calves assigned to '+plan.target.name+'. You can undo this in Calves.');
  },'Assign '+plan.selected.length+' calves');return false;
 },'Preview assignment');
}
function undoRangeForm(){
 const count=data.lastCalfRangeAssignment?.assignments.length;
 if(!count)return;
 show('Undo range assignment','<p>Return '+count+' calves to their previous groups and restore the previous headcount settings.</p>',()=>{
  let next;try{next=undoCalfRange(data)}catch(e){return error(e.message)}
  return commit(d=>{delete d.lastCalfRangeAssignment;Object.assign(d,next)},'Range assignment undone.');
 },'Undo assignment');
}

function recoveryCandidates(){
 const sources=[];
 try{const raw=localStorage.getItem(key+'-before-register-2026');const saved=raw&&JSON.parse(raw);if(validBackup(saved)&&hasFarmLayout(saved))sources.push({label:'the backup from before the calf import',records:saved});}catch{}
 if(validBackup(savedFarmRecovery))sources.push({label:'the saved 9 November farm backup',records:savedFarmRecovery});
 return sources;
}
function recoverMissingFarm(){
 if(storageLoadFailed||data.farmRecovery?.id==='farm-recovery-20261115')return;
 const sources=recoveryCandidates();
 // Complete existing layouts are left alone. Recovery is automatic only when the farm view is missing.
 if(hasFarmLayout(data)&&data.groups.length)return;
 let next=structuredClone(data),used=[];
 for(const source of sources.slice(0,1)){
  const result=mergeMissingFarm(next,source.records);
  if(result.zonesAdded||result.shapesAdded||result.groupsAdded||result.imagesAdded||(!next.shedOutline&&result.next.shedOutline))used.push(source.label);
  next=result.next;
 }
 if(!used.length)return;
 next.farmRecovery={id:'farm-recovery-20261115',sources:used,at:new Date().toISOString()};
 if(saveRecoveredFarm(next)){
  tab='Map';mapPage=farmHome();render();say('Recovered missing paddocks, shed pens and saved groups. Your calf register is kept.');
 }
}
function saveRecoveredFarm(next){
 try{
  const snapshotKey=key+'-before-farm-recovery';
  if(!localStorage.getItem(snapshotKey))localStorage.setItem(snapshotKey,JSON.stringify(data));
  localStorage.setItem(key,JSON.stringify(next));
 }catch{say('Recovery could not be saved. Your existing records and backups are unchanged.');return false;}
 data=next;return true;
}
function farmRecoverySummary(){
 if(!data.farmRecovery)return '';
 return '<div class="card"><strong>Farm layout recovered</strong><p>Recovered missing farm data from '+esc(data.farmRecovery.sources.join(' and '))+'. The calf register has been kept.</p><p class="hint">The 9 November backup may not include later groups or layout edits.</p>'+button('Recovery details','farm-recovery-details')+'</div>';
}
function showFarmRecovery(){
 show('Farm recovery',farmRecoverySummary()+'<p>'+data.zones.length+' locations · '+data.groups.length+' groups · '+data.calves.length+' calf records currently saved.</p><p>If a newer group or outline is still missing, use a newer exported backup. Do not clear browser data: the pre-import backup may still contain your newer setup.</p>');
}
function recoverFarmForm(){
 if(storageLoadFailed){show('Saved records need checking','<p>The current saved records could not be read. They have not been overwritten. Please export or locate your latest backup before restoring it here.</p>');return;}
 const sources=recoveryCandidates();
 const choices=option('','Choose a backup','')+sources.map((source,i)=>option(String(i),source.label+' · '+source.records.groups.length+' groups · '+source.records.zones.length+' locations','')).join('');
 show('Recover paddocks and groups','<p>This adds missing paddocks, shed pens, reference maps and groups. Existing calf records and existing outlines are kept.</p>'+field('Recovery backup',select('source',choices)),v=>{
  const source=sources[Number(v.source)];if(v.source===''||!source)return error('Choose a backup.');
  const result=mergeMissingFarm(data,source.records);
  show('Preview farm recovery','<p>From '+esc(source.label)+'</p><p>'+result.zonesAdded+' locations added · '+result.shapesAdded+' outlines recovered · '+result.groupsAdded+' groups added · '+result.imagesAdded+' reference maps recovered</p><p>Your '+data.calves.length+' calf records will be kept.</p>',()=>{
   const fresh=mergeMissingFarm(data,source.records).next;
   fresh.farmRecovery={id:'farm-recovery-20261115',sources:[source.label],at:new Date().toISOString()};
   if(!saveRecoveredFarm(fresh))return false;mapPage=farmHome();tab='Map';render();say('Farm layout recovered.');return true;
  },'Recover farm layout');return false;
 },'Preview recovery');
}
