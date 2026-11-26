let batchVersion=0,batchBusy=false,batchSaving=false,batchDraft=[];
function resetBatch(){
 batchVersion++;batchDraft=[];batchBusy=false;
 $('#batchReview').hidden=true;$('#batchCards').textContent='';$('#batchStatus').textContent='';
 syncBatch();
}
function syncBatch(){
 const supported=!!window.Capacitor?.Plugins?.WardrobeVision&&!!window.Capacitor?.Plugins?.BodyPose;
 $('#batchPanel').hidden=!supported||!!editing;
 $('#detectBatch').disabled=batchBusy||batchSaving||!selectedPhoto||!$('#maskEditor').classList.contains('hidden');
 const selected=batchDraft.filter(d=>d.keep).length;
 $('#saveBatch').disabled=batchSaving||!selected;
 $('#saveBatch').textContent=selected===1?'Guardar 1 prenda':'Guardar '+selected+' prendas';
}
function batchPhoto(image){
 const canvas=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(image.width,image.height));
 canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 return canvas;
}
function drawBatchMask(source,alpha,w,h){
 const bounds=alphaBounds(alpha,w,h);
 if(!bounds)return null;
 const l=Math.floor(Math.max(0,bounds.l-2)*source.width/w),t=Math.floor(Math.max(0,bounds.t-2)*source.height/h),
  r=Math.ceil(Math.min(w,bounds.r+3)*source.width/w),b=Math.ceil(Math.min(h,bounds.b+3)*source.height/h);
 const c=document.createElement('canvas');
 c.width=r-l;c.height=b-t;
 const ctx=c.getContext('2d');
 ctx.drawImage(source,-l,-t);
 ctx.globalCompositeOperation='destination-in';
 ctx.drawImage(alphaCanvas(w,h,alpha),-l,-t,source.width,source.height);
 ctx.globalCompositeOperation='source-over';
 return c;
}
function shoeOutline(mask,w,h){
 if(!mask||!validVisionMask(mask))return null;
 const alpha=unpackMask(mask),sw=mask.w,sh=mask.h;
 return (x,y)=>{
  const ix=Math.min(sw-1,Math.floor((x+.5)*sw/w)),iy=Math.min(sh-1,Math.floor((y+.5)*sh/h));
  for(let row=Math.max(0,iy-1);row<=Math.min(sh-1,iy+1);row++)
   for(let col=Math.max(0,ix-1);col<=Math.min(sw-1,ix+1);col++)if(alpha[row*sw+col])return true;
  return false;
 };
}
async function detectShoeMasks(source,classes,labels,pose,bridge,isCurrent){
 const {w,h}=classes, parts=[];
 const outline=shoeOutline(pose.outline,w,h);
 for(const zone of shoeZones(pose.points,w,h)){
  if(!isCurrent()||!shoeSeed(zone,labels,w))continue;
  const dx=source.width/w,dy=source.height/h,c=document.createElement('canvas');
  c.width=Math.ceil((zone.r-zone.l)*dx);c.height=Math.ceil((zone.b-zone.t)*dy);
  c.getContext('2d').drawImage(source,zone.l*dx,zone.t*dy,(zone.r-zone.l)*dx,(zone.b-zone.t)*dy,0,0,c.width,c.height);
  const x=(zone.seed.x-zone.l)/(zone.r-zone.l),y=(zone.seed.y-zone.t)/(zone.b-zone.t);
  try{
   const {subject}=await bridge.WardrobeVision.analyze({image:c.toDataURL('image/jpeg',.9).split(',')[1],mode:'select',x,y});
   if(!isCurrent())break;
   const alpha=tappedGarment(subject,null,x,y);
   const good=alpha&&acceptShoe(alpha,subject.w,subject.h,zone,labels,w,h,outline);
   if(good)parts.push(good);
  }catch{/* An unclear shoe must not block confidently segmented clothes. */}
 }
 if(!parts.length)return null;
 const pair=parts[0];
 let overlap=0,second=0;
 if(parts.length===2){
  for(let i=0;i<pair.length;i++)if(parts[1][i]>=90){second++;if(pair[i]>=90)overlap++;}
  if(overlap/Math.max(1,second)<.25){
   for(let i=0;i<pair.length;i++)pair[i]=Math.max(pair[i],parts[1][i]);
   return {alpha:pair,category:'Calzado',pair:true};
  }
 }
 return {alpha:pair,category:'Calzado',pair:false};
}
function draftFromMask(source,w,h,part){
 const canvas=drawBatchMask(source,part.alpha,w,h);
 if(!canvas)return null;
 const {pixels}=productPixels(canvas);
 const [color='Otro',secondaryColor='']=garmentColors(pixels);
 const match=classifyShape(shapeFeatures(pixels));
 const base=part.category==='Calzado'?(part.pair?'Par de calzado':'Calzado visible'):
  match?.certain&&match.category===part.category?match.name:part.category==='Superior'?'Prenda superior':'Prenda inferior';
 return {name:base+' · '+color.toLocaleLowerCase('es-MX'),category:part.category,color,secondaryColor,
  style:'Casual',image:canvas.toDataURL('image/png'),keep:true};
}
function drawBatchReview(){
 const box=$('#batchCards');
 replaceContents(box,...batchDraft.map((item,i)=>{
  const card=el('article','batch-card'),img=thumb(item);
  const keepLabel=el('label','batch-keep'),keep=el('input');keep.type='checkbox';keep.checked=item.keep;
  keep.setAttribute('aria-label','Incluir prenda '+(i+1));
  keep.onchange=()=>{item.keep=keep.checked;syncBatch();};
  keepLabel.append(keep,el('span','','Incluir'));
  function field(title,input){
   const label=el('label','',title);label.append(input);return label;
  }
  const name=el('input');name.value=item.name;name.maxLength=60;name.oninput=()=>{item.name=name.value;};
  const category=el('select');
  category.append(...['Superior','Inferior','Calzado','Exterior','Vestido','Accesorio'].map(c=>new Option(c,c)));
  category.value=item.category;category.onchange=()=>{item.category=category.value;};
  const color=el('select');color.append(...[...Object.keys(swatches),'Otro'].map(c=>new Option(c,c)));
  color.value=item.color;color.onchange=()=>{item.color=color.value;if(item.secondaryColor===item.color)item.secondaryColor='';};
  const details=el('div','batch-fields');
  details.append(keepLabel,field('Nombre',name),field('Categoría',category),field('Color',color));
  img.alt='Recorte propuesto '+(i+1);card.append(img,details);return card;
 }));
 $('#batchReview').hidden=!batchDraft.length;
 syncBatch();
}
async function registerBatch(){
 if(batchBusy||batchSaving||!selectedPhoto||editing||!$('#maskEditor').classList.contains('hidden'))return;
 const bridge=window.Capacitor?.Plugins;
 if(!bridge?.BodyPose||!bridge?.WardrobeVision)return;
 const file=selectedPhoto,version=++batchVersion;
 const current=()=>version===batchVersion&&file===selectedPhoto&&!editing&&tabTrail[tabTrail.length-1]==='add';
 batchBusy=true;batchDraft=[];drawBatchReview();
 const status=$('#batchStatus');status.textContent='Analizando la postura y la ropa en este teléfono…';
 try{
  const source=batchPhoto(await readPhoto(file));
  if(!current())return;
  const image=source.toDataURL('image/jpeg',.92).split(',')[1];
  const pose=await bridge.BodyPose.detect({image});
  if(!current())return;
  if(pose.points?.length!==33)throw Error('No se detectó una postura clara. Prueba una foto de frente y con luz.');
  const {classes}=await bridge.WardrobeVision.analyze({image,mode:'person'});
  if(!current())return;
  const labels=unpackMask(classes),small=document.createElement('canvas');
  const {w,h}=classes;small.width=w;small.height=h;
  const ctx=small.getContext('2d');ctx.drawImage(source,0,0,w,h);
  const parts=wornParts(ctx.getImageData(0,0,w,h).data,labels,w,h,pose.points);
  status.textContent='Revisando si se distingue el calzado…';
  const shoes=await detectShoeMasks(source,classes,labels,pose,bridge,current);
  if(!current())return;
  if(shoes){
   for(const part of parts)if(part.category==='Inferior')
    for(let i=0;i<part.alpha.length;i++)if(shoes.alpha[i]>=90)part.alpha[i]=0;
   parts.push(shoes);
  }
  batchDraft=parts.map(part=>draftFromMask(source,w,h,part)).filter(Boolean);
  drawBatchReview();
  status.textContent=batchDraft.length?
   'Confirma los recortes. Si falta una pieza, añádela por separado con el editor de recorte.':
   'No pude separar las prendas con confianza. Prueba luz uniforme, colores contrastantes y que se vean la cintura y los pies.';
 }catch(error){if(current())status.textContent=error.message||'No se pudo analizar la foto.';}
 finally{if(version===batchVersion){batchBusy=false;syncBatch();}}
}
async function saveBatch(){
 const keep=batchDraft.filter(item=>item.keep),version=batchVersion;
 if(batchSaving||!keep.length||!db)return;
 if(keep.some(item=>!item.name.trim())){$('#batchStatus').textContent='Completa el nombre de las prendas que vas a guardar.';return;}
 batchSaving=true;
 const items=keep.map(({keep,...item})=>({...item,name:item.name.trim()}));
 syncBatch();
 try{
  const base=Date.now();
  const rows=await Promise.all(items.map(async (item,i)=>({...item,id:base+i,thumb:await garmentThumbnail(item.image)})));
  if(version!==batchVersion||tabTrail[tabTrail.length-1]!=='add')return;
  const tx=db.transaction('clothes','readwrite'),done=transactionDone(tx),store=tx.objectStore('clothes');
  rows.forEach(item=>store.add(item));
  await done;
  if(version===batchVersion&&tabTrail[tabTrail.length-1]==='add'){
   selectedPhoto=null;$('#addform').reset();resetCutout();showTab('closet');
  }
  await render();notify(rows.length===1?'Se guardó 1 prenda.':'Se guardaron '+rows.length+' prendas.');
 }catch{if(version===batchVersion)$('#batchStatus').textContent='No se guardó el lote. Revisa el almacenamiento e inténtalo de nuevo.';}
 finally{batchSaving=false;syncBatch();}
}
function bindBatch(){
 $('#detectBatch').onclick=registerBatch;
 $('#saveBatch').onclick=saveBatch;
 syncBatch();
}
