import {Brand} from './Brand.jsx';

// Sticky header: brand on the left, optional status in the middle, actions on the right.
export function TopBar({status, children, className = ''}) {
  return (
    <header className={`topbar ${className}`}>
      <Brand />
      {status}
      {children && <nav className="topnav" aria-label="Account">{children}</nav>}
    </header>
  );
}
