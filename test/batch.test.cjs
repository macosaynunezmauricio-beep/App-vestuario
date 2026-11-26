const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const api=vm.createContext({atob,btoa});
for(const s of ['vision-masks.js','batch-mask.js'])vm.runInContext(fs.readFileSync('www/'+s,'utf8'),api);
const w=100,h=160,points=[];
for(const [i,x,y] of [[11,.35,.23],[12,.65,.23],[23,.40,.55],[24,.60,.55],
 [27,.41,.88],[28,.60,.89],[29,.38,.91],[30,.61,.92],[31,.33,.92],[32,.67,.93]])points[i]={x,y,visibility:.97};
const scene=(contrast=true)=>{
 const labels=new Uint8Array(w*h),rgba=new Uint8ClampedArray(w*h*4);
 for(let y=32;y<140;y++)for(let x=30;x<70;x++){
  if(y>100&&x>=47&&x<=52)continue;
  const i=y*w+x;labels[i]=4;
  const white=y<87+Math.round((x-30)/12);
  rgba.set(white||!contrast?[235,230,221,255]:[35,61,100,255],4*i);
 }
 // A separated skin patch in front of the shirt is not copied into a cutout.
 labels[60*w+49]=2;
 return {labels,rgba};
};
test('propuestas separan torso y ambas piernas y no guardan piel ni fondo',()=>{
 const {labels,rgba}=scene();
 const out=api.wornParts(rgba,labels,w,h,points);
 assert.deepEqual(Array.from(out,d=>d.category),['Superior','Inferior']);
 assert.equal(out[0].alpha[55*w+45],255);
 assert.equal(out[0].alpha[60*w+49],0);
 assert.equal(out[0].alpha[90*w+45],0);
 assert.equal(out[1].alpha[115*w+58],255);
 assert.equal(out[1].alpha[115*w+49],0);
 assert.equal(out[1].alpha[135*w+40],255);
});
test('no inventa la cintura de una pieza continua ni puntos invisibles',()=>{
 const {labels,rgba}=scene(false);
 assert.equal(api.wornParts(rgba,labels,w,h,points).length,0);
 assert.equal(api.shoeZones(points.slice(0,27),w,h).length,0);
});
test('rechaza pies descalzos, zonas fuera de la persona y suelo que toca el recorte',()=>{
 const zone=api.shoeZones(points,w,h)[0],labels=new Uint8Array(w*h),sw=40,sh=36;
 const alpha=new Uint8Array(sw*sh);
 for(let y=10;y<24;y++)for(let x=9;x<29;x++)alpha[y*sw+x]=255;
 assert.ok(api.acceptShoe(alpha,sw,sh,zone,labels,w,h,()=>true));
 assert.equal(api.acceptShoe(alpha,sw,sh,zone,labels,w,h,()=>false),null);
 alpha[18*sw]=255;assert.equal(api.acceptShoe(alpha,sw,sh,zone,labels,w,h,()=>true),null);
 labels.fill(2);assert.equal(api.shoeSeed(zone,labels,w),false);
});
