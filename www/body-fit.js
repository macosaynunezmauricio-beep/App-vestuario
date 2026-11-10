function bodyPlacement(points, category, aspect, width, height, shoeSide=0) {
 const reliable=p=>p&&p.visibility>=.55&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
 if(category==='Calzado'){
  const feet=[[27,29,31],[28,30,32]].map(([ankle,heel,toe])=>[points[ankle],points[heel],points[toe]]);
  if(feet.some(foot=>!reliable(foot[0])))return null;
  feet.sort((a,b)=>a[0].x-b[0].x);
  const [ankle,heel,toe]=feet[shoeSide];
  if(!reliable(heel)||!reliable(toe))return null;
  const length=Math.hypot((toe.x-ankle.x)*width,(toe.y-ankle.y)*height);
  if(length<height*.018)return null;
  return {x:(ankle.x+toe.x)*50,y:(ankle.y+toe.y)*50,
   size:Math.max(5,Math.min(22,length*aspect*115/width)),rotation:0,stretch:1};
 }
 const groups={
  Superior:[[11,12],[23,24],1.75,.18],
  Exterior:[[11,12],[23,24],1.85,.2],
  Inferior:[[23,24],[27,28],1.72,.13],
 };
 const group=groups[category];
 if(!group||!(aspect>0))return null;
 const [upper,lower,margin,extra]=group;
 const landmarks=[...upper,...lower].map(index=>points[index]);
 if(landmarks.some(p=>!p||p.visibility<.55||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))return null;
 const [a,b,c,d]=landmarks.map(p=>({x:p.x*width,y:p.y*height}));
 const top={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 const bottom={x:(c.x+d.x)/2,y:(c.y+d.y)/2};
 if(bottom.y<=top.y)return null;
 const spread=Math.hypot(a.x-b.x,a.y-b.y);
 const length=Math.hypot(bottom.x-top.x,bottom.y-top.y);
 const pixels=spread*margin;
 const stretch=Math.max(.65,Math.min(1.6,length*(1+extra)*aspect/pixels));
 if(pixels<width*.05)return null;
 const [left,right]=a.x<=b.x?[a,b]:[b,a];
 const rotation=category==='Calzado'?0:Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI;
 return {x:(top.x+bottom.x)*50/width,y:(top.y+bottom.y)*50/height,
  size:Math.max(5,Math.min(140,pixels*100/width)),rotation,stretch};
}
