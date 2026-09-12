// Card surface with an optional monospace title.
export function Panel({title, titleId, className = '', children, ...rest}) {
  return (
    <section className={`panel ${className}`} aria-labelledby={titleId} {...rest}>
      {title && <h2 id={titleId} className="panel-title">{title}</h2>}
      {children}
    </section>
  );
}
