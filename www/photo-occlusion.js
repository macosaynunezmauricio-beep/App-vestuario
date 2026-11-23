// Normalized strokes reveal pixels from the original person photo above garments.
function validOcclusion(strokes){
 return Array.isArray(strokes)&&strokes.length<=160&&strokes.reduce((n,s)=>n+(Array.isArray(s?.points)?s.points.length:12001),0)<=12000&&strokes.every(s=>
  s&&['front','clothes'].includes(s.mode)&&Number.isFinite(s.radius)&&s.radius>=.002&&s.radius<=.15&&
  Array.isArray(s.points)&&s.points.length>0&&s.points.length<=400&&s.points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
}
function paintOcclusion(ctx,stroke,width,height,start=0){
 ctx.save();ctx.globalCompositeOperation=stroke.mode==='clothes'?'destination-out':'source-over';
 ctx.fillStyle=ctx.strokeStyle='#fff';ctx.lineWidth=stroke.radius*width*2;ctx.lineCap=ctx.lineJoin='round';
 const points=stroke.points;
 ctx.beginPath();const p=points[start];ctx.moveTo(p.x*width,p.y*height);
 for(let i=start+1;i<points.length;i++)ctx.lineTo(points[i].x*width,points[i].y*height);
 if(points.length-start===1){ctx.arc(p.x*width,p.y*height,stroke.radius*width,0,Math.PI*2);ctx.fill();}else ctx.stroke();
 ctx.restore();
}
