'use client';

export interface ConfirmOptions {
  icon?: string;
  title?: string;
  msg?: string;
  okLabel?: string;
  okClass?: string;
}

export default function ConfirmDialog({
  opts,
  onResolve,
}: {
  opts: ConfirmOptions;
  onResolve: (value: boolean) => void;
}) {
  const {
    icon = '🗑️',
    title = 'Are you sure?',
    msg = '',
    okLabel = 'Delete',
    okClass = 'btn-d',
  } = opts;

  return (
    <div
      className="confirm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onResolve(false);
      }}
    >
      <div className="confirm-box">
        <div className="confirm-icon">{icon}</div>
        <div className="confirm-title">{title}</div>
        <div className="confirm-msg">{msg}</div>
        <div className="confirm-btns">
          <button className="btn" onClick={() => onResolve(false)}>
            Cancel
          </button>
          <button className={'btn ' + okClass} onClick={() => onResolve(true)}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
