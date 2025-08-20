'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Trash2, KeyRound, User, CircleCheckBigIcon, Ban } from 'lucide-react';
import { Role } from './user-role-select'
import { DbUserLite, DbUserVisual } from '@/server/db/user-repo';


type UserRow = {
  id: string;
  email: string;
  roles: string[];
  totpEnabled: boolean;
  forcePasswordChange: boolean;
  createdAt: string | number | Date;
};

const PAGE_SIZE = 7 as const;
type SortKey = 'fname' | 'lname' | 'email' | 'role' | 'lastlogin' | 'accountsts';
type SortDir = 'asc' | 'desc';

function normalizeRole(u: DbUserVisual): Role {
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

export default function UsersTable({
  users,
}: {
  users: DbUserVisual[] ;
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


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const role = normalizeRole(u);
      return `${u.email} ${role} ${u.first_name} ${u.first_name}
      } ${fmtDate(u.last_login_at)}`.toLowerCase().includes(q);
    });
  }, [users, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: DbUserVisual, b: DbUserVisual) => {
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
        case 'fname':
          av = a.first_name ? 1 : 0;
          bv = b.first_name ? 1 : 0;
          break;
        case 'lname':
          av = a.last_name ? 1 : 0;
          bv = b.last_name ? 1 : 0;
          break;
        case 'lastlogin':
          av = a.last_login_at? new Date(a.last_login_at).getTime(): '';
          bv = b.last_login_at? new Date(b.last_login_at).getTime(): '';
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
        setSortDir(key === 'role' ? 'desc' : 'asc');
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
              <SortHeader label="First Name" keyName="fname" className="w-4/24" />
              <SortHeader label="Last Name" keyName="lname" className="w-4/24" />
              <SortHeader label="Email" keyName="email" className="w-4/24" />
              <SortHeader label="Role" keyName="role" className="w-4/24 text-center" />   
              <SortHeader label="Account Status" keyName="accountsts" className="w-2/24 text-center" />
              <SortHeader label="Last Login" keyName="lastlogin" className="w-4/24 text-center" />   
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => {
              const role = normalizeRole(u);
              return (
                <tr key={u.id} className="hover:bg-base-200/70">
                  <td>{u.first_name}</td>
                  <td>{u.last_name}</td>
                  <td>{u.email}</td>
                  <td className="text-center">
                      <span className="badge badge-outline">{role}</span>  
                  </td>
                  <td className="text-center">
                    <div className={`badge ${u.is_active ? 'badge-success' : 'badge-warning'}`}>
                      {u.is_active ?  'Active' : 'Deactivated' }</div>
                   </td>
                  <td className="text-center">{fmtDate(u.last_login_at)}</td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 opacity-70">
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

    </>
  );
}
