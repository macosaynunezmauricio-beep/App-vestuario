const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const html = readFileSync('www/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
test('compila los scripts y conserva las rutas principales', () => {
 for (const [, script] of scripts) new vm.Script(script);
 const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
 assert.equal(new Set(ids).size, ids.length);
 for (const [, tab] of html.matchAll(/data-tab="([^"]+)"/g)) assert.ok(ids.includes(tab));
});

const context = vm.createContext({});
vm.runInContext(readFileSync('www/backup.js', 'utf8'), context);
const validate = context.validateBackup;
test('acepta registros existentes y originales, y rechaza copias mal formadas', () => {
 const item = {id:1,name:'Camisa',category:'Superior',color:'Blanco',style:'Casual',image:'data:image/png;base64,YQ=='};
 const backup = {format:'mi-armario',version:1,clothes:[item],outfits:[{id:2,occasion:'Casual',items:[item]}]};
 assert.equal(validate(backup), backup);
 assert.equal(validate({...backup,clothes:[{...item,original:item.image}]}).clothes.length, 1);
 assert.throws(() => validate({...backup,version:2}));
 assert.throws(() => validate({...backup,clothes:[item,item]}));
 assert.throws(() => validate({...backup,clothes:[{...item,image:'https://example.test'}]}));
});

test('detecta blanco e ignora píxeles transparentes', () => {
 const color = scripts[0][1].match(/^function guessColor.*$/m)[0];
 const data = new Uint8ClampedArray([255,255,255,255,0,0,0,0]);
 const drawing = {drawImage(){},getImageData(){return {data}}};
 const guess = vm.runInNewContext(color+'\nguessColor', {
  document:{createElement(){return {getContext(){return drawing}}}}
 });
 assert.equal(guess({}), 'Blanco');
});

test('el pincel borra y recupera píxeles de la imagen original', () => {
 const source = scripts[0][1].split('function maskStroke')[1].split('function rememberMask')[0];
 const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
 const original = new Uint8ClampedArray(pixels);
 const center = (2 * 5 + 2) * 4;
 original[center] = 40;
 let mode = 'erase';
 const ctx = {
  Math, maskBase:{data:original},
  mc:{width:5,height:5,getBoundingClientRect:()=>({width:5})},
  mx:{getImageData:()=>({data:pixels}),putImageData(){}},
  $:id=>({value:{'#brushSize':4,'#maskMode':mode,'#edgeSoftness':0}[id]})
 };
 const stroke = vm.runInNewContext('function maskStroke'+source+'\nmaskStroke',ctx);
 const point = {x:2,y:2};
 stroke(point,point);
 assert.equal(pixels[center+3],0);
 assert.equal(pixels[3],255);
 mode='restore';
 stroke(point,point);
 assert.equal(pixels[center+3],255);
 assert.equal(pixels[center],40);
});

test('importa registros de ambos almacenes sin reemplazar los existentes', async () => {
 const { indexedDB } = require('fake-indexeddb');
 const req = indexedDB.open('backup-test');
 req.onupgradeneeded = () => {
  for (const store of ['clothes','outfits']) req.result.createObjectStore(store,{keyPath:'id'});
 };
 const db = await new Promise((resolve,reject)=>{
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
 const sandbox = {db,confirm:()=>true,notify(){},render(){}};
 vm.runInNewContext(readFileSync('www/backup.js','utf8'),sandbox);
 const image='data:image/png;base64,YQ==';
 const item={id:1,name:'Existente',category:'Superior',color:'Blanco',style:'Casual',image};
 const tx=db.transaction('clothes','readwrite');
 const committed=sandbox.transactionDone(tx);
 tx.objectStore('clothes').add(item);
 await committed;
 const backup={format:'mi-armario',version:1,
  clothes:[{...item,name:'Colisión'},{...item,id:2,original:image}],
  outfits:[{id:3,occasion:'Casual',items:[item]}]};
 const file={text:async()=>JSON.stringify(backup)};
 await sandbox.importWardrobe(file);
 await sandbox.importWardrobe(file);
 const read=db.transaction(['clothes','outfits']);
 const getAll=store=>new Promise(resolve=>{
  const result=read.objectStore(store).getAll();
  result.onsuccess=()=>resolve(result.result);
 });
 const [clothes,outfits]=await Promise.all([getAll('clothes'),getAll('outfits')]);
 assert.equal(clothes.length,2);
 assert.equal(clothes[0].name,'Existente');
 assert.equal(clothes[1].original,image);
 assert.equal(outfits.length,1);
 db.close();
});

test('el recorte local separa un fondo uniforme y rechaza una foto sin sujeto', () => {
 const ctx=vm.createContext({});
 vm.runInContext(readFileSync('www/local-cutout.js','utf8'),ctx);
 const width=10,height=10,data=new Uint8ClampedArray(width*height*4).fill(255);
 assert.equal(ctx.simpleBackdropMask({width,height,data}),null);
 for(let y=2;y<8;y++)for(let x=3;x<7;x++){
  const offset=(y*width+x)*4;
  data[offset]=20;data[offset+1]=40;data[offset+2]=70;
 }
 const mask=ctx.simpleBackdropMask({width,height,data});
 assert.equal(mask[0],1);
 assert.equal(mask[55],0);
 assert.equal(mask.reduce((sum,pixel)=>sum+pixel,0),76);
});
