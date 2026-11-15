'use strict';
function mergeMissingFarm(current,backup){
 const next=structuredClone(current),zoneIds=new Map();
 const normalize=value=>value.trim().toLowerCase().replace(/\s+/g,' ');
 let zonesAdded=0,shapesAdded=0,groupsAdded=0,imagesAdded=0;
 for(const saved of backup.zones){
  let zone=next.zones.find(z=>z.id===saved.id)??next.zones.find(z=>z.kind===saved.kind&&normalize(z.name)===normalize(saved.name));
  if(!zone){zone=structuredClone(saved);next.zones.push(zone);zonesAdded++;}
  else{
   for(const prop of ['shape','separateImage','mapArea'])if(zone[prop]===undefined&&saved[prop]!==undefined){zone[prop]=structuredClone(saved[prop]);if(prop==='shape')shapesAdded++;}
  }
  zoneIds.set(saved.id,zone.id);
 }
 for(const group of backup.groups){
  const existing=next.groups.find(g=>g.id===group.id)??next.groups.find(g=>normalize(g.name)===normalize(group.name));
  if(!existing){next.groups.push({...structuredClone(group),zone:zoneIds.get(group.zone)??group.zone});groupsAdded++;}
 }
 for(const [name,image] of Object.entries(backup.images??{})){
  const mapped=name.startsWith('location:')?'location:'+(zoneIds.get(name.slice(9))??name.slice(9)):name;
  if(!next.images?.[mapped]){next.images??={};next.images[mapped]=structuredClone(image);imagesAdded++;}
 }
 for(const prop of ['shedOutline','shedPosition'])if(next[prop]===undefined&&backup[prop]!==undefined)next[prop]=structuredClone(backup[prop]);
 if(backup.layout){next.layout??={};for(const [key,value] of Object.entries(backup.layout))if(next.layout[key]===undefined)next.layout[key]=structuredClone(value);}
 // A corrupt dangling group reference can be repaired without changing a valid assignment.
 for(const calf of next.calves)if(calf.group&&!next.groups.some(g=>g.id===calf.group)){
  const prior=backup.calves.find(c=>c.id===calf.id||c.tag===calf.tag);
  if(prior?.group&&next.groups.some(g=>g.id===prior.group))calf.group=prior.group;
 }
 return {next,zonesAdded,shapesAdded,groupsAdded,imagesAdded};
}
function hasFarmLayout(records){return Boolean(records.shedOutline||records.zones?.some(z=>z.shape)||Object.keys(records.images??{}).length);}
