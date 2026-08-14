// Group the Crew Maps source-location selector by episode while leaving React in control of selection.
let episodeByEventId=new Map();
let loadingMeta=false;
async function loadMeta(){
  if(loadingMeta||episodeByEventId.size)return;
  loadingMeta=true;
  try{
    const mod=await import('../supabase.js');
    const params=new URLSearchParams(location.search);
    const showId=params.get('showId')||params.get('show');
    if(!showId)return;
    const {data,error}=await mod.supabase.from('tool_documents').select('payload').eq('show_id',showId).eq('tool_key','calendar').maybeSingle();
    if(error)throw error;
    for(const event of data?.payload?.events||[]){if(event?.id)episodeByEventId.set(String(event.id),String(event.episode||'Unassigned'))}
  }catch(error){console.warn('Crew Maps episode grouping could not load Calendar metadata',error)}
  finally{loadingMeta=false;repair()}
}
function groupSelect(select){
  if(!select)return;
  const label=select.closest('label')?.querySelector('small')?.textContent||'';
  if(!/calendar\s*\/\s*location/i.test(label))return;
  const flat=[...select.querySelectorAll(':scope > option')];
  if(flat.length<2||!episodeByEventId.size){loadMeta();return}
  const placeholder=flat.find(o=>!o.value),value=select.value,groups=new Map();
  for(const option of flat){
    if(!option.value)continue;
    const episode=episodeByEventId.get(String(option.value))||'Unassigned';
    if(!groups.has(episode))groups.set(episode,[]);
    groups.get(episode).push(option);
  }
  if(groups.size===1&&groups.has('Unassigned'))return;
  select.innerHTML='';if(placeholder)select.append(placeholder);
  [...groups.entries()].sort(([a],[b])=>String(a).localeCompare(String(b),undefined,{numeric:true})).forEach(([episode,items])=>{
    const g=document.createElement('optgroup');g.label=/^episode\b/i.test(episode)?episode:`Episode ${episode}`;items.forEach(o=>g.append(o));select.append(g);
  });
  select.value=value;select.dataset.episodeGrouped='1';
}
function repair(){document.querySelectorAll('.cmb-generate select').forEach(groupSelect)}
new MutationObserver(()=>queueMicrotask(repair)).observe(document.documentElement,{childList:true,subtree:true});
queueMicrotask(()=>{loadMeta();repair()});
