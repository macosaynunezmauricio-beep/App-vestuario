const swatches={
 Negro:'#222222',Blanco:'#eeeeea',Gris:'#858689',Plata:'#b6babe',Carbón:'#434647',
 Azul:'#345eaf','Azul marino':'#24374d',Celeste:'#93c5e3',Turquesa:'#3aaea5',Petróleo:'#285d66',
 Verde:'#398352','Verde oliva':'#788049','Verde militar':'#515e43',Menta:'#a6d8b8',
 Rojo:'#c44038',Vino:'#752d43',Rosa:'#d99cab',Fucsia:'#cc3583',Coral:'#df816a',
 Naranja:'#d77d35',Terracota:'#ad6348',Amarillo:'#eac94a',Mostaza:'#bf9634',
 Morado:'#704989',Púrpura:'#753665',Lila:'#baa2ce',Café:'#795240',Marrón:'#593e30',
 Beige:'#c9b798',Crema:'#e9dfbe',Arena:'#bda57e',Dorado:'#b99b55'
};
// sRGB -> CIELAB, D65. Shadows of the same hue get a smaller lightness penalty.
function colorLab(r,g,b){
 const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
 [r,g,b]=[linear(r),linear(g),linear(b)];
 const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
 const x=f((r*.4124564+g*.3575761+b*.1804375)/.95047),y=f(r*.2126729+g*.7151522+b*.072175),z=f((r*.0193339+g*.119192+b*.9503041)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
const palette=Object.entries(swatches).map(([name,hex])=>[name,colorLab(...hex.slice(1).match(/../g).map(s=>parseInt(s,16)))]);
function garmentColors({data}){
 const bins=new Map(),votes=new Map();
 for(let i=0;i<data.length;i+=4){
  if(data[i+3]<192)continue;
  const key=(data[i]>>4)*256+(data[i+1]>>4)*16+(data[i+2]>>4);
  bins.set(key,(bins.get(key)||0)+1);
 }
 for(const [key,count] of bins){
  const lab=colorLab((key>>8)*16+8,((key>>4)&15)*16+8,(key&15)*16+8);
  let closest='Otro',best=Infinity;
  for(const [name,ref] of palette){
   const d=((lab[0]-ref[0])*.78)**2+(lab[1]-ref[1])**2+(lab[2]-ref[2])**2;
   if(d<best){closest=name;best=d;}
  }
  votes.set(closest,(votes.get(closest)||0)+count);
 }
 const ranked=[...votes].sort((a,b)=>b[1]-a[1]);if(!ranked.length)return [];
 const first=ranked[0][0],total=ranked.reduce((n,e)=>n+e[1],0);
 const base=palette.find(x=>x[0]===first)[1];
 const second=ranked.slice(1).find(([name,n])=>n/total>=.18&&Math.hypot(...palette.find(x=>x[0]===name)[1].map((v,i)=>v-base[i]))>28);
 return second?[first,second[0]]:[first];
}
function bindColors(){
 const options=Object.keys(swatches).map(c=>new Option(c,c));
 $('#color').replaceChildren(...options,new Option('Otro','Otro'),new Option('Personalizado','custom'));
 $('#secondaryColor').replaceChildren(new Option('Sin color secundario',''),...Object.keys(swatches).map(c=>new Option(c,c)));
 $('#color').onchange=()=>{$('#customWrap').hidden=$('#color').value!=='custom';};
}
function setDetectedColors(image){
 const {pixels,isolated}=productPixels(image);
 if(!isolated&&selectedPhoto&&!cutoutBlob){$('#color').value='Otro';$('#secondaryColor').value='';}
 else{const [main='Otro',second='']=garmentColors(pixels);$('#color').value=main;$('#secondaryColor').value=second;}
 $('#customWrap').hidden=true;
}
