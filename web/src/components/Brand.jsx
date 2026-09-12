export function Brand({label = 'PrivaMusic home'}) {
  return (
    <a className="brand" href="/" aria-label={label}>
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-name">priva<b>music</b></span>
    </a>
  );
}
