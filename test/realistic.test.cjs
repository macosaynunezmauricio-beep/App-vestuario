const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('www/realistic.js','utf8');
function context(extra={}){const ctx=vm.createContext({URL,Blob,FormData,...extra});vm.runInContext(source,ctx);return ctx;}
test('generation uses 50 steps and supports both fitting modes',()=>{
 const ctx=context();
 assert.deepEqual(Array.from(ctx.realisticParameters('tops',{seed:7})),['tops','flat-lay',50,1.5,7,true]);
 assert.deepEqual(Array.from(ctx.realisticParameters('bottoms',{seed:8,photoType:'model',loose:false})),['bottoms','model',50,1.5,8,false]);
 assert.throws(()=>ctx.realisticParameters('shoes'));
 assert.throws(()=>ctx.realisticParameters('tops',{seed:NaN}));
});
test('alpha bounds preserve white and red garment pixels while removing transparent margins',()=>{
 const ctx=context(),pixels=new Uint8ClampedArray(6*8*4);
 pixels.set([255,255,255,255],(2*6+1)*4);pixels.set([255,0,0,128],(6*6+4)*4);
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.garmentBounds(pixels,6,8))),{x:1,y:2,width:4,height:5});
 assert.throws(()=>ctx.garmentBounds(new Uint8ClampedArray(16),2,2));
});
test('transport sends corrected parameters and fetches completed image',async()=>{
 let payload;const responses=[new Response(JSON.stringify(['/person','/garment'])),new Response('{"event_id":"abc-1"}'),new Response('event: complete\r\ndata: [{"url":"https://fashn-ai-fashn-vton-1-5.hf.space/gradio_api/file=result.png"}]\r\n\r\n'),new Response(new Blob(['png'],{type:'image/png'}))];
 const ctx=context({fetch:async(url,options)=>{if(String(url).endsWith('/call/try_on'))payload=JSON.parse(options.body);return responses.shift();}});
 const result=await ctx.realisticTryOn(new Blob(['a']),new Blob(['b']),'tops',undefined,()=>{},{seed:19});
 assert.equal(result.type,'image/png');assert.deepEqual(payload.data.slice(2),['tops','flat-lay',50,1.5,19,true]);assert.equal(responses.length,0);
});
test('quota errors do not become a successful generated view',async()=>{
 const ctx=context({fetch:async()=>new Response('',{status:429})});
 await assert.rejects(ctx.realisticTryOn(new Blob(),new Blob(),'tops'),/cuota/);
});
test('invalid output host is rejected before downloading',async()=>{
 const responses=[new Response('["a","b"]'),new Response('{"event_id":"abc"}'),new Response('event: complete\ndata: [{"url":"https://other.example/result.png"}]\n\n')];
 const ctx=context({fetch:async()=>responses.shift()});
 await assert.rejects(ctx.realisticTryOn(new Blob(),new Blob(),'tops'),/imagen válida/);
});
