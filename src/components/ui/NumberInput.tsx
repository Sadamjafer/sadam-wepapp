import { forwardRef, useState, useEffect, InputHTMLAttributes, ChangeEvent } from 'react';
import { cn } from '../../lib/utils';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (rawValue: string) => void;
  allowDecimals?: boolean;
}

function formatWithThousands(val: string | number, allowDecimals: boolean = true): string {
  if (val === undefined || val === null || val === '') return '';
  const strVal = String(val).replace(/٫/g, '.').replace(/,/g, '');
  
  const isNegative = strVal.startsWith('-');
  const cleanStr = isNegative ? strVal.slice(1) : strVal;

  const parts = cleanStr.split('.');
  const integerPart = parts[0].replace(/[^\d]/g, '');
  const formattedInt = integerPart ? Number(integerPart).toLocaleString('en-US') : '';

  if (allowDecimals && parts.length > 1) {
    const decimalPart = parts[1].replace(/[^\d]/g, '');
    return `${isNegative ? '-' : ''}${formattedInt}.${decimalPart}`;
  }
  
  if (allowDecimals && cleanStr.endsWith('.')) {
    return `${isNegative ? '-' : ''}${formattedInt}.`;
  }

  return `${isNegative ? '-' : ''}${formattedInt}`;
}

function parseToRaw(formatted: string, allowDecimals: boolean = true): string {
  if (!formatted) return '';
  const str = formatted.replace(/٫/g, '.');
  const isNegative = str.startsWith('-');
  const clean = str.replace(/,/g, '').replace(/[^\d.]/g, '');
  
  const parts = clean.split('.');
  if (allowDecimals && parts.length > 1) {
    return `${isNegative ? '-' : ''}${parts[0]}.${parts.slice(1).join('')}`;
  }
  return `${isNegative ? '-' : ''}${parts[0]}`;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, allowDecimals = true, ...props }, ref) => {
    const [displayVal, setDisplayVal] = useState<string>(() => formatWithThousands(value, allowDecimals));

    useEffect(() => {
      const currentRaw = parseToRaw(displayVal, allowDecimals);
      const incomingRaw = String(value ?? '');
      if (currentRaw !== incomingRaw) {
        setDisplayVal(formatWithThousands(incomingRaw, allowDecimals));
      }
    }, [value, allowDecimals]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const raw = parseToRaw(input, allowDecimals);
      const formatted = formatWithThousands(input, allowDecimals);
      setDisplayVal(formatted);
      onChange(raw);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode={allowDecimals ? "decimal" : "numeric"}
        className={cn(
          "flex h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 text-left font-mono",
          className
        )}
        value={displayVal}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
