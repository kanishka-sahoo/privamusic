import {ChevronLeftIcon, ChevronRightIcon} from './Icons.jsx';
import {pageWindow} from '../lib/paginate.js';

// Windowed pager. `result` comes from paginate(); `onPage` receives the new page number.
export function Pagination({result, onPage, label = 'items'}) {
  const {page, pages, total, from, to} = result;
  if (!total) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-summary">Showing <b>{from}–{to}</b> of <b>{total}</b> {label}</p>
      {pages > 1 && (
        <div className="pagination-controls">
          <button type="button" className="page-button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeftIcon /></button>
          {pageWindow(page, pages).map((n, i) => n === null
            ? <span key={`gap-${i}`} className="page-gap" aria-hidden="true">…</span>
            : <button key={n} type="button" className={`page-button${n === page ? ' current' : ''}`} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>)}
          <button type="button" className="page-button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRightIcon /></button>
        </div>
      )}
    </nav>
  );
}
