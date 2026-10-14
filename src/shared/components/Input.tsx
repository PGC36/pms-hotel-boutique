import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import './Field.css';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helpText?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helpText, error, disabled, required, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : helpText ? helpId : undefined;
  const classes = ['field-control', error ? 'field-control-error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
          {required && (
            <span className="field-required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={classes}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
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
