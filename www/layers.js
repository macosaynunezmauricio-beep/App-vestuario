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
  Math.abs(dy*Math.cos(angle)-dx*Math.sin(angle))<=size*layer.bitmap.height/layer.bitmap.width*(layer.stretch??1)/2;
}

// Canvas paints from back to front. Leave existing (including manually reordered) layers in place.
function insertGarment(layers,layer){
 const order={Calzado:0,Inferior:1,Superior:2,Vestido:2,Exterior:3,Accesorio:4};
 const rank=item=>order[item.category]??4;
 const higher=layers.findIndex(existing=>rank(existing.item)>rank(layer.item));
 const index=higher<0?layers.length:higher;
 layers.splice(index,0,layer);
 return index;
}
