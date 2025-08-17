'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Trash2, KeyRound, User, CircleCheckIcon, CircleCheckBigIcon, Ban } from 'lucide-react';
import RoleSelect, { Role } from './user-role-select'
import TOTPModal from '@/app/_com/totp-modal-insert-pin'
import EnableTOTPRequiredModal from '@/app/_com/totp-modal-warning'
import { useManualLoading } from '@/app/_com/manual-loading'
import UserProfileView from './user-profile-view'


import {
  deleteUser,
  resetPassword,
  changeUserRole,
  currentAdminHasTOTP,
  toggleUserStatus,
} from './actions'
import { DbUserLite } from '@/server/db/user-repo';


type UserRow = {
  id: string;
  email: string;
  roles: string[];
  totpEnabled: boolean;
  forcePasswordChange: boolean;
  createdAt: string | number | Date;
};

const PAGE_SIZE = 7 as const;
type SortKey = 'email' | 'role' | 'totp' | 'force' | 'created' | 'lastlogin' | 'accountsts';
type SortDir = 'asc' | 'desc';

function normalizeRole(u: DbUserLite): Role {
  return (u.roles?.[0] ?? 'user') as Role;
}
function fmtDate(x: UserRow['createdAt'] | null) {
  try {
    if (!x)
      return "Unknown";
    return new Date(x).toISOString().slice(0, 10)
  } catch {
    return String(x ?? '');
  }
}

function OneButtonModal({
  title,
  text,
  onClose,
}: {
  title: string;
  text: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card bg-base-100 w-full max-w-md shadow-xl">
        <div className="card-body">
          <h3 className="card-title">{title}</h3>
          <p className="text-sm opacity-80">
            {text}
          </p>
        
          <div className="card-actions justify-end mt-4">
            <button className="btn btn-primary" onClick={onClose}>
             Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Minimal one-time password modal (inline) */
function OneTimePasswordModal({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card bg-base-100 w-full max-w-md shadow-xl">
        <div className="card-body">
          <h3 className="card-title">Temporary password created</h3>
          <p className="text-sm opacity-80">
            Share this password with <span className="font-semibold">{email}</span> securely.
            It will be shown only once.
          </p>
          <div className="mt-4 p-3 rounded-box bg-base-200 font-mono text-lg break-all select-all">
            {password}
          </div>
          <div className="card-actions justify-end mt-4">
            <button className="btn btn-primary" onClick={onClose}>
              I’ve saved it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersTable({
  users,
  isAdmin,
}: {
  users: DbUserLite[] ;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Debounced search: searchDraft updates on keystroke; query updates after 400ms
  const initialQ = params.get('q') ?? '';
  const [searchDraft, setSearchDraft] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
    const [viewingUser, setViewingUser] = useState<{ id: string, email: string } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>(
    (params.get('sort') as SortKey) ?? 'created'
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (params.get('dir') as SortDir) ?? 'desc'
  );
  const [page, setPage] = useState(Number(params.get('page') || 1));

const handleViewProfile = (userId: string, email: string) => {
    setViewingUser({ id: userId, email })
}


  const [totpModal, setTotpModal] = useState<
    | null
    | {
        action: (pin: string) => Promise<void>;
        onCancel?: () => void;
      }
  >(null);
  const [requireEnableTOTP, setRequireEnableTOTP] = useState(false);

  // Per-user transient errors for role changes
  const [roleErrors, setRoleErrors] = useState<Record<string, string>>({});

  // One-time password modal state after reset
  const [passwordModal, setPasswordModal] = useState<null | {
    email: string;
    password: string;
     onClose: () => void;
  }>(null);

    const [messageModal, setMessageModal] = useState<null | {
    title: string;
    text: string;
    onClose: () => void;
  }>(null);

const closePasswordModalAndRefresh = () => {
  setPasswordModal(null)
  router.refresh()
}

  // --- 400ms debounce: commit searchDraft -> query
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== query) {
        setQuery(searchDraft);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  // Keep URL in sync with UI state (guard no-op replaces)
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    if (query.trim()) sp.set('q', query.trim());
    else sp.delete('q');
    sp.set('sort', sortKey);
    sp.set('dir', sortDir);
    sp.set('page', String(page));

    const next = `${pathname}?${sp.toString()}`;
    const current = `${pathname}?${params.toString()}`;
    if (next !== current) router.replace(next as Route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortKey, sortDir, page]);

  /** Ask for TOTP; supports a cancel hook to revert UI when user cancels */
  const askForTOTP = async (
    action: (pin: string) => Promise<void>,
    onCancel?: () => void
  ) => {
    try {
      const hasTOTP = await currentAdminHasTOTP();
      if (!hasTOTP) {
        setRequireEnableTOTP(true);
        if (onCancel) onCancel(); // revert role UI if we opened from role change
        return;
      }
      setTotpModal({ action, onCancel });
    } catch {
      if (onCancel) onCancel();
     
    }
  };


  const handleResetPassword = (userId: string, email: string) => {
    askForTOTP(async (pin) => {
      const new_pwd = await resetPassword(userId, pin);
      if (new_pwd) 
      {
        setPasswordModal({ email, password: new_pwd ,onClose:()=>{setPasswordModal(null);
  router.refresh()}});
      }
      else 
        {
          setMessageModal({title:"Failure",text:"Unfortunately the operation failed. Please try again later..",onClose:()=>{setMessageModal(null);
  router.refresh()}})
        }
    });
  };

  const handleDeleteUser = (userId: string) => {
    askForTOTP(async (pin) => {
      await deleteUser(userId, pin);
      router.refresh();
    });
  };

  const { show, hide } = useManualLoading();


  const changeUserStatus = (userId: string) =>
  {
    askForTOTP(async (pin) => {
      await toggleUserStatus(userId,pin);
      router.refresh();
    });
  };
  



  const handleChangeRole = (
    userId: string,
    oldRole: string,
    newRole: string,
    revert: () => void,
    done: () => void
  ) => {
    const onCancel = () => {
      try {
        revert();
      } finally {
        done();
      }
    };

    askForTOTP(
      async (pin) => {
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
            [userId]: err?.message ?? 'Failed to update role',
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
          router.refresh();
        }
      },
      onCancel
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const role = normalizeRole(u);
      return `${u.email} ${role} ${u.totp_enabled ? 'yes' : 'no'} ${
        u.force_password_change ? 'yes' : 'no'
      } ${fmtDate(u.created_at)}`.toLowerCase().includes(q);
    });
  }, [users, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: DbUserLite, b: DbUserLite) => {
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
          av = a.totp_enabled ? 1 : 0;
          bv = b.totp_enabled ? 1 : 0;
          break;
        case 'force':
          av = a.force_password_change ? 1 : 0;
          bv = b.force_password_change ? 1 : 0;
          break;
        case 'created':
          av = new Date(a.created_at).getTime();
          bv = new Date(b.created_at).getTime();
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70">🔍</span>
          <input
            type="search"
            className="input input-bordered w-full pl-10 pr-9 h-10"
            placeholder="Search by any field…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchDraft !== query) {
                setQuery(searchDraft);
                setPage(1);
              }
            }}
          />
          {searchDraft && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
              onClick={() => {
                setSearchDraft('');
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
              <SortHeader label="Email" keyName="email" className="w-8/24" />
              <SortHeader label="Role" keyName="role" className="w-4/24 text-center" />
              
              <SortHeader label="Account Status" keyName="accountsts" className="w-2/24 text-center" />
              <SortHeader label="Password Status" keyName="force" className="w-2/24 text-center" />
              <SortHeader label="TOTP" keyName="totp" className="w-2/24 text-center" />
               <SortHeader label="Created" keyName="created" className="w-4/24 text-center" />
              <SortHeader label="Last Login" keyName="lastlogin" className="w-4/24 text-center" />
              {isAdmin && <th className="w-1/24 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => {
              const role = normalizeRole(u);
              return (
                <tr key={u.id} className="hover:bg-base-200/70">
                  <td>{u.email}</td>
                  <td className="text-center">
                    {isAdmin ? (
                      <>
                        <RoleSelect
                          userId={u.id}
                          initialRole={role}
                          onChange={(newRole, revert, done) =>
                            handleChangeRole(u.id, role, newRole, revert, done)
                          }
                        />
                        {roleErrors[u.id] && (
                          <div className="text-error text-xs mt-1">{roleErrors[u.id]}</div>
                        )}
                      </>
                    ) : (
                      <span className="badge badge-outline">{role}</span>
                    )}
                  </td>
                  <td className="text-center">
                  <button
                        className={`btn btn-ghost btn-sm  ${u.is_active ? 'text-success' : 'text-error'}`}
                        onClick={() => changeUserStatus(u.id)}
                        title="Change status"
                      >
                         {u.is_active ? <CircleCheckBigIcon size={18}/> : <Ban size={18}/>}
                         {u.is_active ? 'Active' : 'Deactivated'}
 </button>


                   </td>
                  <td className="text-center">
                    <div className={`badge ${u.force_password_change ? (u.temp_password_used_at ? 'badge-error' : 'badge-warning' ) : 'badge-neutral'}`}>
                      {u.force_password_change ? (u.temp_password_used_at ? 'used' : 'temp' ) : 'valid'}</div>
                      </td>

                  <td className="text-center"><div className={`badge  ${u.totp_enabled ? 'badge-neutral' : 'badge-warning'}`}>{u.totp_enabled ? 'enabled' : 'disabled'}</div></td>
                  <td className="text-center">{fmtDate(u.created_at)}</td>
                  <td className="text-center">{fmtDate(u.last_login_at)}</td>
                  {isAdmin && (
                    <td className="flex ">
                        <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleViewProfile(u.id, u.email)}
                        title="Profile"
                      >
                        <User size={20} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleResetPassword(u.id, u.email)}
                        title="Reset password"
                      >
                        <KeyRound size={20} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => handleDeleteUser(u.id)}
                        title="Delete user"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="text-center py-8 opacity-70">
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
              className={`btn btn-sm join-item ${n === safePage ? 'btn-primary' : ''}`}
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
{/* TOTP modal */}
{totpModal && (
  <TOTPModal
    onCancel={() => {
      try {
        totpModal.onCancel?.()
      } finally {
        setTotpModal(null)
      }
    }}
    onSubmit={async (pin: string) => {
      const act = totpModal?.action
      if (!act) return

      setTotpModal(null)
      try {
        show()                      // use the top-level hook values
        await act(pin)
      } finally {
        hide()
      }
    }}
  />
)}


      {/* Prompt to enable TOTP if admin doesn't have it */}
      {requireEnableTOTP && (
        <EnableTOTPRequiredModal onClose={() => setRequireEnableTOTP(false)} />
      )}

      {/* One-time password display after successful reset */}
      {passwordModal && (
        <OneTimePasswordModal
          email={passwordModal.email}
          password={passwordModal.password}
          onClose={passwordModal.onClose || (() => setPasswordModal(null))}
        />
      )}

      {messageModal && (
        <OneButtonModal
          title={messageModal.title}
          text={messageModal.text}
        
          onClose={messageModal.onClose || (() => setMessageModal(null))}
        />
      )}

{viewingUser && (
    <UserProfileView
        userId={viewingUser.id}
        email={viewingUser.email}
        onClose={() => setViewingUser(null)}
    />
)}
    </>
  );
}
