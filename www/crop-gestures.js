// The mask stays in image coordinates; only the canvas viewport pans and zooms.
function bindCropGestures(){
 const view=$('#maskView'),touches=new Map();let viewScale=1,dx=0,dy=0,pinch=null,pan=null,previousFuture=null;
 function display(){
  const limitX=(viewScale-1)*mc.offsetWidth/2,limitY=(viewScale-1)*mc.offsetHeight/2;
  dx=Math.max(-limitX,Math.min(limitX,dx));dy=Math.max(-limitY,Math.min(limitY,dy));
  mc.style.transform='translate('+dx+'px,'+dy+'px) scale('+viewScale+')';
  $('#zoomMask').textContent=Math.round(viewScale*100)+' %';
 }
 function distance(a,b){return Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));}
 function beginPinch(){
  const [a,b]=touches.values(),bounds=view.getBoundingClientRect();
  const cx=(a.x+b.x)/2-bounds.left-bounds.width/2,cy=(a.y+b.y)/2-bounds.top-bounds.height/2;
  pinch={length:distance(a,b),scale:viewScale,anchorX:(cx-dx)/viewScale,anchorY:(cy-dy)/viewScale};
 }
 function reset(){viewScale=1;dx=dy=0;touches.clear();pinch=pan=null;maskPointer=null;display();}
 $('#zoomMask').onclick=reset;
 $('#panMask').onclick=e=>{const b=e.currentTarget;b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));};
 $('#maskBackground').onchange=e=>{view.dataset.background=e.target.value;};
 view.addEventListener('pointerdown',e=>{
  if(!maskBase||touches.size>=2)return;
  const p={x:e.clientX,y:e.clientY};touches.set(e.pointerId,p);view.setPointerCapture(e.pointerId);
  if(touches.size===2){
   if(maskPointer!==null&&maskHistory.length){mx.putImageData(maskHistory.pop(),0,0);maskFuture=previousFuture;}
   maskPointer=null;pan=null;beginPinch();return;
  }
  if($('#panMask').getAttribute('aria-pressed')==='true'){pan={p,dx,dy};return;}
  previousFuture=maskFuture;rememberMask();maskPointer=e.pointerId;maskLast=maskPoint(e);maskStroke(maskLast,maskLast);
 });
 view.addEventListener('pointermove',e=>{
  if(!touches.has(e.pointerId))return;
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===2&&pinch){
   const [a,b]=touches.values(),bounds=view.getBoundingClientRect();
   viewScale=Math.min(5,Math.max(1,pinch.scale*distance(a,b)/pinch.length));
   dx=(a.x+b.x)/2-bounds.left-bounds.width/2-pinch.anchorX*viewScale;
   dy=(a.y+b.y)/2-bounds.top-bounds.height/2-pinch.anchorY*viewScale;display();
  }else if(pan){dx=pan.dx+e.clientX-pan.p.x;dy=pan.dy+e.clientY-pan.p.y;display();}
  else if(maskPointer===e.pointerId){const point=maskPoint(e);maskStroke(maskLast,point);maskLast=point;}
 });
 function finish(e){
  if(!touches.delete(e.pointerId))return;
  if(maskPointer===e.pointerId)maskPointer=null;
  pan=pinch=null;previousFuture=null;
  if(touches.size===1)pan={p:[...touches.values()][0],dx,dy};
 }
 for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,finish);
 return reset;
}
