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
 const browser=await chromium.launch({headless:true});
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
 fs.mkdirSync('test-results',{recursive:true});
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
 assert.deepEqual(errors,[]);console.log('PASS offline: wardrobe, named looks, 3 layers, two shoes, mesh/undo/redo, masks, gallery, repeated PNG.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
