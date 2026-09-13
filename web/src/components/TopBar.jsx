import {Brand} from './Brand.jsx';
import {MenuIcon} from './Icons.jsx';

// Compact header shown only on narrow screens; it opens the navigation drawer.
export function TopBar({onMenu, status}) {
  return (
    <header className="topbar mobile-bar">
      <button type="button" className="icon-button" onClick={onMenu} aria-label="Open menu"><MenuIcon /></button>
      <Brand />
      {status}
    </header>
  );
}
