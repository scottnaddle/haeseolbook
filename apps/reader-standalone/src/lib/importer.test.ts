import { describe, it, expect } from 'vitest';
import { importPackage } from './importer';

describe('Package Importer', () => {
  it('should reject invalid zip files', async () => {
    const invalidFile = new File([new Uint8Array([1, 2, 3])], 'invalid.zip', { type: 'application/zip' });
    await expect(importPackage(invalidFile)).rejects.toThrow('패키지 파일을 읽을 수 없습니다');
  });

  it('should reject package without item.json', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('book.json', '{}');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'test.zip');
    
    await expect(importPackage(file)).rejects.toThrow('item.json이 패키지에 없습니다');
  });

  it('should reject package with invalid item.json schema', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('item.json', JSON.stringify({ schema: 'wrong/version' }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'test.zip');
    
    await expect(importPackage(file)).rejects.toThrow('item.json 형식 오류');
  });

  it('should reject package without required files', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('item.json', JSON.stringify({
      schema: 'ipitem/1',
      type: 'ebook-video',
      id: 'test',
      version: '1.0.0',
      title: 'Test',
      exam: 'Test',
      subject: 'Test',
      year: 2026,
      stats: { pages: 0, quizzes: 0, videos: 0, solutions: 0 },
      createdAt: new Date().toISOString(),
      files: {}
    }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'test.zip');
    
    await expect(importPackage(file)).rejects.toThrow('book.json이 패키지에 없습니다');
  });
});
