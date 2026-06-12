import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type NameModalProps = {
  title: string;
  message: string;
  label: string;
  open: boolean;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
};

export default function NameModal({
  title,
  message,
  label,
  open,
  initialValue = '',
  confirmLabel = 'Save',
  onCancel,
  onSubmit,
}: NameModalProps) {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setName(initialValue);
    }
  }, [initialValue, open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    onSubmit(trimmedName);
  }

  return (
    <div className="wp-modal-backdrop" onClick={onCancel}>
      <form
        className="wp-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h4>{title}</h4>
        <p>{message}</p>

        <label className="modal-field">
          <span>{label}</span>
          <input
            autoFocus
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <div className="wp-modal-actions">
          <button
            className="action-btn action-btn-neutral"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="action-btn action-btn-primary"
            type="submit"
            disabled={!name.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
