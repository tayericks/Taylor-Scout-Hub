// Keep the Crew Maps source-location selector organized by episode without changing React data flow.
// This is intentionally additive: React still owns the selected value/change event.
function episodeFromOption(option){
  const text=String(option?.textContent||'');
  const explicit=text.match(/(?:episode|ep\.?)[\s:#-]*([A-Za-z0-9 &-]+)/i);
  if(explicit)return explicit[1].trim();
  return String(option?.dataset?.episode||'').trim();
}
function eventEpisodeMap(){
  const map=new Map();
  try{
    // Crew Maps stores no event data globally, so preserve any episode metadata already stamped by React/runtime.
    document.querySelectorAll('option[data-episode]').forEach(o=>map.set(o.value,o.dataset.episode));
  }catch{}
  return map;
}
function groupSelect(select){
  if(!select||select.dataset.episodeGrouped==='1')return;
  const label=select.closest('label')?.querySelector('small')?.textContent||'';
  if(!/calendar\s*\/\s*location/i.test(label))return;
  const options=[...select.options];
  if(options.length<2)return;
  const placeholder=options.find(o=>!o.value);
  const groups=new Map();
  const meta=eventEpisodeMap();
  for(const option of options){
    if(!option.value)continue;
    const episode=option.dataset.episode||meta.get(option.value)||episodeFromOption(option)||'Unassigned';
    if(!groups.has(episode))groups.set(episode,[]);
    groups.get(episode).push(option);
  }
  if(groups.size<2&&[...groups.keys()][0]==='Unassigned')return;
  const value=select.value;
  select.innerHTML='';
  if(placeholder)select.append(placeholder);
  [...groups.entries()].sort(([a],[b])=>String(a).localeCompare(String(b),undefined,{numeric:true})).forEach(([episode,items])=>{
    const g=document.createElement('optgroup');g.label=/^episode\b/i.test(episode)?episode:`Episode ${episode}`;
    items.forEach(o=>g.append(o));select.append(g);
  });
  select.value=value;
  select.dataset.episodeGrouped='1';
}
function repair(){document.querySelectorAll('.cmb-generate select').forEach(groupSelect)}
new MutationObserver(()=>queueMicrotask(repair)).observe(document.documentElement,{childList:true,subtree:true});
queueMicrotask(repair);
