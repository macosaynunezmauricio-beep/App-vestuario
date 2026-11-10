const realisticHost='https://fashn-ai-fashn-vton-1-5.hf.space';

async function realisticTryOn(person,garment,category,signal,onQueue){
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
 if(!Array.isArray(paths)||paths.length!==2)throw Error('El servicio no recibió las dos fotos.');
 const files=paths.map(path=>({path,meta:{_type:'gradio.FileData'}}));
 const job=await (await check(await fetch(api+'/call/try_on',{
  method:'POST',headers:{'Content-Type':'application/json'},signal,
  body:JSON.stringify({data:[...files,category,'flat-lay',25,1.5,42,true]})
 }))).json();
 if(!/^[a-z0-9-]+$/i.test(job.event_id??''))throw Error('El servicio no devolvió un turno válido.');
 onQueue();
 const events=await (await check(await fetch(api+'/call/try_on/'+job.event_id,{signal}))).text();
 const completed=events.split(/\r?\n\r?\n/).find(block=>/^event: complete\r?$/m.test(block));
 if(!completed){
  if(/quota|rate limit/i.test(events))throw Error('La cuota gratuita se agotó. Intenta más tarde.');
  throw Error('La generación no terminó. El servicio puede estar ocupado o requerir sesión.');
 }
 const line=completed.split(/\r?\n/).find(value=>value.startsWith('data:'));
 const output=JSON.parse(line.slice(5))[0];
 const url=new URL(output?.url||'',realisticHost);
 if(url.origin!==realisticHost||!url.pathname.startsWith('/gradio_api/file='))throw Error('El servicio no devolvió una imagen válida.');
 return (await check(await fetch(url,{signal}))).blob();
}
