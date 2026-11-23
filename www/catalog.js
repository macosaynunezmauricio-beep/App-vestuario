const catalog = {clothes: [], looks: [], generation: 0, favoritesOnly: false};
const names = new Intl.Collator('es-MX', {sensitivity:'base',numeric:true});
function searchable(value) {
 return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function filteredClothes(clothes, {category,color,query,favoritesOnly,order}) {
 const term=searchable(query);
 const result=clothes.filter(item=>(!category||item.category===category)&&
  (!color||item.color===color||item.secondaryColor===color)&&(!favoritesOnly||item.favorite)&&
  searchable([item.name,item.category,item.color,item.secondaryColor,item.style].filter(Boolean).join(' ')).includes(term));
 return result.sort((a,b)=>{
  if(order==='category')return names.compare(a.category,b.category)||names.compare(a.name,b.name);
  if(order==='name')return names.compare(a.name,b.name);
  return (Number(b.id)||0)-(Number(a.id)||0)||names.compare(a.name,b.name);
 });
}
function icon(key){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');
 svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#i-'+key);svg.append(use);return svg;
}
function action(label,cls,handler){
 const button=el('button',cls,label);
 button.type='button';button.onclick=handler;return button;
}
function thumb(item){
 const img=el('img');img.alt='';img.src=item.thumb||item.image;img.loading='lazy';img.decoding='async';return img;
}
function smallCard(item,label,handler){
 const button=action(undefined,'thumb-button',handler);
 button.setAttribute('aria-label',label+' '+item.name);button.append(thumb(item),el('span','',item.name));return button;
}
async function editItem(item){
 try{const full=await request(db.transaction('clothes').objectStore('clothes').get(item.id));if(full)openRegistration(full);}
 catch{notify('No se pudo abrir la prenda.');}
}
async function toggleFavorite(item){
 try{
  const tx=db.transaction('clothes','readwrite'),done=transactionDone(tx),table=tx.objectStore('clothes');
  const lookup=table.get(item.id);
  lookup.onsuccess=()=>{if(lookup.result)table.put({...lookup.result,favorite:!lookup.result.favorite});};
  await done;await render();
 }catch{notify('No se pudo actualizar la favorita.');}
}
function card(item,editable=false){
 const node=el('article','item'),info=el('div','info');node.append(thumb(item));
 info.append(el('strong','',item.name),el('div','muted',[item.color,item.secondaryColor,item.category].filter(Boolean).join(' · ')));
 if(editable){
  const fav=action(undefined,'favorite-button',()=>toggleFavorite(item));fav.append(icon('heart'));
  fav.setAttribute('aria-label',(item.favorite?'Quitar de favoritas: ':'Marcar favorita: ')+item.name);
  fav.setAttribute('aria-pressed',String(!!item.favorite));node.append(fav);
  const buttons=el('div','card-actions');
  buttons.append(action('Probar','secondary',()=>{showTab('tryon');addGarment(item);}),action('Editar','text-action',()=>editItem(item)));
  const more=el('details','more-actions');more.append(el('summary','','Más opciones'),action('Eliminar prenda','danger',async()=>{
   if(confirm('¿Eliminar «'+item.name+'» del armario?')){await remove('clothes',item.id);await render();}
  }));info.append(buttons,more);
 }
 node.append(info);return node;
}
function drawCatalog(){
 const clothes=catalog.clothes;
 const list=filteredClothes(clothes,{category:$('#filter').value,color:$('#filterColor').value,query:$('#searchClothes').value,
  favoritesOnly:catalog.favoritesOnly,order:$('#order').value});
 $('#count').textContent=(list.length!==clothes.length?list.length+' de ':'')+clothes.length+(clothes.length===1?' prenda':' prendas');
 const items=$('#items');items.replaceChildren(...list.map(item=>card(item,true)));
 if(!list.length)items.append(el('p','empty',clothes.length?'Ninguna prenda coincide con estos filtros.':'Tu armario está vacío. Añade tu primera prenda.'));
 $('#filterToggle').textContent=($('#filter').value||$('#filterColor').value||$('#order').value!=='recent')?'Filtros activos':'Filtros';
 $('#filterToggle').prepend(icon('filter'));
}
function lookTitle(record){
 if(record.name)return record.name;
 const date=new Date(Number(record.id));return record.occasion+(Number.isNaN(date.getTime())?'':' · '+date.toLocaleDateString('es-MX'));
}
function drawLookList(){
 const list=$('#favorites');list.replaceChildren();
 for(const record of catalog.looks){
  const node=el('article','panel'),grid=el('div','outfit');
  node.append(el('h2','',lookTitle(record)));record.items.forEach(i=>grid.append(thumb(i)));node.append(grid);
  if(record.editable)node.append(action('Abrir en el probador','secondary',async()=>{showTab('tryon');await openLook(record.id);}));
  else node.append(action('Probar estas prendas','secondary',()=>tryGroup(record.items)));
  node.append(action('Eliminar','text-action',async()=>{
   if(confirm('¿Eliminar este conjunto guardado?')){await remove('outfits',record.id);if(editingLook===record.id)resetLookName();await render();}
  }));list.append(node);
 }
 if(!catalog.looks.length)list.append(el('p','empty','Aquí aparecerán los conjuntos que guardes al combinar o probarte ropa.'));
}
async function render(){
 if(!db)return;
 const generation=++catalog.generation;
 const [clothes,looks]=await Promise.all([all('clothes'),all('outfits')]);
 if(catalog.generation!==generation)return;
 catalog.clothes=clothes.map(({original,...item})=>item).reverse();
 catalog.looks=looks.reverse().map(({id,name,occasion,items,composition})=>({id,name,occasion,items,editable:!!composition}));
 const recent=$('#recentClothes');recent.replaceChildren(...catalog.clothes.slice(0,7).map(item=>smallCard(item,'Editar',()=>editItem(item))));
 if(!clothes.length)recent.append(action('Añadir mi primera prenda','secondary',()=>openRegistration()));
 const rail=$('#garmentRail');rail.replaceChildren(...catalog.clothes.map(item=>smallCard(item,'Añadir',()=>addGarment(item))));
 if(!clothes.length)rail.append(action('Añadir ropa al armario','secondary',()=>openRegistration()));
 const colors=$('#filterColor'),oldColor=colors.value;
 colors.replaceChildren(new Option('Todos',''),...Array.from(new Set(clothes.flatMap(c=>[c.color,c.secondaryColor]).filter(Boolean))).sort(names.compare).map(c=>new Option(c,c)));
 colors.value=oldColor;if(colors.selectedIndex<0)colors.selectedIndex=0;
 $('#lookCount').textContent=catalog.looks.length===1?'1 conjunto':catalog.looks.length+' conjuntos';
 drawCatalog();drawLookList();refreshLooks();
}
function bindCatalog(){
 $('#favFilter').onclick=e=>{catalog.favoritesOnly=!catalog.favoritesOnly;e.currentTarget.setAttribute('aria-pressed',String(catalog.favoritesOnly));drawCatalog();};
 $('#filterToggle').onclick=e=>{const panel=$('#catalogFilters');panel.hidden=!panel.hidden;e.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));};
 for(const id of ['filter','filterColor','order'])$('#'+id).onchange=drawCatalog;
 $('#searchClothes').oninput=drawCatalog;
 $('#clearFilters').onclick=()=>{$('#searchClothes').value=$('#filter').value=$('#filterColor').value='';$('#order').value='recent';catalog.favoritesOnly=false;$('#favFilter').setAttribute('aria-pressed','false');drawCatalog();};
 $('#brand').onclick=()=>showTab('home');$('#enterStudio').onclick=()=>showTab('tryon');$('#seeCloset').onclick=()=>showTab('closet');
}

async function garmentThumbnail(source){
 const image=await loadImage(source);
 const scale=Math.min(1,216/Math.max(image.width,image.height));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 const trimmed=trimGarment(canvas);
 return trimmed.toDataURL('image/webp',.84);
}
