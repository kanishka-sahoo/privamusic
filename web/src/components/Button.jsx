// variant: 'primary' | 'ghost' | 'quiet' | 'small'; size: 'large' | undefined; block: full width.
export function Button({variant, size, block, className = '', as: Tag = 'button', children, ...rest}) {
  const classes = ['button', variant, size, block && 'block', className].filter(Boolean).join(' ');
  const props = Tag === 'button' ? {type: 'button', ...rest} : rest;
  return <Tag className={classes} {...props}>{children}</Tag>;
}

export function ExternalIcon() {
  return <span aria-hidden="true">↗</span>;
}
