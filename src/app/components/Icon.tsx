const paths = {
  plus: 'M12 5v14M5 12h14',
  search: 'm21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  copy: 'M9 9h11v11H9zM15 5V3H3v12h2',
  edit: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z',
  duplicate: 'M8 8h12v12H8zM15 4H4v11M11 14h6M14 11v6',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  download: 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
  close: 'm6 6 12 12M6 18 18 6',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  library: 'M4 4h4v16H4zM11 4h4v16h-4zM18 4l3 15',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
  tag: 'M3 3h8l10 10-8 8L3 11zM7 7h.01',
  check: 'm5 12 4 4L19 6',
  external: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
} as const;

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
