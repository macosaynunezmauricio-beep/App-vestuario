// Local recommendations; keep candidate work bounded even with a large closet.
const outfitSlots=['Superior','Inferior','Calzado'];
const outfitNeutrals=new Set(['Negro','Blanco','Gris','Plata','Carbón','Beige','Café','Marrón','Crema','Arena','Azul marino']);
function colorPair(a,b){
 if(!a||!b||a==='Otro'||b==='Otro')return 1;
 if(a===b)return 2;
 if(outfitNeutrals.has(a)||outfitNeutrals.has(b))return 3;
 if((a==='Azul'&&b==='Verde')||(a==='Verde'&&b==='Azul'))return 2;
 return 0;
}
function outfitPreference(item,occasion){
 return (item.style===occasion?4:item.style==='Versátil'?2:0)+(item.favorite?1:0);
}
function outfitScore(items,occasion){
 let score=0;
 for(let i=0;i<items.length;i++){
  score+=outfitPreference(items[i],occasion);
  for(let j=0;j<i;j++)score+=colorPair(items[i].color,items[j].color);
 }
 return score;
}
function outfitKey(items){return JSON.stringify(items.map(item=>item.id));}
function suggestOutfit(clothes,occasion,previous=[],pinned=null){
 const pools=outfitSlots.map(slot=>pinned?.category===slot?[pinned]:clothes.filter(item=>item.category===slot)
  .sort((a,b)=>outfitPreference(b,occasion)-outfitPreference(a,occasion)).slice(0,16));
 if(pools.some(pool=>!pool.length))return [];
 const previousKey=outfitKey(previous);
 let best=[],max=-Infinity,repeat=[];
 for(const top of pools[0])for(const bottom of pools[1])for(const shoes of pools[2]){
  const items=[top,bottom,shoes];
  if(outfitKey(items)===previousKey){repeat=items;continue;}
  const score=outfitScore(items,occasion);
  if(score>max){max=score;best=items;}
 }
 return best.length?best:repeat;
}
function outfitAlternatives(clothes,items,index,occasion){
 if(!items[index])return [];
 return clothes.filter(item=>item.category===items[index].category&&item.id!==items[index].id)
  .map(item=>{
   const next=items.slice();next[index]=item;
   return {item,score:outfitScore(next,occasion)};
  }).sort((a,b)=>b.score-a.score).map(entry=>entry.item);
}

let outfitDraft=[],outfitAnchor=null,draftOccasion='Casual',outfitSaving=false;
function garmentComposition(items){
 const grid=el('div','look-composition');
 for(const item of items){
  const figure=el('figure','look-piece');
  const caption=el('figcaption','',item.name);
  if(item.shopCandidate===true)caption.append(el('small','shop-label','De tienda'));
  figure.append(thumb(item),caption);grid.append(figure);
 }
 return grid;
}
function renderOutfitDraft(focusIndex=-1){
 const box=$('#suggestion');
 replaceContents(box);
 if(outfitAnchor){
  box.append(el('p','muted','Combinando '+outfitAnchor.name+' con tu ropa. No se añadió a tu armario.'),
   action('Quitar prenda de tienda','text-action',()=>{outfitAnchor=null;outfitDraft=[];renderOutfitDraft();}));
 }
 if(!outfitDraft.length){
  const missing=outfitSlots.filter(slot=>outfitAnchor?.category!==slot&&!catalog.clothes.some(item=>item.category===slot));
  box.append(el('p','muted',missing.length?'Para armar un conjunto, añade: '+missing.join(', ')+'.':'Pulsa Crear combinación para empezar.'));
  return;
 }
 const grid=garmentComposition(outfitDraft);
 const choices=el('div','swap-choices');choices.hidden=true;
 const swapButtons=[];
 outfitDraft.forEach((item,index)=>{
  const alts=item.shopCandidate?[]:outfitAlternatives(catalog.clothes,outfitDraft,index,draftOccasion);
  const button=action('Cambiar','text-action',()=>{
   const toggle=button.getAttribute('aria-expanded')!=='true';
   for(const b of swapButtons)b.setAttribute('aria-expanded','false');
   choices.hidden=!toggle;
   if(!toggle)return;
   button.setAttribute('aria-expanded','true');
   const label=el('h3','','Alternativas para '+item.name);
   const rail=el('div','rail');
   for(const other of alts)rail.append(smallCard(other,'Elegir',()=>{
    outfitDraft=outfitDraft.map((existing,i)=>i===index?other:existing);
    renderOutfitDraft(index);
   }));
   replaceContents(choices,label,rail);
   rail.firstElementChild?.focus();
  });
  button.setAttribute('aria-label','Cambiar '+item.name);
  button.setAttribute('aria-controls','swapChoices');
  button.setAttribute('aria-expanded','false');
  button.disabled=!alts.length;swapButtons.push(button);
  if(!item.shopCandidate)grid.children[index].append(button);
 });
 choices.id='swapChoices';
 const actions=el('div','look-actions');
 const open=action('Probar conjunto','',()=>tryGroup(outfitDraft));
 const save=action('Guardar conjunto','secondary',async()=>{
  if(outfitSaving)return;
  outfitSaving=true;save.disabled=true;
  const items=outfitDraft.slice(),occasion=draftOccasion;
  try{
   await put('outfits',{id:Date.now(),occasion,items});
   await render();notify('Conjunto guardado.');
  }catch{notify('No se pudo guardar el conjunto.');}
  finally{outfitSaving=false;save.disabled=false;}
 });
 actions.append(open,save);
 box.append(el('h3','','Tu combinación'),grid,choices,actions);
 swapButtons[focusIndex]?.focus();
}
function drawHomeLook(){
 const box=$('#homeLook'),record=catalog.looks[0];
 replaceContents(box);
 if(record){
  box.append(el('h2','','Último conjunto'),el('p','look-name',lookTitle(record)),
   garmentComposition(record.items.slice(0,4)),
   action('Probar este conjunto','secondary',async()=>{
    if(record.editable){showTab('tryon');await openLook(record.id);}
    else await tryGroup(record.items);
   }));
 }else{
  box.append(el('h2','','Tu primer conjunto'),
   el('p','muted','Combina tres prendas y mira el conjunto sin subir una foto de cuerpo entero.'),
   action('Ir a Combinar','secondary',()=>showTab('style')));
 }
}
function bindOutfits(){
 $('#generate').onclick=()=>{
  const occasion=$('#occasion').value;
  outfitDraft=suggestOutfit(catalog.clothes,occasion,occasion===draftOccasion?outfitDraft:[],outfitAnchor);
  draftOccasion=occasion;
  renderOutfitDraft();
 };
 $('#occasion').onchange=()=>{outfitDraft=[];renderOutfitDraft();};
}
