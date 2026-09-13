export function EmptyState({title, children, action}) {
  return (
    <div className="empty">
      <div className="empty-disc" aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
