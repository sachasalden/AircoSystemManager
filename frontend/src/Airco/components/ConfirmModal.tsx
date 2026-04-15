type ConfirmModalProps = {
  title: string;
  message: string;
  open: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  title,
  message,
  open,
  confirmLabel = 'Remove',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="wp-modal-backdrop" onClick={onCancel}>
      <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        <p>{message}</p>

        <div className="wp-modal-actions">
          <button className="btn ghost-btn" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn add-btn" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
