function bodyPlacement(points, category, aspect, width, height, shoeSide=0) {
 if(!Array.isArray(points)||!(width>0&&height>0&&aspect>0))return null;
 const reliable=p=>p&&p.visibility>=.55&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
 if(category==='Calzado'){
  const feet=[[27,29,31],[28,30,32]].map(([ankle,heel,toe])=>[points[ankle],points[heel],points[toe]]);
  if(feet.some(foot=>!reliable(foot[0])))return null;
  feet.sort((a,b)=>a[0].x-b[0].x);
  const [ankle,heel,toe]=feet[shoeSide===1?1:0];
  if(!reliable(heel)||!reliable(toe))return null;
  const length=Math.hypot((toe.x-ankle.x)*width,(toe.y-ankle.y)*height);
  if(length<height*.018)return null;
  return {x:(ankle.x+toe.x)*50,y:(ankle.y*.44+toe.y*.56)*100,
   size:Math.max(5,Math.min(22,length*aspect*141/width)),rotation:Math.max(-28,Math.min(28,-Math.atan2((toe.x-ankle.x)*width,Math.max(height*.025,(toe.y-ankle.y)*height))*180/Math.PI*.85)),stretch:1};
 }
 const groups={
  Superior:[[11,12],[23,24],1.88,.36],
  Exterior:[[11,12],[23,24],1.98,.38],
  Inferior:[[23,24],[27,28],2.18,.13],
  Corto:[[23,24],[25,26],1.66,.07],
  Vestido:[[11,12],[25,26],1.78,.10],
 };
 const group=groups[category];
 if(!group||!(aspect>0))return null;
 const [upper,lower,margin,extra]=group;
 const landmarks=[...upper,...lower].map(index=>points[index]);
 if(landmarks.some(p=>!reliable(p)))return null;
 const [a,b,c,d]=landmarks.map(p=>({x:p.x*width,y:p.y*height}));
 const top={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 const bottom={x:(c.x+d.x)/2,y:(c.y+d.y)/2};
 if(bottom.y<=top.y)return null;
 const spread=Math.hypot(a.x-b.x,a.y-b.y);
 const length=Math.hypot(bottom.x-top.x,bottom.y-top.y);
 // Fit waist-to-ankles independently of garment aspect; avoid truncating long trousers.
 const legSpread=Math.abs(c.x-d.x);
 const pixels=category==='Inferior'?Math.max(spread*margin,legSpread+spread*1.04):spread*margin;
 const targetHeight=length*(1+extra);
 const stretch=Math.max(.35,Math.min(3.5,targetHeight*aspect/pixels));
 if(pixels<width*.05)return null;
 const [left,right]=a.x<=b.x?[a,b]:[b,a];
 const rotation=category==='Calzado'?0:Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI;
 return {x:(top.x+bottom.x)*50/width,y:((top.y+bottom.y)/2-(['Superior','Exterior'].includes(category)?length*.055:0))*100/height,
  size:Math.max(5,Math.min(140,pixels*100/width)),rotation,stretch};
}

// Project joints into the garment's own rotated coordinates before shaping its grid.
function poseMesh(points, category, layer, width, height) {
 if(!['Superior','Exterior','Inferior'].includes(category))return null;
 const project=index=>{
  const joint=points?.[index];
  if(!joint||joint.visibility<.55||!Number.isFinite(joint.x)||!Number.isFinite(joint.y))return null;
  return canvasToMesh({x:joint.x*width,y:joint.y*height},layer,width,height);
 };
 function pair(a,b){
  const left=project(a),right=project(b);
  if(!left||!right)return null;
  return [left,right].sort((u,v)=>u.x-v.x);
 }
 const mesh=flatGarmentMesh(),clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
 // Each row maps the midline and width independently. Limits retain the photographed cut.
 function setRow(row,joints,spanFactor,halfMin,halfMax,bend){
  if(!joints)return;
  const [a,b]=joints,center=clamp((a.x+b.x)/2,.28,.72);
  const half=clamp((b.x-a.x)*spanFactor/2,halfMin,halfMax);
  const tilt=clamp((b.y-a.y)*bend,-.085,.085);
  mesh[row*3]={x:center-half,y:row/2-tilt};
  mesh[row*3+1]={x:center,y:row/2};
  mesh[row*3+2]={x:center+half,y:row/2+tilt};
 }
 const hips=pair(23,24);
 if(category==='Inferior'){
  const knees=pair(25,26),feet=pair(27,28);
  if(!hips||!knees||!feet)return null;
  setRow(0,hips,2.18,.46,.62,.2);
  setRow(1,knees,1.65,.32,.63,.42);
  setRow(2,feet,1.65,.31,.68,.48);
 }else{
  const shoulders=pair(11,12);
  if(!shoulders||!hips)return null;
  setRow(0,shoulders,category==='Exterior'?1.85:1.75,.44,.56,.12);
  const middle=shoulders.map((p,i)=>({x:(p.x+hips[i].x)/2,y:(p.y+hips[i].y)/2}));
  setRow(1,middle,2.12,.49,.61,.2);
  setRow(2,hips,2.55,.47,.63,.32);
 }
 return validGarmentMesh(mesh)?mesh:null;
}

// Locate the last opaque part of a sleeve projecting beyond the side seam.
function sleeveEnd(mask,right){
 const {width:w,height:h,alpha}=mask;
 function extent(v){
  const row=Math.min(h-1,Math.round(v*(h-1)))*w;
  for(let i=0;i<w/2;i++){
   const x=right?w-1-i:i;
   if(alpha[row+x]>180)return i/w;
  }
  return .5;
 }
 const seam=[.68,.72,.76,.8,.84].map(extent).sort((a,b)=>a-b)[2];
 let end;
 for(let y=.14;y<=.66;y+=.015){
  const edge=extent(y);
  if(seam-edge>.065)end={x:right?1-(edge+seam)/2:(edge+seam)/2,y};
 }
 return end;
}

// Two runs of visible material separated by transparency identify the trouser hems.
function legCenters(mask,v){
 const {width:w,height:h,alpha}=mask,row=Math.round((h-1)*v)*w;
 const runs=[];
 for(let x=0;x<w;x++){
  if(alpha[row+x]<120)continue;
  const start=x;
  while(x+1<w&&alpha[row+x+1]>=120)x++;
  if(x-start>w*.10)runs.push({x:(start+x)/(2*w),start,end:x});
 }
 if(runs.length!==2||runs[0].end+1>=runs[1].start)return null;
 return runs.map(r=>r.x);
}

function articulatedMesh(base,points,category,layer,width,height,mask){
 if(!base||!mask)return base;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const project=i=>{
  const p=points[i];
  return p&&p.visibility>=.55&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?
   canvasToMesh({x:p.x*width,y:p.y*height},layer,width,height):null;
 };
 const anchors=[];
 const legs=category==='Inferior';
 if(!legs&&!['Superior','Exterior'].includes(category))return base;
 const sides=legs?[[23,25,27],[24,26,28]]:[[11,13,15],[12,14,16]];
 const chains=sides.map(chain=>chain.map(project));
 if(chains.some(chain=>!chain[0]))return base;
 chains.sort((a,b)=>a[0].x-b[0].x);
 const hems=legs&&(legCenters(mask,.92)||legCenters(mask,.85));
 if(legs&&!hems)return base;
 for(const [side,[root,middle,end]] of chains.entries()){
  if(!middle)continue;
  const append=(x,y,target)=>{
   const p=meshSample(base,x,y);
   anchors.push({x,y,side,dx:clamp(target.x-p.x,-.32,.32),dy:clamp(target.y-p.y,-.25,.25)});
  };
  if(legs){
   if(!end||end.y<=middle.y||middle.y<=root.y)continue;
   const knees=legCenters(mask,.5)||hems;
   append(knees[side],.5,middle);append(hems[side],.96,end);
  }else{
   const cuff=sleeveEnd(mask,!!side);
   if(!cuff)continue;
   // Short sleeves end on the upper arm; longer photographed sleeves may reach the forearm.
   const reach=clamp((cuff.y-.09)*2.15,.28,1.28);
   if(reach>1&&!end)continue;
   const a=reach<=1?root:middle,b=reach<=1?middle:end,t=reach<=1?reach:reach-1;
   append(cuff.x,cuff.y,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  }
 }
 if(!anchors.length)return base;
 const original=[],delta=[];
 for(let r=0;r<5;r++)for(let col=0;col<5;col++){
  const x=col/4,y=r/4;original.push(meshSample(base,x,y));
  let dx=0,dy=0;
  for(const a of anchors){
   const lateral=legs?clamp((a.side?x-.40:.60-x)/.18,0,1):
    clamp((a.side?x-.54:.46-x)/Math.max(.1,a.side?a.x-.54:.46-a.x),0,1);
   const vertical=legs?clamp(1-Math.abs(y-a.y)/.46,0,1):
    clamp(1-Math.abs(y-a.y)/.32,0,1)*clamp(y/.14,0,1);
   dx+=a.dx*lateral*vertical;dy+=a.dy*lateral*vertical;
  }
  delta.push({x:dx,y:dy});
 }
 // Reduce extreme corrections until all cells keep their orientation.
 for(const amount of [1,.75,.5,.25]){
  const mesh=original.map((p,i)=>({x:p.x+delta[i].x*amount,y:p.y+delta[i].y*amount}));
  if(validGarmentMesh(mesh))return mesh;
 }
 return base;
}

// Estimate lateral lighting from small interior patches of the photographed torso.
const portraitLight=new WeakMap();
function torsoLight(photo,points){
 if(!photo)return 0;
 if(portraitLight.has(photo))return portraitLight.get(photo);
 const joints=[11,12,23,24].map(i=>points[i]);
 if(joints.some(p=>!p||p.visibility<.65))return 0;
 const c=document.createElement('canvas');c.width=64;c.height=64;
 const ctx=c.getContext('2d');ctx.drawImage(photo,0,0,64,64);
 const pixels=ctx.getImageData(0,0,64,64).data;
 const ordered=[joints.slice(0,2),joints.slice(2)].map(pair=>pair.sort((a,b)=>a.x-b.x));
 function median(u){
  const values=[];
  for(const v of [.3,.42,.54,.66])for(const offset of [-.055,0,.055]){
   const sample=axis=>{
    const rows=ordered.map(([a,b])=>a[axis]+(b[axis]-a[axis])*(u+offset));
    return rows[0]+(rows[1]-rows[0])*v;
   };
   const x=Math.max(0,Math.min(63,Math.round(sample('x')*63))),y=Math.max(0,Math.min(63,Math.round(sample('y')*63))),i=(y*64+x)*4;
   values.push(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2]);
  }
  return values.sort((a,b)=>a-b)[6];
 }
 const left=median(.22),right=median(.78);
 const light=Math.max(-.22,Math.min(.22,(right-left)/Math.max(60,(left+right)/2)*.65));
 portraitLight.set(photo,light);return light;
}

const poseOutlines=new WeakMap();
function fitSilhouette(mesh,outline,points,category,layer,width,height,mask){
 if(!outline||mesh.length!==25)return mesh;
 const pants=category==='Inferior';
 if(!pants&&!['Superior','Exterior'].includes(category))return mesh;
 const result=mesh.map(p=>({...p}));
 const sides=pants?[[23,25,27],[24,26,28]]:[[11,23],[12,24]];
 const paths=sides.map(ids=>ids.map(i=>points[i])).sort((a,b)=>a[0].x-b[0].x);
 const {w,h,pixels}=outline,clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 for(let row=0;row<5;row++){
  if(!pants&&row<2)continue; // Upper arms and shoulders can form one connected silhouette.
  const v=clamp(row/4,.065,.94),mrow=Math.round(v*(mask.height-1))*mask.width;
  for(let side=0;side<2;side++){
   const sign=side?1:-1,chain=paths[side];
   let col=side?mask.width-1:0;
   while(col>=0&&col<mask.width&&mask.alpha[mrow+col]<150)col-=sign;
   if(col<0||col>=mask.width)continue;
   const u=col/(mask.width-1);
   if((side?u:1-u)<.60)continue;
   const edge=meshToCanvas(meshSample(mesh,u,v),layer,width,height);
   const y=edge.y/height;
   if(chain.some(p=>!p||p.visibility<.55))continue;
   const from=pants&&y>chain[1].y?1:0,a=chain[from],b=chain[from+1];
   if(b.y<=a.y+.02)continue;
   const t=clamp((y-a.y)/(b.y-a.y),0,1);
   const jointX=a.x+(b.x-a.x)*t;
   const iy=Math.round(y*(h-1)),ix=Math.round(jointX*(w-1));
   if(iy<0||iy>=h||ix<0||ix>=w||pixels.charCodeAt(iy*w+ix)!==1)continue;
   let boundary=ix;
   while(boundary+sign>=0&&boundary+sign<w&&pixels.charCodeAt(iy*w+boundary+sign)===1)boundary+=sign;
   if(boundary===0||boundary===w-1)continue;
   const outer=boundary*width/(w-1),gap=sign*(outer-edge.x);
   const frame=garmentFrame(layer,width,height);
   if(gap<=0||gap>frame.w*.26)continue;
   // Extend only outboard vertices. Preserve seams and retain the photographed ease.
   const amount=Math.min(.20,(gap+width/w*.5)/frame.w);
   for(let i=0;i<5;i++){
    const influence=clamp((i/4-.5)*sign/Math.max(.15,Math.abs(u-.5)),0,1.45);
    result[row*5+i].x+=sign*amount*influence;
   }
  }
 }
 return validGarmentMesh(result)?result:mesh;
}
