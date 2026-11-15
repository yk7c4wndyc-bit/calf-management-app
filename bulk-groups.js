'use strict';
function planCalfRange(records,startText,endText,groupId,onlyUngrouped=false){
 if(!/^\d+$/.test(startText)||!/^\d+$/.test(endText))throw Error('Enter whole calf tag numbers.');
 const start=Number(startText),end=Number(endText);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start)throw Error('The last tag must be at least the first tag.');
 const target=records.groups.find(g=>g.id===groupId);
 if(!target)throw Error('Choose a destination group.');
 const type=target.type??(/\bbeef\b/i.test(target.name)?'Beef':'Dairy');
 const inRange=records.calves.filter(c=>/^\d+$/.test(c.tag.trim())&&Number(c.tag)>=start&&Number(c.tag)<=end);
 const weaned=inRange.filter(c=>c.weaned),active=inRange.filter(c=>!c.weaned);
 const mismatched=active.filter(c=>type!=='Mixed'&&c.type&&c.type!==type);
 const eligible=active.filter(c=>!mismatched.includes(c));
 const already=eligible.filter(c=>c.group===groupId);
 const assignedSkipped=eligible.filter(c=>c.group&&c.group!==groupId&&onlyUngrouped);
 const selected=eligible.filter(c=>c.group!==groupId&&(!onlyUngrouped||!c.group));
 return {start,end,target,selected,already,assignedSkipped,mismatched,weaned,missingCount:end-start+1-inRange.length};
}
function applyCalfRange(records,plan,recount){
 const next=structuredClone(records),affected=new Set([plan.target.id]);
 const assignments=plan.selected.map(c=>({id:c.id,before:c.group,after:plan.target.id}));
 for(const row of assignments){
  const calf=next.calves.find(c=>c.id===row.id);
  if(calf.group!==row.before)throw Error('A calf changed groups. Preview the range again.');
  if(row.before)affected.add(row.before);
  calf.group=row.after;
 }
 const counts=[];
 if(recount)for(const group of next.groups.filter(g=>affected.has(g.id))){
  counts.push({id:group.id,before:group.headcount??null});group.headcount=null;
 }
 next.lastCalfRangeAssignment={assignments,counts};
 return next;
}
function undoCalfRange(records){
 const last=records.lastCalfRangeAssignment;
 if(!last)throw Error('There is no range assignment to undo.');
 if(last.assignments.some(r=>records.calves.find(c=>c.id===r.id)?.group!==r.after)||last.counts.some(r=>records.groups.find(g=>g.id===r.id)?.headcount!=null))throw Error('These calves or group counts have changed since the assignment. Edit their groups individually.');
 const next=structuredClone(records);
 for(const row of last.assignments){
  if(row.before&&!next.groups.some(g=>g.id===row.before))throw Error('An original group no longer exists.');
  next.calves.find(c=>c.id===row.id).group=row.before;
 }
 for(const row of last.counts)next.groups.find(g=>g.id===row.id).headcount=row.before;
 delete next.lastCalfRangeAssignment;return next;
}
