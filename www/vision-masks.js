function validVisionMask(mask){
 return !!mask&&Number.isInteger(mask.w)&&Number.isInteger(mask.h)&&
  mask.w>0&&mask.h>0&&mask.w<=384&&mask.h<=384&&typeof mask.data==='string'&&
  mask.data.length===4*Math.ceil(mask.w*mask.h/3)&&/^[A-Za-z0-9+/]+={0,2}$/.test(mask.data)&&
  atob(mask.data).length===mask.w*mask.h;
}
function unpackMask(mask){
 if(!validVisionMask(mask))throw Error('La máscara recibida está incompleta.');
 return Uint8Array.from(atob(mask.data),ch=>ch.charCodeAt(0));
}
function packMask(w,h,pixels){
 let raw='';
 for(let i=0;i<pixels.length;i+=4096)raw+=String.fromCharCode(...pixels.subarray(i,i+4096));
 return {w,h,data:btoa(raw)};
}
function alphaCanvas(w,h,alpha){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(w,h);
 for(let i=0;i<alpha.length;i++)pixels.data[i*4+3]=alpha[i];
 ctx.putImageData(pixels,0,0);return canvas;
}
// Retain the connected object under the tap; trim uncertain edges without making them jagged.
function tappedGarment(subject,classes,x,y,seam=null,part=null){
 const confidence=unpackMask(subject),{w,h}=subject;
 const labels=classes&&unpackMask(classes);
 if(labels&&(classes.w!==w||classes.h!==h))throw Error('Las máscaras tienen tamaños distintos.');
 const sx=Math.max(0,Math.min(w-1,Math.floor(x*w))),sy=Math.max(0,Math.min(h-1,Math.floor(y*h))),seed=sy*w+sx;
 const allowed=i=>confidence[i]>=100&&(!labels||labels[i]===4)&&
  (!seam||(part==='upper'?Math.floor(i/w)<=seam[i%w]:Math.floor(i/w)>seam[i%w]));
 if(!allowed(seed))return null;
 const result=new Uint8Array(w*h),queue=new Int32Array(w*h);
 let used=0;
 function add(i){
  if(!result[i]&&allowed(i)){result[i]=Math.min(255,(confidence[i]-99)*5);queue[used++]=i;}
 }
 add(seed);
 for(let j=0;j<used;j++){
  const i=queue[j],col=i%w;
  if(col>0)add(i-1);if(col<w-1)add(i+1);if(i>=w)add(i-w);if(i+w<result.length)add(i+w);
 }
 return used>=8&&used<result.length*.99?result:null;
}

function personForeground(classes,points){
 const labels=unpackMask(classes),{w,h}=classes,alpha=new Uint8Array(w*h);
 const joint=i=>{
  const p=points[i];
  return p&&p.visibility>=.55&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x*w,y:p.y*h}:null;
 };
 const shoulders=[joint(11),joint(12)];
 if(!shoulders[0]||!shoulders[1])return null;
 const span=Math.hypot(shoulders[0].x-shoulders[1].x,shoulders[0].y-shoulders[1].y);
 if(span<4)return null;
 const face=joint(0),skinZones=[];
 function capsule(a,b,r){
  if(!a||!b)return;
  const dx=b.x-a.x,dy=b.y-a.y;
  skinZones.push({a,dx,dy,length:dx*dx+dy*dy,r});
 }
 const shoulderCenter={x:(shoulders[0].x+shoulders[1].x)/2,y:(shoulders[0].y+shoulders[1].y)/2};
 if(face){
  // Stop above the shirt opening. Only pixels classified as exposed skin can pass.
  const neck={x:face.x*.18+shoulderCenter.x*.82,y:face.y*.18+shoulderCenter.y*.82};
  capsule(face,neck,span*.125);
 }
 for(const side of [0,1]){
  const elbow=joint(13+side),wrist=joint(15+side);
  if(!wrist)continue;
  if(elbow){
   const outer=Math.max(shoulders[0].x,shoulders[1].x),inner=Math.min(shoulders[0].x,shoulders[1].x);
   // A lowered arm alongside the body should still accept a new long sleeve.
   const across=wrist.x>=inner&&wrist.x<=outer&&wrist.y>=shoulderCenter.y-span*.2;
   const from=across ? .62 : .12;
   capsule({x:elbow.x*from+wrist.x*(1-from),y:elbow.y*from+wrist.y*(1-from)},wrist,span*.16);
  }
  for(const i of [17,19,21])capsule(wrist,joint(i+side),span*.14);
 }
 let count=0;
 for(let i=0;i<labels.length;i++){
  const id=labels[i],x=i%w+.5,y=Math.floor(i/w)+.5;
  if(id===1||id===3){
   if(face&&Math.hypot(x-face.x,y-face.y)<span*.88)alpha[i]=255;
  }else if(id===2){
   for(const c of skinZones){
    const t=Math.max(0,Math.min(1,((x-c.a.x)*c.dx+(y-c.a.y)*c.dy)/(c.length||1)));
    const d=Math.hypot(x-c.a.x-t*c.dx,y-c.a.y-t*c.dy);
    if(d<c.r){alpha[i]=Math.max(alpha[i],Math.round(255*Math.min(1,c.r-d)));}
   }
  }
  if(alpha[i])count++;
 }
 return count>=8?packMask(w,h,alpha):null;
}

// Trace the waist seam near the detected hips, allowing a curved hem rather than a straight crop.
function waistSeam(photo,labels,w,h,joints){
 const [ls,rs,lh,rh]=[11,12,23,24].map(i=>joints&&joints[i]);
 if([ls,rs,lh,rh].some(p=>!p||p.visibility<.55||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 const hips=(lh.y+rh.y)*h/2,torso=hips-(ls.y+rs.y)*h/2;
 if(torso<12)return null;
 const cx=(lh.x+rh.x)*w/2,half=Math.max(Math.abs(ls.x-rs.x)*w*.64,Math.abs(lh.x-rh.x)*w*.87);
 const start=Math.max(0,Math.round(cx-half)),end=Math.min(w-1,Math.round(cx+half));
 const radius=Math.max(2,Math.round(torso*.035));
 const top=Math.max(radius,Math.floor(hips-torso*.28)),bottom=Math.min(h-radius-1,Math.ceil(hips+torso*.40));
 const rows=bottom-top+1,cols=end-start+1;
 if(rows<4||cols<6)return null;
 let last=new Float32Array(rows),next=new Float32Array(rows);
 const back=new Int8Array(cols*rows);
 function contrast(x,y){
  let sum=0;
  for(let k=1;k<=radius;k++){
   const a=(y-k)*w+x,b=(y+k)*w+x;
   if(labels[a]!==4||labels[b]!==4)continue;
   for(let c=0;c<3;c++)sum+=Math.abs(photo[a*4+c]-photo[b*4+c]);
  }
  return sum/(3*radius);
 }
 for(let x=start;x<=end;x++){
  for(let j=0;j<rows;j++){
   let best=last[j],move=0;
   for(const step of [-1,1]){
    const index=j+step;if(index<0||index>=rows)continue;
    const score=last[index]-5;if(score>best){best=score;move=step;}
   }
   back[(x-start)*rows+j]=move;
   next[j]=best+Math.min(90,contrast(x,top+j))-12*Math.abs(top+j-hips)/torso;
  }
  [last,next]=[next,last];
 }
 let j=last.indexOf(Math.max(...last)),strong=0,seen=0;
 const line=new Uint16Array(w);
 for(let x=end;x>=start;x--){
  line[x]=top+j;
  if(Math.abs(x-cx)<half*.70){seen++;if(contrast(x,line[x])>=16)strong++;}
  j+=back[(x-start)*rows+j];
 }
 if(strong<Math.max(4,seen*.42))return null;
 line.fill(line[start],0,start);line.fill(line[end],end+1);
 return line;
}
