// Geometry operates at model resolution; final cutouts reuse the original RGB pixels.
function batchJoint(points,i,w,h){
 const p=points?.[i];
 if(!p||p.visibility<.52||!Number.isFinite(p.x)||!Number.isFinite(p.y)||
    p.x<0||p.x>1||p.y<0||p.y>1)return null;
 return {x:p.x*w,y:p.y*h};
}
function alphaBounds(alpha,w,h){
 let l=w,t=h,r=-1,b=-1,count=0;
 for(let i=0;i<alpha.length;i++)if(alpha[i]>=90){
  const x=i%w,y=Math.floor(i/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);count++;
 }
 return count?{l,t,r,b,count}:null;
}
function cleanComponents(alpha,w,h,minimum){
 const queue=new Int32Array(alpha.length),examined=new Uint8Array(alpha.length);
 for(let i=0;i<alpha.length;i++){
  if(!alpha[i]||examined[i])continue;
  let n=0;
  const add=j=>{if(alpha[j]&&!examined[j]){examined[j]=1;queue[n++]=j;}};
  add(i);
  for(let k=0;k<n;k++){
   const j=queue[k],x=j%w;
   if(x)add(j-1);if(x<w-1)add(j+1);if(j>=w)add(j-w);if(j+w<alpha.length)add(j+w);
  }
  if(n<minimum)for(let k=0;k<n;k++)alpha[queue[k]]=0;
 }
 return alpha;
}
function waistGap(labels,w,h,points){
 const ls=batchJoint(points,11,w,h),rs=batchJoint(points,12,w,h),
       lh=batchJoint(points,23,w,h),rh=batchJoint(points,24,w,h);
 if(!ls||!rs||!lh||!rh)return null;
 const hips=(lh.y+rh.y)/2,torso=hips-(ls.y+rs.y)/2;
 if(torso<12)return null;
 const mid=(lh.x+rh.x)/2,half=Math.max(Math.abs(lh.x-rh.x)*.42,4);
 const l=Math.max(0,Math.ceil(mid-half)),r=Math.min(w-1,Math.floor(mid+half));
 if(r-l<5)return null;
 const fraction=(y,kind)=>{
  if(y<0||y>=h)return 0;
  let n=0;for(let x=l;x<=r;x++)if(labels[y*w+x]===kind)n++;
  return n/(r-l+1);
 };
 const distance=Math.max(4,Math.round(torso*.13));
 for(let y=Math.max(1,Math.round(hips-torso*.38));y<=Math.min(h-2,Math.round(hips+torso*.17));y++){
  if(fraction(y,2)>=.6&&fraction(y-1,2)>=.55&&fraction(y-distance,4)>.6&&fraction(y+distance,4)>.6)
   return new Uint16Array(w).fill(y);
 }
 return null;
}
function wornParts(photo,labels,w,h,points){
 const shoulders=[11,12].map(i=>batchJoint(points,i,w,h)),hips=[23,24].map(i=>batchJoint(points,i,w,h));
 if([...shoulders,...hips].some(p=>!p))return [];
 const mid=(hips[0].x+hips[1].x)/2,hipY=(hips[0].y+hips[1].y)/2;
 const topY=(shoulders[0].y+shoulders[1].y)/2,torso=hipY-topY;
 const span=Math.max(Math.abs(shoulders[0].x-shoulders[1].x),Math.abs(hips[0].x-hips[1].x));
 if(torso<12||span<8)return [];
 const seam=waistGap(labels,w,h,points)||waistSeam(photo,labels,w,h,points);
 if(!seam)return [];
 const alpha=[new Uint8Array(w*h),new Uint8Array(w*h)];
 for(let i=0;i<labels.length;i++)if(labels[i]===4){
  const x=i%w,y=Math.floor(i/w);
  if(y<topY-torso*.36)continue;
  if(y<=seam[x])alpha[0][i]=255;
  else if(y>=hipY+torso*.3||Math.abs(x-mid)<span*.95)alpha[1][i]=255;
 }
 const min=Math.max(12,Math.round(span*torso*.025));
 return alpha.map((a,i)=>({alpha:cleanComponents(a,w,h,min),category:i?'Inferior':'Superior'}))
  .filter(p=>{
   const b=alphaBounds(p.alpha,w,h);
   return b&&b.count>=span*torso*.14&&b.b-b.t>torso*.23;
  });
}
function shoeZones(points,w,h){
 const hips=[23,24].map(i=>batchJoint(points,i,w,h));
 const shoulders=[11,12].map(i=>batchJoint(points,i,w,h));
 if([...hips,...shoulders].some(p=>!p))return [];
 const trunk=Math.hypot((hips[0].x+hips[1].x-shoulders[0].x-shoulders[1].x)/2,
  (hips[0].y+hips[1].y-shoulders[0].y-shoulders[1].y)/2);
 if(trunk<12)return [];
 const zones=[];
 for(const side of [0,1]){
  const ankle=batchJoint(points,27+side,w,h),toe=batchJoint(points,31+side,w,h),heel=batchJoint(points,29+side,w,h);
  if(!ankle||!toe||!heel||Math.hypot(ankle.x-toe.x,ankle.y-toe.y)>trunk*.75)continue;
  const margin=Math.max(4,trunk*.18);
  const l=Math.max(0,Math.floor(Math.min(ankle.x,toe.x,heel.x)-margin)),
   r=Math.min(w,Math.ceil(Math.max(ankle.x,toe.x,heel.x)+margin)),
   t=Math.max(0,Math.floor(Math.min(ankle.y,toe.y,heel.y)-margin)),
   b=Math.min(h,Math.ceil(Math.max(ankle.y,toe.y,heel.y)+margin));
  if(r-l<9||b-t<9)continue;
  const seed={x:toe.x*.53+heel.x*.24+ankle.x*.23,y:toe.y*.53+heel.y*.24+ankle.y*.23};
  zones.push({l,r,t,b,seed,trunk,ankleY:ankle.y});
 }
 return zones;
}
function shoeSeed(zone,labels,w){
 let skin=0,near=0;
 for(let y=Math.max(zone.t,Math.floor(zone.seed.y-3));y<=Math.min(zone.b-1,Math.ceil(zone.seed.y+3));y++){
  for(let x=Math.max(zone.l,Math.floor(zone.seed.x-3));x<=Math.min(zone.r-1,Math.ceil(zone.seed.x+3));x++){
   const l=labels[y*w+x];if(l===2||l===3)skin++;near++;
  }
 }
 // Body skin or face dominates here: do not turn a bare foot into an item.
 return near&&skin/near<.46;
}
function acceptShoe(alpha,sw,sh,zone,labels,w,h,outline){
 let bbox=alphaBounds(alpha,sw,sh);
 // When an otherwise centered detection runs into the top, it may include the
 // sock or shin. Keep only pixels from ankle level down; never trim the sides
 // or sole simply to make a low-confidence result pass.
 if(bbox?.t===0&&Number.isFinite(zone.ankleY)){
  const stop=Math.max(0,Math.min(sh-1,Math.floor((zone.ankleY-zone.trunk*.065-zone.t)*sh/(zone.b-zone.t))));
  alpha=alpha.slice();
  alpha.fill(0,0,stop*sw);
  bbox=alphaBounds(alpha,sw,sh);
 }
 if(!bbox||bbox.count<Math.max(18,sw*sh*.035)||bbox.count>sw*sh*.66)return null;
 const nearEdge=bbox.l<=0||bbox.r>=sw-1||bbox.t<=0||bbox.b>=sh-1;
 if(nearEdge)return null;
 const result=new Uint8Array(w*h);
 let skin=0,inside=0,count=0;
 const zw=zone.r-zone.l,zh=zone.b-zone.t;
 for(let y=zone.t;y<zone.b;y++)for(let x=zone.l;x<zone.r;x++){
  const i=y*w+x,mask=alpha[Math.min(sh-1,Math.floor((y-zone.t+.5)*sh/zh))*sw+Math.min(sw-1,Math.floor((x-zone.l+.5)*sw/zw))];
  if(mask<55)continue;
  const l=labels[i];count++;
  if(l===2||l===3){skin++;continue;}
  if(outline?.(x,y))inside++;
  result[i]=mask;
 }
 if(count<8||skin/count>.31||(outline&&inside/count<.42))return null;
 return result;
}
