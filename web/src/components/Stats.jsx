import {Link} from './Link.jsx';

// Stat tile; `to` makes the whole tile a link into its section.
export function Stat({value, label, to, tone}) {
  const body = (
    <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  const className = `stat${tone ? ` ${tone}` : ''}`;
  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

export function StatGrid({children}) {
  return <div className="stat-grid" aria-label="Library summary">{children}</div>;
}
