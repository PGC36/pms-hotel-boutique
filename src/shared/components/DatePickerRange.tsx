import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './DatePickerRange.css';
import './Field.css';

export type DateRangeValue = {
  start: Date | null;
  end: Date | null;
};

export type DatePickerRangeProps = {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  label?: string;
  helpText?: string;
  error?: string;
  disabled?: boolean;
  unavailableDates?: Date[] | ((date: Date) => boolean);
  minDate?: Date;
  className?: string;
  id?: string;
};

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Calendar-day identity, derived from local getters (never UTC parsing), so
 * comparisons never shift by timezone. Zero-padded so string comparisons
 * ("<", ">", "===") also order chronologically.
 */
function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

type CalendarCell = {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
};

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return { date, key: dayKey(date), inCurrentMonth: date.getMonth() === month };
  });
}

export function DatePickerRange({
  value,
  onChange,
  label,
  helpText,
  error,
  disabled = false,
  unavailableDates,
  minDate,
  className,
  id,
}: DatePickerRangeProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const labelId = `${fieldId}-label`;
  const helpId = `${fieldId}-help`;
  const messageId = `${fieldId}-message`;

  const initialMonthSource = value.start ?? new Date();
  const [visibleYear, setVisibleYear] = useState(initialMonthSource.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(initialMonthSource.getMonth());
  const [internalMessage, setInternalMessage] = useState<string | null>(null);

  useEffect(() => {
    setInternalMessage(null);
  }, [value.start, value.end]);

  const unavailableSet = useMemo(() => {
    if (!unavailableDates || typeof unavailableDates === 'function') return null;
    return new Set(unavailableDates.map(dayKey));
  }, [unavailableDates]);

  const isDateUnavailable = useCallback(
    (date: Date): boolean => {
      if (!unavailableDates) return false;
      if (typeof unavailableDates === 'function') return unavailableDates(date);
      return unavailableSet ? unavailableSet.has(dayKey(date)) : false;
    },
    [unavailableDates, unavailableSet],
  );

  const isBeforeMinDate = useCallback(
    (date: Date): boolean => (minDate ? dayKey(date) < dayKey(minDate) : false),
    [minDate],
  );

  const isDateBlocked = useCallback(
    (date: Date): boolean => isDateUnavailable(date) || isBeforeMinDate(date),
    [isDateUnavailable, isBeforeMinDate],
  );

  const rangeCrossesUnavailable = useCallback(
    (start: Date, end: Date): boolean => {
      const endKey = dayKey(end);
      let cursor = addDays(start, 1);
      while (dayKey(cursor) !== endKey) {
        if (isDateUnavailable(cursor)) return true;
        cursor = addDays(cursor, 1);
      }
      return false;
    },
    [isDateUnavailable],
  );

  const currentRangeInvalid = useMemo(() => {
    if (!value.start || !value.end) return false;
    return (
      isDateUnavailable(value.start) ||
      isDateUnavailable(value.end) ||
      rangeCrossesUnavailable(value.start, value.end)
    );
  }, [value.start, value.end, isDateUnavailable, rangeCrossesUnavailable]);

  const handleDayClick = (date: Date) => {
    if (disabled || isDateBlocked(date)) return;

    const key = dayKey(date);

    if (!value.start || value.end) {
      setInternalMessage(null);
      onChange({ start: date, end: null });
      return;
    }

    const startKey = dayKey(value.start);

    if (key === startKey) {
      setInternalMessage('La fecha de salida debe ser posterior a la fecha de entrada.');
      return;
    }

    if (key < startKey) {
      setInternalMessage(null);
      onChange({ start: date, end: null });
      return;
    }

    if (rangeCrossesUnavailable(value.start, date)) {
      setInternalMessage('El rango seleccionado incluye una fecha no disponible.');
      return;
    }

    setInternalMessage(null);
    onChange({ start: value.start, end: date });
  };

  const goToPreviousMonth = () => {
    const previous = new Date(visibleYear, visibleMonth - 1, 1);
    setVisibleYear(previous.getFullYear());
    setVisibleMonth(previous.getMonth());
  };

  const goToNextMonth = () => {
    const next = new Date(visibleYear, visibleMonth + 1, 1);
    setVisibleYear(next.getFullYear());
    setVisibleMonth(next.getMonth());
  };

  const cells = useMemo(
    () => buildMonthGrid(visibleYear, visibleMonth),
    [visibleYear, visibleMonth],
  );

  const startKey = value.start ? dayKey(value.start) : null;
  const endKey = value.end ? dayKey(value.end) : null;

  const displayMessage =
    error ??
    internalMessage ??
    (currentRangeInvalid ? 'El rango seleccionado ya no está disponible.' : null);
  const describedBy = displayMessage ? messageId : helpText ? helpId : undefined;

  const dayAccessibleName = (cell: CalendarCell): string => {
    const formatted = `${cell.date.getDate()} de ${MONTH_NAMES[cell.date.getMonth()]} de ${cell.date.getFullYear()}`;
    if (isDateBlocked(cell.date)) return `${formatted} · no disponible`;
    if (startKey === cell.key) return `${formatted} · fecha de entrada seleccionada`;
    if (endKey === cell.key) return `${formatted} · fecha de salida seleccionada`;
    return formatted;
  };

  const dayClassName = (cell: CalendarCell): string => {
    const classes = ['dprc-day'];
    if (!cell.inCurrentMonth) classes.push('dprc-day--outside');
    if (isDateBlocked(cell.date)) classes.push('dprc-day--unavailable');

    const isStart = startKey === cell.key;
    const isEnd = endKey === cell.key;
    const inRange = !!startKey && !!endKey && cell.key > startKey && cell.key < endKey;

    if (isStart) classes.push('dprc-day--start');
    if (isEnd) classes.push('dprc-day--end');
    if (inRange) classes.push('dprc-day--in-range');

    return classes.join(' ');
  };

  return (
    <div className={['dprc', className].filter(Boolean).join(' ')}>
      {label ? (
        <span className="field-label" id={labelId}>
          {label}
        </span>
      ) : null}
      <div
        className={[
          'dprc-calendar',
          disabled ? 'dprc-calendar--disabled' : '',
          currentRangeInvalid ? 'dprc-calendar--range-invalid' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="group"
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={describedBy}
      >
        <div className="dprc-header">
          <button
            type="button"
            className="dprc-nav-button"
            onClick={goToPreviousMonth}
            disabled={disabled}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="dprc-month-label">
            {MONTH_NAMES[visibleMonth]} {visibleYear}
          </span>
          <button
            type="button"
            className="dprc-nav-button"
            onClick={goToNextMonth}
            disabled={disabled}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="dprc-weekdays">
          {WEEKDAY_LABELS.map((weekday) => (
            <span key={weekday} className="dprc-weekday">
              {weekday}
            </span>
          ))}
        </div>
        <div className="dprc-grid">
          {cells.map((cell) => (
            <button
              key={cell.key}
              type="button"
              className={dayClassName(cell)}
              disabled={disabled || isDateBlocked(cell.date)}
              aria-label={dayAccessibleName(cell)}
              onClick={() => handleDayClick(cell.date)}
            >
              {cell.date.getDate()}
            </button>
          ))}
        </div>
      </div>
      {displayMessage ? (
        <p className="field-error" id={messageId}>
          {displayMessage}
        </p>
      ) : helpText ? (
        <p className="field-help" id={helpId}>
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
