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

test('cada manga responde a su codo sin mover el bolsillo ni la otra manga',()=>{
 const c=app(),base=c.flatGarmentMesh(),w=100,mask={width:w,height:w,alpha:new Uint8Array(w*w)};
 for(let y=0;y<w;y++)for(let x=0;x<w;x++)if((x>24&&x<76)||(y>8&&y<42))mask.alpha[y*w+x]=255;
 const points=[];
 for(const [i,x,y] of [[11,.26,.12],[12,.74,.12],[13,.22,.56],[14,.84,.53],[23,.34,.9],[24,.67,.9]])points[i]={x,y,visibility:1};
 const layer={size:100,x:50,y:50,rotation:0,bitmap:{width:w,height:w}};
 const fit=()=>c.articulatedMesh(base,points,'Superior',layer,w,w,mask);
 const first=fit();points[13].x=.02;const second=fit();
 assert.equal(first.length,25);assert.ok(c.validGarmentMesh(second));
 assert.ok(c.meshSample(second,.10,.40).x<c.meshSample(first,.10,.40).x-.045);
 for(const x of [.5,.75,1])assert.deepEqual(c.meshSample(second,x,.40),c.meshSample(first,x,.40));
 points[13].visibility=points[14].visibility=.1;assert.equal(fit(),base);
});
test('cada pernera sigue su rodilla, mantiene la cintura y admite respaldos de ambas mallas',()=>{
 const c=app(),base=c.flatGarmentMesh(),mask={width:100,height:100,alpha:new Uint8Array(10000)};
 for(let y=0;y<100;y++)for(let x=4;x<96;x++)if(y<30||Math.abs(x-50)>4)mask.alpha[y*100+x]=255;
 const points=[];for(const [i,x,y] of [[23,.30,.05],[24,.69,.05],[25,.29,.53],[26,.77,.54],[27,.22,.96],[28,.8,.94]])points[i]={x,y,visibility:1};
 const layer={size:100,x:50,y:50,rotation:0,bitmap:{width:100,height:100}};
 const fit=()=>c.articulatedMesh(base,points,'Inferior',layer,100,100,mask);
 const first=fit();points[25].x=.12;const second=fit();
 assert.equal(second.length,25);assert.ok(c.validGarmentMesh(second));assert.ok(second[11].x<first[11].x-.12);
 assert.deepEqual(second.slice(0,5),first.slice(0,5));assert.deepEqual(second[13],first[13]);
 const q=c.meshToCanvas(second[11],layer,100,100);assert.ok(c.meshHit({...layer,mesh:second},q,100,100));
 mask.alpha.fill(255);assert.equal(fit(),base);
});
test('la silueta ensancha el borde visible del pantalón sin arrastrar la costura central',()=>{
 const c=app(),points=[],flat=c.flatGarmentMesh(),mesh=Array.from({length:25},(_,i)=>c.meshSample(flat,i%5/4,Math.floor(i/5)/4));
 for(const [i,x,y] of [[23,.34,.08],[24,.66,.08],[25,.34,.51],[26,.66,.51],[27,.34,.92],[28,.66,.92]])points[i]={x,y,visibility:1};
 const mask={width:100,height:100,alpha:new Uint8Array(10000)},body=Buffer.alloc(10000);
 for(let y=0;y<100;y++)for(let x=0;x<100;x++){
  if(x>=17&&x<83)mask.alpha[y*100+x]=255;
  if(x>=8&&x<91)body[y*100+x]=1;
 }
 const l={size:100,x:50,y:50,rotation:0,bitmap:{width:100,height:100}};
 const outline={w:100,h:100,pixels:body.toString('latin1')};
 const adjusted=c.fitSilhouette(mesh,outline,points,'Inferior',l,100,100,mask);
 assert.ok(c.validGarmentMesh(adjusted));assert.ok(adjusted[10].x<mesh[10].x);assert.ok(adjusted[14].x>mesh[14].x);
 assert.deepEqual(adjusted[12],mesh[12]);assert.equal(c.fitSilhouette(mesh,null,points,'Inferior',l,100,100,mask),mesh);
});
