import { useId } from 'react';

export function ComponentTagsField({
  label = 'Component tags',
  value,
  disabled,
  onChange,
}: {
  label?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const helpId = useId();
  return (
    <>
      <label className="field">
        {label} <span className="optional">optional</span>
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="nursing, role, exam-prep"
          aria-describedby={helpId}
        />
      </label>
      <p className="field-help" id={helpId}>
        Separate tags with commas. Up to 20 tags, 40 characters each. Saved in
        lowercase.
      </p>
    </>
  );
}
