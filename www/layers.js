function initialLayer(category) {
 const presets={Calzado:[28,86],Inferior:[45,66],Accesorio:[22,27]};
 const [size,y]=presets[category]||[55,38];
 return {size,y,x:50,rotation:0,visible:true};
}

function layerHit(layer, point, width, height) {
 const dx=point.x-layer.x*width/100,dy=point.y-layer.y*height/100;
 const angle=layer.rotation*Math.PI/180;
 const size=layer.size*width/100;
 return Math.abs(dx*Math.cos(angle)+dy*Math.sin(angle))<=size/2 &&
  Math.abs(dy*Math.cos(angle)-dx*Math.sin(angle))<=size*layer.bitmap.height/layer.bitmap.width/2;
}
