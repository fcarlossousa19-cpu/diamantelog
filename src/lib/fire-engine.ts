// ====================================================================
// NUCLEO FIREBASE - EXPEDLOG DIRECT-TO-CLOUD ENGINE
// Integrado ao Cloud Firestore, Firebase Auth e Cloud Storage (Spark Plan)
// ====================================================================

import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  query as firestoreQuery, 
  where as firestoreWhere, 
  onSnapshot as firestoreOnSnapshot, 
  setDoc as firestoreSetDoc, 
  deleteDoc as firestoreDeleteDoc, 
  getDocs as firestoreGetDocs, 
  writeBatch as firestoreWriteBatch
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updatePassword as firebaseUpdatePassword
} from "firebase/auth";
import { 
  getStorage, 
  ref as storageRef, 
  uploadString, 
  getDownloadURL 
} from "firebase/storage";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyAEp8eImH5MrV5oLVil3o7P5vCuhNZZeoc",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "diamantelog.firebaseapp.com",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "diamantelog",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "diamantelog.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "401435018169",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:401435018169:web:cebfc50331a10775e02c68"
};

export const isCloudActive = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let appInstance: any = null;
export let db: any = null;
export let auth: any = null;
export let storage: any = null;

const localCollectionsCache: Record<string, any[]> = {};
const localListeners: Record<string, Set<(snapshot: any) => void>> = {};
const LS_PREFIX = "diamantelog_local_db_";

function loadFromLocalStorage(name: string): any[] {
  try {
    const saved = localStorage.getItem(LS_PREFIX + name);
    return saved ? JSON.parse(saved) : [];
  } catch (_) {
    return [];
  }
}

function saveToLocalStorage(name: string, list: any[]) {
  try {
    localStorage.setItem(LS_PREFIX + name, JSON.stringify(list));
  } catch (_) {}
}

if (isCloudActive) {
  try {
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(appInstance);
    auth = getAuth(appInstance);
    storage = getStorage(appInstance);
    console.log("Firebase SDK Direct-To-Cloud Iniciado com Sucesso!");
  } catch (err) {
    console.error("Erro na inicializacao do Firebase Cloud SDK:", err);
  }
}

export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        newObj[key] = cleanUndefined(val);
      }
    }
    return newObj as T;
  }
  return obj;
}

export let hasFirebasePermissionError = false;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isPermissionError = error && (
    String(error).includes('permission') || 
    String(error).includes('insufficient') || 
    (error as any).code === 'permission-denied'
  );

  if (isPermissionError) {
    hasFirebasePermissionError = true;
    console.warn(`[Offline Mode] Operacao ${operationType} em '${path}' executada localmente devido a limites de permissao do Firebase:`, error);
  } else {
    console.error('Database Operation Error in ' + operationType + ' at ' + path + ':', error);
  }
}

export function cleanBarcode(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();
  const cleanSci = cleaned.replace(',', '.');
  if (/^[+-]?\d+\.?\d*[Ee]\+[+-]?\d+$/.test(cleanSci)) {
    try {
      const parts = cleanSci.split(/[Ee]\+/);
      const base = parts[0];
      const exponent = parseInt(parts[1], 10);
      if (!isNaN(exponent) && exponent > 0) {
        const baseParts = base.split('.');
        const integerPart = baseParts[0];
        const decimalPart = baseParts[1] || '';
        if (exponent >= decimalPart.length) {
          cleaned = integerPart + decimalPart + '0'.repeat(exponent - decimalPart.length);
        } else {
          cleaned = integerPart + decimalPart.substring(0, exponent);
        }
      }
    } catch (_) {}
  }
  if (cleaned.includes('^')) {
    const parts = cleaned.split('^');
    const candidates = parts.map(p => p.trim()).filter(p => {
      if (!p || p.length < 5) return false;
      const lower = p.toLowerCase();
      if (lower === 'id' || lower === 'lm' || lower === 'lf') return false;
      return true;
    });
    if (candidates.length > 0) {
      let candidate = candidates[0];
      candidate = candidate.replace(/^[`,\s\{\}\[\]\*]+|[`,\s\{\}\[\]\*]+$/g, '');
      if (candidate.length >= 6) {
        return candidate.toUpperCase();
      }
    }
  }
  cleaned = cleaned.replace(/^[`,\s\{\}\[\]\*\^\>\<\-\+]+|[`,\s\{\}\[\]\*\^\>\<\-\+]+$/g, '');
  return cleaned.toUpperCase();
}

async function uploadBase64ToStorage(base64Str: string, collectionName: string, id: string, key: string): Promise<string> {
  // Se o base64 for leve (por exemplo, abaixo de 250KB após compressão), salvamos inline no Firestore.
  // Isso otimiza imensamente a velocidade e evita problemas comuns de CORS, permissões ou balde de armazenamento desalinhado.
  if (base64Str.length < 250000) {
    console.log(`[Base64 Bypass] Guardando inline no Firestore para ${collectionName}/${id} (${key}) por ser leve (${Math.round(base64Str.length / 1024)}KB)`);
    return base64Str;
  }

  if (!storage) return base64Str;
  try {
    const mimeType = base64Str.split(";")[0].split(":")[1] || "image/png";
    const extension = mimeType.split("/")[1] || "png";
    const fileName = `${collectionName}/${id}_${key}_${Date.now()}.${extension}`;
    const fileRef = storageRef(storage, fileName);

    console.log(`[Storage Upload] Iniciando upload para Firebase Storage: ${fileName}`);

    // Limite de tempo rígido de 2 segundos para evitar que o cadastro fique travado em conexões ruins ou storage desativado
    const uploadPromise = uploadString(fileRef, base64Str, 'data_url');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout de 2 segundos no upload")), 2000)
    );

    await Promise.race([uploadPromise, timeoutPromise]);
    const downloadUrl = await getDownloadURL(fileRef);
    console.log(`[Storage Upload] Upload concluído com sucesso: ${downloadUrl}`);
    return downloadUrl;
  } catch (err) {
    console.warn("Erro ou timeout no Firebase Storage, usando inline base64 fallback:", err);
    return base64Str;
  }
}

async function handleBase64Uploads(data: any, collectionName: string, id: string): Promise<any> {
  if (!data || typeof data !== "object") return data;
  const result = Array.isArray(data) ? [...data] : { ...data };
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (typeof value === "string" && value.startsWith("data:") && value.includes(";base64,")) {
      result[key] = await uploadBase64ToStorage(value, collectionName, id, key);
    } else if (value && typeof value === "object") {
      result[key] = await handleBase64Uploads(value, collectionName, id);
    }
  }
  return result;
}

export function collection(dbInstance: any, name: string) {
  return { type: 'collection', name, collectionName: name };
}

export function doc(dbInstance: any, name: string, id?: string) {
  return { type: 'doc', collectionName: name, id: id || '' };
}

export function query(colRef: any, ...constraints: any[]) {
  return { ...colRef, constraints };
}

export function where(field: string, operator: string, value: any) {
  return { type: 'where', field, operator, value };
}

function notifyLocalSubscribers(colName: string) {
  if (!localCollectionsCache[colName]) {
    localCollectionsCache[colName] = loadFromLocalStorage(colName);
  }
  const list = localCollectionsCache[colName] || [];
  if (localListeners[colName]) {
    const mockSnap = {
      empty: list.length === 0,
      size: list.length,
      forEach: (cb: (doc: any) => void) => {
        list.forEach(item => cb({ id: item.id || '', data: () => item, exists: () => true }));
      },
      docs: list.map(item => ({ id: item.id || '', data: () => item, exists: () => true }))
    };
    localListeners[colName].forEach(cb => { try { cb(mockSnap); } catch (_) {} });
  }
  list.forEach(item => {
    const docKey = `${colName}/${item.id}`;
    if (localListeners[docKey]) {
      const mockDocSnap = { exists: () => true, data: () => item };
      localListeners[docKey].forEach(cb => { try { cb(mockDocSnap); } catch (_) {} });
    }
  });
}

export function onSnapshot(ref: any, onNext: (snapshot: any) => void, onError?: (err: any) => void) {
  const colName = ref.collectionName || ref.name;
  const id = ref.id;
  const key = id ? `${colName}/${id}` : colName;

  let localUnsubscribe: (() => void) | null = null;
  let isUsingLocalFallback = false;

  const switchToLocalFallback = (err: any) => {
    if (isUsingLocalFallback) return;
    isUsingLocalFallback = true;
    hasFirebasePermissionError = true;
    console.warn(`[Firebase Engine] Falha ao assinar '${key}' no Firestore (erro de permissão ou rede). Ativando failover para banco local off-line. Detalhes:`, err);

    if (onError) {
      try {
        onError(err);
      } catch (handlerError) {
        console.warn(`[Firebase Engine] Evitado estouro de exceção em subscriber de '${key}':`, handlerError);
      }
    }

    if (!localListeners[key]) localListeners[key] = new Set();
    localListeners[key].add(onNext);
    localUnsubscribe = () => { localListeners[key]?.delete(onNext); };

    if (!localCollectionsCache[colName]) {
      localCollectionsCache[colName] = loadFromLocalStorage(colName);
    }
    const list = localCollectionsCache[colName] || [];
    if (id) {
      const item = list.find(i => i.id === id);
      onNext({ exists: () => !!item, data: () => item || null, id });
    } else {
      let filteredList = [...list];
      if (ref.constraints) {
        ref.constraints.forEach((c: any) => {
          if (c.type === 'where') {
            filteredList = filteredList.filter(item => {
              const v = item[c.field];
              if (c.operator === '==') return v === c.value;
              if (c.operator === '!=') return v !== c.value;
              return true;
            });
          }
        });
      }
      const docs = filteredList.map(item => ({ id: item.id || '', data: () => item, exists: () => true, ref: doc(null, colName, item.id) }));
      onNext({ empty: filteredList.length === 0, size: filteredList.length, docs: docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) });
    }
  };

  if (db) {
    try {
      if (id) {
        const unsub = firestoreOnSnapshot(firestoreDoc(db, colName, id), (snap) => {
          if (!isUsingLocalFallback) {
            onNext({ exists: () => snap.exists(), data: () => snap.data() || null, id: snap.id });
          }
        }, (err) => {
          switchToLocalFallback(err);
        });
        return () => {
          unsub();
          if (localUnsubscribe) localUnsubscribe();
        };
      } else {
        let finalQuery: any = firestoreCollection(db, colName);
        if (ref.constraints) {
          const fsConstraints: any[] = [];
          ref.constraints.forEach((c: any) => {
            if (c.type === 'where') {
              fsConstraints.push(firestoreWhere(c.field, c.operator, c.value));
            }
          });
          if (fsConstraints.length > 0) {
            finalQuery = firestoreQuery(firestoreCollection(db, colName), ...fsConstraints);
          }
        }
        const unsub = firestoreOnSnapshot(finalQuery, (snap: any) => {
          if (!isUsingLocalFallback) {
            const docs = snap.docs.map((d: any) => ({
              id: d.id,
              data: () => d.data(),
              exists: () => true,
              ref: doc(db, colName, d.id)
            }));
            onNext({ empty: snap.empty, size: snap.size, docs: docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) });
          }
        }, (err) => {
          switchToLocalFallback(err);
        });
        return () => {
          unsub();
          if (localUnsubscribe) localUnsubscribe();
        };
      }
    } catch (err) {
      switchToLocalFallback(err);
    }
  }

  if (!localListeners[key]) localListeners[key] = new Set();
  localListeners[key].add(onNext);

  if (!localCollectionsCache[colName]) {
    localCollectionsCache[colName] = loadFromLocalStorage(colName);
  }
  const list = localCollectionsCache[colName] || [];
  if (id) {
    const item = list.find(i => i.id === id);
    onNext({ exists: () => !!item, data: () => item || null, id });
  } else {
    let filteredList = [...list];
    if (ref.constraints) {
      ref.constraints.forEach((c: any) => {
        if (c.type === 'where') {
          filteredList = filteredList.filter(item => {
            const v = item[c.field];
            if (c.operator === '==') return v === c.value;
            if (c.operator === '!=') return v !== c.value;
            return true;
          });
        }
      });
    }
    const docs = filteredList.map(item => ({ id: item.id || '', data: () => item, exists: () => true, ref: doc(null, colName, item.id) }));
    onNext({ empty: filteredList.length === 0, size: filteredList.length, docs: docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) });
  }

  return () => { localListeners[key]?.delete(onNext); };
}

export async function setDoc(docRef: any, data: any) {
  const colName = docRef.collectionName;
  const id = docRef.id;
  const cleanedData = cleanUndefined(data);
  const finalizedData = await handleBase64Uploads(cleanedData, colName, id);

  if (db) {
    try {
      await firestoreSetDoc(firestoreDoc(db, colName, id), finalizedData);
      if (colName === 'users' && finalizedData.passwordHash && finalizedData.email) {
        try {
          await registerUserInFirebaseAuth(finalizedData.email, finalizedData.passwordHash);
        } catch (_) {}
      }
      return;
    } catch (_) {}
  }

  if (!localCollectionsCache[colName]) {
    localCollectionsCache[colName] = loadFromLocalStorage(colName);
  }
  const list = localCollectionsCache[colName] || [];
  const idx = list.findIndex(item => item.id === id);
  if (idx > -1) {
    list[idx] = finalizedData;
  } else {
    list.push(finalizedData);
  }
  localCollectionsCache[colName] = list;
  saveToLocalStorage(colName, list);
  notifyLocalSubscribers(colName);
}

export async function deleteDoc(docRef: any) {
  const colName = docRef.collectionName;
  const id = docRef.id;

  if (db) {
    try {
      await firestoreDeleteDoc(firestoreDoc(db, colName, id));
      return;
    } catch (_) {}
  }

  if (!localCollectionsCache[colName]) {
    localCollectionsCache[colName] = loadFromLocalStorage(colName);
  }
  const list = localCollectionsCache[colName] || [];
  localCollectionsCache[colName] = list.filter(item => item.id !== id);
  saveToLocalStorage(colName, localCollectionsCache[colName]);
  notifyLocalSubscribers(colName);
}

export async function getDocs(colQuery: any) {
  const colName = colQuery.collectionName || colQuery.name;

  if (db) {
    try {
      let finalQuery: any = firestoreCollection(db, colName);
      if (colQuery.constraints) {
        const fsConstraints: any[] = [];
        colQuery.constraints.forEach((c: any) => {
          if (c.type === 'where') {
            fsConstraints.push(firestoreWhere(c.field, c.operator, c.value));
          }
        });
        if (fsConstraints.length > 0) {
          finalQuery = firestoreQuery(firestoreCollection(db, colName), ...fsConstraints);
        }
      }
      const snap = await firestoreGetDocs(finalQuery);
      const docs = snap.docs.map(d => ({ id: d.id, data: () => d.data(), exists: () => true, ref: doc(db, colName, d.id) }));
      return { empty: snap.empty, size: snap.size, docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) };
    } catch (_) {}
  }

  if (!localCollectionsCache[colName]) {
    localCollectionsCache[colName] = loadFromLocalStorage(colName);
  }
  let localList = [...localCollectionsCache[colName]];
  const docs = localList.map(item => ({ id: item.id || '', data: () => item, exists: () => true, ref: doc(null, colName, item.id) }));
  return { empty: localList.length === 0, size: localList.length, docs, forEach: (cb: (doc: any) => void) => docs.forEach(cb) };
}

export async function getDocFromServer(docRef: any) {
  const colName = docRef.collectionName;
  const id = docRef.id;
  if (db) {
    try {
      const snap = await firestoreGetDocs(firestoreQuery(firestoreCollection(db, colName), firestoreWhere('__name__', '==', firestoreDoc(db, colName, id))));
      if (!snap.empty) {
        return { exists: () => true, data: () => snap.docs[0].data() };
      }
    } catch (_) {}
  }
  if (!localCollectionsCache[colName]) localCollectionsCache[colName] = loadFromLocalStorage(colName);
  const item = localCollectionsCache[colName]?.find((i: any) => i.id === id);
  return { exists: () => !!item, data: () => item || null };
}

class FirebaseDirectBatch {
  private ops: { type: 'set' | 'delete'; collection: string; id: string; data?: any }[] = [];
  set(docRef: any, data: any) {
    const cleaned = cleanUndefined(data);
    this.ops.push({ type: 'set', collection: docRef.collectionName, id: docRef.id, data: cleaned });
    const colName = docRef.collectionName;
    if (!localCollectionsCache[colName]) localCollectionsCache[colName] = loadFromLocalStorage(colName);
    const list = localCollectionsCache[colName] || [];
    const idx = list.findIndex(item => item.id === docRef.id);
    if (idx > -1) { list[idx] = cleaned; } else { list.push(cleaned); }
    localCollectionsCache[colName] = list;
    saveToLocalStorage(colName, list);
    notifyLocalSubscribers(colName);
  }
  delete(docRef: any) {
    this.ops.push({ type: 'delete', collection: docRef.collectionName, id: docRef.id });
    const colName = docRef.collectionName;
    if (!localCollectionsCache[colName]) localCollectionsCache[colName] = loadFromLocalStorage(colName);
    const list = localCollectionsCache[colName] || [];
    localCollectionsCache[colName] = list.filter(item => item.id !== docRef.id);
    saveToLocalStorage(colName, localCollectionsCache[colName]);
    notifyLocalSubscribers(colName);
  }
  async commit() {
    if (db) {
      try {
        const batch = firestoreWriteBatch(db);
        for (const op of this.ops) {
          const fDocRef = firestoreDoc(db, op.collection, op.id);
          if (op.type === 'set') {
            const finalData = await handleBase64Uploads(op.data, op.collection, op.id);
            batch.set(fDocRef, finalData);
          } else if (op.type === 'delete') {
            batch.delete(fDocRef);
          }
        }
        await batch.commit();
      } catch (_) {}
    }
  }
}

export function writeBatch(dbInstance?: any) {
  return new FirebaseDirectBatch();
}

export async function registerUserInFirebaseAuth(email: string, pass: string) {
  if (!auth) return null;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return cred.user;
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') return null;
    throw err;
  }
}

export async function loginWithFirebaseAuth(email: string, pass: string) {
  if (!auth) return null;
  return (await signInWithEmailAndPassword(auth, email, pass)).user;
}

export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  if (auth) {
    return firebaseOnAuthStateChanged(auth, (u) => {
      callback(u ? { uid: u.uid, email: u.email, displayName: u.displayName || 'Usuario' } : null);
    });
  }
  setTimeout(() => {
    const saved = sessionStorage.getItem('logi_currentUser');
    callback(saved ? JSON.parse(saved) : null);
  }, 50);
  return () => {};
}

export async function authSignOut() {
  if (auth) await firebaseSignOut(auth);
}

export async function syncAllTablesForce() {
  // O Cloud Firestore com onSnapshot realiza sincronizacao automatica nativa e instantanea.
  return true;
}

export async function syncTableListForce() {
  return true;
}
