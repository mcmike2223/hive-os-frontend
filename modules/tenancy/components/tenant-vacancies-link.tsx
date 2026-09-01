"use client";
import { useEffect, useState } from "react";
import { getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";
export function TenantVacanciesLink({color,borderColor}:{color:string;borderColor:string}){
 const[visible,setVisible]=useState(false);
 useEffect(()=>{fetch(getBackendApiRoot()+"/public/recruitment/jobs",{headers:{Accept:"application/json",...getTenantHeaders({allowUnsigned:true})}}).then(response=>setVisible(response.ok)).catch(()=>setVisible(false))},[]);
 if(!visible)return null;
 return <a href="/careers" className="inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-black uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{color,borderColor}}>Vacancies</a>
}
