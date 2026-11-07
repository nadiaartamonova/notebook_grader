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
};
export function Icon({ name }) {
  return (
    <svg
      className="svg"
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
