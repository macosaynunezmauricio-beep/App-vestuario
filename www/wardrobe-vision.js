// The model always sees the original; alpha operations are applied to the editable mask.
let tapVersion=0,tapArmed=false,tapBusy=false,tapSource=null;
function updateTap(armed=false){
 tapArmed=armed;tapBusy=false;tapVersion++;
 $('#tapSelect').setAttribute('aria-pressed',String(armed));
 $('#tapSelect').textContent=armed?'Cancelar selección':'Seleccionar por toque';
}
function originalForVision(base){
 if(tapSource&&tapSource.base===base)return tapSource;
 const canvas=document.createElement('canvas');canvas.width=base.width;canvas.height=base.height;
 canvas.getContext('2d').putImageData(base,0,0);
 tapSource={base,canvas,image:canvas.toDataURL('image/jpeg',.92).split(',')[1],pose:null};
 return tapSource;
}
async function selectFromTap(point){
 if(tapBusy||!maskBase)return;
 const version=tapVersion,base=maskBase,part=$('#wornPart').value,op=$('#tapOperation').value;
 const status=$('#maskStatus'),source=originalForVision(base);
 const bridge=window.Capacitor.Plugins;
 const x=Math.max(0,Math.min(1,point.x/base.width)),y=Math.max(0,Math.min(1,point.y/base.height));
 tapBusy=true;status.textContent='Buscando la prenda en tu teléfono…';
 const current=()=>version===tapVersion&&base===maskBase;
 try{
  const {subject,classes}=await bridge.WardrobeVision.analyze({image:source.image,mode:'select',worn:part!=='loose',x,y});
  if(!current())return;
  let seam=null;
  if(part==='upper'||part==='lower'){
   if(!source.pose)source.pose=(await bridge.BodyPose.detect({image:source.image})).points;
   if(!current())return;
   const small=document.createElement('canvas');small.width=subject.w;small.height=subject.h;
   const ctx=small.getContext('2d');ctx.drawImage(source.canvas,0,0,small.width,small.height);
   seam=waistSeam(ctx.getImageData(0,0,small.width,small.height).data,unpackMask(classes),small.width,small.height,source.pose);
   if(!seam)throw Error('La cintura no se distingue. Elige «Ropa puesta completa» o usa el pincel.');
  }
  const alpha=tappedGarment(subject,classes,x,y,seam,part);
  if(!alpha)throw Error('Toca dentro de la tela, lejos del borde, o cambia el tipo de foto.');
  const small=alphaCanvas(subject.w,subject.h,alpha),large=document.createElement('canvas');
  large.width=base.width;large.height=base.height;
  const ctx=large.getContext('2d');ctx.drawImage(small,0,0,large.width,large.height);
  const ink=ctx.getImageData(0,0,large.width,large.height).data;
  const edited=mx.getImageData(0,0,mc.width,mc.height);
  rememberMask();
  for(let i=0;i<ink.length;i+=4){
   const old=edited.data[i+3],a=Math.round(base.data[i+3]*ink[i+3]/255);
   edited.data[i+3]=op==='add'?Math.max(old,a):op==='subtract'?Math.round(old*(1-ink[i+3]/255)):a;
   for(let k=0;k<3;k++)edited.data[i+k]=base.data[i+k];
  }
  mx.putImageData(edited,0,0);
  $('#tapOperation').value='add';
  status.textContent='Selección lista. Puedes sumar otra zona con un toque o pulsar Aplicar recorte.';
 }catch(error){if(current())status.textContent=error.message||'No se pudo seleccionar esa zona.';}
 finally{if(current())updateTap(false);}
}

let automaticFront=null,frontDirty=true,frontRequest=0;
function syncFrontButton(){
 $('#detectFront').textContent=automaticFront?'Quitar protección automática':'Proteger manos y rostro';
 $('#detectFront').setAttribute('aria-pressed',String(!!automaticFront));
}
async function detectForeground(points,automatic=false){
 const source=personSource,version=sceneVersion,request=++frontRequest;
 const current=()=>request===frontRequest&&source===personSource&&version===sceneVersion;
 const status=$('#frontStatus'),button=$('#detectFront');
 if(!source||!window.Capacitor?.Plugins?.WardrobeVision)return;
 button.disabled=true;status.textContent='Detectando manos y rostro…';
 try{
  const pose=points||await detectPose(source);
  if(!current())return;
  if(!pose.length)throw Error('No se encontró una postura clara. Puedes pintar las zonas al frente.');
  const {classes}=await window.Capacitor.Plugins.WardrobeVision.analyze({mode:'person',image:source.split(',')[1]});
  if(!current())return;
  portraitSemantics={source,classes};
  const mask=personForeground(classes,pose);
  if(!mask)throw Error('No se distinguieron esas zonas. Puedes retocarlas con el pincel.');
  if(!automatic)remember();
  automaticFront=mask;rebuildOcclusion();syncLayers();
  status.textContent='Protección activa. El pincel permite corregirla.';
 }catch(error){if(current())status.textContent=error.message||'Puedes usar el pincel para corregir.';}
 finally{if(current())button.disabled=false;}
}
function resetFront(mask=null){
 frontRequest++;automaticFront=mask;
 $('#detectFront').disabled=false;$('#frontStatus').textContent='';syncFrontButton();
}
function bindWardrobeVision(){
 const available=!!window.Capacitor?.Plugins?.WardrobeVision;
 $('#tapTools').hidden=$('#nativeFront').hidden=!available;
 $('#tapSelect').onclick=()=>{
  updateTap(!tapArmed);
  $('#maskStatus').textContent=tapArmed?'Toca el centro de la zona de tela que quieres seleccionar.':'Selección por toque cancelada.';
 };
 $('#detectFront').onclick=()=>{
  if(automaticFront){remember();resetFront();rebuildOcclusion();syncLayers();}
  else detectForeground(null);
 };
}

let neckRequest=0,portraitSemantics=null;
async function toggleRealNeck(){
 const layer=layers[active],source=personSource,version=sceneVersion;
 if(!layer||!source||!window.Capacitor?.Plugins?.WardrobeVision)return;
 if(layer.neckMask){deleteRealNeck();return;}
 const request=++neckRequest;$('#realNeck').disabled=true;
 $('#neckStatus').textContent='Buscando la piel visible del cuello…';
 const current=()=>version===sceneVersion&&source===personSource&&request===neckRequest&&layers[active]===layer;
 try{
  const pose=await detectPose(source);
  if(!current())return;
  if(!pose.length)throw Error('No se distinguió el cuello. Puedes usar la abertura manual.');
  const classes=portraitSemantics?.source===source?portraitSemantics.classes:
   (await window.Capacitor.Plugins.WardrobeVision.analyze({mode:'person',image:source.split(',')[1]})).classes;
  if(!current())return;
  const mask=exposedNeck(classes,pose);
  if(!mask)throw Error('No se distinguió piel visible en el cuello. Prueba con una foto con el cuello descubierto.');
  changeLayer(currentLayer=>{currentLayer.neckMask=mask;});
  $('#neckStatus').textContent='Solo se recupera la piel visible; la ropa original no se restaura.';
 }catch(error){if(current())$('#neckStatus').textContent=error.message||'No se pudo detectar el cuello.';}
 finally{if(request===neckRequest){$('#realNeck').disabled=false;}}
}
function deleteRealNeck(){
 changeLayer(layer=>{delete layer.neckMask;});
 $('#neckStatus').textContent='';
}
