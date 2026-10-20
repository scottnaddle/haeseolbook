import katex from 'katex';

export function renderMarkdown(md: string): string {
  let html = md
    .replace(/\\\[(.*?)\\\]/gs, (_, tex) => {
      try {
        return `<div class="math-block">${katex.renderToString(tex, { displayMode: true, throwOnError: false })}</div>`;
      } catch {
        return `<div class="math-block">[수식 오류: ${tex}]</div>`;
      }
    })
    .replace(/\\\((.*?)\\\)/g, (_, tex) => {
      try {
        return katex.renderToString(tex, { displayMode: false, throwOnError: false });
      } catch {
        return `[수식 오류: ${tex}]`;
      }
    })
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul]|<div)/gm, '<p>')
    .replace(/(?<!>)$/gm, '</p>')
    .replace(/<p><\/p>/g, '');
  
  return html;
}
