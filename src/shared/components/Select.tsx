import { forwardRef, useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import './Field.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helpText?: string;
  error?: string;
  children: ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helpText, error, disabled, required, className, id, children, ...rest },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const helpId = `${selectId}-help`;
  const errorId = `${selectId}-error`;
  const describedBy = error ? errorId : helpText ? helpId : undefined;
  const classes = ['field-control', error ? 'field-control-error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={selectId}>
          {label}
          {required && (
            <span className="field-required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={classes}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : helpText ? (
        <p className="field-help" id={helpId}>
          {helpText}
        </p>
      ) : null}
    </div>
  );
});
