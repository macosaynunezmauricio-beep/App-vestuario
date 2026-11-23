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
  return {x:(ankle.x+toe.x)*50,y:(ankle.y+toe.y)*50,
   size:Math.max(5,Math.min(22,length*aspect*115/width)),rotation:Math.abs(toe.y-heel.y)>.012?Math.max(-32,Math.min(32,-Math.atan2((toe.x-heel.x)*width,(toe.y-heel.y)*height)*180/Math.PI)):0,stretch:1};
 }
 const groups={
  Superior:[[11,12],[23,24],1.75,.18],
  Exterior:[[11,12],[23,24],1.85,.2],
  Inferior:[[23,24],[27,28],1.72,.13],
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
 const pixels=category==='Inferior'?Math.max(spread*margin,legSpread+spread*.65):spread*margin;
 const targetHeight=length*(1+extra);
 const stretch=Math.max(.35,Math.min(3.5,targetHeight*aspect/pixels));
 if(pixels<width*.05)return null;
 const [left,right]=a.x<=b.x?[a,b]:[b,a];
 const rotation=category==='Calzado'?0:Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI;
 return {x:(top.x+bottom.x)*50/width,y:(top.y+bottom.y)*50/height,
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
  setRow(0,hips,1.58,.32,.55,.2);
  setRow(1,knees,1.65,.32,.63,.42);
  setRow(2,feet,1.65,.31,.68,.48);
 }else{
  const shoulders=pair(11,12);
  if(!shoulders||!hips)return null;
  setRow(0,shoulders,category==='Exterior'?1.85:1.75,.44,.56,.12);
  const middle=shoulders.map((p,i)=>({x:(p.x+hips[i].x)/2,y:(p.y+hips[i].y)/2}));
  setRow(1,middle,1.84,.40,.57,.2);
  setRow(2,hips,1.93,.38,.6,.32);
 }
 return validGarmentMesh(mesh)?mesh:null;
}
