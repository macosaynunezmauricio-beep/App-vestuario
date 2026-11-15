const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('www');
const server=http.createServer((req,res)=>{
 const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:412,height:915},acceptDownloads:true});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!db);
 await context.setOffline(true);
 await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=200;c.height=300;const x=c.getContext('2d');
  const items=[];
  for(const [i,name,category,color] of [[1,'Camisa naranja','Superior','#ed8024'],[2,'Pantalón gris','Inferior','#777777'],[3,'Tenis negros','Calzado','#111111']]){
   x.clearRect(0,0,200,300);x.fillStyle=color;x.fillRect(10,10,180,280);
   const item={id:i,name,category,color,style:'Casual',image:c.toDataURL()};await put('clothes',item);items.push(item);
  }
  c.width=600;c.height=900;x.fillStyle='#87b9d1';x.fillRect(0,0,600,900);personSource=c.toDataURL();setPerson(await loadImage(personSource));await render();showTab('tryon');
 });
 for(const id of ['1','2','3']){await page.selectOption('#tryGarment',id);await page.click('#addLayer');await page.waitForFunction(n=>layers.length===n,Number(id));}
 await page.getByText('Ajustes de las prendas',{exact:true}).click();
 await page.selectOption('#activeLayer','0');await page.click('#shapeGarment');
 // Real pointer input drags the left waist control inward.
 const start=await page.evaluate(()=>{tc.scrollIntoView({block:'center'});const r=tc.getBoundingClientRect(),p=meshToCanvas({x:0,y:.5},layers[0],tc.width,tc.height);return {x:r.left+p.x*r.width/tc.width,y:r.top+p.y*r.height/tc.height};});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+25,start.y,{steps:6});await page.mouse.up();
 const mesh=await page.evaluate(()=>layers[0].mesh);assert.ok(mesh[3].x>0);assert.equal(mesh[0].x,0);
 await page.click('#undoLayer');assert.equal(await page.evaluate(()=>layers[0].mesh),undefined);
 await page.click('#redoLayer');assert.deepEqual(await page.evaluate(()=>layers[0].mesh),mesh);
 await page.click('#shapeGarment');await page.getByText('Manos y brazos delante de la ropa',{exact:true}).click();await page.click('#occlusionToggle');
 const mark=await page.evaluate(()=>{tc.scrollIntoView({block:'center'});const r=tc.getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.4};});
 await page.mouse.move(mark.x,mark.y);await page.mouse.down();await page.mouse.move(mark.x+10,mark.y+10,{steps:4});await page.mouse.up();
 assert.equal(await page.evaluate(()=>occlusion.length),1);assert.equal(await page.evaluate(()=>occlusionDrag),null);
 const restored=await page.evaluate(()=>Array.from(tctx.getImageData(tc.width*.5,tc.height*.4,1,1).data));assert.deepEqual(restored,[135,185,209,255]);
 await page.click('#occlusionToggle');await page.click('#saveLook');await page.waitForFunction(()=>$('#tryStatus').textContent==='Conjunto guardado.');
 const look=await page.evaluate(async()=>{const b={format:'mi-armario',version:1,clothes:await all('clothes'),outfits:await all('outfits')};validateBackup(b);return b.outfits[0];});assert.deepEqual(look.composition.transforms[0].mesh,mesh);
 await context.setOffline(false);await page.reload();await page.waitForFunction(()=>!!db);await context.setOffline(true);await page.evaluate(async()=>{showTab('tryon');await refreshLooks();});await page.click('#loadLook');await page.waitForFunction(()=>layers.length===3);
 assert.deepEqual(await page.evaluate(()=>layers[0].mesh),mesh);assert.equal(await page.evaluate(()=>occlusion.length),1);
 // Mesh rendering has opaque interior, so no transparency seams in a solid garment.
 const alpha=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=300;canvas.height=400;
  renderGarment(canvas.getContext('2d'),{...layers[0],x:50,y:50,size:80,rotation:0,mesh:flatGarmentMesh()},300,400);
  const data=canvas.getContext('2d').getImageData(80,100,140,200).data;
  let min=255;for(let i=3;i<data.length;i+=4)min=Math.min(min,data[i]);return min;
 });assert.ok(alpha>=245,'opaque mesh interior should not show grid seams: '+alpha);
 assert.equal(await page.locator('#realisticTry').count(),0);assert.equal(await page.locator('#serverUrl').count(),0);
 assert.deepEqual(errors,[]);fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/local-tryon.png',fullPage:true});
 console.log('PASS offline browser: 3 layers, mesh drag, undo/redo, original-photo brush, saved look/reload, backup validation, alpha rendering');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
