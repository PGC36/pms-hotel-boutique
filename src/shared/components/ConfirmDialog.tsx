import { AlertTriangle, Trash2 } from 'lucide-react';

import { Modal } from '@/shared/components/Modal';
import './ConfirmDialog.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  pending?: boolean;
  /** Texto del botón de confirmación; por defecto "Eliminar". */
  confirmLabel?: string;
  pendingLabel?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  pending = false,
  confirmLabel = 'Eliminar',
  pendingLabel = 'Eliminando...',
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const close = () => {
    if (!pending) onClose();
  };

  return (
    <Modal open={open} title={title} onClose={close} closeOnOverlayClick={!pending}>
      <div className="confirm-dialog-content">
        <span className="confirm-dialog-icon" aria-hidden="true">
          <AlertTriangle size={21} />
        </span>
        <p>{description}</p>
      </div>
      <div className="confirm-dialog-actions">
        <button className="button secondary" type="button" onClick={close} disabled={pending}>
          Cancelar
        </button>
        <button
          className="button confirm-dialog-delete"
          type="button"
          onClick={() => void onConfirm()}
          disabled={pending}
        >
          {confirmLabel === 'Eliminar' && <Trash2 size={16} aria-hidden="true" />}
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
