import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { getClientId, redirectUri, setClientId } from '../spotify';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [clientId, setValue] = useState(getClientId);

  useEffect(() => {
    if (open) {
      setValue(getClientId());
      ref.current?.showModal();
    } else ref.current?.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} className="dialog">
      <form
        method="dialog"
        onSubmit={() => {
          setClientId(clientId);
          onClose();
        }}
      >
        <h2>{t.setupTitle}</h2>
        <ol className="steps">
          <li>
            {t.setupStep1}{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
              developer.spotify.com/dashboard
            </a>{' '}
            {t.setupStep1After}
          </li>
          <li>
            {t.setupStep2} <code className="copyable">{redirectUri()}</code>
          </li>
          <li>{t.setupStep3}</li>
          <li>{t.setupStep4}</li>
        </ol>
        <label className="field">
          {t.clientId}
          <input value={clientId} onChange={(e) => setValue(e.target.value)} placeholder={t.clientIdPlaceholder} autoFocus />
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="primary">
            {t.save}
          </button>
        </div>
      </form>
    </dialog>
  );
}
