// React applies `style` through the CSSOM, which the page CSP permits (inline style attributes are not).
export function ProgressBar({value, label = 'Download progress'}) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100" aria-label={label}>
      <div style={{width: `${value}%`}} />
    </div>
  );
}
