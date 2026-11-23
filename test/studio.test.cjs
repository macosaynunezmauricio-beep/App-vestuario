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
