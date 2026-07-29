(() => {
  "use strict";
  const items = window.GRAVITY_GOONS_GALLERY || [];
  const storageKey = "gravity-goons-creator-reserve-v1";
  const targetRarity = { Legendary: 2, Epic: 6, Rare: 12, Uncommon: 15, Common: 15 };
  const rarityRank = { Legendary: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1 };
  const selection = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]").map(Number));
  let visible = items;
  let modalId = null;
  let toastTimer;
  const $ = (id) => document.getElementById(id);
  const controls = ["search","rarity","discipline","species","cast","body-build","equipment","play-style","stat","stat-min","selection","sort"];
  const pad = (id) => String(id).padStart(4, "0");
  const esc = (value) => { const span = document.createElement("span"); span.textContent = value ?? ""; return span.innerHTML; };
  const counts = (field) => items.filter((item) => selection.has(item.id)).reduce((out,item) => { const key=item[field]; out[key]=(out[key]||0)+1; return out; },{});
  const totalEth = () => items.filter((item) => selection.has(item.id)).reduce((sum,item) => sum + Number(item.price_eth),0);

  function save(){ localStorage.setItem(storageKey, JSON.stringify([...selection].sort((a,b)=>a-b))); }
  function toast(message){ const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1800); }
  function fill(id, values){ const select=$(id); [...new Set(values)].sort().forEach((value)=>select.add(new Option(value,value))); }
  function initialize(){
    fill("rarity",Object.keys(rarityRank)); fill("discipline",items.map(x=>x.discipline)); fill("species",items.map(x=>x.species));
    fill("cast",items.map(x=>x.cast)); fill("body-build",items.map(x=>x.body_build)); fill("equipment",items.map(x=>x.equipment));
    fill("play-style",items.map(x=>x.play_style)); fill("stat",["Speed","Air","Control","Style","Toughness"]);
    controls.forEach((id)=>$(id).addEventListener("input",render));
  }
  function targetPills(values, targets){ return Object.entries(targets).map(([key,target])=>{ const value=values[key]||0; const cls=value>target?"over":value===target?"met":""; return `<span class="target-pill ${cls}">${esc(key)} ${value}/${target}</span>`; }).join(""); }
  function updateDashboard(){
    const size=selection.size; $("selected-count").textContent=size; $("selected-value").textContent=totalEth().toFixed(4).replace(/0+$/,"").replace(/\.$/,"");
    $("progress-fill").style.width=`${Math.min(100,size*2)}%`; $("export-json").disabled=$("export-csv").disabled=size!==50;
    $("rarity-targets").innerHTML=targetPills(counts("rarity"),targetRarity);
    const disciplines=[...new Set(items.map(x=>x.discipline))].sort(); const dCounts=counts("discipline");
    $("discipline-targets").innerHTML=disciplines.map((key)=>`<span class="target-pill ${(dCounts[key]||0)>=8?"met":""}">${esc(key)} ${dCounts[key]||0}</span>`).join("");
  }
  function toggle(id){
    if(selection.has(id)){selection.delete(id);toast(`#${pad(id)} removed`);}else if(selection.size>=50){toast("Your reserve already has 50 Goons");return;}else{selection.add(id);toast(`#${pad(id)} added`);} save(); render(); if(modalId===id) renderModal();
  }
  function card(item){
    const article=document.createElement("article"); article.className=`card ${selection.has(item.id)?"selected":""}`;
    const statOrder=["Speed","Air","Control","Style","Toughness"];
    article.innerHTML=`<button class="image-button" type="button"><img src="${item.thumb}" alt="Gravity Goons #${pad(item.id)}" loading="lazy" decoding="async" /></button><div class="badges"><span class="badge">${esc(item.rarity)}</span>${item.creator_customization?'<span class="badge corrected">CUSTOM</span>':item.reviewed_replacement?'<span class="badge corrected">CORRECTED</span>':""}</div><div class="card-body"><div class="card-title"><span>#${pad(item.id)} · ${esc(item.species)}</span><span>${esc(item.price_eth)} ETH</span></div><p class="card-meta">${esc(item.discipline)} · ${esc(item.play_style)}<br>${esc(item.trick_specialty)} · ${esc(item.sponsor)}</p><div class="mini-stats">${statOrder.map(k=>`<span>${k.slice(0,3).toUpperCase()} ${item.stats[k]}</span>`).join("")}</div><button class="keep" type="button">${selection.has(item.id)?"✓ KEEPING":"+ KEEP"}</button></div>`;
    article.querySelector(".image-button").addEventListener("click",()=>openModal(item.id)); article.querySelector(".keep").addEventListener("click",()=>toggle(item.id)); return article;
  }
  function render(){
    const q=$("search").value.trim().toLowerCase().replace(/^#/,""); const stat=$("stat").value; const min=Number($("stat-min").value);
    visible=items.filter((item)=>{ const hay=`${pad(item.id)} ${item.id} ${item.name} ${item.species} ${item.discipline} ${item.sponsor} ${item.equipment} ${item.play_style} ${item.trick_specialty}`.toLowerCase(); return (!q||hay.includes(q)) && ($("rarity").value==="all"||item.rarity===$("rarity").value) && ($("discipline").value==="all"||item.discipline===$("discipline").value) && ($("species").value==="all"||item.species===$("species").value) && ($("cast").value==="all"||item.cast===$("cast").value) && ($("body-build").value==="all"||item.body_build===$("body-build").value) && ($("equipment").value==="all"||item.equipment===$("equipment").value) && ($("play-style").value==="all"||item.play_style===$("play-style").value) && (stat==="all"||Number(item.stats[stat])>=min) && ($("selection").value==="all"||($("selection").value==="selected"&&selection.has(item.id))||($("selection").value==="available"&&!selection.has(item.id))||($("selection").value==="replacements"&&(item.reviewed_replacement||item.creator_customization))); });
    const sort=$("sort").value; visible.sort((a,b)=>sort==="rarity"?rarityRank[b.rarity]-rarityRank[a.rarity]||a.id-b.id:sort==="price"?Number(b.price_eth)-Number(a.price_eth)||a.id-b.id:sort==="discipline"?a.discipline.localeCompare(b.discipline)||a.id-b.id:a.id-b.id);
    $("gallery").replaceChildren(...visible.map(card)); $("visible-count").textContent=`${visible.length.toLocaleString()} visible`; $("empty").hidden=visible.length>0; updateDashboard();
  }
  function openModal(id){modalId=id;renderModal();if(!$("viewer").open)$("viewer").showModal();}
  function renderModal(){ const item=items.find(x=>x.id===modalId); if(!item)return; $("full-image").src=item.full; $("full-image").alt=`Gravity Goons #${pad(item.id)}`; $("modal-number").textContent=`GOON #${pad(item.id)} · ${item.rarity} · ${item.price_eth} ETH`; $("modal-title").textContent=item.species; $("modal-subtitle").textContent=`${item.discipline} · ${item.play_style} · ${item.trick_specialty}`; $("modal-toggle").textContent=selection.has(item.id)?"✓ KEEPING — click to remove":"+ KEEP THIS GOON"; $("open-original").href=item.full; $("traits").innerHTML=[["Cast",item.cast],["Build",item.body_build],["Stance",item.stance],["Expression",item.expression],["Sponsor",item.sponsor],["Equipment",item.equipment],["Pose",item.pose],["Play style",item.play_style],["Signature trick",item.trick_specialty],["Stats",Object.entries(item.stats).map(([k,v])=>`${k} ${v}`).join(" · ")],["Artwork",item.creator_customization?"Creator customization":item.reviewed_replacement?"Reviewed correction":"Accepted production source"],["Source",item.source]].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(""); }
  function reservePayload(){ const selected=items.filter(x=>selection.has(x.id)).sort((a,b)=>a.id-b.id); return {schema:"gravity-goons-creator-reserve-v1",collection:"Gravity Goons",collection_seed:260718,exported_at:new Date().toISOString(),token_count:selected.length,token_ids:selected.map(x=>x.id),counts_by_rarity:selected.reduce((o,x)=>(o[x.rarity]=(o[x.rarity]||0)+1,o),{}),counts_by_discipline:selected.reduce((o,x)=>(o[x.discipline]=(o[x.discipline]||0)+1,o),{}),total_list_price_eth:totalEth().toFixed(4).replace(/0+$/,"").replace(/\.$/,""),advisory_target:{rarity:targetRarity,discipline:"approximately eight per discipline plus two flexible favorites"},tokens:selected.map(x=>({token_id:x.id,name:x.name,rarity:x.rarity,price_eth:x.price_eth,discipline:x.discipline,cast:x.cast,species:x.species,body_build:x.body_build,equipment:x.equipment,play_style:x.play_style,trick_specialty:x.trick_specialty,stats:x.stats,source:x.source,reviewed_replacement:x.reviewed_replacement}))}; }
  function download(name,type,text){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function exportJson(){if(selection.size!==50)return;download("creator-reserve.json","application/json",JSON.stringify(reservePayload(),null,2)+"\n");toast("Final creator-reserve.json saved");}
  function exportCsv(){if(selection.size!==50)return;const rows=reservePayload().tokens;const headers=["token_id","name","rarity","price_eth","discipline","cast","species","body_build","equipment","play_style","trick_specialty","reviewed_replacement"];const csv=[headers.join(","),...rows.map(row=>headers.map(h=>`"${String(row[h]??"").replaceAll('"','""')}"`).join(","))].join("\n");download("creator-reserve.csv","text/csv",csv+"\n");toast("Creator reserve CSV saved");}
  async function importFile(file){try{const text=await file.text();let ids;if(file.name.toLowerCase().endsWith(".csv")){ids=text.split(/\r?\n/).slice(1).filter(Boolean).map(line=>Number(line.match(/^"?(\d+)/)?.[1]));}else{const data=JSON.parse(text);ids=data.token_ids||data.tokens?.map(x=>x.token_id);}ids=[...new Set((ids||[]).map(Number))];if(ids.length>50||ids.some(id=>!items.some(x=>x.id===id)))throw new Error("The file contains invalid token IDs or more than 50 selections.");selection.clear();ids.forEach(id=>selection.add(id));save();render();toast(`${ids.length} selections imported`);}catch(error){toast(error instanceof Error?error.message:"Could not import that file");}}
  $("clear-filters").addEventListener("click",()=>{controls.forEach(id=>{const el=$(id);el.value=id==="stat-min"?"0":id==="sort"?"id":"all";});$("search").value="";render();});
  $("export-json").addEventListener("click",exportJson);$("export-csv").addEventListener("click",exportCsv);$("import-button").addEventListener("click",()=>$("import-file").click());$("import-file").addEventListener("change",e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value="";});
  $("close-viewer").addEventListener("click",()=>$("viewer").close());$("viewer").addEventListener("click",e=>{if(e.target===$("viewer"))$("viewer").close();});$("modal-toggle").addEventListener("click",()=>toggle(modalId));
  initialize(); render();
})();
