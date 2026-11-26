const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const api=vm.createContext({});
vm.runInContext(fs.readFileSync('www/outfits.js','utf8'),api);
const garment=(id,category,style='Casual',favorite=false,color='Gris')=>({id,category,style,favorite,color});
const ids=items=>Array.from(items,item=>item.id);
test('no sugiere un conjunto incompleto',()=>{
 assert.equal(api.suggestOutfit([garment(1,'Superior')],'Casual').length,0);
});
test('prioriza ocasión y favoritas y permite variar una sugerencia',()=>{
 const pools=[garment(1,'Superior'),garment(2,'Inferior'),garment(3,'Calzado'),garment(4,'Calzado','Casual',true),garment(5,'Calzado','Formal',true)];
 const casual=api.suggestOutfit(pools,'Casual');
 assert.deepEqual(ids(casual),[1,2,4]);
 assert.deepEqual(ids(api.suggestOutfit(pools,'Casual',casual)),[1,2,3]);
 assert.deepEqual(ids(api.outfitAlternatives(pools,casual,2,'Casual')),[3,5]);
 assert.deepEqual(ids(api.suggestOutfit(pools,'Formal')),[1,2,5]);
 assert.deepEqual(ids(api.suggestOutfit(pools.slice(0,3),'Casual',pools.slice(0,3))),[1,2,3]);
});
test('el generador no enumera todas las posibilidades de un armario grande',()=>{
 const count=240;
 const clothes=['Superior','Inferior','Calzado'].flatMap((slot,i)=>Array.from({length:count},(_,j)=>garment(i*count+j,slot)));
 assert.deepEqual(ids(api.suggestOutfit(clothes,'Casual')),[0,240,480]);
});
test('una prenda de tienda fija solo su categoría y no modifica el armario',()=>{
 const clothes=[garment(1,'Superior'),garment(2,'Inferior'),garment(3,'Calzado')];
 const pinned=garment('tienda-1','Superior');
 assert.deepEqual(ids(api.suggestOutfit(clothes,'Casual',[],pinned)),['tienda-1',2,3]);
 assert.deepEqual(ids(clothes),[1,2,3]);
 assert.equal(api.suggestOutfit(clothes.slice(0,2),'Casual',[],pinned).length,0);
});
