// Detects background connected to the frame on a mostly uniform backdrop.
function simpleBackdropMask({width, height, data}) {
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
   return distance(reference,pixel)<(light>165?28:53);
  }
  const offset=pixel*4;
  const x=data[offset]-data[offset+1],y=data[offset+2]-data[offset+1];
  const length=Math.hypot(x,y);
  return length>12&&x*u+y*v>length*referenceLength*.83;
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
  if(area>largestSize){largestSize=area;largestStart=pixel;}
 }
 if(largestSize<size*.04)return null;
 seen.fill(0);
 component(largestStart,true);
 for(let pixel=0;pixel<size;pixel++)background[pixel]=seen[pixel]===2?0:1;
 return background;
}
