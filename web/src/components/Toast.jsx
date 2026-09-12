export function Toast({toast, onDismiss}) {
  if (!toast) return null;
  return (
    <p key={toast.id} className="message toast" role="status" aria-live="polite" onClick={onDismiss}>
      {toast.text}
    </p>
  );
}
