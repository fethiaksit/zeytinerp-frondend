export default function Modal({ title, open, onClose, children, showCloseButton = true }) {
  if (!open) return null;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="panel-header">
          <h2>{title}</h2>
          {showCloseButton && (
            <button className="icon-button" type="button" onClick={onClose} aria-label="Kapat">
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
