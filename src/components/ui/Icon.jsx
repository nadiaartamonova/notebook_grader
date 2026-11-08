import React from 'react';
const paths = {
  folder: <path d="M3 7V5h6l2 2h10v13H3z" />,
  book: <path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M15 8V3H3v12h5" />
    </>
  ),
  back: <path d="m14 5-7 7 7 7M7 12h14" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  userSwap: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 12.5-4.3M16 13h6m-2-2 2 2-2 2M22 18h-6m2-2-2 2 2 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  x: <path d="m7 7 10 10M17 7 7 17" />,
  minus: <path d="M6 12h12" />,
  spark: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  file: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3M15 8l2 2" />
    </>
  ),
  logout: <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />,
  dots: <path d="M6 12h.01M12 12h.01M18 12h.01" />,
  upload: <path d="M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5" />,
  play: <path d="m8 5 11 7-11 7z" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  archive: <path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4" />,
  restore: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />,
};
export function Icon({ name, className = '' }) {
  return (
    <svg
      className={`svg ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.folder}
    </svg>
  );
}
