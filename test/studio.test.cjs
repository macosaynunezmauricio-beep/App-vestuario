const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function app(){const c=vm.createContext({atob});for(const mod of ['catalog','colors','recognition','fashion-weights','garment-mesh','body-fit'])vm.runInContext(fs.readFileSync('www/'+mod+'.js','utf8'),c);return c;}
test('catálogo combina favoritas, color secundario, búsqueda sin acentos y orden',()=>{
 const c=app(),items=[{id:1,name:'Pantalón',category:'Inferior',color:'Gris',secondaryColor:'Negro',favorite:true},{id:2,name:'Pantalón corto',color:'Gris',category:'Inferior'}];
 assert.equal(c.filteredClothes(items,{query:'pantalon',color:'Negro',category:'Inferior',favoritesOnly:true})[0].id,1);
 assert.deepEqual(c.filteredClothes(items,{order:'recent'}).map(i=>i.id),[2,1]);assert.equal(c.categoryFromName('Pantalón gris'),'Inferior');
});
test('color dominante y secundario excluyen alfa y separan blanco y rojo',()=>{
 const c=app(),data=new Uint8ClampedArray(400);
 for(let i=0;i<100;i++)data.set(i<60?[245,245,245,255]:i<85?[195,62,55,255]:[0,0,0,0],i*4);
 assert.deepEqual(Array.from(c.garmentColors({data})),['Blanco','Rojo']);assert.equal(c.garmentColors({data:new Uint8Array(4)}).length,0);
});
test('la forma sigue postura asimétrica de cadera, rodillas y tobillos',()=>{
 const c=app(),points=Array.from({length:33},()=>null);
 for(const [i,x,y] of [[23,.43,.45],[24,.56,.47],[25,.35,.64],[26,.55,.68],[27,.29,.85],[28,.61,.91]])points[i]={x,y,visibility:.94};
 const fit=c.bodyPlacement(points,'Inferior',.6,600,900),layer={...fit,bitmap:{width:240,height:400}},mesh=c.poseMesh(points,'Inferior',layer,600,900);
 assert.ok(c.validGarmentMesh(mesh));assert.notEqual(mesh[4].x,mesh[1].x);
 points[25].visibility=.1;assert.equal(c.poseMesh(points,'Inferior',layer,600,900),null);
});
test('reconocedor local acepta entrada aislada y rechaza máscara vacía',()=>{
 const c=app();assert.equal(c.shapeFeatures({width:3,height:3,data:new Uint8Array(36)}),null);
 const features=new Float32Array(196);features.fill(.7,25,150);const r=c.classifyShape(features);assert.ok(r.score>0&&r.score<=1);assert.ok(r.name);
});
test('recorte delicado conserva dos zapatos blancos separados y elimina el fondo',()=>{
 const c=app();vm.runInContext(fs.readFileSync('www/local-cutout.js','utf8'),c);
 const width=50,height=40,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const left of [5,29])for(let y=9;y<=30;y++)for(let x=left;x<left+13;x++){
  const i=(y*width+x)*4;data.set(y===22?[160,40,40,255]:[231,231,231,255],i);
 }
 const mask=c.simpleBackdropMask({width,height,data},true);
 assert.equal(mask[0],1);assert.equal(mask[15*width+10],0);assert.equal(mask[15*width+34],0);assert.equal(mask[15*width+25],1);
});
test('quitar sombras requiere contraste y detiene la máscara en la costura',()=>{
 const c=app();vm.runInContext(fs.readFileSync('www/local-cutout.js','utf8'),c);
 const w=50,h=30,data=new Uint8ClampedArray(w*h*4),mask=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const light=x<15?245:x<24?240-(x-15)*10:60,i=y*w+x;
  data.set([light,light,light,255],i*4);mask[i]=Number(x<15);
 }
 assert.equal(c.clearBackdropShadow({width:w,height:h,data},mask),9*h);
 assert.equal(mask[23],1);assert.equal(mask[24],0);
 data.fill(255);mask.fill(0);mask[0]=1;
 assert.equal(c.clearBackdropShadow({width:w,height:h,data},mask),0);
});
