'use client';

import { useEffect, useRef, useState } from 'react';

export default function TOTPModal({
  onSubmit,
  onCancel,
  title = 'Enter TOTP code',
  description = 'Confirm this action by entering your 6-digit TOTP code.',
}: {
  onSubmit: (pin: string) => Promise<void> | void;
  onCancel: () => void;
  title?: string;
  description?: string;
}) {
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const cleaned = pin.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await onSubmit(cleaned);
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog open className="modal">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-2 text-sm opacity-80">{description}</p>
        {error && <div className="alert alert-error text-sm my-2">{error}</div>}

        <label className="form-control w-full mt-2">
          <span className="label-text">TOTP Code</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            placeholder="123456"
            className="input input-bordered font-mono tracking-widest text-center text-lg"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={pending}
          />
        </label>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={pending}>
            {pending ? 'Verifying…' : 'Confirm'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" onClick={onCancel}>close</button>
      </form>
    </dialog>
  );
}
