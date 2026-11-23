// Detects background connected to the frame on a mostly uniform backdrop.
function simpleBackdropMask({width, height, data}, careful=false) {
 const size=width*height;
 if(width<3||height<3)return null;
 const edges=[];
 const inset=Math.max(0,Math.floor(Math.min(width,height)*.015));
 const left=inset,right=width-1-inset,top=inset,bottom=height-1-inset;
 for(let x=left;x<=right;x++)edges.push(top*width+x,bottom*width+x);
 for(let y=top+1;y<bottom;y++)edges.push(y*width+left,y*width+right);
 const step=Math.max(1,Math.ceil(edges.length/180));
 const sample=edges.filter((_,i)=>i%step===0);
 const distance=(first,second)=>{
  const r=data[first*4]-data[second*4];
  const g=data[first*4+1]-data[second*4+1];
  const b=data[first*4+2]-data[second*4+2];
  return Math.abs((r+g+b)/3)*.55+Math.hypot(r-g,b-g);
 };
 let reference=sample[0],support=0;
 for(const candidate of sample){
  const count=sample.filter(pixel=>distance(candidate,pixel)<42).length;
  if(count>support){reference=candidate;support=count;}
 }
 if(support<sample.length*.38)return null;
 const channels=data.subarray(reference*4,reference*4+3);
 const colorful=Math.max(...channels)-Math.min(...channels)>35;
 const [red,green,blue]=channels;
 const u=red-green,v=blue-green;
 const referenceLength=Math.hypot(u,v);
 const matches=pixel=>{
  if(!colorful){
   const offset=pixel*4;
   const light=(data[offset]+data[offset+1]+data[offset+2])/3;
   // Protect bright foreground that differs only slightly from a white backdrop.
   return distance(reference,pixel)<(light>165?(careful?8:28):(careful?28:53));
  }
  const offset=pixel*4;
  const x=data[offset]-data[offset+1],y=data[offset+2]-data[offset+1];
  const length=Math.hypot(x,y);
  return length>12&&x*u+y*v>length*referenceLength*(careful?.94:.83)&&(!careful||distance(reference,pixel)<54);
 };
 const background=new Uint8Array(size), queue=new Uint32Array(size);
 let tail=0;
 const visit=pixel=>{
  if(background[pixel]||!matches(pixel))return;
  background[pixel]=1;
  queue[tail++]=pixel;
 };
 edges.forEach(visit);
 for(let head=0;head<tail;head++){
  const pixel=queue[head], x=pixel%width;
  if(x>0)visit(pixel-1);
  if(x<width-1)visit(pixel+1);
  if(pixel>=width)visit(pixel-width);
  if(pixel<size-width)visit(pixel+width);
 }
 if(tail<size*.08||tail>size*.96)return null;
 // Keep the largest remaining component so a detached frame or object
 // does not survive alongside the garment.
 const seen=new Uint8Array(size);
 let largestStart=-1,largestSize=0;
 const candidates=[];
 function component(start,keep){
  let end=0;
  function add(pixel){
   if(background[pixel]||seen[pixel])return;
   seen[pixel]=1;
   queue[end++]=pixel;
  }
  add(start);
  for(let head=0;head<end;head++){
   const pixel=queue[head],x=pixel%width;
   if(x>0)add(pixel-1);
   if(x<width-1)add(pixel+1);
   if(pixel>=width)add(pixel-width);
   if(pixel<size-width)add(pixel+width);
  }
  if(keep)for(let i=0;i<end;i++)seen[queue[i]]=2;
  return end;
 }
 for(let pixel=0;pixel<size;pixel++){
  if(background[pixel]||seen[pixel])continue;
  const area=component(pixel,false);
  if(careful&&area>=size*.008)candidates.push({pixel,area});
  if(area>largestSize){largestSize=area;largestStart=pixel;}
 }
 if(largestSize<size*.04)return null;
 seen.fill(0);
 component(largestStart,true);
 if(careful)for(const candidate of candidates){
  if(candidate.pixel!==largestStart&&candidate.area>=largestSize*.18)component(candidate.pixel,true);
 }
 for(let pixel=0;pixel<size;pixel++)background[pixel]=seen[pixel]===2?0:1;
 return background;
}

// Follow smooth neutral cast shadows out from an existing bright backdrop.
// Require a dark textile sample and retain strong gradients at the true fabric edge.
function clearBackdropShadow(image,background){
 const {width,height,data}=image,size=width*height;
 let cloth=0,dark=0,backgroundSamples=0,bright=0;
 const light=i=>(data[4*i]+2*data[4*i+1]+data[4*i+2])/4;
 for(let i=0;i<size;i+=3){
  if(background[i]){backgroundSamples++;if(light(i)>202)bright++;}
  else{cloth++;if(light(i)<135)dark++;}
 }
 if(!cloth||dark/cloth<.57||!backgroundSamples||bright/backgroundSamples<.75)return 0;
 const queue=new Uint32Array(size);let tail=0,added=0;
 function expand(from,to){
  if(background[to])return;
  const lum=light(to),j=to*4,r=data[j],g=data[j+1],b=data[j+2];
  if(lum<116||Math.max(r,g,b)-Math.min(r,g,b)>32||Math.abs(light(from)-lum)>13)return;
  background[to]=1;queue[tail++]=to;added++;
 }
 function neighbors(i){
  if(i%width)expand(i,i-1);
  if(i%width<width-1)expand(i,i+1);
  if(i>=width)expand(i,i-width);
  if(i<size-width)expand(i,i+width);
 }
 for(let i=0;i<size;i++)if(background[i]&&light(i)>154)neighbors(i);
 for(let head=0;head<tail;head++)neighbors(queue[head]);
 return added;
}
