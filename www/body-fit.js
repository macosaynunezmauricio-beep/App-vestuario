function bodyPlacement(points, category, aspect, width, height) {
 const groups={
  Superior:[[11,12],[23,24],1.35,.06],
  Exterior:[[11,12],[23,24],1.5,.08],
  Inferior:[[23,24],[27,28],1.26,0],
  Calzado:[[27,28],[31,32],1.45,.02]
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
 const pixels=category==='Calzado'?Math.max(spread*margin,length*aspect):Math.min(spread*margin,length*aspect*(1+extra));
 if(pixels<width*.05)return null;
 const [left,right]=a.x<=b.x?[a,b]:[b,a];
 const rotation=category==='Calzado'?0:Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI;
 return {x:(top.x+bottom.x)*50/width,y:(top.y+bottom.y)*50/height,
  size:Math.max(5,Math.min(140,pixels*100/width)),rotation};
}
