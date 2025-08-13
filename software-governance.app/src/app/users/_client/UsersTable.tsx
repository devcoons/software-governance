'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Trash2, KeyRound } from 'lucide-react';
import RoleSelect, { Role } from '@/app/users/_client/RoleSelect';
import TOTPModal from '@/components/TOTPModal';
import EnableTOTPRequiredModal from '@/components/EnableTOTPRequiredModal';
import { useManualLoading } from '@/components/ManualLoadingOverlay';

import {
  deleteUser,
  resetPassword,
  changeUserRole,
  currentAdminHasTOTP,
} from '@/app/users/_client/actions';

type UserRow = {
  id: string;
  email: string;
  roles: string[];
  totpEnabled: boolean;
  forcePasswordChange: boolean;
  createdAt: string | number | Date;
};

const PAGE_SIZE = 7 as const;
type SortKey = 'email' | 'role' | 'totp' | 'force' | 'created';
type SortDir = 'asc' | 'desc';

function normalizeRole(u: UserRow): Role {
  return (u.roles?.[0] ?? 'user') as Role;
}
function fmtDate(x: UserRow['createdAt']) {
  try {
    return new Date(x).toLocaleString();
  } catch {
    return String(x ?? '');
  }
}

export default function UsersTable({
  users,
  isAdmin,
}: {
  users: UserRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [sortKey, setSortKey] = useState<SortKey>(
    (params.get('sort') as SortKey) || 'created'
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (params.get('dir') as SortDir) || 'desc'
  );
  const [page, setPage] = useState(Number(params.get('page') || 1));

  const [totpModal, setTotpModal] = useState<null | { action: (pin: string) => Promise<void> }>(null);
  const [requireEnableTOTP, setRequireEnableTOTP] = useState(false);

  // New: Track error messages per userId for role changes
  const [roleErrors, setRoleErrors] = useState<Record<string, string>>({});

useEffect(() => 
  {
  const sp = new URLSearchParams(params.toString());
  if (query.trim()) sp.set('q', query.trim()); else sp.delete('q');
  sp.set('sort', sortKey);
  sp.set('dir', sortDir);
  sp.set('page', String(page));

  const next = `${pathname}?${sp.toString()}`;
  const current = `${pathname}?${params.toString()}`;
  if (next !== current) router.replace(next as Route);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [query, sortKey, sortDir, page]);

  const askForTOTP = async (action: (pin: string) => Promise<void>) => {
    const hasTOTP = await currentAdminHasTOTP();
    if (!hasTOTP) {
      setRequireEnableTOTP(true);
      return;
    }
    setTotpModal({ action });
  };

  const handleResetPassword = (userId: string, email: string) => {
    askForTOTP(async (pin) => {
      await resetPassword(userId, email, pin);
    });
  };

  const handleDeleteUser = (userId: string) => {
    askForTOTP(async (pin) => {
      await deleteUser(userId, pin);
      router.refresh();
    });
  };

    const { show, hide } = useManualLoading();

const handleChangeRole = (userId: string, oldRole: string, newRole: string, revert: () => void, done: () => void) => {
    askForTOTP(async (pin) => {
     
      try {
        await changeUserRole(userId, newRole as any, pin);
        setRoleErrors((prev) => {
          const copy = { ...prev };
          delete copy[userId];
          return copy;
        });
      } catch (err: any) {
        revert();
        setRoleErrors((prev) => ({
          ...prev,
          [userId]: err?.message || 'Failed to update role',
        }));
        setTimeout(() => {
          setRoleErrors((prev) => {
            const copy = { ...prev };
            delete copy[userId];
            return copy;
          });
        }, 5000);
      } finally {
       
        done();
      }
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const role = normalizeRole(u);
      return `${u.email} ${role} ${u.totpEnabled ? 'yes' : 'no'} ${
        u.forcePasswordChange ? 'yes' : 'no'
      } ${fmtDate(u.createdAt)}`.toLowerCase().includes(q);
    });
  }, [users, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: UserRow, b: UserRow) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortKey) {
        case 'email':
          av = a.email.toLowerCase();
          bv = b.email.toLowerCase();
          break;
        case 'role':
          av = normalizeRole(a);
          bv = normalizeRole(b);
          break;
        case 'totp':
          av = a.totpEnabled ? 1 : 0;
          bv = b.totpEnabled ? 1 : 0;
          break;
        case 'force':
          av = a.forcePasswordChange ? 1 : 0;
          bv = b.forcePasswordChange ? 1 : 0;
          break;
        case 'created':
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return a.id.localeCompare(b.id);
    };
    return arr.sort(cmp);
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage]
  );

  const SortHeader = ({
    label,
    keyName,
    className,
  }: {
    label: string;
    keyName: SortKey;
    className?: string;
  }) => {
    const active = sortKey === keyName;
    const dir = active ? (sortDir === 'asc' ? '▲' : '▼') : '↕';
    const toggleSort = (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortKey(key);
        setSortDir(key === 'created' ? 'desc' : 'asc');
      }
      setPage(1);
    };
    return (
      <th className={className}>
        <button
          type="button"
          onClick={() => toggleSort(keyName)}
          className={`inline-flex items-center gap-1 font-semibold hover:underline focus:outline-none ${
            active ? 'text-primary' : ''
          }`}
        >
          <span>{label}</span>
          <span aria-hidden className="opacity-70">{dir}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-b border-base-300 bg-base-100 rounded-t-box">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
            🔍
          </span>
          <input
            type="search"
            className="input input-bordered w-full pl-10 pr-9 h-10"
            placeholder="Search by any field…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          {query && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="text-sm opacity-70 sm:ml-4">
          {sorted.length} result{sorted.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table table-md">
          <thead>
            <tr>
              <SortHeader label="Email" keyName="email" className="w-2/5" />
              <SortHeader label="Role" keyName="role" className="w-1/5" />
              <SortHeader label="TOTP" keyName="totp" className="w-1/12" />
              <SortHeader label="Force" keyName="force" className="w-1/12" />
              <SortHeader label="Created" keyName="created" className="w-1/5" />
              {isAdmin && <th className="w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => {
              const role = normalizeRole(u);
              return (
                <tr key={u.id} className="hover:bg-base-200/70">
                  <td>{u.email}</td>
                  <td>
                    {isAdmin ? (
                      <>
<RoleSelect
    userId={u.id}
    initialRole={role}
    onChange={(newRole, revert, done) => handleChangeRole(u.id, role, newRole, revert, done)}
  />
  {roleErrors[u.id] && <div className="text-error text-xs mt-1">{roleErrors[u.id]}</div>}

                      </>
                    ) : (
                      <span className="badge badge-outline">{role}</span>
                    )}
                  </td>
                  <td>{u.totpEnabled ? 'yes' : 'no'}</td>
                  <td>{u.forcePasswordChange ? 'yes' : 'no'}</td>
                  <td>{fmtDate(u.createdAt)}</td>
                  {isAdmin && (
                    <td className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleResetPassword(u.id, u.email)}
                        title="Reset password"
                      >
                        <KeyRound size={18} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => handleDeleteUser(u.id)}
                        title="Delete user"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center py-8 opacity-70"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 flex items-center justify-between">
        <div className="opacity-70 text-sm">
          Page {safePage} of {totalPages}
        </div>
        <div className="join">
          <button
            className="btn btn-sm join-item"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`btn btn-sm join-item ${
                n === safePage ? 'btn-primary' : ''
              }`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            className="btn btn-sm join-item"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* TOTP modal */}
      {totpModal && (
        <TOTPModal
          onCancel={() => setTotpModal(null)}
          onSubmit={async (pin) => {
            const act = totpModal?.action;
    if (!act) return;

    show(); // 👈 show overlay before closing modal
    setTotpModal(null);

    try {
      await act(pin);
    } finally {
      hide();
    }}}
        />
      )}
      {requireEnableTOTP && (
        <EnableTOTPRequiredModal onClose={() => setRequireEnableTOTP(false)} />
      )}
    </>
  );
}
