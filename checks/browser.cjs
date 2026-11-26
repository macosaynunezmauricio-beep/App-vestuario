const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('www');
const server=http.createServer((req,res)=>{
 const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.ttf':'font/ttf'}[path.extname(file)]||'text/html'));res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
 try{
 const context=await browser.newContext({viewport:{width:412,height:915},reducedMotion:'reduce',acceptDownloads:true});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!db);
 await context.setOffline(true);
 // The same accessible picker lives in the empty stage and then beside the photo.
 for(const width of [320,412,768]){
  await page.setViewportSize({width,height:800});
  for(const tab of ['home','closet','style','tryon']){
   await page.locator('nav [data-tab="'+tab+'"]').click();
   assert.equal(await page.locator('nav [aria-current="page"]').getAttribute('data-tab'),tab);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow in '+tab+' at '+width);
  }
  assert.equal(await page.locator('#stageEmpty #personPhoto').isVisible(),true);
  assert.equal(await page.locator('#stageActions').isVisible(),false);
 }
 await page.setViewportSize({width:412,height:915});
 fs.mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/probador-vacio.png'});
 await page.click('#addClothes');await page.screenshot({path:'test-results/registro.png'});
 await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=200;c.height=300;const x=c.getContext('2d');
  const items=[];
  for(const [i,name,category,color] of [[1,'Camisa naranja','Superior','#ed8024'],[2,'Pantalón gris','Inferior','#777777'],[3,'Tenis negros','Calzado','#111111']]){
   x.clearRect(0,0,200,300);x.fillStyle=color;x.fillRect(10,10,180,280);
   const item={id:i,name,category,color,style:'Casual',image:c.toDataURL()};await put('clothes',item);items.push(item);
  }
  c.width=600;c.height=900;x.fillStyle='#87b9d1';x.fillRect(0,0,600,900);personSource=c.toDataURL();setPerson(await loadImage(personSource));await render();showTab('tryon');
 });
 assert.equal(await page.locator('#stageHeading #personPhoto').isVisible(),true);
 assert.equal(await page.locator('#stageActions').isVisible(),true);
 for(const [i,name] of ['Camisa naranja','Pantalón gris','Tenis negros'].entries()){
  await page.getByRole('button',{name:'Añadir '+name,exact:true}).click();await page.waitForFunction(n=>layers.length===n,i+1);
 }
 await page.click('#pairShoe');assert.equal(await page.evaluate(()=>layers[active].flipX),true);
 await page.click('#undoLayer');assert.equal(await page.evaluate(()=>layers.length),3);
 await page.getByText('Ajustes de las prendas',{exact:true}).click();
 await page.selectOption('#activeLayer','2');await page.click('#shapeGarment');
 // Real pointer input drags the left waist control inward.
 const start=await page.evaluate(()=>{tc.scrollIntoView({block:'center'});const r=tc.getBoundingClientRect(),p=meshToCanvas({x:0,y:.5},layers[2],tc.width,tc.height);return {x:r.left+p.x*r.width/tc.width,y:r.top+p.y*r.height/tc.height};});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+25,start.y,{steps:6});await page.mouse.up();
 const mesh=await page.evaluate(()=>layers[2].mesh);assert.ok(mesh[3].x>0);assert.equal(mesh[0].x,0);
 await page.click('#undoLayer');assert.equal(await page.evaluate(()=>layers[2].mesh),undefined);
 await page.click('#redoLayer');assert.deepEqual(await page.evaluate(()=>layers[2].mesh),mesh);
 await page.click('#shapeGarment');await page.getByText('Manos y brazos delante de la ropa',{exact:true}).click();await page.click('#occlusionToggle');
 const mark=await page.evaluate(()=>{tc.scrollIntoView({block:'center'});const r=tc.getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.4};});
 await page.mouse.move(mark.x,mark.y);await page.mouse.down();await page.mouse.move(mark.x+10,mark.y+10,{steps:4});await page.mouse.up();
 assert.equal(await page.evaluate(()=>occlusion.length),1);assert.equal(await page.evaluate(()=>occlusionDrag),null);
 const restored=await page.evaluate(()=>Array.from(tctx.getImageData(tc.width*.5,tc.height*.4,1,1).data));assert.deepEqual(restored,[135,185,209,255]);
 await page.click('#occlusionToggle');
 await page.click('#collarTools summary');await page.click('#toggleCollar');
 assert.equal(await page.evaluate(()=>{const tex=garmentTexture(layers[2]);return tex.getContext('2d').getImageData(tex.width*.5,tex.height*.12,1,1).data[3];}),0);
 assert.deepEqual(await page.evaluate(()=>layers.map(l=>l.item.category)),['Calzado','Inferior','Superior']);
 await page.fill('#lookName','Sábado');await page.click('#saveLook');await page.waitForFunction(()=>$('#tryStatus').textContent==='Conjunto guardado.');
 const look=await page.evaluate(async()=>{const b={format:'mi-armario',version:1,clothes:await all('clothes'),outfits:await all('outfits')};validateBackup(b);return b.outfits[0];});assert.deepEqual(look.composition.transforms[2].mesh,mesh);
 await context.setOffline(false);await page.reload();await page.waitForFunction(()=>!!db);await context.setOffline(true);await page.evaluate(async()=>{showTab('tryon');await render();});await page.click('#reopen summary');await page.click('#loadLook');await page.waitForFunction(()=>layers.length===3);
 assert.deepEqual(await page.evaluate(()=>layers[2].mesh),mesh);assert.equal(await page.evaluate(()=>occlusion.length),1);
 // Mesh rendering has opaque interior, so no transparency seams in a solid garment.
 const alpha=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=300;canvas.height=400;
  renderGarment(canvas.getContext('2d'),{...layers[2],neckDepth:undefined,x:50,y:50,size:80,rotation:0,mesh:flatGarmentMesh()},300,400);
  const data=canvas.getContext('2d').getImageData(80,100,140,200).data;
  let min=255;for(let i=3;i<data.length;i+=4)min=Math.min(min,data[i]);return min;
 });assert.ok(alpha>=245,'opaque mesh interior should not show grid seams: '+alpha);
 assert.equal(await page.locator('#realisticTry').count(),0);assert.equal(await page.locator('#serverUrl').count(),0);
 for(let i=0;i<3;i++){
  const waiting=page.waitForEvent('download');await page.click('#tryDownload');const download=await waiting;
  const bytes=fs.readFileSync(await download.path());assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),600);
 }
 await page.locator('[data-tab="closet"]').click();await page.getByRole('button',{name:'Marcar favorita: Pantalón gris'}).click();
 await page.click('#favFilter');await page.waitForFunction(()=>$('#items').children.length===1);
 await page.fill('#searchClothes','pantalon');assert.ok((await page.locator('#count').innerText()).includes('1 de 3'));
 await page.locator('[data-tab="home"]').click();await page.screenshot({path:'test-results/inicio.png'});
 await page.click('#showFavorites');await page.getByRole('button',{name:'Abrir en el probador'}).click();
 await page.waitForFunction(()=>$('#tryStatus').textContent==='Conjunto abierto.');
 assert.equal(await page.inputValue('#lookName'),'Sábado');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/local-tryon.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Register a real catalog cutout while offline, then edit its metadata and mask.
 await page.click('#addClothes');await page.setInputFiles('#photo',path.join(__dirname,'fixtures/pantalon.png'));
 await page.waitForFunction(()=>!$('#preview').hidden);await page.click('#recognize');
 await page.waitForFunction(()=>$('#category').value==='Inferior');
 await page.fill('#name','Pantalón de prueba');await page.selectOption('#color','custom');await page.fill('#customColor','#52354a');
 await page.selectOption('#secondaryColor','Gris');await page.click('#removeBg');
 await page.selectOption('#maskBackground','dark');await page.click('#maskApply');
 await page.waitForFunction(()=>$('#maskEditor').classList.contains('hidden'));
 await page.selectOption('#color','custom');await page.fill('#customColor','#52354a');await page.selectOption('#secondaryColor','Gris');
 await page.click('#addform button[type=submit]');
 await page.waitForFunction(()=>catalog.clothes.some(i=>i.name==='Pantalón de prueba'));
 const added=await page.evaluate(async()=>{const i=(await all('clothes')).find(i=>i.name==='Pantalón de prueba');return {color:i.color,secondary:i.secondaryColor,thumb:!!i.thumb,original:!!i.original};});
 assert.deepEqual(added,{color:'#52354a',secondary:'Gris',thumb:true,original:true});
 await page.click('#filterToggle');await page.click('#clearFilters');const article=page.getByRole('article').filter({hasText:'Pantalón de prueba'});await article.locator('summary').click();await article.getByRole('button',{name:'Editar',exact:true}).click();
 await page.waitForFunction(()=>$('#name').value==='Pantalón de prueba');assert.equal(await page.inputValue('#customColor'),'#52354a');
 const hole=await page.evaluate(()=>{
  const bitmap=document.createElement('canvas');bitmap.width=bitmap.height=100;const ctx=bitmap.getContext('2d');ctx.fillRect(0,0,100,100);ctx.clearRect(40,40,20,20);
  const l={bitmap,size:100,rotation:0,x:50,y:50,mesh:flatGarmentMesh()};
  return [garmentHitTest(l,{x:50,y:50},100,100),garmentHitTest(l,{x:20,y:50},100,100)];
 });assert.deepEqual(hole,[false,true]);
 // A paired product image keeps distinct shoe graphics after saving and reopening.
 const pairTest=await page.evaluate(async()=>{
  layers=[];active=-1;showTab('tryon');
  const c=document.createElement('canvas');c.width=160;c.height=100;
  const x=c.getContext('2d');x.fillStyle='#b01d1d';x.fillRect(8,8,55,86);
  x.fillStyle='#336abb';x.fillRect(96,8,55,86);
  await addGarment({id:202,name:'Tenis de par',category:'Calzado',color:'Rojo',style:'Casual',image:c.toDataURL()});
  $('#pairShoe').click();$('#lookName').value='Par completo';await saveLook(true);
  const id=editingLook;layers=[];await openLook(id);
  const parts=layers.map(l=>{
   const sample=document.createElement('canvas');sample.width=sample.height=1;
   const ctx=sample.getContext('2d');ctx.drawImage(l.bitmap,0,0,1,1);
   return [l.shoeHalf,Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)];
  });
  const b={format:'mi-armario',version:1,clothes:await all('clothes'),outfits:await all('outfits')};validateBackup(b);
  return parts;
 });
 assert.equal(pairTest.length,2);assert.deepEqual(pairTest.map(part=>part[0]),[0,1]);
 assert.ok(pairTest[0][1][0]>pairTest[0][1][2]&&pairTest[1][1][2]>pairTest[1][1][0]);
 // Whole-look preview and single-piece replacement work offline, also without a body photo.
 let nav=page.locator('nav [data-tab="style"]');
 await page.evaluate(async()=>{
  const shoe=(await all('clothes')).find(x=>x.id===3);
  await put('clothes',{...shoe,id:4,name:'Tenis beige',color:'Beige',favorite:true});
  await render();
 });
 await nav.click();await page.click('#generate');
 const topAndBottom=await page.evaluate(()=>outfitDraft.slice(0,2).map(x=>x.id));
 const firstShoe=await page.evaluate(()=>outfitDraft[2].id);
 await page.locator('#suggestion button[aria-label^="Cambiar Tenis"]').click();
 await page.locator('#swapChoices button').first().click();
 assert.deepEqual(await page.evaluate(()=>outfitDraft.slice(0,2).map(x=>x.id)),topAndBottom);
 assert.notEqual(await page.evaluate(()=>outfitDraft[2].id),firstShoe);
 const picked=await page.evaluate(()=>outfitDraft.map(x=>x.id).sort());
 await page.locator('#suggestion').getByRole('button',{name:'Guardar conjunto'}).click();
 await page.waitForFunction(()=>document.querySelector('#homeLook h2')?.textContent==='Último conjunto'&&catalog.looks[0].occasion==='Casual');
 await page.setViewportSize({width:320,height:800});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'test-results/combinacion.png'});
 await page.locator('nav [data-tab="home"]').click();
 assert.equal(await page.locator('#homeLook figure').count(),3);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'test-results/conjunto-en-inicio.png'});
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Probar este conjunto'}).click();
 assert.equal(await page.locator('nav [aria-current="page"]').getAttribute('data-tab'),'home');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Probar este conjunto'}).click();
 await page.waitForFunction(()=>layers.length===3);
 assert.deepEqual(await page.evaluate(()=>layers.map(l=>l.item.id).sort()),picked);
 assert.equal(await page.evaluate(()=>!!personImage),true);
 await page.click('#undoLayer');
 assert.equal(await page.evaluate(()=>layers.length),2);
 assert.equal(await page.inputValue('#lookName'),'Par completo');
 await page.click('#redoLayer');assert.deepEqual(await page.evaluate(()=>layers.map(l=>l.item.id).sort()),picked);
 // Try a store image without adding it to the closet.
 const before=await page.evaluate(async()=>(await all('clothes')).length);
 await page.click('#addClothes');await page.setInputFiles('#photo',path.join(__dirname,'fixtures/pantalon.png'));
 await page.waitForFunction(()=>!$('#preview').hidden);
 await page.fill('#name','Pantalón de tienda');await page.selectOption('#category','Inferior');
 await page.click('#shopCandidate');
 await page.waitForFunction(()=>outfitDraft.some(item=>item.shopCandidate===true));
 assert.equal(await page.evaluate(async()=>(await all('clothes')).length),before);
 assert.equal(await page.locator('#suggestion .shop-label').innerText(),'De tienda');
 await page.locator('#suggestion').getByRole('button',{name:'Guardar conjunto'}).click();
 await page.waitForFunction(()=>catalog.looks[0]?.items.some(item=>item.shopCandidate));
 // Android bridge contract: a full-body photo yields editable suggestions, not automatic writes.
 const synthetic=await page.evaluate(async()=>{
  const w=100,h=160,labels=new Uint8Array(w*h),points=Array(33).fill(null);
  for(const [i,x,y] of [[11,.35,.23],[12,.65,.23],[23,.40,.55],[24,.60,.55]])points[i]={x,y,visibility:.97};
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.fillStyle='#caa180';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#eee9d9';ctx.fillRect(30,32,40,56);ctx.fillStyle='#264c80';ctx.fillRect(30,88,40,52);
  for(let y=32;y<140;y++)for(let x=30;x<70;x++)labels[y*w+x]=4;
  window.Capacitor={isNativePlatform:()=>false,Plugins:{BodyPose:{detect:async()=>({points})},
   WardrobeVision:{analyze:async()=>({classes:packMask(w,h,labels)})}}};
  bindBatch();
  return c.toDataURL().split(',')[1];
 });
 await page.click('#addClothes');
 await page.setInputFiles('#photo',{name:'sintetica.png',mimeType:'image/png',buffer:Buffer.from(synthetic,'base64')});
 await page.waitForFunction(()=>!$('#preview').hidden);await page.click('#detectBatch');
 await page.waitForFunction(()=>batchDraft.length===2);
 assert.equal(await page.evaluate(async()=>(await all('clothes')).length),before);
 await page.locator('.batch-card input:not([type=checkbox])').first().fill('Camisa confirmada');
 await page.getByRole('checkbox',{name:'Incluir prenda 2'}).uncheck();
 await page.screenshot({path:'test-results/registro-multiple.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Guardar 1 prenda'}).click();
 await page.waitForFunction(()=>catalog.clothes.some(item=>item.name==='Camisa confirmada'));
 const savedBatch=await page.evaluate(async()=>{const allItems=await all('clothes'),item=allItems.find(i=>i.name==='Camisa confirmada');return [allItems.length,item.category,!!item.original, item.image.slice(0,22)];});
 assert.deepEqual(savedBatch,[before+1,'Superior',false,'data:image/png;base64,']);
 assert.deepEqual(errors,[]);console.log('PASS offline: wardrobe, named looks, 3 layers, two shoes, mesh/undo/redo, masks, gallery, repeated PNG.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
