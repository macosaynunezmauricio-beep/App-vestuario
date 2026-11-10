// Detects background connected to the frame on a mostly uniform backdrop.
function simpleBackdropMask({width, height, data}) {
 const size=width*height;
 if(width<3||height<3)return null;
 const edges=[];
 for(let x=0;x<width;x++)edges.push(x,size-width+x);
 for(let y=1;y<height-1;y++)edges.push(y*width,y*width+width-1);
 const sample=edges.filter((_,i)=>i%Math.max(1,Math.ceil(edges.length/160))===0);
 const median=channel=>sample.map(pixel=>data[pixel*4+channel]).sort((a,b)=>a-b)[sample.length>>1];
 const [r,g,b]=[0,1,2].map(median);
 const distances=Float32Array.from({length:size},(_,i)=>
  Math.hypot(data[i*4]-r,data[i*4+1]-g,data[i*4+2]-b));
 const matches=pixel=>distances[pixel]<48;
 if(sample.filter(matches).length<sample.length*.72)return null;
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
 if(tail<size*.08||tail>size*.96||background[(height>>1)*width+(width>>1)])return null;
 return background;
}
