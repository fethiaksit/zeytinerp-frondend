export default function Modal({ title, open, onClose, children, showCloseButton = true, cardClassName = "" }) {
  if (!open) return null;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <div className={`modal-card ${cardClassName}`.trim()}>
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
