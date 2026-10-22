import { useEffect, useRef, useState } from 'react';
import { getClientId, redirectUri, setClientId } from '../spotify';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
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
        <h2>Spotify setup</h2>
        <ol className="steps">
          <li>
            Create an app at{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
              developer.spotify.com/dashboard
            </a>{' '}
            (tick <em>Web API</em> and <em>Web Playback SDK</em>).
          </li>
          <li>
            Add this Redirect URI: <code className="copyable">{redirectUri()}</code>
          </li>
          <li>
            Under <em>User Management</em>, add your own Spotify account (the email you log in with).
          </li>
          <li>Paste the app's Client ID below.</li>
        </ol>
        <label className="field">
          Client ID
          <input value={clientId} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 1a2b3c…" autoFocus />
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
