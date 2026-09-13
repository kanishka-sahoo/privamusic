import {coverUrl} from '../lib/jobs.js';

// Artwork from Spotify's CDN, or a vinyl placeholder. size: 'sm' | 'md' | 'lg'
export function Cover({job, size = 'md'}) {
  const url = coverUrl(job);
  const px = {sm: 44, md: 64, lg: 200}[size];
  return url
    ? <img className={`cover cover-${size}`} src={url} alt="" loading="lazy" width={px} height={px} />
    : <div className={`cover cover-${size} cover-blank`} aria-hidden="true" />;
}
