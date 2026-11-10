const realisticHost='https://fashn-ai-fashn-vton-1-5.hf.space';

// Keep inference controls separate from transport so the exact request is testable.
function realisticParameters(category, options={}) {
 if(!['tops','bottoms','one-pieces'].includes(category))throw Error('Elige el tipo de prenda.');
 const photoType=options.photoType??'flat-lay';
 if(!['flat-lay','model'].includes(photoType))throw Error('Tipo de fotografía no válido.');
 const seed=options.seed??Math.floor(Math.random()*2147483647);
 if(!Number.isInteger(seed)||seed<0||seed>2147483647)throw Error('Semilla no válida.');
 return [category,photoType,50,1.5,seed,options.loose!==false];
}

function garmentBounds(data,width,height) {
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(data[(y*width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 }
 if(right<left)throw Error('El recorte está vacío. Recupera la prenda en el editor.');
 return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}

// Composite alpha onto white explicitly: remote RGB conversion otherwise loses alpha.
async function prepareRealisticGarment(source) {
 const image=new Image();
 image.src=source;
 await image.decode();
 const work=document.createElement('canvas'),output=document.createElement('canvas');
 try {
  const scale=Math.min(1,1536/Math.max(image.naturalWidth,image.naturalHeight));
  work.width=Math.max(1,Math.round(image.naturalWidth*scale));
  work.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=work.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,work.width,work.height);
  const bounds=garmentBounds(ctx.getImageData(0,0,work.width,work.height).data,work.width,work.height);
  output.width=768;output.height=1152;
  const out=output.getContext('2d');
  out.fillStyle='#fff';out.fillRect(0,0,output.width,output.height);
  const fit=Math.min(output.width*.92/bounds.width,output.height*.92/bounds.height);
  const w=bounds.width*fit,h=bounds.height*fit;
  out.drawImage(work,bounds.x,bounds.y,bounds.width,bounds.height,(output.width-w)/2,(output.height-h)/2,w,h);
  return await new Promise((resolve,reject)=>output.toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo preparar la prenda.')),'image/png'));
 } finally {work.width=work.height=output.width=output.height=1;image.src='';}
}

async function realisticTryOn(person,garment,category,signal,onQueue,options={}){
 const parameters=realisticParameters(category,options);
 const api=realisticHost+'/gradio_api';
 const check=async response=>{
  if(response.ok)return response;
  if(response.status===429)throw Error('La cuota gratuita se agotó. Intenta más tarde.');
  if(response.status===401||response.status===403)throw Error('El servicio no permite esta solicitud sin iniciar sesión.');
  throw Error('El servicio no está disponible (HTTP '+response.status+').');
 };
 const form=new FormData();
 form.append('files',person,'persona.jpg');
 form.append('files',garment,'prenda.png');
 const paths=await (await check(await fetch(api+'/upload',{method:'POST',body:form,signal}))).json();
 if(!Array.isArray(paths)||paths.length!==2||paths.some(path=>typeof path!=='string'))throw Error('El servicio no recibió las dos fotos.');
 const files=paths.map(path=>({path,meta:{_type:'gradio.FileData'}}));
 const job=await (await check(await fetch(api+'/call/try_on',{
  method:'POST',headers:{'Content-Type':'application/json'},signal,
  body:JSON.stringify({data:[...files,...parameters]})
 }))).json();
 if(!/^[a-z0-9-]+$/i.test(job.event_id??''))throw Error('El servicio no devolvió un turno válido.');
 onQueue?.();
 const events=await (await check(await fetch(api+'/call/try_on/'+job.event_id,{signal}))).text();
 const completed=events.split(/\r?\n\r?\n/).find(block=>/^event: complete\r?$/m.test(block));
 if(!completed){
  if(/quota|rate limit/i.test(events))throw Error('La cuota gratuita se agotó. Intenta más tarde.');
  throw Error('La generación no terminó. El servicio puede estar ocupado o requerir sesión.');
 }
 const line=completed.split(/\r?\n/).find(value=>value.startsWith('data:'));
 let output;
 try {output=JSON.parse(line.slice(5))[0];}catch{throw Error('El servicio devolvió un resultado incompleto.');}
 const url=new URL(output?.url||'',realisticHost);
 if(url.origin!==realisticHost||!url.pathname.startsWith('/gradio_api/file='))throw Error('El servicio no devolvió una imagen válida.');
 const blob=await (await check(await fetch(url,{signal}))).blob();
 if(!/^image\/(png|jpeg|webp)$/.test(blob.type)||!blob.size)throw Error('El servicio devolvió un archivo que no es una imagen.');
 return blob;
}
