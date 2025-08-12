'use client';

import { useEffect, useState } from 'react';

export type Role = 'admin' | 'user' | 'viewer';

export default function RoleSelect({
  userId,
  initialRole,
  onChange,
}: {
  userId: string;
  initialRole: Role;
  onChange?: (newRole: Role, revert: () => void, done: () => void) => void;
}) {
  const [value, setValue] = useState<Role>(initialRole);
  const [busy, setBusy] = useState(false);

  // keep in sync if parent updates initialRole
  useEffect(() => {
    setValue(initialRole);
  }, [initialRole]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextRole = e.target.value as Role;
    const prev = value;
    const revert = () => setValue(prev);
    const done = () => setBusy(false);

    setValue(nextRole);
    setBusy(true);

    if (onChange) {
      onChange(nextRole, revert, done);
    } else {
      // no handler: revert immediately
      revert();
      done();
    }
  }

  return (
    <select
      name="role"
      className="select select-bordered select-sm"
      value={value}
      onChange={handleChange}
      disabled={busy}
      aria-label="Change role"
    >
      <option value="user">user</option>
      <option value="admin">admin</option>
      <option value="viewer">viewer</option>
    </select>
  );
}
