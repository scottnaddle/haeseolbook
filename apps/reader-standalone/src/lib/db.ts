import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BookManifest, InkPage } from '@hsb/shared';

export interface StoredPackage {
  id: string;
  title: string;
  exam: string;
  subject: string;
  year: number;
  round: string;
  pageCount: number;
  quizCount: number;
  version: string;
  importedAt: number;
  packageBlob: Blob;
}

export interface LocalInk {
  key: string;
  bookId: string;
  pageId: string;
  ink: InkPage;
  updatedAt: number;
  deletedIds: string[];
}

export interface QuizAttempt {
  key: string;
  bookId: string;
  quizId: string;
  chosen: number;
  correct: boolean;
  tries: number;
  everWrong: boolean;
  lastAttemptAt: number;
}

interface ReaderDB extends DBSchema {
  packages: { key: string; value: StoredPackage };
  manifests: { key: string; value: { bookId: string; manifest: BookManifest; savedAt: number } };
  ink: { key: string; value: LocalInk; indexes: { byBook: string } };
  attempts: { key: string; value: QuizAttempt; indexes: { byBook: string } };
  pageImages: { key: string; value: { key: string; bookId: string; pageId: string; size: 'xs' | 'sm' | 'hi'; blob: Blob } };
}

let dbp: Promise<IDBPDatabase<ReaderDB>> | null = null;

function db() {
  dbp ??= openDB<ReaderDB>('hsb-reader-standalone', 1, {
    upgrade(d) {
      const pkgStore = d.createObjectStore('packages', { keyPath: 'id' });
      d.createObjectStore('manifests', { keyPath: 'bookId' });
      const inkStore = d.createObjectStore('ink', { keyPath: 'key' });
      inkStore.createIndex('byBook', 'bookId');
      const attemptStore = d.createObjectStore('attempts', { keyPath: 'key' });
      attemptStore.createIndex('byBook', 'bookId');
      const imgStore = d.createObjectStore('pageImages', { keyPath: 'key' });
    },
  });
  return dbp;
}

export const inkKey = (bookId: string, pageId: string) => `${bookId}:${pageId}`;
export const attemptKey = (bookId: string, quizId: string) => `${bookId}:${quizId}`;
export const imageKey = (bookId: string, pageId: string, size: 'xs' | 'sm' | 'hi') => `${bookId}:${pageId}:${size}`;

export async function listPackages(): Promise<StoredPackage[]> {
  const all = await (await db()).getAll('packages');
  return all.sort((a, b) => b.importedAt - a.importedAt);
}

export async function getPackage(bookId: string): Promise<StoredPackage | undefined> {
  return (await db()).get('packages', bookId);
}

export async function savePackage(pkg: StoredPackage): Promise<void> {
  await (await db()).put('packages', pkg);
}

export async function deletePackage(bookId: string): Promise<void> {
  const d = await db();
  await d.delete('packages', bookId);
  await d.delete('manifests', bookId);
  const inkKeys = (await d.getAllKeysFromIndex('ink', 'byBook', bookId)) as string[];
  for (const k of inkKeys) await d.delete('ink', k);
  const attemptKeys = (await d.getAllKeysFromIndex('attempts', 'byBook', bookId)) as string[];
  for (const k of attemptKeys) await d.delete('attempts', k);
}

export async function saveManifest(m: BookManifest): Promise<void> {
  await (await db()).put('manifests', { bookId: m.book.id, manifest: m, savedAt: Date.now() });
}

export async function loadManifest(bookId: string): Promise<BookManifest | undefined> {
  return (await (await db()).get('manifests', bookId))?.manifest;
}

export async function getInk(bookId: string, pageId: string): Promise<LocalInk | undefined> {
  return (await db()).get('ink', inkKey(bookId, pageId));
}

export async function putInk(v: LocalInk): Promise<void> {
  await (await db()).put('ink', v);
}

export async function getBookInk(bookId: string): Promise<LocalInk[]> {
  return (await db()).getAllFromIndex('ink', 'byBook', bookId);
}

export async function getAttempt(bookId: string, quizId: string): Promise<QuizAttempt | undefined> {
  return (await db()).get('attempts', attemptKey(bookId, quizId));
}

export async function putAttempt(v: QuizAttempt): Promise<void> {
  await (await db()).put('attempts', v);
}

export async function listAttempts(bookId: string): Promise<QuizAttempt[]> {
  return (await db()).getAllFromIndex('attempts', 'byBook', bookId);
}

export async function savePageImage(bookId: string, pageId: string, size: 'xs' | 'sm' | 'hi', blob: Blob): Promise<void> {
  await (await db()).put('pageImages', { key: imageKey(bookId, pageId, size), bookId, pageId, size, blob });
}

export async function getPageImage(bookId: string, pageId: string, size: 'xs' | 'sm' | 'hi'): Promise<Blob | undefined> {
  return (await (await db()).get('pageImages', imageKey(bookId, pageId, size)))?.blob;
}
