// Slices a list for one page and describes the result for the pager and the "showing x–y of z" line.
export function paginate(items, page, size) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (current - 1) * size;
  return {items: items.slice(start, start + size), page: current, pages, total, from: total ? start + 1 : 0, to: Math.min(start + size, total)};
}

// Page numbers to render, with null standing in for an ellipsis.
export function pageWindow(page, pages, width = 2) {
  if (pages <= 7) return Array.from({length: pages}, (_, i) => i + 1);
  const numbers = new Set([1, pages]);
  for (let n = page - width; n <= page + width; n++) if (n >= 1 && n <= pages) numbers.add(n);
  const sorted = [...numbers].sort((a, b) => a - b);
  const result = [];
  for (const [i, n] of sorted.entries()) {
    if (i && n - sorted[i - 1] > 1) result.push(null);
    result.push(n);
  }
  return result;
}
