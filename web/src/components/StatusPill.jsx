// state: 'ok' | 'pending' | 'error'
export function StatusPill({state, children, id, className = ''}) {
  return (
    <span id={id} className={`status-pill ${className}`} data-state={state} role="status">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text">{children}</span>
    </span>
  );
}
