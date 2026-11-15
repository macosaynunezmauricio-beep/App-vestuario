// Normalized control grid: three columns and three rows, stored per garment.
function flatGarmentMesh(){return Array.from({length:9},(_,i)=>({x:(i%3)/2,y:Math.floor(i/3)/2}));}
function meshArea(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function validGarmentMesh(points){
 if(!Array.isArray(points)||points.length!==9||points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<-.35||p.x>1.35||p.y<-.35||p.y>1.35))return false;
 for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  const a=y*3+x,b=a+1,c=a+3,d=c+1;
  if(meshArea(points[a],points[b],points[d])<.015||meshArea(points[a],points[d],points[c])<.015||meshArea(points[a],points[b],points[c])<.015||meshArea(points[b],points[d],points[c])<.015)return false;
 }
 return true;
}
function meshSample(points,u,v){
 const x=Math.min(1,Math.floor(u*2)),y=Math.min(1,Math.floor(v*2)),a=y*3+x;
 const s=u*2-x,t=v*2-y;
 const blend=key=>(1-s)*(1-t)*points[a][key]+s*(1-t)*points[a+1][key]+(1-s)*t*points[a+3][key]+s*t*points[a+4][key];
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
function renderGarment(ctx,layer,width,height){
 const f=garmentFrame(layer,width,height);
 if(!layer.mesh){
  ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);ctx.globalAlpha=layer.opacity??1;ctx.filter='brightness('+(layer.brightness??1)+')';
  ctx.drawImage(layer.bitmap,-f.w/2,-f.h/2,f.w,f.h);ctx.restore();return;
 }
 // One reusable surface bounds memory and applies opacity only once after triangles overlap.
 if(!garmentSurface)garmentSurface=document.createElement('canvas');
 if(garmentSurface.width!==width||garmentSurface.height!==height){garmentSurface.width=width;garmentSurface.height=height;}
 const targetCtx=garmentSurface.getContext('2d');targetCtx.clearRect(0,0,width,height);
 targetCtx.save();targetCtx.translate(f.x,f.y);targetCtx.rotate(f.angle);
 const count=8;
 const dest=(u,v)=>{const p=meshSample(layer.mesh,u,v);return {x:(p.x-.5)*f.w,y:(p.y-.5)*f.h};};
 for(let y=0;y<count;y++)for(let x=0;x<count;x++){
  const uv=[[x/count,y/count],[(x+1)/count,y/count],[(x+1)/count,(y+1)/count],[x/count,(y+1)/count]];
  const source=uv.map(([u,v])=>({x:u*layer.bitmap.width,y:v*layer.bitmap.height})),target=uv.map(([u,v])=>dest(u,v));
  for(const ids of [[0,1,2],[0,2,3]])meshTriangle(targetCtx,layer.bitmap,ids.map(i=>source[i]),ids.map(i=>target[i]));
 }
 targetCtx.restore();
 ctx.save();ctx.globalAlpha=layer.opacity??1;ctx.filter='brightness('+(layer.brightness??1)+')';ctx.drawImage(garmentSurface,0,0);ctx.restore();
}
function meshHit(layer,point,width,height){
 const p=canvasToMesh(point,layer,width,height),points=layer.mesh||flatGarmentMesh();
 for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  const a=y*3+x;
  for(const ids of [[a,a+1,a+4],[a,a+4,a+3]]){
   const [a,b,c]=ids.map(i=>points[i]);
   if(meshArea(a,b,p)>=0&&meshArea(b,c,p)>=0&&meshArea(c,a,p)>=0)return true;
  }
 }
 return false;
}
