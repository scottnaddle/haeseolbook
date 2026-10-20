import JSZip from 'jszip';
import { z } from 'zod';
import type { BookManifest } from '@hsb/shared';
import * as db from './db';

const ItemSchema = z.object({
  schema: z.literal('ipitem/1'),
  type: z.literal('ebook-video'),
  id: z.string(),
  version: z.string(),
  title: z.string(),
  exam: z.string(),
  subject: z.string(),
  year: z.number(),
  stats: z.object({
    pages: z.number(),
    quizzes: z.number(),
    videos: z.number(),
    solutions: z.number(),
  }),
  createdAt: z.string(),
  files: z.record(z.string()),
});

const BookSchema = z.object({
  id: z.string(),
  title: z.string(),
  exam: z.string(),
  subject: z.string(),
  year: z.number(),
  round: z.string(),
});

const PageSchema = z.object({
  id: z.string(),
  pageNo: z.number(),
  width: z.number(),
  height: z.number(),
  files: z.object({
    xs: z.string(),
    sm: z.string(),
    hi: z.string(),
  }),
});

const RegionSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  kind: z.enum(['quiz', 'solution']),
  quizId: z.string().nullable(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
});

const QuizSchema = z.object({
  id: z.string(),
  no: z.number(),
  answer: z.number(),
  choiceCount: z.number(),
  keywords: z.array(z.string()).optional(),
});

const SolutionSchema = z.object({
  quizId: z.string(),
  markdown: z.string(),
});

const VideoCueSchema = z.object({
  t: z.number(),
  pageNo: z.number(),
  x: z.number(),
  y: z.number(),
});

const VideoMapEntrySchema = z.object({
  no: z.number(),
  youtubeId: z.string(),
  startSec: z.number(),
  endSec: z.number(),
  pageNo: z.number().optional(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }).optional(),
  cues: z.array(VideoCueSchema).optional(),
});

export interface ImportResult {
  bookId: string;
  title: string;
  errors: string[];
}

export async function importPackage(file: File): Promise<ImportResult> {
  const errors: string[] = [];
  
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (e) {
    throw new Error('패키지 파일을 읽을 수 없습니다. 올바른 .hsbpkg.zip 파일인지 확인하세요.');
  }

  const itemFile = zip.file('item.json');
  if (!itemFile) {
    throw new Error('item.json이 패키지에 없습니다.');
  }

  let item: z.infer<typeof ItemSchema>;
  try {
    const itemText = await itemFile.async('text');
    item = ItemSchema.parse(JSON.parse(itemText));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`item.json 형식 오류: ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`);
    }
    throw new Error('item.json을 읽을 수 없습니다.');
  }

  const bookFile = zip.file('book.json');
  if (!bookFile) {
    throw new Error('book.json이 패키지에 없습니다.');
  }

  let book: z.infer<typeof BookSchema>;
  try {
    const bookText = await bookFile.async('text');
    book = BookSchema.parse(JSON.parse(bookText));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`book.json 형식 오류: ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`);
    }
    throw new Error('book.json을 읽을 수 없습니다.');
  }

  const pagesFile = zip.file('pages.json');
  if (!pagesFile) {
    throw new Error('pages.json이 패키지에 없습니다.');
  }

  let pages: z.infer<typeof PageSchema>[];
  try {
    const pagesText = await pagesFile.async('text');
    pages = z.array(PageSchema).parse(JSON.parse(pagesText));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`pages.json 형식 오류: ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`);
    }
    throw new Error('pages.json을 읽을 수 없습니다.');
  }

  const regionsFile = zip.file('regions.json');
  if (!regionsFile) {
    throw new Error('regions.json이 패키지에 없습니다.');
  }

  let regions: z.infer<typeof RegionSchema>[];
  try {
    const regionsText = await regionsFile.async('text');
    regions = z.array(RegionSchema).parse(JSON.parse(regionsText));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`regions.json 형식 오류: ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`);
    }
    throw new Error('regions.json을 읽을 수 없습니다.');
  }

  const quizzesFile = zip.file('quizzes.json');
  if (!quizzesFile) {
    throw new Error('quizzes.json이 패키지에 없습니다.');
  }

  let quizzes: z.infer<typeof QuizSchema>[];
  try {
    const quizzesText = await quizzesFile.async('text');
    quizzes = z.array(QuizSchema).parse(JSON.parse(quizzesText));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`quizzes.json 형식 오류: ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`);
    }
    throw new Error('quizzes.json을 읽을 수 없습니다.');
  }

  const solutionsFile = zip.file('solutions.json');
  let solutions: z.infer<typeof SolutionSchema>[] = [];
  if (solutionsFile) {
    try {
      const solutionsText = await solutionsFile.async('text');
      solutions = z.array(SolutionSchema).parse(JSON.parse(solutionsText));
    } catch (e) {
      if (e instanceof z.ZodError) {
        errors.push(`solutions.json 형식 오류 (생략됨): ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`);
      } else {
        errors.push('solutions.json을 읽을 수 없습니다 (생략됨).');
      }
    }
  }

  const videoMapFile = zip.file('video_map.json');
  let videoMapEntries: z.infer<typeof VideoMapEntrySchema>[] = [];
  if (videoMapFile) {
    try {
      const videoMapText = await videoMapFile.async('text');
      videoMapEntries = z.array(VideoMapEntrySchema).parse(JSON.parse(videoMapText));
    } catch (e) {
      if (e instanceof z.ZodError) {
        errors.push(`video_map.json 형식 오류 (생략됨): ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`);
      } else {
        errors.push('video_map.json을 읽을 수 없습니다 (생략됨).');
      }
    }
  }

  const quizIdByNo = new Map(quizzes.map(q => [q.no, q.id]));
  const videoSegments = videoMapEntries.map(entry => {
    const quizId = quizIdByNo.get(entry.no);
    if (!quizId) {
      errors.push(`video_map.json: 문항 번호 ${entry.no}를 quizzes.json에서 찾을 수 없습니다.`);
      return null;
    }
    return {
      quizId,
      youtubeId: entry.youtubeId,
      startSec: entry.startSec,
      endSec: entry.endSec,
      cues: entry.cues || [],
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  for (const page of pages) {
    for (const size of ['xs', 'sm', 'hi'] as const) {
      const path = page.files[size];
      const imgFile = zip.file(path);
      if (!imgFile) {
        errors.push(`페이지 이미지 파일 없음: ${path}`);
        continue;
      }
      try {
        const blob = await imgFile.async('blob');
        await db.savePageImage(book.id, page.id, size, blob);
      } catch (e) {
        errors.push(`페이지 이미지 저장 실패: ${path}`);
      }
    }
  }

  const manifest: BookManifest = {
    book: {
      id: book.id,
      title: book.title,
      exam: book.exam,
      subject: book.subject,
      year: book.year,
      round: book.round,
      pageCount: pages.length,
      quizCount: quizzes.length,
      priceKrw: 0,
      coverPageId: pages[0]?.id || null,
    },
    pages: pages.map(p => ({
      id: p.id,
      pageNo: p.pageNo,
      width: p.width,
      height: p.height,
    })),
    regions,
    quizzes: quizzes.map(q => ({
      id: q.id,
      no: q.no,
      answer: q.answer,
      choiceCount: q.choiceCount,
      keywords: q.keywords || [],
    })),
    solutions,
    videoSegments,
    imageUrls: {},
    urlExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await db.saveManifest(manifest);

  const storedPkg: db.StoredPackage = {
    id: book.id,
    title: book.title,
    exam: book.exam,
    subject: book.subject,
    year: book.year,
    round: book.round,
    pageCount: pages.length,
    quizCount: quizzes.length,
    version: item.version,
    importedAt: Date.now(),
    packageBlob: file,
  };

  await db.savePackage(storedPkg);

  return {
    bookId: book.id,
    title: book.title,
    errors,
  };
}
