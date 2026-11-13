// Stroke icons from the design reference (docs/screens/ui.js), the ones the app uses.
const PATHS = {
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  shield: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  heart: <path d="M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.8-8 10.6-8 10.6z" />,
  menu:<path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  logout:<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4m0 3v.01" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8v.01" /></>,
  package: <><path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  truck: <><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" />,
};

export function Icon({ name, size = 18 }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
