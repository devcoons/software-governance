'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AuditLogVisual, UserVisual } from '@/server/db/mysql-types';
import type { Route } from 'next';

const PAGE_SIZE = 7 as const;
type SortKey = 'id' | 'timestamp' | 'actor' | 'action_group' | 'action' | 'status' | 'metadata';
type SortDir = 'asc' | 'desc';

function fmtDate(x: AuditLogVisual['at'] | null) {
  try {
    if (!x)
      return "Unknown";
    return new Date(x).toISOString()
  } catch {
    return String(x ?? '');
  }
}

export default function LogsTable({
  logs,
}: {
  logs: AuditLogVisual[] ;
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
    (params.get('sort') as SortKey) ?? 'id'
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (params.get('dir') as SortDir) ?? 'desc'
  );
  const [page, setPage] = useState(Number(params.get('page') || 1));


  // --- 400ms debounce: commit searchDraft -> query
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== query) {
        setQuery(searchDraft);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(handle);
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
    if (!q) return logs;
    return logs.filter((u) => {
      return `${u.id} ${u.username} ${u.group} ${u.type} ${u.status} ${u.meta}
      } ${fmtDate(u.at)}`.toLowerCase().includes(q);
    });
  }, [logs, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a: AuditLogVisual, b: AuditLogVisual) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortKey) {
        case 'id':
          av = a.id;
          bv = b.id;
          break;
        case 'timestamp':
          av = a.at? new Date(a.at).getTime(): '';
          bv = b.at? new Date(b.at).getTime(): '';
          break;
        case 'actor':
          av = a.username ? 1 : 0;
          bv = b.username ? 1 : 0;
          break;
        case 'action_group':
          av = a.group ? 1 : 0;
          bv = b.group ? 1 : 0;
        case 'status':
          av = a.status ? 1 : 0;
          bv = b.status ? 1 : 0;
         case 'action':
          av = a.type ? 1 : 0;
          bv = b.type ? 1 : 0;
          break;
          break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return a.id < b.id ? 1 : 0;
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
        setSortDir(key === 'id' ? 'desc' : 'asc');
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
              <SortHeader label="Id" keyName="id" className="w-2/24" />
              <SortHeader label="Timestamp" keyName="timestamp" className="w-4/24" />
              <SortHeader label="Actor" keyName="actor" className="w-6/24" />
              <SortHeader label="Action Group" keyName="action_group" className="w-2/24 text-center" />   
              <SortHeader label="Action" keyName="action" className="w-2/24 text-center" />
              <SortHeader label="Status" keyName="status" className="w-2/24 text-center" />  
              <th>Metadata</th>    
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => {
              return (
                <tr key={u.id} className="hover:bg-base-200/70">
                    <td>{u.id}</td>
                    <td>{fmtDate(u.at)}</td>
                    <td>{u.username}<br/> <span className="badge badge-outline">{u.user_id}</span> </td>
                    <td className="text-center"><span className="badge badge-neutral">{u.group}</span></td>
                    <td className="text-center"><span className="badge badge-outline">{u.type}</span></td>
                    <td className="text-center"><div className={`badge ${!u.status ? 'badge-warning' : (u.status == 'ok' ? 'badge-success' : 'badge-error')}`}>
                      {!u.status  ?  'Unknown' : u.status == 'ok' ? "Completed" : "Failed" }</div>
                    </td>
                    <td>  <div className="flex flex-wrap gap-2">
    {Object.entries(u.meta || {}).map(([k, v]) => (
      <span key={k} className="badge badge-outline py-1">
        {k}:{String(v)}
      </span>
    ))}
  </div></td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 opacity-70">
                  No logs found.
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
