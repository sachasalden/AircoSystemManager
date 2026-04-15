import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  span?: 1 | 2;
  children: ReactNode;
};

export function Field({ label, span = 1, children }: FieldProps) {
  return (
    <div className={`field${span === 2 ? ' span-2' : ''}`}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

type TextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: TextInputProps) {
  return (
    <input
      className="text-input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

type NumberInputProps = {
  value: number | '';
  onChange: (value: number | '') => void;
};

export function NumberInput({ value, onChange }: NumberInputProps) {
  return (
    <input
      className="text-input"
      type="number"
      value={value}
      onChange={(e) =>
        onChange(e.target.value === '' ? '' : Number(e.target.value))
      }
    />
  );
}

type SelectInputProps = {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
};

export function SelectInput({
  value,
  onChange,
  children,
  disabled = false,
}: SelectInputProps) {
  return (
    <select
      className="browser-default"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function CheckboxField({
  label,
  checked,
  onChange,
}: CheckboxFieldProps) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

type FormActionsProps = {
  children: ReactNode;
};

export function FormActions({ children }: FormActionsProps) {
  return <div className="form-actions">{children}</div>;
}
