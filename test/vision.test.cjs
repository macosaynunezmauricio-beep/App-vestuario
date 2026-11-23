const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const c=vm.createContext({atob,btoa});
vm.runInContext(fs.readFileSync('www/vision-masks.js','utf8'),c);
test('un toque conserva el objeto conectado y excluye piel y fondo',()=>{
 const w=12,h=8,subject=new Uint8Array(w*h),labels=new Uint8Array(w*h);
 for(let y=1;y<7;y++)for(let x=1;x<11;x++){subject[y*w+x]=255;labels[y*w+x]=x===6?2:4;}
 const s=c.packMask(w,h,subject),m=c.packMask(w,h,labels);
 const area=c.tappedGarment(s,m,.25,.45);
 assert.equal(area[3*w+3],255);assert.equal(area[3*w+6],0);assert.equal(area[3*w+8],0);
 assert.equal(c.tappedGarment(s,m,.52,.45),null);
 assert.equal(c.tappedGarment(s,m,.25,.8,new Uint16Array(w).fill(3),'upper'),null);
 assert.ok(!c.validVisionMask({...m,data:m.data.slice(1)}));
});
test('el borde de la camisa sigue el cambio de tela; una superficie uniforme queda para revisión',()=>{
 const w=64,h=96,labels=new Uint8Array(w*h).fill(4),data=new Uint8ClampedArray(w*h*4),p=[];
 for(const [i,x,y] of [[11,.3,.2],[12,.7,.22],[23,.35,.60],[24,.65,.60]])p[i]={x,y,visibility:.99};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const level=y<53+Math.round(x/8)?205:65;data.fill(level,4*(y*w+x),4*(y*w+x)+3);
 }
 const seam=c.waistSeam(data,labels,w,h,p);assert.ok(seam);assert.ok(seam[42]>seam[20]);
 data.fill(70);assert.equal(c.waistSeam(data,labels,w,h,p),null);
});
test('las manos y la cara pasan delante conservando las mangas y el fondo',()=>{
 const w=64,h=96,p=[],labels=new Uint8Array(w*h).fill(4);
 for(const [i,x,y] of [[0,32,16],[11,18,35],[12,46,35],[13,15,50],[15,26,56],[19,29,55],[14,49,43],[16,57,70]])p[i]={x:x/w,y:y/h,visibility:1};
 for(let y=12;y<=20;y++)for(let x=28;x<=36;x++)labels[y*w+x]=3;
 for(let y=53;y<=58;y++)for(let x=20;x<=33;x++)labels[y*w+x]=2;
 labels[29*w+32]=2;labels[55*w+53]=2;labels[69*w+57]=2;
 labels[73*w+48]=2;labels[14*w+3]=0;
 const front=c.personForeground(c.packMask(w,h,labels),p),alpha=c.unpackMask(front);
 assert.ok(alpha[16*w+32]>240&&alpha[55*w+27]>240);
 assert.equal(alpha[50*w+15],0);assert.equal(alpha[73*w+48],0);
 assert.equal(alpha[29*w+32],255);assert.equal(alpha[55*w+53],0);assert.ok(alpha[69*w+57]>200);assert.equal(alpha[14*w+3],0);
});
