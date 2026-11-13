import { useEffect, useId, useState } from 'react';
import type { ComponentProps } from 'react';

export function TooltipButton({
  tooltip,
  children,
  ...props
}: Omit<ComponentProps<'button'>, 'title' | 'aria-describedby'> & {
  tooltip: string;
}) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function dismiss(event: KeyboardEvent) {
      if (event.key === 'Escape') setDismissed(true);
    }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, []);

  return (
    <span
      className="tooltip-target"
      data-dismissed={dismissed || undefined}
      onMouseEnter={() => setDismissed(false)}
      onFocusCapture={() => setDismissed(false)}
    >
      <button type="button" {...props} aria-describedby={id}>
        {children}
      </button>
      <span id={id} className="button-tooltip" role="tooltip">
        {tooltip}
      </span>
    </span>
  );
}
