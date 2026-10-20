import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import './styles.css';
import { Library } from './pages/Library';
import { Reader } from './pages/Reader';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/read/:bookId" element={<Reader />} />
        <Route path="/" element={<Library />} />
        <Route path="*" element={<div className="center-msg"><p>없는 페이지입니다</p><Link to="/">서재로</Link></div>} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
