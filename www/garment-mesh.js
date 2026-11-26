// Normalized control grid: legacy 3×3 and articulated 5×5 meshes, stored per garment.
function flatGarmentMesh(){return Array.from({length:9},(_,i)=>({x:(i%3)/2,y:Math.floor(i/3)/2}));}
function meshArea(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function validGarmentMesh(points){
 if(!Array.isArray(points)||![9,25].includes(points.length)||points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<-.35||p.x>1.35||p.y<-.35||p.y>1.35))return false;
 const side=Math.sqrt(points.length),minimum=.06/(side-1)**2;
 for(let y=0;y<side-1;y++)for(let x=0;x<side-1;x++){
  const a=y*side+x,b=a+1,c=a+side,d=c+1;
  if(meshArea(points[a],points[b],points[d])<minimum||meshArea(points[a],points[d],points[c])<minimum||meshArea(points[a],points[b],points[c])<minimum||meshArea(points[b],points[d],points[c])<minimum)return false;
 }
 return true;
}
function meshSample(points,u,v){
 const side=Math.sqrt(points.length),steps=side-1;
 const x=Math.min(steps-1,Math.floor(u*steps)),y=Math.min(steps-1,Math.floor(v*steps)),a=y*side+x;
 const s=u*steps-x,t=v*steps-y;
 const blend=key=>(1-s)*(1-t)*points[a][key]+s*(1-t)*points[a+1][key]+(1-s)*t*points[a+side][key]+s*t*points[a+side+1][key];
 return {x:blend('x'),y:blend('y')};
}
function garmentFrame(layer,width,height){
 const w=layer.size*width/100;
 return {w,h:w*layer.bitmap.height/layer.bitmap.width*(layer.stretch??1),x:layer.x*width/100,y:layer.y*height/100,angle:layer.rotation*Math.PI/180};
}
function meshToCanvas(point,layer,width,height){
 const f=garmentFrame(layer,width,height),x=(point.x-.5)*f.w,y=(point.y-.5)*f.h;
 return {x:f.x+x*Math.cos(f.angle)-y*Math.sin(f.angle),y:f.y+x*Math.sin(f.angle)+y*Math.cos(f.angle)};
}
function canvasToMesh(point,layer,width,height){
 const f=garmentFrame(layer,width,height),x=point.x-f.x,y=point.y-f.y;
 return {x:(x*Math.cos(f.angle)+y*Math.sin(f.angle))/f.w+.5,y:(y*Math.cos(f.angle)-x*Math.sin(f.angle))/f.h+.5};
}
function meshTriangle(ctx,image,src,dst){
 const [a,b,c]=src,[p,q,r]=dst,det=meshArea(a,b,c);
 const solve=key=>{
  const u=q[key]-p[key],v=r[key]-p[key];
  const x=(u*(c.y-a.y)-v*(b.y-a.y))/det,y=((b.x-a.x)*v-(c.x-a.x)*u)/det;
  return [x,y,p[key]-x*a.x-y*a.y];
 };
 const [xx,xy,xt]=solve('x'),[yx,yy,yt]=solve('y');
 // Subpixel overlap prevents antialiased clip edges from opening seams.
 const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
 const clip=[p,q,r].map(v=>{const dx=v.x-center.x,dy=v.y-center.y,d=Math.hypot(dx,dy);return {x:v.x+dx/d*1.2,y:v.y+dy/d*1.2};});
 ctx.save();ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);ctx.lineTo(clip[1].x,clip[1].y);ctx.lineTo(clip[2].x,clip[2].y);ctx.closePath();ctx.clip();
 ctx.transform(xx,yx,xy,yy,xt,yt);ctx.drawImage(image,0,0);ctx.restore();
}
let garmentSurface=null;
const neckCanvases=new WeakMap();
const preparedGarments=new WeakMap();
function necklinePath(center,width,depth){
 const half=width/2;
 return [[center-half,-.01],[center+half,-.01],[center+half,depth*.57],
  [center+half*.68,depth*.75],[center,depth],[center-half*.68,depth*.75],[center-half,depth*.57]];
}
function garmentTexture(layer){
 const bitmap=layer.bitmap;
 if(!layer.flipX&&!layer.neckDepth&&!layer.sceneShade&&!layer.sceneLight)return bitmap;
 const key=[!!layer.flipX,layer.neckCenter,layer.neckWidth,layer.neckDepth,layer.sceneShade,layer.sceneLight].join(',');
 const cached=preparedGarments.get(bitmap);
 if(cached?.key===key)return cached.image;
 const image=document.createElement('canvas');image.width=bitmap.width;image.height=bitmap.height;
 const ctx=image.getContext('2d');
 if(layer.flipX){ctx.translate(image.width,0);ctx.scale(-1,1);}
 ctx.drawImage(bitmap,0,0);
 if(layer.neckDepth){
  ctx.globalCompositeOperation='destination-out';ctx.beginPath();
  necklinePath(layer.neckCenter??.5,layer.neckWidth??.24,layer.neckDepth).forEach(([x,y],i)=>{
   if(i)ctx.lineTo(x*image.width,y*image.height);else ctx.moveTo(x*image.width,y*image.height);
  });
  ctx.closePath();ctx.fill();
 }
 if(validSceneLight(layer.sceneLight)){
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-atop';
  const light=document.createElement('canvas');light.width=light.height=3;
  const mini=light.getContext('2d'),rgba=mini.createImageData(3,3);
  layer.sceneLight.forEach((v,i)=>{rgba.data.fill(v>0?255:0,4*i,4*i+3);rgba.data[4*i+3]=Math.round(Math.abs(v)*255);});
  mini.putImageData(rgba,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(light,0,0,image.width,image.height);
 }else if(layer.sceneShade){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation='source-atop';
  const gradient=ctx.createLinearGradient(0,0,image.width,0),shade='rgba(0,0,0,'+Math.abs(layer.sceneShade)+')';
  gradient.addColorStop(0,layer.sceneShade>0?shade:'transparent');
  gradient.addColorStop(1,layer.sceneShade<0?shade:'transparent');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,image.width,image.height);
 }
 preparedGarments.set(bitmap,{key,image});return image;
}
function renderGarment(ctx,layer,width,height){
 const texture=garmentTexture(layer);
 const f=garmentFrame(layer,width,height);
 if(!layer.mesh&&!layer.neckMask){
  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);ctx.globalAlpha=layer.opacity??1;ctx.filter='brightness('+(layer.brightness??1)+')';
  ctx.drawImage(texture,-f.w/2,-f.h/2,f.w,f.h);ctx.restore();return;
 }
 // One reusable surface bounds memory and applies opacity only once after triangles overlap.
 if(!garmentSurface)garmentSurface=document.createElement('canvas');
 if(garmentSurface.width!==width||garmentSurface.height!==height){garmentSurface.width=width;garmentSurface.height=height;}
 const targetCtx=garmentSurface.getContext('2d');targetCtx.clearRect(0,0,width,height);
 targetCtx.save();targetCtx.translate(f.x,f.y);targetCtx.rotate(f.angle);
 if(!layer.mesh)targetCtx.drawImage(texture,-f.w/2,-f.h/2,f.w,f.h);
 const count=layer.mesh?8:0;
 const dest=(u,v)=>{const p=meshSample(layer.mesh,u,v);return {x:(p.x-.5)*f.w,y:(p.y-.5)*f.h};};
 for(let y=0;y<count;y++)for(let x=0;x<count;x++){
  const uv=[[x/count,y/count],[(x+1)/count,y/count],[(x+1)/count,(y+1)/count],[x/count,(y+1)/count]];
  const source=uv.map(([u,v])=>({x:u*layer.bitmap.width,y:v*layer.bitmap.height})),target=uv.map(([u,v])=>dest(u,v));
  for(const ids of [[0,1,2],[0,2,3]])meshTriangle(targetCtx,texture,ids.map(i=>source[i]),ids.map(i=>target[i]));
 }
 targetCtx.restore();
 if(layer.neckMask){
  let mask=neckCanvases.get(layer.neckMask);
  if(!mask){
   mask=alphaCanvas(layer.neckMask.w,layer.neckMask.h,unpackMask(layer.neckMask));
   neckCanvases.set(layer.neckMask,mask);
  }
  targetCtx.save();targetCtx.globalCompositeOperation='destination-out';
  targetCtx.drawImage(mask,0,0,width,height);targetCtx.restore();
 }
 ctx.save();ctx.globalAlpha=layer.opacity??1;ctx.filter='brightness('+(layer.brightness??1)+')';ctx.drawImage(garmentSurface,0,0);ctx.restore();
}
function meshHit(layer,point,width,height){
 const p=canvasToMesh(point,layer,width,height),points=layer.mesh||flatGarmentMesh();
 const side=Math.sqrt(points.length);
 for(let y=0;y<side-1;y++)for(let x=0;x<side-1;x++){
  const a=y*side+x;
  for(const ids of [[a,a+1,a+side+1],[a,a+side+1,a+side]]){
   const [a,b,c]=ids.map(i=>points[i]);
   if(meshArea(a,b,p)>=0&&meshArea(b,c,p)>=0&&meshArea(c,a,p)>=0)return true;
  }
 }
 return false;
}

const touchMasks=new WeakMap();
function touchMask(bitmap){
 if(!touchMasks.has(bitmap)){
  const scale=Math.min(1,120/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0,c.width,c.height);
  const pixels=ctx.getImageData(0,0,c.width,c.height).data,alpha=new Uint8Array(c.width*c.height);
  for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
  touchMasks.set(bitmap,{alpha,width:c.width,height:c.height});c.width=c.height=1;
 }
 return touchMasks.get(bitmap);
}
function garmentHitTest(layer,point,width,height){
 if(!meshHit(layer,point,width,height))return false;
 const p=canvasToMesh(point,layer,width,height);
 let uv=p;
 if(layer.mesh){
  // Invert the same piecewise affine triangles used to render the texture.
  uv=null;const n=8;
  for(let y=0;y<n&&!uv;y++)for(let x=0;x<n&&!uv;x++){
   const cell=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([i,j])=>({x:i/n,y:j/n}));
   const dest=cell.map(q=>meshSample(layer.mesh,q.x,q.y));
   for(const [a,b,c] of [[0,1,2],[0,2,3]]){
    const area=meshArea(dest[a],dest[b],dest[c]),s=meshArea(dest[a],p,dest[c])/area,t=meshArea(dest[a],dest[b],p)/area;
    if(s<-.0001||t<-.0001||s+t>1.0001)continue;
    uv={x:cell[a].x*(1-s-t)+cell[b].x*s+cell[c].x*t,y:cell[a].y*(1-s-t)+cell[b].y*s+cell[c].y*t};break;
   }
  }
  if(!uv)return false;
 }
 const m=touchMask(garmentTexture(layer));
 const x=Math.max(0,Math.min(m.width-1,Math.floor(uv.x*m.width))),y=Math.max(0,Math.min(m.height-1,Math.floor(uv.y*m.height)));
 return m.alpha[y*m.width+x]>=40;
}

// Keep both photographed shoes, including their distinct logos and orientation.
const photographedPairs=new WeakMap();
function shoePieces(bitmap){
 if(photographedPairs.has(bitmap))return photographedPairs.get(bitmap);
 const m=touchMask(bitmap),counts=new Uint16Array(m.width);
 for(let i=0;i<m.alpha.length;i++)if(m.alpha[i]>=100)counts[i%m.width]++;
 const empty=x=>counts[x]<=Math.floor(m.height*.015);
 let split=null;
 for(let x=Math.ceil(m.width*.26);x<m.width*.74;x++){
  if(!empty(x))continue;
  const start=x;while(x+1<m.width*.75&&empty(x+1))x++;
  if(x-start+1>=Math.max(2,m.width*.025)){split=(start+x+1)/2;break;}
 }
 let pair=null;
 if(split!==null){
  const ranges=[[0,Math.floor(split)],[Math.ceil(split),m.width]];
  const areas=ranges.map(([start,end])=>counts.slice(start,end).reduce((a,b)=>a+b,0));
  if(Math.min(...areas)>m.width*m.height*.07&&Math.min(...areas)/Math.max(...areas)>.48){
   const cut=Math.round(bitmap.width*split/m.width);
   pair=[[0,cut],[cut,bitmap.width]].map(([start,end])=>{
    const c=document.createElement('canvas');c.width=end-start;c.height=bitmap.height;
    c.getContext('2d').drawImage(bitmap,-start,0);return trimGarment(c);
   });
   for(const shoe of pair)photographedPairs.set(shoe,pair);
  }
 }
 photographedPairs.set(bitmap,pair);return pair;
}
