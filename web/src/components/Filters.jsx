import {SearchIcon} from './Icons.jsx';

export function SegmentedControl({options, value, onChange, label}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className={option.value === value ? 'selected' : ''} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
          {option.count !== undefined && <span className="segment-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({value, onChange, placeholder = 'Search'}) {
  return (
    <label className="search-box">
      <SearchIcon />
      <span className="sr-only">{placeholder}</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} spellCheck="false" />
    </label>
  );
}

export function Toolbar({children}) {
  return <div className="toolbar">{children}</div>;
}
