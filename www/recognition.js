// Small classifier trained on isolated product photos. Predict only after isolating a usable outline.
const fashionLabels=[
 ['Camiseta','Superior'],['Pantalón','Inferior'],['Suéter','Superior'],['Vestido','Vestido'],
 ['Abrigo','Exterior'],['Sandalia','Calzado'],['Camisa','Superior'],['Tenis','Calzado'],
 ['Bolso','Accesorio'],['Botín','Calzado']
];
const namedCategories=[
 ['Superior',/\b(camisas?|camisetas?|playeras?|blusas?|polos?|sudaderas?|sueter(?:es)?)\b/],
 ['Inferior',/\b(pantalon(?:es)?|jeans?|mezclilla|faldas?|shorts?|bermudas?)\b/],
 ['Calzado',/\b(tenis|zapatos?|botas?|botin(?:es)?|sandalias?|zapatillas?)\b/],
 ['Exterior',/\b(chamarras?|chaquetas?|abrigos?|blazers?)\b/],['Vestido',/\bvestidos?\b/],
 ['Accesorio',/\b(gorras?|bols[ao]s?|cinturon(?:es)?|sombreros?|bufandas?)\b/]
];
function categoryFromName(name){return namedCategories.find(([,words])=>words.test(searchable(name)))?.[0];}
function productPixels(img){
 const canvas=document.createElement('canvas'),scale=Math.min(1,125/Math.max(img.width,img.height));
 canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 let clear=0;for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<64)clear++;
 if(clear>pixels.width*pixels.height*.025)return {pixels,isolated:true};
 const mask=simpleBackdropMask(pixels);
 if(mask)for(let i=0;i<mask.length;i++)if(mask[i])pixels.data[i*4+3]=0;
 return {pixels,isolated:!!mask};
}
function shapeFeatures({width,height,data}){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(data[4*(y*width+x)+3]<128)continue;
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
 }
 if(right-left<2||bottom-top<2)return null;
 const w=right-left+1,h=bottom-top+1,step=Math.max(w,h)/13,features=new Float32Array(196);
 features.fill(-1);let peak=1;
 for(let y=0;y<14;y++)for(let x=0;x<14;x++){
  const px=Math.floor(left+w/2+(x-6.5)*step),py=Math.floor(top+h/2+(y-6.5)*step);
  if(px<left||px>right||py<top||py>bottom)continue;
  const i=4*(py*width+px);if(data[i+3]<128)continue;
  const light=.299*data[i]+.587*data[i+1]+.114*data[i+2];
  features[y*14+x]=light;peak=Math.max(peak,light);
 }
 return features.map(v=>v<0?0:.42+.58*v/peak);
}
let denseWeights;
function classifyShape(features){
 if(!features)return null;
 if(!denseWeights)denseWeights=fashionWeights.weights.map(({scale,values})=>Float32Array.from(atob(values),c=>((c.charCodeAt(0)+128)%256-128)*scale));
 let outputs=features;
 for(let l=0;l<denseWeights.length;l++){
  const next=Float32Array.from(fashionWeights.biases[l]),weights=denseWeights[l];
  for(let i=0;i<outputs.length;i++)for(let j=0;j<next.length;j++)next[j]+=outputs[i]*weights[i*next.length+j];
  outputs=l===0?next.map(v=>Math.max(0,v)):next;
 }
 const peak=Math.max(...outputs),exp=outputs.map(v=>Math.exp(v-peak)),total=exp.reduce((a,b)=>a+b,0);
 const ranked=fashionLabels.map(([name,category],i)=>({name,category,score:exp[i]/total})).sort((a,b)=>b.score-a.score);
 return {...ranked[0],certain:ranked[0].score>=.8&&ranked[0].score-ranked[1].score>=.35};
}
async function recognize(){
 const status=$('#aiStatus'),button=$('#recognize');
 const source=cutoutBlob||selectedPhoto||editing?.image;
 if(!source){status.textContent='Elige primero una foto.';return;}
 const named=categoryFromName($('#name').value);
 if(named){$('#category').value=named;status.textContent='Categoría sugerida por el nombre: '+named+'.';return;}
 const file=selectedPhoto,item=editing;button.disabled=true;
 try{
  const image=source instanceof Blob?await readPhoto(source):await loadImage(source);
  if(file!==selectedPhoto||item!==editing)return;
  const {pixels,isolated}=productPixels(image);
  if(!isolated){status.textContent='Recorta la prenda para que el reconocedor pueda distinguir su silueta.';return;}
  const match=classifyShape(shapeFeatures(pixels));
  if(!match?.certain){status.textContent=match?'Podría ser '+match.name.toLowerCase()+'. Confirma la categoría.':'Revisa el recorte y elige la categoría.';return;}
  $('#category').value=match.category;if(!$('#name').value.trim())$('#name').value=match.name;
  status.textContent='Sugerencia local: '+match.name+'. Revisa antes de guardar.';
 }catch{status.textContent='No se pudo reconocer esta prenda. Puedes elegir la categoría.';}
 finally{button.disabled=false;}
}
