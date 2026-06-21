import { openDB, type DBSchema } from "idb";

interface PdfDB extends DBSchema {
  pdfs: {
    key: string;
    value: {
      id: string;
      name: string;
      data: ArrayBuffer;
      storedAt: number;
    };
  };
}

const DB_NAME = "pdf-reader";
const DB_VERSION = 1;

function getDB() {
  return openDB<PdfDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("pdfs", { keyPath: "id" });
    },
  });
}

export async function storePdf(
  name: string,
  data: ArrayBuffer
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put("pdfs", { id, name, data, storedAt: Date.now() });
  return id;
}

export async function getPdf(id: string) {
  const db = await getDB();
  return db.get("pdfs", id);
}

export async function listPdfs() {
  const db = await getDB();
  const all = await db.getAll("pdfs");
  return all.map(({ id, name, storedAt }) => ({ id, name, storedAt }));
}

export async function deletePdf(id: string) {
  const db = await getDB();
  await db.delete("pdfs", id);
}
