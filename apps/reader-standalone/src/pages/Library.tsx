import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as db from '../lib/db';
import { importPackage, type ImportResult } from '../lib/importer';

export function Library() {
  const [packages, setPackages] = useState<db.StoredPackage[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    db.listPackages().then(setPackages);
  }, [importing]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await importPackage(file);
      setImportResult(result);
      setTimeout(() => setImporting(false), 100);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '알 수 없는 오류');
      setImporting(false);
    }
    e.target.value = '';
  };

  const onDelete = async (id: string) => {
    if (!confirm('이 교재를 삭제하시겠습니까? 필기와 채점 기록도 모두 지워집니다.')) return;
    await db.deletePackage(id);
    setPackages(await db.listPackages());
  };

  return (
    <div className="container">
      <section className="hero-sm">
        <h1>해설북 독립형 — 로컬 전용 리더</h1>
        <p>
          기출 원문 위에 쓰고, 문항별 해설 영상으로 바로. <code>.hsbpkg.zip</code> 패키지를 가져오면 모든 기능이 오프라인에서 작동합니다.
        </p>
      </section>

      <div className="import-zone">
        <label className="file-btn">
          {importing ? '가져오는 중...' : '📦 패키지 가져오기 (.hsbpkg.zip)'}
          <input type="file" accept=".zip,.hsbpkg.zip" onChange={onFileChange} disabled={importing} />
        </label>
        {importError && <div className="error-box">{importError}</div>}
        {importResult && (
          <div className="success-box">
            <b>{importResult.title}</b>을 가져왔습니다.
            {importResult.errors.length > 0 && (
              <details>
                <summary>경고 {importResult.errors.length}개</summary>
                <ul>
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {!packages && <p className="muted">불러오는 중…</p>}
      {packages && !packages.length && <p className="muted">아직 가져온 교재가 없습니다.</p>}

      {packages && packages.length > 0 && <h2 className="sec">내 교재</h2>}
      <div className="book-grid">
        {packages?.map((pkg) => (
          <div key={pkg.id} className="book">
            <Link to={`/read/${pkg.id}`} className="book-cover">
              <span className="exam">{pkg.exam}</span>
              <b>{pkg.subject}</b>
              <span>{pkg.year} · {pkg.round}</span>
            </Link>
            <div className="book-meta">
              <b>{pkg.title}</b>
              <span className="muted">{pkg.quizCount}문항 · v{pkg.version}</span>
              <div className="book-actions">
                <Link to={`/read/${pkg.id}`} className="cta">펼치기</Link>
                <button onClick={() => onDelete(pkg.id)} className="btn-danger">삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
