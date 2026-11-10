const backupStores = ['clothes', 'outfits'];

function transactionDone(tx) {
 return new Promise((resolve, reject) => {
  tx.oncomplete = resolve;
  tx.onabort = () => reject(tx.error || Error('Transacción cancelada'));
 });
}

function validateBackup(backup) {
 const validImage = value => typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+=*$/i.test(value);
 const validId = id => Number.isSafeInteger(id) || (typeof id === 'string' && id.length > 0);
 const validItem = item => item && validId(item.id) && validImage(item.image) &&
  ['name','category','color','style'].every(key => typeof item[key] === 'string') &&
  (item.original === undefined || validImage(item.original));
 if (backup?.format !== 'mi-armario' || backup.version !== 1 ||
     !Array.isArray(backup.clothes) || !backup.clothes.every(validItem) ||
     !Array.isArray(backup.outfits) || !backup.outfits.every(outfit =>
      outfit && validId(outfit.id) && typeof outfit.occasion === 'string' &&
      Array.isArray(outfit.items) && outfit.items.every(validItem))) {
  throw Error('El archivo no es una copia compatible de Mi Armario.');
 }
 for (const store of backupStores) {
  if (new Set(backup[store].map(record => record.id)).size !== backup[store].length) {
   throw Error('La copia contiene registros duplicados.');
  }
 }
 return backup;
}

async function exportWardrobe() {
 const tx = db.transaction(backupStores);
 const committed = transactionDone(tx);
 const [clothes, outfits] = await Promise.all([
  ...backupStores.map(store => request(tx.objectStore(store).getAll())), committed
 ]);
 const blob = new Blob([JSON.stringify({format:'mi-armario',version:1,clothes,outfits})],
  {type:'application/json'});
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = 'mi-armario-respaldo.json';
 document.body.appendChild(link);
 link.click();
 link.remove();
 setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function importWardrobe(file) {
 const backup = validateBackup(JSON.parse(await file.text()));
 if (!confirm('¿Combinar la copia con tu armario? Se conservarán los registros existentes.')) return;
 const tx = db.transaction(backupStores, 'readwrite');
 const committed = transactionDone(tx);
 for (const store of backupStores) {
  const table = tx.objectStore(store);
  for (const record of backup[store]) {
   const lookup = table.getKey(record.id);
   lookup.onsuccess = () => {
    if (lookup.result === undefined) table.add(record);
   };
  }
 }
 await committed;
 notify('Copia importada. Los registros existentes se conservaron.');
 render();
}
