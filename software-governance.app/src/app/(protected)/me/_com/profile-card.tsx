'use client'

import { DbUserProfile } from "@/server/db/user-profile-repo";
import { redirect } from "next/dist/server/api-utils";
import { useRouter } from "next/navigation";
import { useState } from "react";


async function UpdateUserProfile(first_name: string, last_name:string, phone_number:string, timezone:string): Promise<boolean>{
 try {
    const res = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        first_name: first_name,
        last_name: last_name,
        phone_number: phone_number,
        timezone,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}


export default function ProfileCard(profileDetails : DbUserProfile) {
    const router = useRouter()
    let defaultProfile = profileDetails;
    const [firstname, setFirstname] = useState(defaultProfile.first_name)
    const [lastname, setLastname] = useState(defaultProfile.last_name)
    const [phonenumber, setPhonenumber] = useState(defaultProfile.phone_number)
    const [timezone, setTimezone] = useState(defaultProfile.timezone)
    const changed = (firstname !== defaultProfile.first_name) || (lastname !== defaultProfile.last_name)
                    || (phonenumber !== defaultProfile.phone_number) || (timezone !== defaultProfile.timezone);
    const [saving, setSaving] = useState(false)

    return (
    <div className="card bg-base-100 shadow-md border border-base-300 ">
        <div className="card-body">
            <h2 className="card-title ">User Profile</h2>
            <p className="text-sm opacity-70 mb-4">Below, you will find your personal details as currently recorded in our system. Please ensure they are kept up to date and accurate.</p>
            <ul className="text-sm space-y-2 mb-4">
                <li><span className="font-medium">First Name:</span> </li>
                <li>           
                    <label className="input w-full">
                        <span className={`"indicator-item status ${firstname!==defaultProfile.first_name?'status-primary':''}`}></span>
                        <input type="text" value={firstname} onChange={(e)=>{setFirstname(e.target.value)}} />
                    </label>
                </li>
                <li><span className="font-medium">Last Name:</span> </li>
                <li>           
                    <label className="input w-full">
                        <span className={`"indicator-item status ${lastname!==defaultProfile.last_name?'status-primary':''}`}></span>
                        <input type="text" value={lastname} onChange={(e)=>{setLastname(e.target.value)}} />
                    </label>
                </li>
                <li><span className="font-medium">Phone Number:</span> </li>
                <li>           
                    <label className="input w-full">
                        <span className={`"indicator-item status ${phonenumber!==defaultProfile.phone_number?'status-primary':''}`}></span>
                        <input type="text" value={phonenumber} onChange={(e)=>{setPhonenumber(e.target.value)}} />
                    </label>
                </li>
                <li><span className="font-medium">Timezone:</span> </li>
                <li>           
                    <label className="input w-full">
                        <span className={`"indicator-item status ${timezone!==defaultProfile.timezone?'status-primary':''}`}></span>
                        <input type="text" value={timezone} onChange={(e)=>{setTimezone(e.target.value)}} />
                    </label>
                </li>
            </ul>
            <div className="inline-flex gap-2 ">
                <button className="btn btn-primary w2/7" disabled={!changed} onClick={async ()=>{
                    const ok = await UpdateUserProfile(firstname,lastname,phonenumber,timezone);
                    setSaving(false)
                if (ok) router.refresh()
                    
                }}>{saving ? 'Saving…' : 'Save'}</button>
                <button className="btn btn-outline" disabled={!changed} onClick={(e)=>
                {
                    setFirstname(defaultProfile.first_name);
                    setLastname(defaultProfile.last_name);
                    setPhonenumber(defaultProfile.phone_number);
                    setTimezone(defaultProfile.timezone);
                }}>Reset</button>
            </div>
        </div>
    </div>
    );
}