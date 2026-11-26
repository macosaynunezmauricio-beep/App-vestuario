const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function app(){const c=vm.createContext({});for(const p of ['garment-mesh','photo-occlusion','backup'])vm.runInContext(fs.readFileSync('www/'+p+'.js','utf8'),c);return c;}
test('mesh coordinates round-trip across rotation, stretch and canvas size',()=>{
 const c=app();for(const rotation of [-130,0,45,170]){
  const layer={x:42,y:57,size:65,rotation,stretch:1.3,bitmap:{width:200,height:300}};
  for(const p of c.flatGarmentMesh()){
   const q=c.canvasToMesh(c.meshToCanvas(p,layer,600,900),layer,600,900);
   assert.ok(Math.abs(q.x-p.x)<1e-9&&Math.abs(q.y-p.y)<1e-9);
  }
 }
});
test('control mesh rejects inverted triangles and invalid values',()=>{
 const c=app(),mesh=c.flatGarmentMesh();assert.equal(c.validGarmentMesh(mesh),true);
 mesh[4]={x:1.2,y:-.2};assert.equal(c.validGarmentMesh(mesh),false);
 mesh[4]={x:NaN,y:.5};assert.equal(c.validGarmentMesh(mesh),false);
});
test('waist deformation changes middle samples and hit area, keeps collar and hem',()=>{
 const c=app(),mesh=c.flatGarmentMesh();mesh[3].x=.2;mesh[5].x=.8;
 assert.equal(c.validGarmentMesh(mesh),true);
 assert.equal(c.meshSample(mesh,0,.5).x,.2);assert.equal(c.meshSample(mesh,0,0).x,0);
 const layer={x:50,y:50,size:50,rotation:0,bitmap:{width:100,height:100},mesh};
 assert.equal(c.meshHit(layer,{x:26,y:50},100,100),false);
 assert.equal(c.meshHit(layer,{x:50,y:50},100,100),true);
});
test('backup accepts old looks and new mesh/light/occlusion, rejects corrupt edits',()=>{
 const c=app(),image='data:image/png;base64,YQ==';
 const item={id:1,name:'Camisa naranja',category:'Superior',color:'Naranja',style:'Casual',image};
 const transform={x:50,y:40,size:55,rotation:0,visible:true};
 const b={format:'mi-armario',version:1,clothes:[item],outfits:[{id:2,occasion:'Probador',items:[item],composition:{photo:image,transforms:[transform]}}]};
 assert.equal(c.validateBackup(b),b);
 Object.assign(transform,{mesh:c.flatGarmentMesh(),brightness:1.1,opacity:.8});
 b.outfits[0].composition.occlusion=[{mode:'front',radius:.04,points:[{x:.4,y:.6}]}];assert.equal(c.validateBackup(b),b);
 transform.mesh[0].x=Infinity;assert.throws(()=>c.validateBackup(b));transform.mesh=c.flatGarmentMesh();
 b.outfits[0].composition.occlusion[0].points[0].x=-1;assert.throws(()=>c.validateBackup(b));
});
test('mask stroke limits reject unbounded data and invalid modes',()=>{
 const c=app();assert.equal(c.validOcclusion([]),true);
 assert.equal(c.validOcclusion([{mode:'front',radius:.04,points:[{x:.2,y:.5}]}]),true);
 assert.equal(c.validOcclusion([{mode:'other',radius:.04,points:[{x:.2,y:.5}]}]),false);
 assert.equal(c.validOcclusion([{mode:'front',radius:.04,points:Array(401).fill({x:.2,y:.5})}]),false);
});

test('long trousers reach ankles rather than hitting an arbitrary stretch cap',()=>{
 const c=app();vm.runInContext(fs.readFileSync('www/body-fit.js','utf8'),c);
 const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
 points[23]={x:.43,y:.45,visibility:1};points[24]={x:.57,y:.45,visibility:1};
 points[27]={x:.4,y:.9,visibility:1};points[28]={x:.6,y:.9,visibility:1};
 const fit=c.bodyPlacement(points,'Inferior',.6,600,900);
 const height=fit.size*600/100/.6*fit.stretch;
 assert.ok(Math.abs(height-(.9-.45)*900*1.13)<1);
 points[23].visibility=.1;assert.equal(c.bodyPlacement(points,'Inferior',.6,600,900),null);
});

test('cada calzado se ajusta a su silueta independiente y no a un pie fuera del cuadro',()=>{
 const c=app();vm.runInContext(fs.readFileSync('www/body-fit.js','utf8'),c);
 const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
 for(const [i,x,y] of [[27,.33,.78],[29,.33,.8],[31,.30,.88],[28,.66,.78],[30,.66,.8],[32,.69,.88]])
  Object.assign(p[i],{x,y});
 const w=100,h=120,mask=new Uint8Array(w*h);
 for(let y=93;y<111;y++)for(const cent of [32,67])for(let x=cent-5;x<=cent+5;x++)mask[y*w+x]=1;
 const outline={w,h,pixels:String.fromCharCode(...mask)};
 for(const side of [0,1]){
  const old=c.bodyPlacement(p,'Calzado',.62,720,960,side);
  const fit=c.shoeOutlinePlacement(old,outline,p,side,720,960,.62);
  assert.notEqual(fit,old);
  assert.ok(side?fit.x>60:fit.x<40);assert.ok(fit.size>=5);
  assert.equal(c.shoeOutlinePlacement(old,{...outline,pixels:''},p,side,720,960,.62),old);
 }
 assert.equal(c.validSceneLight([-.21,.085,0,0,0,0,0,0,0]),true);
 assert.equal(c.validSceneLight([-.3,0,0,0,0,0,0,0,0]),false);
});
