import {isModifiedClick, navigate, useLocation} from '../lib/router.js';

// Anchor that routes in-app. `end` requires an exact path match for the active state.
export function Link({to, className = '', activeClassName = '', end = false, children, onClick, ...rest}) {
  const {path} = useLocation();
  const target = to.split('?')[0];
  const active = end ? path === target : path === target || path.startsWith(`${target}/`);
  function handleClick(event) {
    onClick?.(event);
    if (isModifiedClick(event) || rest.target === '_blank') return;
    event.preventDefault();
    navigate(to);
  }
  return (
    <a href={to} className={[className, active && activeClassName].filter(Boolean).join(' ')} aria-current={active ? 'page' : undefined} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
