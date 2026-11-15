'use strict';
function mergeCalfRegister(records, register, makeId, importedAt) {
 if (records.calfRegisterImport?.id === register.id) return {next:records, added:0, matched:0, filledBirths:0, alreadyImported:true};
 const next=structuredClone(records);
 const existing=new Map(next.calves.map(c=>[c.tag.trim().toLowerCase(),c]));
 let added=0,matched=0,filledBirths=0;
 for(const row of register.rows){
  const tag=row.tag.trim(),match=existing.get(tag.toLowerCase());
  const provenance={birthBasis:row.birthBasis,birthSource:row.birthSource,registerImportId:register.id};
  if(match){
   matched++;
   // Existing pen, group, health and edited birth records remain authoritative.
   if(!match.birth){Object.assign(match,provenance,{birth:row.birth});filledBirths++;}
   match.registerBirthReference={birth:row.birth,...provenance};
   continue;
  }
  const calf={id:makeId(),tag,birth:row.birth,type:row.type,dam:'',group:'',weaned:'',health:[],
   notes:'2026 register. '+row.birthBasis+'. '+row.notes+(row.birthSource?' Source: '+row.birthSource:''),...provenance};
  next.calves.push(calf);existing.set(tag.toLowerCase(),calf);added++;
 }
 next.calfRegisterImport={id:register.id,importedAt,added,matched,filledBirths,
  expectedAlive:register.expectedAlive,unidentifiedDeaths:register.unidentifiedDeaths,deaths:structuredClone(register.deaths)};
 return {next,added,matched,filledBirths,alreadyImported:false};
}
