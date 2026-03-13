"use client";

import { useMemo, useState } from "react";
import { SearchableCombobox } from "@/app/_components/searchable-combobox";

type AdaptiveSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

type AdaptiveSelectProps = {
  options: AdaptiveSelectOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  threshold?: number;
  className?: string;
};

export function AdaptiveSelect({
  options,
  name,
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Seleccionar",
  emptyOptionLabel,
  emptyMessage = "Sin resultados disponibles",
  disabled = false,
  required = false,
  threshold = 6,
  className,
}: AdaptiveSelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const currentValue = isControlled ? value : internalValue;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === currentValue) ?? null,
    [currentValue, options]
  );

  const inputValue =
    currentValue && selectedOption ? selectedOption.label : query;

  const handleValueChange = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  if (options.length <= threshold) {
    return (
      <select
        name={name}
        value={currentValue}
        onChange={(event) => handleValueChange(event.target.value)}
        disabled={disabled}
        required={required}
        className={className}
      >
        {emptyOptionLabel ? <option value="">{emptyOptionLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="space-y-0.5">
      {name ? (
        <input
          type="text"
          name={name}
          value={currentValue}
          onChange={() => {}}
          readOnly
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        />
      ) : null}

      <SearchableCombobox
        items={options}
        inputValue={inputValue}
        getItemId={(option) => option.value}
        getItemLabel={(option) => option.label}
        getItemKeywords={(option) => option.keywords ?? ""}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        disabled={disabled}
        className={className}
        clearOnSelect={false}
        onClear={() => {
          handleValueChange("");
          setQuery("");
        }}
        onInputValueChange={(nextValue) => {
          setQuery(nextValue);

          if (selectedOption && nextValue !== selectedOption.label) {
            handleValueChange("");
          }
        }}
        onSelect={(option) => {
          handleValueChange(option.value);
          setQuery("");
        }}
      />
    </div>
  );
}
