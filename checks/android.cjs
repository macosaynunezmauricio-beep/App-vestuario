// Exercise the installed APK through its WebView, then independently read its published PNGs with adb.
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const adb=(...args)=>execFileSync('adb',args,{maxBuffer:16*1024*1024});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,reason){
 for(let n=0;n<100;n++){const value=await check();if(value)return value;await wait(400);}
 throw Error('Timed out: '+reason);
}
async function main(){
 const app='mx.miarmario.personal';
 adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');
 adb('shell','am','start','-W','-n',app+'/.MainActivity');
 const pid=await until(()=>{
  try{return adb('shell','pidof',app).toString().trim();}catch(error){if(error.status===1)return false;throw error;}
 },'process');
 adb('forward','tcp:9223','localabstract:webview_devtools_remote_'+pid);
 const target=await until(async()=>{
  try{return (await (await fetch('http://127.0.0.1:9223/json/list')).json()).find(x=>x.type==='page');}catch{return false;}
 },'WebView');
 const socket=new WebSocket(target.webSocketDebuggerUrl.replace(/localhost|127\.0\.0\.1/, '127.0.0.1'));
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 const calls=new Map();let seq=0;
 socket.onmessage=event=>{const msg=JSON.parse(event.data);if(calls.has(msg.id)){calls.get(msg.id)(msg);calls.delete(msg.id);}};
 async function evaluate(expression){
  const id=++seq;
  const reply=new Promise(resolve=>calls.set(id,resolve));
  socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
  const msg=await reply;if(msg.error||msg.result.exceptionDetails)throw Error(JSON.stringify(msg.error||msg.result.exceptionDetails));
  return msg.result.result.value;
 }
 try{
  await until(()=>evaluate("typeof db!=='undefined' && !!db"),'wardrobe');
  const photo='data:image/jpeg;base64,'+fs.readFileSync(process.argv[2]).toString('base64');
  await evaluate(`(async()=>{
   for(const [id,name,category,color] of [[1,'Camisa naranja','Superior','#ef7615'],[2,'Pantalón gris','Inferior','#808080'],[3,'Tenis negros','Calzado','#282828']]){
    const c=document.createElement('canvas');c.width=140;c.height=category==='Inferior'?300:160;
    const ctx=c.getContext('2d');ctx.fillStyle=color;if(category==='Superior'){ctx.fillRect(31,10,78,142);ctx.fillRect(4,18,132,45);}
    else if(category==='Inferior'){ctx.fillRect(18,4,104,91);ctx.fillRect(10,90,53,203);ctx.fillRect(76,90,53,203);}
    else{ctx.fillRect(6,18,51,130);ctx.fillRect(81,18,51,130);}
    await put('clothes',{id,name,category,color,style:'Casual',image:c.toDataURL()});
   }await render();showTab('tryon');
  })()`);
  for(const size of [360,2200,1000]){
   await evaluate(`(async()=>{
    const original=await loadImage(${JSON.stringify(photo)}),c=document.createElement('canvas');c.width=${size};c.height=Math.round(c.width*original.height/original.width);
    c.getContext('2d').drawImage(original,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.91)),dt=new DataTransfer();
    dt.items.add(new File([blob],'pose.jpg',{type:'image/jpeg'}));
    const input=$('#personPhoto');input.files=dt.files;await input.onchange({target:input});
   })()`);
   const pose=await evaluate("({points:analysis?.length||0,status:document.querySelector('#fitStatus').textContent})");
   assert.equal(pose.points,33,'native MediaPipe: '+pose.status);
   assert.ok(await evaluate('validVisionMask(automaticFront)'),'native semantic foreground: '+await evaluate("$('#frontStatus').textContent"));
   assert.ok(await evaluate("poseOutlines.get(analysis)?.pixels.includes(String.fromCharCode(1))"),'native silhouette');
   if(size===360){
    for(const id of [1,2,3])await evaluate(`(async()=>{const item=catalog.clothes.find(i=>i.id===${id});await addGarment(item);})()`);
   }
   assert.equal(await evaluate('layers.length'),3);
   assert.ok(await evaluate("layers.find(l=>l.item.category==='Superior').mesh?.length===25"));
   assert.equal(await evaluate("layers.find(l=>l.item.category==='Calzado').shoeHalf"),0);
   const expected=await evaluate(`(async()=>{
    const png=await compositePng(),img=await readPhoto(png),c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let orange=0,blue=0;
    for(let i=0;i<p.length;i+=16){if(p[i]>210&&p[i+1]>75&&p[i+1]<160&&p[i+2]<55)orange++;if(p[i+2]>p[i]+22)blue++;}
    const hash=await crypto.subtle.digest('SHA-256',await png.arrayBuffer());
    return {hash:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''),w:c.width,h:c.height,orange,blue};
   })()`);
   assert.ok(expected.orange>30&&expected.blue>40,'garment and photograph pixels must be present');
   for(let repeat=0;repeat<2;repeat++){
    await evaluate("$('#tryDownload').click()");
    await until(()=>evaluate("!exportBusy && $('#tryStatus').textContent.includes('Imágenes')"),'gallery save');
    const rows=adb('shell','content','query','--uri','content://media/external/images/media','--projection','_id:_display_name').toString();
    const images=[...rows.matchAll(/_id=(\d+), _display_name=(Mi-Armario-[a-f0-9-]+\.png)/g)].map(m=>({id:Number(m[1]),name:m[2]}));
    assert.ok(images.length,'PNG row in MediaStore');const latest=images.sort((a,b)=>b.id-a.id)[0];
    // The Android 11 "content read" shell tool can return permission diagnostics on stdout
    // with a zero exit status. Read the published file via adb's file-transfer service.
    const target=require('node:path').join(require('node:os').tmpdir(),'gallery-'+latest.name);
    adb('pull','/sdcard/Pictures/Mi Armario/'+latest.name,target);
    const bytes=fs.readFileSync(target);fs.unlinkSync(target);
    assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]),'gallery PNG signature');
    assert.equal(bytes.readUInt32BE(16),expected.w);assert.equal(bytes.readUInt32BE(20),expected.h);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.hash,'gallery pixels and PNG bytes');
    assert.equal(adb('shell','pidof',app).toString().trim(),pid);
   }
   console.log('PASS Android offline pose and two gallery exports',expected.w,expected.h);
  }
  await evaluate("$('#tryShare').click()");
  await until(()=>/ChooserActivity|ResolverActivity|IntentResolver/.test(adb('shell','dumpsys','activity','activities').toString()),'Android share sheet');
  adb('shell','input','keyevent','4');await until(()=>evaluate('!exportBusy'),'return to editor');
  assert.equal(await evaluate('layers.length'),3);console.log('PASS native share sheet, editor kept all layers.');
  const reopened=await evaluate(`(async()=>{
   const expected=automaticFront.data;await saveLook();const id=editingLook;
   $('#detectFront').click();const removed=automaticFront===null;
   await openLook(id);return {removed,restored:automaticFront?.data===expected,count:layers.length};
  })()`);
  assert.deepEqual(reopened,{removed:true,restored:true,count:3});
  console.log('PASS saved look restores native foreground and all three garments.');
  const combined=await evaluate(`(async()=>{
   const old=window.confirm;
   window.confirm=()=>true;
   try{
    showTab('style');$('#generate').click();
    const picked=outfitDraft.map(i=>i.id);
    const photo=personSource;await tryGroup(outfitDraft);
    const ready={picked,photoPreserved:personSource===photo,shoeHalves:layers.filter(l=>l.item.category==='Calzado').map(l=>l.shoeHalf),fit:layers.some(l=>l.mesh?.length===25)};
    $('#undoLayer').click();ready.undo=layers.length===3&&editingLook!==null;
    return ready;
   }finally{window.confirm=old;}
  })()`);
  assert.deepEqual(combined,{picked:[1,2,3],photoPreserved:true,shoeHalves:[0,1],fit:true,undo:true});
  console.log('PASS native local group handoff, pair fitting and undo.');
  const nativeCut=await evaluate(`(async()=>{
   const pose=analysis,torso=[11,12,23,24].map(i=>pose[i]);
   const px=torso.reduce((sum,p)=>sum+p.x,0)/4,py=torso.reduce((sum,p)=>sum+p.y,0)/4;
   openRegistration();
   const bytes=await (await fetch(personSource)).blob(),dt=new DataTransfer();
   dt.items.add(new File([bytes],'prenda-puesta.jpg',{type:'image/jpeg'}));
   const input=$('#photo');input.files=dt.files;await choosePhoto(input);await $('#removeBg').onclick();
   $('#wornPart').value='whole';$('#tapSelect').click();await selectFromTap({x:px*mc.width,y:py*mc.height});
   const pixels=mx.getImageData(0,0,mc.width,mc.height).data;
   const kept=pixels.filter((v,i)=>i%4===3&&v>=160).length/(mc.width*mc.height);
   const status=$('#maskStatus').textContent;
   $('#maskUndo').click();const restored=mx.getImageData(0,0,1,1).data[3];$('#maskRedo').click();
   await $('#maskApply').onclick();return {kept,restored,png:cutoutBlob&&cutoutBlob.type,status};
  })()`);
  assert.ok(nativeCut.kept>.001&&nativeCut.kept<.70,JSON.stringify(nativeCut));assert.equal(nativeCut.restored,255);
  assert.equal(nativeCut.png,'image/png');console.log('PASS interactive garment, clothing classes, undo / redo and transparent PNG',nativeCut.kept);
  async function propose(file){
   const input='data:image/jpeg;base64,'+fs.readFileSync(file).toString('base64');
   return evaluate(`(async()=>{
    const before=(await all('clothes')).length;openRegistration();
    const blob=await (await fetch(${JSON.stringify(input)})).blob(),dt=new DataTransfer();
    dt.items.add(new File([blob],'conjunto.jpg',{type:'image/jpeg'}));
    $('#photo').files=dt.files;await choosePhoto($('#photo'));
    await $('#detectBatch').onclick();
    return {before,after:(await all('clothes')).length,status:$('#batchStatus').textContent,items:batchDraft.map(({image,...i})=>({...i,png:image.startsWith('data:image/png;base64,')}))};
   })()`);
  }
  const bare=await propose(process.argv[2]);
  assert.ok(!bare.items.some(i=>i.category==='Calzado'),JSON.stringify(bare));
  const proposed=await propose(process.argv[3]);
  assert.equal(proposed.before,proposed.after);
  assert.deepEqual(proposed.items.map(i=>i.category),['Superior','Inferior','Calzado'],JSON.stringify(proposed));
  assert.ok(proposed.items.every(i=>i.png),JSON.stringify(proposed));
  const saved=await evaluate(`(async()=>{
   const upper=$('.batch-card input:not([type=checkbox])');
   upper.value='Playera de prueba en Android';upper.dispatchEvent(new Event('input'));
   document.querySelectorAll('.batch-keep input')[1].click();
   await $('#saveBatch').onclick();
   const rows=await all('clothes');
   return {count:rows.length,renamed:rows.some(r=>r.name==='Playera de prueba en Android'&&!r.original),gallery:catalog.clothes.length};
  })()`);
  assert.deepEqual(saved,{count:proposed.before+2,renamed:true,gallery:proposed.before+2});
  console.log('PASS full-body registration offline: separate shirt, shorts and shoes; skip bare feet; save only confirmed crops.');
 }catch(error){
  try{console.error(adb('logcat','-d','-s','WardrobeVision:E').toString().slice(-6000));}catch{}
  try{console.error('Android app state:',await evaluate("({url:location.href,webview:navigator.userAgent,fit:document.querySelector('#fitStatus')?.textContent,export:document.querySelector('#tryStatus')?.textContent})"));}catch{}
  throw error;
 }finally{socket.close();adb('forward','--remove','tcp:9223');}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
