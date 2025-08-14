'use client';

export default function EnableTOTPRequiredModal({
  onClose,
  settingsHref = '/me',
}: {
  onClose: () => void;
  settingsHref?: string;
}) {
  return (
    <dialog open className="modal">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg">TOTP required</h3>
        <p className="py-2 text-sm opacity-80">
          This action is protected. You need to enable two-factor authentication (TOTP) on your admin account
          before making changes to users.
        </p>
        <div className="modal-action">
          <a className="btn btn-primary" href={settingsHref}>Enable TOTP</a>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
