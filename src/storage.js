import { openDB } from 'idb';

const DB_NAME = 'PasteAndEraseDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let dbPromise;

export async function initDB() {
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
  await dbPromise;
  console.log('IndexedDB Initialized');
}

export async function saveImage(imageObj) {
  const db = await dbPromise;
  await db.put(STORE_NAME, imageObj);
}

export async function getAllImages() {
  const db = await dbPromise;
  return await db.getAll(STORE_NAME);
}

export async function deleteImage(id) {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}

export async function updateImage(id, changes) {
  const db = await dbPromise;
  const imageObj = await db.get(STORE_NAME, id);
  if (imageObj) {
    Object.assign(imageObj, changes);
    await db.put(STORE_NAME, imageObj);
  }
}
