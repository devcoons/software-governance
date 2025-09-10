'use client';

import { UserProfile } from '@/server/db/mysql-types';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
  startTransition,
  useTransition,
} from 'react';
import { flushSync } from 'react-dom';

/* -------------------- Helpers -------------------- */

function toSafeProfile(p?: Partial<UserProfile> | null): UserProfile {
  return {
    user_id: p?.user_id ?? '',
    first_name: p?.first_name ?? '',
    last_name: p?.last_name ?? '',
    phone_number: p?.phone_number ?? '',
    timezone: p?.timezone ?? '',
  };
}

// Only compare the editable fields (user_id is immutable in this form)
function shallowEqualProfile(a: UserProfile, b: UserProfile): boolean {
  return (
    a.first_name === b.first_name &&
    a.last_name === b.last_name &&
    a.phone_number === b.phone_number &&
    a.timezone === b.timezone
  );
}

/* -------------------- Types -------------------- */

type ApiOk = { ok: true; profile: UserProfile };
type ApiErr = { ok: false; error: string; issues?: unknown };
type ApiResp = ApiOk | ApiErr;

/* -------------------- API -------------------- */

async function updateUserProfile(input: Omit<UserProfile, 'user_id'>): Promise<ApiResp> {
  try {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        first_name: input.first_name,
        last_name: input.last_name,
        phone_number: input.phone_number,
        timezone: input.timezone,
      }),
    });
    const json = (await res.json()) as ApiResp;
    return json;
  } catch {
    return { ok: false, error: 'network_failure' };
  }
}

/* -------------------- Child: Buttons -------------------- */

type ActionsProps = {
  canSave: boolean;
  canReset: boolean;
  saving: boolean;
  isPending: boolean;
  resetInProg: boolean;
  onSave: () => void;   // stable
  onReset: () => void;  // stable
};

const ProfileActions = React.memo(function ProfileActions({
  canSave,
  canReset,
  saving,
  isPending,
  resetInProg,
  onSave,
  onReset,
}: ActionsProps) {
  return (
    <div className="mt-6 inline-flex gap-2">
      <button
        className="btn btn-primary w-28"
        disabled={!canSave || saving || isPending}
        onClick={onSave}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      <button
        className="btn btn-outline"
        disabled={!canReset || resetInProg || saving}
        onClick={onReset}
      >
        {resetInProg ? 'Resetting…' : 'Reset'}
      </button>
    </div>
  );
});

/* -------------------- Reducer -------------------- */

type Draft = Pick<UserProfile, 'first_name' | 'last_name' | 'phone_number' | 'timezone'> & {
  user_id?: string; // ignored by changed compare but kept for shape compatibility
};

type DraftAction =
  | { type: 'setField'; field: keyof Draft; value: string }
  | { type: 'reset'; payload: UserProfile }
  | { type: 'replace'; payload: UserProfile };

function draftFromProfile(p: UserProfile): Draft {
  return {
    user_id: p.user_id,
    first_name: p.first_name,
    last_name: p.last_name,
    phone_number: p.phone_number,
    timezone: p.timezone,
  };
}

function draftReducer(state: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'setField':
      if (state[action.field] === action.value) return state;
      return { ...state, [action.field]: action.value };
    case 'reset':
    case 'replace':
      return draftFromProfile(action.payload);
    default:
      return state;
  }
}

/* -------------------- Component -------------------- */

export default function ProfileCard(profileDetails: UserProfile) {
  const initial = toSafeProfile(profileDetails);

  // Server-truth defaults (updated after successful save)
  const [defaultProfile, setDefaultProfile] = useState<UserProfile>(initial);

  // Single draft reducer for all inputs
  const [draft, dispatch] = useReducer(draftReducer, draftFromProfile(initial));

  // Flags
  const [saving, setSaving] = useState(false);
  const [resetInProg, setResetInProg] = useState(false);
  const [isPending, startLowPri] = useTransition();

  // changed via shallowEqual over the 4 editable fields
  const changed = useMemo(
    () => !shallowEqualProfile(draft as UserProfile, defaultProfile),
    [draft, defaultProfile]
  );

  // Keep latest draft in a ref so onSave can be stable
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // ---------- stable onSave ----------
  const onSave = useCallback(() => {
    if (!changed || saving) return;

    flushSync(() => {
      setSaving(true);
    });

    (async () => {
      const d = draftRef.current;
      const resp = await updateUserProfile({
        first_name: d.first_name,
        last_name: d.last_name,
        phone_number: d.phone_number,
        timezone: d.timezone,
      });

      if (resp.ok) {
        const p = toSafeProfile(resp.profile);
        // Update both draft and defaults to what the server accepted
        startLowPri(() => {
          dispatch({ type: 'replace', payload: p });
          setDefaultProfile(p);
        });
      } else {
        console.error('save failed:', resp);
      }

      setSaving(false);
    })();
  }, [changed, saving]); // only UX-related deps

  // ---------- stable onReset ----------
  const onReset = useCallback(() => {
    if (!changed || resetInProg) return;
    setResetInProg(true);
    startTransition(() => {
      dispatch({ type: 'reset', payload: defaultProfile });
    });
    requestAnimationFrame(() => setResetInProg(false));
  }, [changed, resetInProg, defaultProfile]);

  return (
    <div className="card bg-base-100 shadow-md border border-base-300">
      <div className="card-body">
        <h2 className="card-title">User Profile</h2>
        <p className="text-sm opacity-70 mb-4">
          Below, you will find your personal details as currently recorded in our system. Please ensure they are kept up to date and accurate.
        </p>

        <ul className="text-sm space-y-2 mb-4">
          <li><span className="font-medium">First Name:</span></li>
          <li>
            <label className="input w-full">
              <span className={`indicator-item status ${draft.first_name !== defaultProfile.first_name ? 'status-primary' : ''}`}></span>
              <input
                type="text"
                value={draft.first_name}
                onChange={(e) => dispatch({ type: 'setField', field: 'first_name', value: e.target.value })}
              />
            </label>
          </li>

          <li><span className="font-medium">Last Name:</span></li>
          <li>
            <label className="input w-full">
              <span className={`indicator-item status ${draft.last_name !== defaultProfile.last_name ? 'status-primary' : ''}`}></span>
              <input
                type="text"
                value={draft.last_name}
                onChange={(e) => dispatch({ type: 'setField', field: 'last_name', value: e.target.value })}
              />
            </label>
          </li>

          <li><span className="font-medium">Phone Number:</span></li>
          <li>
            <label className="input w-full">
              <span className={`indicator-item status ${draft.phone_number !== defaultProfile.phone_number ? 'status-primary' : ''}`}></span>
              <input
                type="text"
                value={draft.phone_number}
                onChange={(e) => dispatch({ type: 'setField', field: 'phone_number', value: e.target.value })}
              />
            </label>
          </li>

          <li><span className="font-medium">Timezone:</span></li>
          <li>
            <label className="input w-full">
              <span className={`indicator-item status ${draft.timezone !== defaultProfile.timezone ? 'status-primary' : ''}`}></span>
              <input
                type="text"
                value={draft.timezone}
                onChange={(e) => dispatch({ type: 'setField', field: 'timezone', value: e.target.value })}
              />
            </label>
          </li>
        </ul>

        <ProfileActions
          canSave={changed}
          canReset={changed}
          saving={saving}
          isPending={isPending}
          resetInProg={resetInProg}
          onSave={onSave}
          onReset={onReset}
        />
      </div>
    </div>
  );
}
