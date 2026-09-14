// Inline icons: the CSP allows no remote assets, and these stay small.
function Icon({children, size = 18, ...rest}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p) => <Icon {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></Icon>;
export const QueueIcon = (p) => <Icon {...p}><path d="M4 6h10M4 12h10M4 18h7" /><path d="M17 9v6l4-3z" /></Icon>;
export const PlaylistIcon = (p) => <Icon {...p}><path d="M4 6h12M4 11h12M4 16h7" /><circle cx="17" cy="17" r="3" /><path d="M20 17V9" /></Icon>;
export const AlbumIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></Icon>;
export const TrackIcon = (p) => <Icon {...p}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></Icon>;
export const PlusIcon = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const DesktopIcon = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon>;
export const CompassIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></Icon>;
export const MenuIcon = (p) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const CloseIcon = (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const ChevronLeftIcon = (p) => <Icon {...p}><path d="m14 6-6 6 6 6" /></Icon>;
export const ChevronRightIcon = (p) => <Icon {...p}><path d="m10 6 6 6-6 6" /></Icon>;
export const SearchIcon = (p) => <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Icon>;
export const LinkIcon = (p) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Icon>;
export const ArrowLeftIcon = (p) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
