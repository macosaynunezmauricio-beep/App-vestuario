let exportBusy=false;
function compositePng(){
 const canvas=document.createElement('canvas');
 canvas.width=tc.width;canvas.height=tc.height;
 const ctx=canvas.getContext('2d',{alpha:false});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(personImage,0,0,canvas.width,canvas.height);
 for(const layer of layers)if(layer.visible)renderGarment(ctx,layer,canvas.width,canvas.height);
 if(occlusion.length){
  const front=frontPhoto.getContext('2d');
  front.clearRect(0,0,canvas.width,canvas.height);
  front.drawImage(personImage,0,0,canvas.width,canvas.height);
  front.globalCompositeOperation='destination-in';front.drawImage(frontMask,0,0);
  front.globalCompositeOperation='source-over';ctx.drawImage(frontPhoto,0,0);
 }
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
  canvas.width=canvas.height=1;
  if(blob?.size)resolve(blob);else reject(Error('No se pudo preparar el PNG.'));
 },'image/png'));
}
async function sendLocalFile(blob,kind,mode){
 const native=window.Capacitor.Plugins.WardrobeExport;
 const {token}=await native.begin({kind});
 try{
  const chunkSize=96*1024;
  for(let offset=0;offset<blob.size;offset+=chunkSize){
   const chunk=await dataUrl(blob.slice(offset,offset+chunkSize));
   await native.append({token,offset,data:chunk.slice(chunk.indexOf(',')+1)});
  }
  return await native.finish({token,mode,size:blob.size});
 }catch(error){
  await native.discard({token}).catch(()=>{});
  throw error;
 }
}
function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function exportComposition(mode){
 if(exportBusy||!personImage||!layers.some(l=>l.visible))return;
 exportBusy=true;syncLayers();const status=$('#tryStatus');status.textContent='Preparando la imagen…';
 try{
  const png=await compositePng();
  if(window.Capacitor?.isNativePlatform?.()){
   const result=await sendLocalFile(png,'image',mode);
   status.textContent=mode==='share'?'Se abrió el menú para compartir.':result.saved?(result.gallery?'Imagen guardada en Imágenes / Mi Armario.':'Imagen guardada.'):'Guardado cancelado.';
  }else{downloadBlob(png,'mi-armario.png');status.textContent='Descarga solicitada.';}
 }catch(error){status.textContent=error.message||'No se pudo guardar la imagen.';}
 finally{exportBusy=false;syncLayers();}
}
function bindExport(){
 $('#tryDownload').onclick=()=>exportComposition('save');
 $('#tryShare').onclick=()=>exportComposition('share');
}
