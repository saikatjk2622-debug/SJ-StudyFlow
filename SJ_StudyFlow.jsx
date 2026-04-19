import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL = "https://wvgqncmlgbnbdosuwcvc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Z3FuY21sZ2JuYmRvc3V3Y3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzE3ODgsImV4cCI6MjA5MjEwNzc4OH0.Aqu27BX8MjpO-ypv4xu6Eqq-50lOgAiiuiDU39tTAR0";

const sb = {
  h: { "Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}` },
  ah(t){ return {...this.h,"Authorization":`Bearer ${t}`}; },
  async signUp(email,password,name){ const r=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{method:"POST",headers:this.h,body:JSON.stringify({email,password,data:{name}})}); return r.json(); },
  async signIn(email,password){ const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:this.h,body:JSON.stringify({email,password})}); return r.json(); },
  async signOut(t){ await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:"POST",headers:this.ah(t)}); },
  async getUser(t){ const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:this.ah(t)}); return r.json(); },
  async resetPass(email){ const r=await fetch(`${SUPABASE_URL}/auth/v1/recover`,{method:"POST",headers:this.h,body:JSON.stringify({email})}); return r.json(); },
  async saveData(t,uid,key,value){
    const c=await fetch(`${SUPABASE_URL}/rest/v1/userdata?user_id=eq.${uid}&key=eq.${key}`,{headers:this.ah(t)});
    const ex=await c.json();
    const b=JSON.stringify({value:JSON.stringify(value),updated_at:new Date().toISOString()});
    if(ex.length>0) await fetch(`${SUPABASE_URL}/rest/v1/userdata?user_id=eq.${uid}&key=eq.${key}`,{method:"PATCH",headers:{...this.ah(t),"Prefer":"return=minimal"},body:b});
    else await fetch(`${SUPABASE_URL}/rest/v1/userdata`,{method:"POST",headers:{...this.ah(t),"Prefer":"return=minimal"},body:JSON.stringify({user_id:uid,key,value:JSON.stringify(value),updated_at:new Date().toISOString()})});
  },
  async getData(t,uid,key){ const r=await fetch(`${SUPABASE_URL}/rest/v1/userdata?user_id=eq.${uid}&key=eq.${key}&select=value`,{headers:this.ah(t)}); const d=await r.json(); if(Array.isArray(d)&&d.length>0){try{return JSON.parse(d[0].value);}catch{}} return null; },
  async loadAll(t,uid){ const keys=["sessions","todos","notes","subjects","goals","streak"]; const res=await Promise.all(keys.map(k=>this.getData(t,uid,k))); return Object.fromEntries(keys.map((k,i)=>[k,res[i]])); },
  async saveAll(t,uid,data){ await Promise.all(Object.entries(data).map(([k,v])=>this.saveData(t,uid,k,v))); },
  genCode(){ return Math.random().toString(36).substring(2,8).toUpperCase(); },
  async createGroup(t,uid,name,uname){
    const code=this.genCode();
    const r=await fetch(`${SUPABASE_URL}/rest/v1/study_groups`,{method:"POST",headers:{...this.ah(t),"Prefer":"return=representation"},body:JSON.stringify({name,code,created_by:uid})});
    const groups=await r.json();
    if(!Array.isArray(groups)||!groups[0]) return null;
    const gid=groups[0].id;
    await fetch(`${SUPABASE_URL}/rest/v1/group_members`,{method:"POST",headers:{...this.ah(t),"Prefer":"return=minimal"},body:JSON.stringify({group_id:gid,user_id:uid,display_name:uname,is_studying:false,total_today:0})});
    return groups[0];
  },
  async joinGroup(t,uid,code,uname){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/study_groups?code=eq.${code}&select=*`,{headers:this.ah(t)});
    const groups=await r.json();
    if(!Array.isArray(groups)||!groups[0]) return null;
    const g=groups[0];
    const mc=await fetch(`${SUPABASE_URL}/rest/v1/group_members?group_id=eq.${g.id}&select=id`,{headers:this.ah(t)});
    const members=await mc.json();
    if(members.length>=g.max_members) return "full";
    const check=await fetch(`${SUPABASE_URL}/rest/v1/group_members?group_id=eq.${g.id}&user_id=eq.${uid}`,{headers:this.ah(t)});
    const ex=await check.json();
    if(ex.length===0) await fetch(`${SUPABASE_URL}/rest/v1/group_members`,{method:"POST",headers:{...this.ah(t),"Prefer":"return=minimal"},body:JSON.stringify({group_id:g.id,user_id:uid,display_name:uname,is_studying:false,total_today:0})});
    return g;
  },
  async getGroupMembers(t,gid){ const r=await fetch(`${SUPABASE_URL}/rest/v1/group_members?group_id=eq.${gid}&select=*&order=total_today.desc`,{headers:this.ah(t)}); return r.json(); },
  async updateMemberStatus(t,uid,gid,isStudying,studyStart,totalToday){ await fetch(`${SUPABASE_URL}/rest/v1/group_members?user_id=eq.${uid}&group_id=eq.${gid}`,{method:"PATCH",headers:{...this.ah(t),"Prefer":"return=minimal"},body:JSON.stringify({is_studying:isStudying,study_start:studyStart,total_today:totalToday,last_seen:new Date().toISOString()})}); },
  async leaveGroup(t,uid,gid){ await fetch(`${SUPABASE_URL}/rest/v1/group_members?user_id=eq.${uid}&group_id=eq.${gid}`,{method:"DELETE",headers:this.ah(t)}); },
  async getUserGroups(t,uid){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/group_members?user_id=eq.${uid}&select=group_id`,{headers:this.ah(t)});
    const memberships=await r.json();
    if(!memberships.length) return [];
    const ids=memberships.map(m=>`id=eq.${m.group_id}`).join(",");
    const gr=await fetch(`${SUPABASE_URL}/rest/v1/study_groups?or=(${ids})&select=*`,{headers:this.ah(t)});
    return gr.json();
  },
};

const today = () => new Date().toISOString().split("T")[0];
const fmt = (s) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`; };
const fmtShort = (s) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; };
const weekKey = (d) => { const dt=new Date(d),day=dt.getDay(),diff=dt.getDate()-day+(day===0?-6:1); return new Date(dt.setDate(diff)).toISOString().split("T")[0]; };
const monthKey = (d) => d.slice(0,7);
const COLORS = ["#6EE7B7","#93C5FD","#FCA5A5","#FDE68A","#C4B5FD","#F9A8D4","#6EE7F7","#A3E635"];

function useLS(key,init) {
  const [val,setVal] = useState(() => { try { const s=localStorage.getItem(key); return s?JSON.parse(s):(typeof init==="function"?init():init); } catch { return typeof init==="function"?init():init; } });
  useEffect(() => { try { localStorage.setItem(key,JSON.stringify(val)); } catch {} },[key,val]);
  return [val,setVal];
}

const Icon = ({ name, size=18 }) => {
  const P = {
    home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    timer:"M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
    check:"M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
    chart:"M18 20V10 M12 20V4 M6 20v-6",
    book:"M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
    brain:"M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 019.5 7h5A2.5 2.5 0 0117 4.5v0A2.5 2.5 0 0014.5 2h-5z M9 7v3 M15 7v3 M7 10a5 5 0 0010 0 M7 10v4a5 5 0 0010 0v-4",
    user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    users:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
    sun:"M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42 M12 5a7 7 0 100 14A7 7 0 0012 5z",
    moon:"M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    plus:"M12 5v14 M5 12h14",
    trash:"M3 6h18 M19 6l-1 14H6L5 6 M8 6V4h8v2",
    edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    play:"M5 3l14 9-14 9V3z",
    pause:"M6 4h4v16H6z M14 4h4v16h-4z",
    reset:"M1 4v6h6 M23 20v-6h-6 M20.49 9A9 9 0 005.64 5.64L1 10 M23 14l-4.64 4.36A9 9 0 013.51 15",
    fire:"M12 22c5.523 0 10-4.477 10-10 0-4-3-7-3-7s-1 3-3 3c0-4-4-7-4-7S8 5 6 9c-1 2-1 4-1 5a7 7 0 007 8z",
    send:"M22 2L11 13 M22 2L15 22 8 13 2 11 22 2z",
    cloud:"M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z",
    logout:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
    eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
    eyeoff:"M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94 M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19 M1 1l22 22",
    copy:"M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
    trophy:"M6 9H4.5a2.5 2.5 0 010-5H6 M18 9h1.5a2.5 2.5 0 000-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0012 0V2z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {P[name]?.split(" M").map((d,i) => <path key={i} d={i===0?d:"M"+d} />)}
    </svg>
  );
};

const CircularProgress = ({ value, max, size=120, stroke=8, color="#6EE7B7", children }) => {
  const r=(size-stroke)/2, circ=2*Math.PI*r, pct=max>0?Math.min(value/max,1):0;
  return (
    <div style={{position:"relative",width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",position:"absolute"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} style={{transition:"stroke-dashoffset 0.5s ease",strokeLinecap:"round"}}/>
      </svg>
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}>{children}</div>
    </div>
  );
};

const BarChart = ({ data, color="#6EE7B7", height=80 }) => {
  const max=Math.max(...data.map(d=>d.val),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height}}>
      {data.map((d,i) => (
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:"100%",background:color,borderRadius:"4px 4px 0 0",height:`${(d.val/max)*(height-16)}px`,minHeight:d.val>0?4:0,opacity:0.85,transition:"height 0.4s ease"}}/>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",whiteSpace:"nowrap"}}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [mode,setMode] = useState("login");
  const [name,setName] = useState(""), [email,setEmail] = useState(""), [password,setPassword] = useState("");
  const [showP,setShowP] = useState(false), [loading,setLoading] = useState(false);
  const [error,setError] = useState(""), [success,setSuccess] = useState("");
  const th = { bg:"#0A0E1A",card:"#111827",card2:"#1A2235",border:"rgba(255,255,255,0.07)",text:"#F1F5F9",sub:"rgba(255,255,255,0.45)",accent:"#6EE7B7",accent2:"#93C5FD",danger:"#FCA5A5" };
  const inp = { width:"100%",background:th.card2,border:`1px solid ${th.border}`,borderRadius:12,padding:"13px 16px",color:th.text,fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit" };

  const handle = async () => {
    setError(""); setSuccess("");
    if(!email.trim()||!password.trim()) { setError("Email aur password bharen!"); return; }
    if(mode==="signup"&&!name.trim()) { setError("Naam likhein!"); return; }
    if(password.length<6) { setError("Password kam se kam 6 characters!"); return; }
    setLoading(true);
    try {
      if(mode==="login") {
        const res=await sb.signIn(email.trim(),password);
        if(res.error) setError(res.error.message.includes("Invalid")?"Email ya password galat!":res.error.message);
        else onLogin(res.access_token,res.user);
      } else if(mode==="signup") {
        const res=await sb.signUp(email.trim(),password,name.trim());
        if(res.error) setError(res.error.message.includes("already")?"Email already registered!":res.error.message);
        else if(res.user?.identities?.length===0) setError("Email already registered!");
        else { setSuccess("Account ban gaya! 🎉 Login karein."); setMode("login"); }
      } else {
        const res=await sb.resetPass(email.trim());
        if(res.error) setError(res.error.message);
        else setSuccess("Reset email bhej diya! 📧");
      }
    } catch { setError("Connection error!"); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:th.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Nunito',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');*{box-sizing:border-box}body{margin:0}`}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${th.accent},${th.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:32}}>📚</div>
          <div style={{fontSize:28,fontWeight:900,background:`linear-gradient(135deg,${th.accent},${th.accent2})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SJ StudyFlow</div>
          <div style={{fontSize:13,color:th.sub,marginTop:6}}>Apni padhai track karo 🎯</div>
        </div>
        <div style={{background:th.card,borderRadius:20,padding:28,border:`1px solid ${th.border}`}}>
          {mode!=="forgot" && (
            <div style={{display:"flex",background:th.card2,borderRadius:12,padding:4,marginBottom:24,gap:4}}>
              {[["login","Login"],["signup","Sign Up"]].map(([m,l]) => (
                <button key={m} onClick={() => {setMode(m);setError("");setSuccess("");}} style={{flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",background:mode===m?th.accent:"transparent",color:mode===m?"#0A0E1A":th.sub,fontWeight:800,fontSize:14,fontFamily:"inherit"}}>{l}</button>
              ))}
            </div>
          )}
          {mode==="forgot" ? (
            <>
              <div style={{fontSize:13,color:th.sub,marginBottom:16,textAlign:"center"}}>Email dalo — reset link bhejenge 📧</div>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{...inp,marginBottom:16}} type="email"/>
              {error && <div style={{background:"#FCA5A522",border:"1px solid #FCA5A544",borderRadius:10,padding:"10px 14px",color:th.danger,fontSize:13,marginBottom:12}}>{error}</div>}
              {success && <div style={{background:"#6EE7B722",border:"1px solid #6EE7B744",borderRadius:10,padding:"10px 14px",color:th.accent,fontSize:13,marginBottom:12}}>{success}</div>}
              <button onClick={handle} disabled={loading} style={{width:"100%",background:th.accent,color:"#0A0E1A",border:"none",borderRadius:12,padding:"13px 0",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{loading?"Bhej raha...":"Reset Link Bhejo"}</button>
              <button onClick={()=>{setMode("login");setError("");}} style={{width:"100%",background:"none",border:"none",color:th.sub,fontSize:13,cursor:"pointer",marginTop:12,fontFamily:"inherit"}}>← Wapas Login</button>
            </>
          ) : (
            <>
              {mode==="signup" && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Naam" style={{...inp,marginBottom:14}}/>}
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{...inp,marginBottom:14}} type="email" onKeyDown={e=>e.key==="Enter"&&handle()}/>
              <div style={{position:"relative",marginBottom:8}}>
                <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (min 6)" style={{...inp,paddingRight:48}} type={showP?"text":"password"} onKeyDown={e=>e.key==="Enter"&&handle()}/>
                <button onClick={()=>setShowP(s=>!s)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:th.sub,cursor:"pointer",padding:0}}><Icon name={showP?"eyeoff":"eye"} size={18}/></button>
              </div>
              {mode==="login" && <button onClick={()=>{setMode("forgot");setError("");}} style={{background:"none",border:"none",color:th.accent2,fontSize:12,cursor:"pointer",marginBottom:16,fontFamily:"inherit",display:"block"}}>Password bhool gaye?</button>}
              {error && <div style={{background:"#FCA5A522",border:"1px solid #FCA5A544",borderRadius:10,padding:"10px 14px",color:th.danger,fontSize:13,marginBottom:12}}>{error}</div>}
              {success && <div style={{background:"#6EE7B722",border:"1px solid #6EE7B744",borderRadius:10,padding:"10px 14px",color:th.accent,fontSize:13,marginBottom:12}}>{success}</div>}
              <button onClick={handle} disabled={loading} style={{width:"100%",background:`linear-gradient(135deg,${th.accent},${th.accent2})`,color:"#0A0E1A",border:"none",borderRadius:12,padding:"14px 0",fontSize:15,fontWeight:900,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",opacity:loading?0.7:1}}>
                {loading?"Please wait...":mode==="login"?"🚀 Login Karein":"✨ Account Banao"}
              </button>
            </>
          )}
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:12,color:th.sub}}>🔒 Secure · Powered by Supabase</div>
      </div>
    </div>
  );
};

// ── GROUP STUDY PAGE ──────────────────────────────────────────────────────────
const GroupStudyPage = ({ token, user, uname, timerRunning, timerSecs, todayTotal, th, S, notify }) => {
  const [groups,setGroups] = useState([]);
  const [activeGroup,setActiveGroup] = useState(null);
  const [members,setMembers] = useState([]);
  const [loading,setLoading] = useState(true);
  const [view,setView] = useState("list");
  const [groupName,setGroupName] = useState("");
  const [joinCode,setJoinCode] = useState("");
  const [copied,setCopied] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => { loadGroups(); },[]);

  useEffect(() => {
    if(activeGroup) { loadMembers(); pollRef.current=setInterval(loadMembers,5000); }
    return () => clearInterval(pollRef.current);
  },[activeGroup]);

  useEffect(() => {
    if(!activeGroup||!user) return;
    sb.updateMemberStatus(token,user.id,activeGroup.id,timerRunning,timerRunning?new Date().toISOString():null,Math.floor(todayTotal));
  },[timerRunning,todayTotal]);

  const loadGroups = async () => {
    setLoading(true);
    try { const g=await sb.getUserGroups(token,user.id); setGroups(Array.isArray(g)?g:[]); } catch {}
    setLoading(false);
  };

  const loadMembers = async () => {
    if(!activeGroup) return;
    try { const m=await sb.getGroupMembers(token,activeGroup.id); setMembers(Array.isArray(m)?m:[]); } catch {}
  };

  const createGroup = async () => {
    if(!groupName.trim()) { notify("Group naam likhein!","warn"); return; }
    setLoading(true);
    const g=await sb.createGroup(token,user.id,groupName.trim(),uname);
    if(g) { await loadGroups(); setGroupName(""); setView("list"); notify(`Group "${g.name}" ban gaya! 🎉`); }
    else notify("Error! Dobara try karein.","warn");
    setLoading(false);
  };

  const joinGroup = async () => {
    if(!joinCode.trim()) { notify("Code likhein!","warn"); return; }
    setLoading(true);
    const g=await sb.joinGroup(token,user.id,joinCode.trim().toUpperCase(),uname);
    if(g==="full") notify("Group full hai! (Max 10)","warn");
    else if(g) { await loadGroups(); setJoinCode(""); setView("list"); notify("Group join kar liya! 🎉"); }
    else notify("Code galat hai!","warn");
    setLoading(false);
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(activeGroup?.code||"");
    setCopied(true); setTimeout(()=>setCopied(false),2000);
    notify("Code copy ho gaya! 📋");
  };

  const studyingNow = members.filter(m=>m.is_studying);

  if(view==="group"&&activeGroup) return (
    <div style={S.page}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={()=>{setView("list");setActiveGroup(null);clearInterval(pollRef.current);}} style={{background:"none",border:"none",color:th.sub,cursor:"pointer",fontSize:22,lineHeight:1}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:900}}>{activeGroup.name}</div>
          <div style={{fontSize:12,color:th.sub}}>{members.length} members · {studyingNow.length} studying now</div>
        </div>
      </div>

      {studyingNow.length>0 && (
        <div style={{...S.card,background:`linear-gradient(135deg,${th.accent}15,${th.accent2}15)`,border:`1px solid ${th.accent}33`}}>
          <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>🟢 Abhi Padh Rahe Hain</div>
          {studyingNow.map(m => {
            const elapsed=m.study_start?Math.floor((Date.now()-new Date(m.study_start).getTime())/1000):0;
            return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${th.border}`}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${th.accent},${th.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#0A0E1A",flexShrink:0}}>{m.display_name?.charAt(0).toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700}}>{m.display_name} {m.user_id===user?.id?"(You)":""}</div>
                  <div style={{fontSize:11,color:th.sub}}>Is session: {fmt(elapsed)}</div>
                </div>
                <div style={{width:8,height:8,borderRadius:"50%",background:th.accent,animation:"pulse 2s infinite"}}/>
              </div>
            );
          })}
        </div>
      )}

      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:800,marginBottom:12,display:"flex",alignItems:"center",gap:6}}><Icon name="trophy" size={16}/>Aaj Ka Leaderboard</div>
        {members.sort((a,b)=>b.total_today-a.total_today).map((m,i) => (
          <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${th.border}`}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:i===0?"#FDE68A":i===1?"#E2E8F0":i===2?"#F9A8D4":th.card2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#0A0E1A",flexShrink:0}}>{i+1}</div>
            <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${COLORS[i%COLORS.length]}88,${COLORS[(i+1)%COLORS.length]}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0}}>{m.display_name?.charAt(0).toUpperCase()}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:m.user_id===user?.id?800:600}}>{m.display_name}{m.user_id===user?.id?" 👈":""}</div>
              {m.is_studying && <span style={{fontSize:10,background:th.accent+"22",color:th.accent,padding:"1px 8px",borderRadius:10,fontWeight:700,display:"inline-block",marginTop:2}}>📖 Studying</span>}
            </div>
            <div style={{fontSize:14,fontWeight:900,color:i===0?th.warn:th.accent}}>{fmtShort(m.total_today)}</div>
          </div>
        ))}
      </div>

      <div style={{...S.card,background:th.card2}}>
        <div style={{fontSize:13,color:th.sub,marginBottom:10}}>📌 Code share karo doston ke saath:</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{flex:1,background:th.card,borderRadius:10,padding:"12px 16px",fontSize:22,fontWeight:900,letterSpacing:4,textAlign:"center",color:th.accent,border:`1px solid ${th.accent}33`}}>{activeGroup.code}</div>
          <button onClick={copyCode} style={{...S.btn(th.accent),flexShrink:0}}><Icon name="copy" size={16}/>{copied?"✓":"Copy"}</button>
        </div>
      </div>

      <button onClick={async()=>{await sb.leaveGroup(token,user.id,activeGroup.id);setActiveGroup(null);setView("list");loadGroups();notify("Group leave kar diya");}} style={{...S.btn(th.danger),width:"100%",justifyContent:"center",color:"#0A0E1A"}}>Group Leave Karein</button>
    </div>
  );

  if(view==="create") return (
    <div style={S.page}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:th.sub,cursor:"pointer",fontSize:22,lineHeight:1}}>←</button>
        <span style={{fontSize:18,fontWeight:800}}>New Group Banao</span>
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,color:th.sub,marginBottom:16}}>Group naam rakho — ek unique code milega jo doston ke saath share karo!</div>
        <input value={groupName} onChange={e=>setGroupName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createGroup()} placeholder="Group naam (jaise: UPSC Warriors 2025)" style={{...S.inp,marginBottom:16}}/>
        <button onClick={createGroup} disabled={loading} style={{...S.btn(th.accent),width:"100%",justifyContent:"center"}}>{loading?"Ban raha hai...":"✨ Group Banao"}</button>
      </div>
    </div>
  );

  if(view==="join") return (
    <div style={S.page}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:th.sub,cursor:"pointer",fontSize:22,lineHeight:1}}>←</button>
        <span style={{fontSize:18,fontWeight:800}}>Group Join Karo</span>
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,color:th.sub,marginBottom:16}}>Apne dost ka 6-digit code enter karo!</div>
        <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&joinGroup()} placeholder="CODE" style={{...S.inp,marginBottom:16,textAlign:"center",letterSpacing:6,fontSize:22,fontWeight:900}}/>
        <button onClick={joinGroup} disabled={loading} style={{...S.btn(th.accent2),width:"100%",justifyContent:"center",color:"#fff"}}>{loading?"Join ho raha...":"🚀 Join Karein"}</button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{fontSize:20,fontWeight:800,marginBottom:16}}>👥 Group Study</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <button onClick={()=>setView("create")} style={{background:`linear-gradient(135deg,${th.accent}22,${th.accent}11)`,border:`1px solid ${th.accent}44`,borderRadius:16,padding:20,cursor:"pointer",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>➕</div>
          <div style={{fontSize:13,fontWeight:800,color:th.accent}}>Group Banao</div>
          <div style={{fontSize:11,color:th.sub,marginTop:4}}>Naya group create karo</div>
        </button>
        <button onClick={()=>setView("join")} style={{background:`linear-gradient(135deg,${th.accent2}22,${th.accent2}11)`,border:`1px solid ${th.accent2}44`,borderRadius:16,padding:20,cursor:"pointer",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>🔗</div>
          <div style={{fontSize:13,fontWeight:800,color:th.accent2}}>Join Karo</div>
          <div style={{fontSize:11,color:th.sub,marginTop:4}}>Code se join karo</div>
        </button>
      </div>
      {loading ? (
        <div style={{textAlign:"center",padding:"40px 0",color:th.sub}}>Loading...</div>
      ) : groups.length===0 ? (
        <div style={{...S.card,textAlign:"center",padding:40}}>
          <div style={{fontSize:48,marginBottom:12}}>👥</div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Koi group nahi abhi</div>
          <div style={{fontSize:13,color:th.sub}}>Group banao ya kisi ke group mein join karo!</div>
        </div>
      ) : (
        <>
          <div style={{fontSize:12,fontWeight:700,color:th.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Tumhare Groups</div>
          {groups.map(g => (
            <div key={g.id} onClick={()=>{setActiveGroup(g);setView("group");}} style={{...S.card,cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <div style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${th.accent},${th.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📚</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800}}>{g.name}</div>
                <div style={{fontSize:11,color:th.sub,marginTop:2}}>Code: <span style={{color:th.accent,fontWeight:700,letterSpacing:2}}>{g.code}</span></div>
              </div>
              <div style={{color:th.sub,fontSize:20}}>›</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function SJStudyFlow() {
  const [token,setToken] = useLS("sjsf_token",null);
  const [user,setUser] = useLS("sjsf_user",null);
  const [authLoading,setAuthLoading] = useState(true);
  const [dark,setDark] = useLS("sjsf_dark",true);
  const [tab,setTab] = useState("home");
  const [subjects,setSubjects] = useLS("sjsf_subjects",["Mathematics","Physics","Chemistry","Biology","History","English"]);
  const [todos,setTodos] = useLS("sjsf_todos",{});
  const [sessions,setSessions] = useLS("sjsf_sessions",[]);
  const [notes,setNotes] = useLS("sjsf_notes",[]);
  const [goals,setGoals] = useLS("sjsf_goals",{daily:7200,weekly:36000});
  const [streak,setStreak] = useLS("sjsf_streak",{count:0,last:""});
  const [timerMode,setTimerMode] = useState("study");
  const [timerRunning,setTimerRunning] = useState(false);
  const [timerSecs,setTimerSecs] = useState(0);
  const [pomW,setPomW] = useLS("sjsf_pw",25);
  const [pomB,setPomB] = useLS("sjsf_pb",5);
  const [pomPhase,setPomPhase] = useState("work");
  const [pomLeft,setPomLeft] = useState(null);
  const [activeSub,setActiveSub] = useLS("sjsf_as","");
  const [aiMsgs,setAiMsgs] = useLS("sjsf_ai",[]);
  const [aiInput,setAiInput] = useState(""), [aiLoading,setAiLoading] = useState(false), [aiSub,setAiSub] = useState("");
  const [newTodo,setNewTodo] = useState(""), [newSub,setNewSub] = useState("");
  const [noteTitle,setNoteTitle] = useState(""), [noteBody,setNoteBody] = useState(""), [noteSub,setNoteSub] = useState("");
  const [editNote,setEditNote] = useState(null), [showNoteForm,setShowNoteForm] = useState(false);
  const [notif,setNotif] = useState(null);
  const [aRange,setARange] = useState("week");
  const [goalInput,setGoalInput] = useState({daily:goals.daily/3600,weekly:goals.weekly/3600});
  const [syncSt,setSyncSt] = useState("");
  const pomRef=useRef(null), studyRef=useRef(null), syncRef=useRef(null);

  const th = dark ? {
    bg:"#0A0E1A",card:"#111827",card2:"#1A2235",border:"rgba(255,255,255,0.07)",
    text:"#F1F5F9",sub:"rgba(255,255,255,0.45)",accent:"#6EE7B7",accent2:"#93C5FD",
    danger:"#FCA5A5",warn:"#FDE68A",purple:"#C4B5FD",pink:"#F9A8D4",
  } : {
    bg:"#F0F4FF",card:"#FFFFFF",card2:"#E8EEF8",border:"rgba(0,0,0,0.08)",
    text:"#1E293B",sub:"rgba(0,0,0,0.45)",accent:"#059669",accent2:"#2563EB",
    danger:"#DC2626",warn:"#D97706",purple:"#7C3AED",pink:"#DB2777",
  };

  const notify = (msg,type="success") => { setNotif({msg,type}); setTimeout(()=>setNotif(null),3000); };

  useEffect(() => {
    (async () => {
      if(token) {
        try {
          const u=await sb.getUser(token);
          if(u.error) { setToken(null); setUser(null); }
          else { setUser(u); loadCloud(token,u.id); }
        } catch {}
      }
      setAuthLoading(false);
    })();
  },[]);

  const loadCloud = async (t,uid) => {
    try {
      const d=await sb.loadAll(t,uid);
      if(d.sessions) setSessions(d.sessions);
      if(d.todos) setTodos(d.todos);
      if(d.notes) setNotes(d.notes);
      if(d.subjects) setSubjects(d.subjects);
      if(d.goals) setGoals(d.goals);
      if(d.streak) setStreak(d.streak);
    } catch {}
  };

  const syncCloud = useCallback(async () => {
    if(!token||!user) return;
    setSyncSt("syncing");
    try { await sb.saveAll(token,user.id,{sessions,todos,notes,subjects,goals,streak}); setSyncSt("synced"); }
    catch { setSyncSt("error"); }
    setTimeout(()=>setSyncSt(""),3000);
  },[token,user,sessions,todos,notes,subjects,goals,streak]);

  useEffect(() => {
    if(!token) return;
    clearTimeout(syncRef.current);
    syncRef.current=setTimeout(syncCloud,8000);
    return () => clearTimeout(syncRef.current);
  },[sessions,todos,notes,subjects,goals,streak]);

  const handleLogin = async (t,u) => { setToken(t); setUser(u); await loadCloud(t,u.id); notify("Welcome! 🎉"); };
  const handleLogout = async () => { await syncCloud(); try{await sb.signOut(token);}catch{} setToken(null); setUser(null); };

  useEffect(() => {
    if(!user) return;
    const t=today();
    if(streak.last===t) return;
    const y=new Date(); y.setDate(y.getDate()-1);
    const ys=y.toISOString().split("T")[0];
    setStreak(streak.last===ys?{count:streak.count+1,last:t}:{count:1,last:t});
  },[user]);

  useEffect(() => {
    if(timerRunning&&timerMode==="study") { studyRef.current=setInterval(()=>setTimerSecs(s=>s+1),1000); }
    else clearInterval(studyRef.current);
    return () => clearInterval(studyRef.current);
  },[timerRunning,timerMode]);

  useEffect(() => { if(pomLeft===null) setPomLeft(pomW*60); },[pomW]);

  useEffect(() => {
    if(timerRunning&&timerMode==="pomodoro") {
      pomRef.current=setInterval(()=>{
        setPomLeft(p=>{
          if(p<=1) { if(pomPhase==="work"){notify("🎉 Break!");setPomPhase("break");return pomB*60;}else{notify("💪 Work!");setPomPhase("work");return pomW*60;} }
          return p-1;
        });
        setTimerSecs(s=>s+1);
      },1000);
    } else clearInterval(pomRef.current);
    return () => clearInterval(pomRef.current);
  },[timerRunning,timerMode,pomPhase,pomW,pomB]);

  const startTimer = () => { if(!activeSub){notify("Subject select karein!","warn");return;} setTimerRunning(true); };
  const pauseTimer = () => setTimerRunning(false);
  const saveSession = useCallback(() => {
    if(timerSecs<5) return;
    setSessions(p=>[...p,{id:Date.now(),date:today(),subject:activeSub,duration:timerSecs,mode:timerMode,ts:Date.now()}]);
    notify(`${fmtShort(timerSecs)} saved! 🎯`); setTimerSecs(0);
  },[timerSecs,activeSub,timerMode]);
  const resetTimer = () => { if(timerRunning&&timerSecs>10) saveSession(); setTimerRunning(false); setTimerSecs(0); setPomLeft(pomW*60); setPomPhase("work"); };

  const todayTodos = todos[today()]||[];
  const addTodo = () => { if(!newTodo.trim()) return; setTodos(t=>({...t,[today()]:[...(t[today()]||[]),{id:Date.now(),text:newTodo.trim(),done:false}]})); setNewTodo(""); };
  const toggleTodo = id => setTodos(t=>({...t,[today()]:(t[today()]||[]).map(x=>x.id===id?{...x,done:!x.done}:x)}));
  const delTodo = id => setTodos(t=>({...t,[today()]:(t[today()]||[]).filter(x=>x.id!==id)}));

  const todayTotal = sessions.filter(s=>s.date===today()).reduce((a,b)=>a+b.duration,0);
  const allTotal = sessions.reduce((a,b)=>a+b.duration,0);
  const subTotals = subjects.reduce((acc,s)=>{acc[s]=sessions.filter(x=>x.subject===s).reduce((a,b)=>a+b.duration,0);return acc;},{});

  const chartData = () => {
    const now=new Date();
    if(aRange==="week") return Array.from({length:7},(_,i)=>{ const d=new Date(now);d.setDate(d.getDate()-(6-i));const k=d.toISOString().split("T")[0];return{label:["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()],val:sessions.filter(s=>s.date===k).reduce((a,b)=>a+b.duration,0)/3600}; });
    if(aRange==="month") return Array.from({length:4},(_,i)=>{ const ws=new Date(now);ws.setDate(ws.getDate()-(3-i)*7);const we=new Date(ws);we.setDate(we.getDate()+6);return{label:`W${i+1}`,val:sessions.filter(s=>s.date>=ws.toISOString().split("T")[0]&&s.date<=we.toISOString().split("T")[0]).reduce((a,b)=>a+b.duration,0)/3600}; });
    return Array.from({length:12},(_,i)=>{ const m=String(i+1).padStart(2,"0");return{label:["J","F","M","A","M","J","J","A","S","O","N","D"][i],val:sessions.filter(s=>s.date.startsWith(`${now.getFullYear()}-${m}`)).reduce((a,b)=>a+b.duration,0)/3600}; });
  };

  const saveNote = () => {
    if(!noteTitle.trim()) return;
    if(editNote) { setNotes(n=>n.map(x=>x.id===editNote?{...x,title:noteTitle,body:noteBody,subject:noteSub}:x)); setEditNote(null); }
    else { setNotes(n=>[...n,{id:Date.now(),title:noteTitle,body:noteBody,subject:noteSub,date:today()}]); }
    setNoteTitle(""); setNoteBody(""); setNoteSub(""); setShowNoteForm(false); notify("Note saved! 📝");
  };

  const askAI = async () => {
    if(!aiInput.trim()||aiLoading) return;
    const q=aiInput.trim();
    setAiMsgs(m=>[...m,{role:"user",content:q}]); setAiInput(""); setAiLoading(true);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`Study assistant.${aiSub?` Subject: ${aiSub}.`:""} Help clearly.`,messages:[...aiMsgs,{role:"user",content:q}].slice(-10)})});
      const d=await res.json();
      setAiMsgs(m=>[...m,{role:"assistant",content:d.content?.map(c=>c.text||"").join("")||"Error."}]);
    } catch { setAiMsgs(m=>[...m,{role:"assistant",content:"⚠️ Error. Retry karein."}]); }
    setAiLoading(false);
  };

  const S = {
    app:{minHeight:"100vh",background:th.bg,color:th.text,fontFamily:"'Nunito',sans-serif",paddingBottom:80},
    header:{background:th.card,borderBottom:`1px solid ${th.border}`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
    logo:{fontSize:18,fontWeight:900,background:`linear-gradient(135deg,${th.accent},${th.accent2})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
    nav:{position:"fixed",bottom:0,left:0,right:0,background:th.card,borderTop:`1px solid ${th.border}`,display:"flex",zIndex:100,padding:"8px 0 12px"},
    navBtn:(a)=>({flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,border:"none",background:"none",cursor:"pointer",color:a?th.accent:th.sub,fontSize:10,fontWeight:a?700:500,padding:"4px 0",fontFamily:"inherit"}),
    page:{padding:"20px 16px",maxWidth:700,margin:"0 auto"},
    card:{background:th.card,borderRadius:16,padding:20,marginBottom:16,border:`1px solid ${th.border}`},
    card2:{background:th.card2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${th.border}`},
    h3:{fontSize:11,fontWeight:700,color:th.sub,textTransform:"uppercase",letterSpacing:1,margin:"0 0 12px"},
    inp:{width:"100%",background:th.card2,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px 14px",color:th.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
    btn:(c=th.accent)=>({background:c,color:c===th.accent?"#0A0E1A":"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}),
    ghost:{background:"transparent",border:`1px solid ${th.border}`,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",color:th.sub,display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"},
    tag:(c)=>({background:c+"22",color:c,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}),
    stat:(c)=>({background:c+"15",border:`1px solid ${c}33`,borderRadius:12,padding:14,textAlign:"center"}),
  };

  if(authLoading) return (
    <div style={{minHeight:"100vh",background:"#0A0E1A",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:"sans-serif"}}>
      <div style={{fontSize:48}}>📚</div>
      <div style={{color:"#6EE7B7",fontSize:20,fontWeight:800}}>SJ StudyFlow</div>
      <div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>Loading...</div>
    </div>
  );

  if(!token||!user) return <LoginScreen onLogin={handleLogin} />;

  const uname = user?.user_metadata?.name||user?.email?.split("@")[0]||"Student";

  const HomePage = () => {
    const done=todayTodos.filter(t=>t.done).length, pct=goals.daily>0?Math.min(todayTotal/goals.daily,1):0;
    return (
      <div style={S.page}>
        <div style={{...S.card,background:`linear-gradient(135deg,${dark?"#0F2027":"#E0F2FE"},${dark?"#1A2A3A":"#F0F9FF"})`,border:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:13,color:th.sub,marginBottom:4}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
              <div style={{fontSize:20,fontWeight:900}}>Namaste, {uname}! 👋</div>
              <div style={{fontSize:12,color:th.sub,marginTop:4}}>Aaj bhi padhai karein 💪</div>
            </div>
            <div style={{...S.tag(th.warn),display:"flex",alignItems:"center",gap:4}}><Icon name="fire" size={12}/>{streak.count} day</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={S.stat(th.accent)}><div style={{fontSize:22,fontWeight:900,color:th.accent}}>{fmtShort(todayTotal)}</div><div style={{fontSize:11,color:th.sub,marginTop:2}}>Today</div></div>
          <div style={S.stat(th.accent2)}><div style={{fontSize:22,fontWeight:900,color:th.accent2}}>{done}/{todayTodos.length}</div><div style={{fontSize:11,color:th.sub,marginTop:2}}>Tasks</div></div>
        </div>
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontWeight:700,fontSize:14}}>Daily Goal</span><span style={{fontSize:12,color:th.sub}}>{fmtShort(todayTotal)}/{fmtShort(goals.daily)}</span></div>
          <div style={{background:th.card2,borderRadius:8,height:10,overflow:"hidden"}}><div style={{background:`linear-gradient(90deg,${th.accent},${th.accent2})`,height:"100%",width:`${pct*100}%`,borderRadius:8,transition:"width 0.5s"}}/></div>
          <div style={{fontSize:11,color:th.sub,marginTop:6}}>{Math.round(pct*100)}% complete</div>
        </div>
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontWeight:700,fontSize:14}}>Today's Tasks</span><button style={S.ghost} onClick={()=>setTab("todo")}>View All</button></div>
          {todayTodos.length===0 ? <div style={{textAlign:"center",color:th.sub,fontSize:13,padding:"12px 0"}}>Koi task nahi ✅</div> : todayTodos.slice(0,3).map(t => (
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:`1px solid ${th.border}`}}>
              <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${t.done?th.accent:th.border}`,background:t.done?th.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{t.done&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0A0E1A" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}</div>
              <span style={{fontSize:13,textDecoration:t.done?"line-through":"none",color:t.done?th.sub:th.text,flex:1}}>{t.text}</span>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Quick Start</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {subjects.map((s,i) => <button key={s} onClick={()=>{setActiveSub(s);setTab("timer");}} style={{background:activeSub===s?COLORS[i%COLORS.length]+"33":th.card2,border:`1px solid ${activeSub===s?COLORS[i%COLORS.length]:th.border}`,color:activeSub===s?COLORS[i%COLORS.length]:th.text,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s}</button>)}
          </div>
          <button style={{...S.btn(th.accent),width:"100%",justifyContent:"center"}} onClick={()=>setTab("timer")}><Icon name="play" size={16}/>Start Studying</button>
        </div>
      </div>
    );
  };

  const TimerPage = () => {
    const pomTotal=pomPhase==="work"?pomW*60:pomB*60, disp=timerMode==="pomodoro"?(pomLeft??pomW*60):timerSecs;
    return (
      <div style={S.page}>
        <div style={{...S.card,textAlign:"center"}}>
          <div style={{display:"flex",background:th.card2,borderRadius:12,padding:4,marginBottom:20,gap:4}}>
            {["study","pomodoro"].map(m => <button key={m} onClick={()=>{resetTimer();setTimerMode(m);}} style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",cursor:"pointer",background:timerMode===m?th.accent:"transparent",color:timerMode===m?"#0A0E1A":th.sub,fontWeight:700,fontSize:13,fontFamily:"inherit"}}>{m==="study"?"⏱ Study":"🍅 Pomodoro"}</button>)}
          </div>
          <select value={activeSub} onChange={e=>setActiveSub(e.target.value)} style={{...S.inp,marginBottom:20,textAlign:"center",fontWeight:700}}>
            <option value="">— Subject Select Karein —</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
            <CircularProgress value={timerMode==="pomodoro"?pomTotal-(pomLeft??0):timerSecs} max={timerMode==="pomodoro"?pomTotal:Math.max(timerSecs,goals.daily)} size={200} stroke={12} color={timerRunning?th.accent:th.sub}>
              <div>
                <div style={{fontSize:36,fontWeight:900,fontFamily:"'Courier New',monospace",lineHeight:1}}>{fmt(disp)}</div>
                {timerMode==="pomodoro" && <div style={{fontSize:11,color:th.sub,marginTop:4}}>{pomPhase==="work"?"🎯 Focus":"☕ Break"}</div>}
                {activeSub && <div style={{fontSize:11,color:th.accent,marginTop:4}}>{activeSub}</div>}
              </div>
            </CircularProgress>
          </div>
          {timerMode==="pomodoro" && (
            <div style={{display:"flex",gap:12,marginBottom:16}}>
              <div style={{flex:1}}><div style={{fontSize:11,color:th.sub,marginBottom:4}}>Work (min)</div><input type="number" value={pomW} onChange={e=>{setPomW(+e.target.value);setPomLeft(+e.target.value*60);}} style={{...S.inp,textAlign:"center"}} min={1} max={120}/></div>
              <div style={{flex:1}}><div style={{fontSize:11,color:th.sub,marginBottom:4}}>Break (min)</div><input type="number" value={pomB} onChange={e=>setPomB(+e.target.value)} style={{...S.inp,textAlign:"center"}} min={1} max={60}/></div>
            </div>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button style={{...S.btn(th.card2),color:th.sub}} onClick={resetTimer}><Icon name="reset" size={16}/>Reset</button>
            {!timerRunning ? <button style={{...S.btn(th.accent),minWidth:110,justifyContent:"center"}} onClick={startTimer}><Icon name="play" size={16}/>{timerSecs>0?"Resume":"Start"}</button>
            : <button style={{...S.btn(th.warn),minWidth:110,justifyContent:"center",color:"#0A0E1A"}} onClick={pauseTimer}><Icon name="pause" size={16}/>Pause</button>}
            {timerSecs>0 && <button style={{...S.btn(th.accent2),color:"#0A0E1A"}} onClick={saveSession}>Save</button>}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.h3}>Aaj Ki Sessions</div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${th.border}`,marginBottom:8}}>
            <span style={{fontSize:13,color:th.sub}}>Total</span><span style={{fontSize:13,fontWeight:700,color:th.accent}}>{fmtShort(todayTotal)}</span>
          </div>
          {sessions.filter(s=>s.date===today()).slice(-5).reverse().map(s => (
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${th.border}`}}>
              <div><div style={{fontSize:13,fontWeight:600}}>{s.subject}</div><div style={{fontSize:11,color:th.sub}}>{s.mode}·{new Date(s.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div></div>
              <div style={{fontSize:13,fontWeight:700,color:th.accent2}}>{fmtShort(s.duration)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const TodoPage = () => {
    const [showH,setShowH] = useState(false);
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>📋 Daily Tasks</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={newTodo} onChange={e=>setNewTodo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()} placeholder="Task add karein..." style={{...S.inp,flex:1}}/>
            <button style={S.btn(th.accent)} onClick={addTodo}><Icon name="plus" size={16}/></button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <span style={S.tag(th.accent)}>{todayTodos.filter(t=>!t.done).length} Pending</span>
            <span style={S.tag(th.accent2)}>{todayTodos.filter(t=>t.done).length} Done</span>
          </div>
          {todayTodos.length===0 ? <div style={{textAlign:"center",color:th.sub,padding:"20px 0"}}>Koi task nahi! 🎯</div> : (
            <>
              {todayTodos.filter(t=>!t.done).map(t => (
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${th.border}`}}>
                  <div onClick={()=>toggleTodo(t.id)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${th.border}`,cursor:"pointer",flexShrink:0}}/>
                  <span style={{flex:1,fontSize:14}}>{t.text}</span>
                  <button onClick={()=>delTodo(t.id)} style={{background:"none",border:"none",color:th.sub,cursor:"pointer"}}><Icon name="trash" size={14}/></button>
                </div>
              ))}
              {todayTodos.filter(t=>t.done).length>0 && (
                <div style={{marginTop:12,opacity:0.6}}>
                  <div style={{fontSize:11,color:th.sub,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Completed</div>
                  {todayTodos.filter(t=>t.done).map(t => (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${th.border}`}}>
                      <div onClick={()=>toggleTodo(t.id)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${th.accent}`,background:th.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A0E1A" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span style={{flex:1,fontSize:14,textDecoration:"line-through",color:th.sub}}>{t.text}</span>
                      <button onClick={()=>delTodo(t.id)} style={{background:"none",border:"none",color:th.sub,cursor:"pointer"}}><Icon name="trash" size={14}/></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <button style={{...S.ghost,width:"100%",justifyContent:"center",marginBottom:12}} onClick={()=>setShowH(!showH)}>{showH?"Hide":"Show"} History</button>
        {showH && Object.entries(todos).filter(([k])=>k!==today()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7).map(([date,tasks]) => (
          <div key={date} style={S.card2}>
            <div style={{fontSize:12,fontWeight:700,color:th.sub,marginBottom:8}}>{new Date(date).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})}</div>
            {tasks.map(t => <div key={t.id} style={{fontSize:13,padding:"3px 0",textDecoration:t.done?"line-through":"none",color:t.done?th.sub:th.text}}>{t.done?"✅":"⬜"} {t.text}</div>)}
          </div>
        ))}
      </div>
    );
  };

  const AnalyticsPage = () => {
    const wt=sessions.filter(s=>s.date>=weekKey(today())).reduce((a,b)=>a+b.duration,0);
    const mt=sessions.filter(s=>s.date.startsWith(monthKey(today()))).reduce((a,b)=>a+b.duration,0);
    return (
      <div style={S.page}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[{l:"Today",v:todayTotal,c:th.accent},{l:"This Week",v:wt,c:th.accent2},{l:"This Month",v:mt,c:th.purple},{l:"All Time",v:allTotal,c:th.pink}].map(({l,v,c}) => (
            <div key={l} style={S.stat(c)}><div style={{fontSize:20,fontWeight:900,color:c}}>{fmtShort(v)}</div><div style={{fontSize:11,color:th.sub}}>{l}</div></div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{fontWeight:700}}>Study History</span>
            <div style={{display:"flex",gap:6}}>
              {["week","month","year"].map(r => <button key={r} onClick={()=>setARange(r)} style={{padding:"4px 10px",borderRadius:8,border:"none",cursor:"pointer",background:aRange===r?th.accent:th.card2,color:aRange===r?"#0A0E1A":th.sub,fontSize:11,fontWeight:700,fontFamily:"inherit"}}>{r.charAt(0).toUpperCase()+r.slice(1)}</button>)}
            </div>
          </div>
          <BarChart data={chartData()} color={th.accent} height={100}/>
        </div>
        <div style={S.card}>
          <div style={S.h3}>Subject Breakdown</div>
          {subjects.filter(s=>subTotals[s]>0).sort((a,b)=>subTotals[b]-subTotals[a]).map((s,i) => {
            const p=allTotal>0?subTotals[s]/allTotal:0;
            return (
              <div key={s} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{fontWeight:600}}>{s}</span><span style={{color:th.sub}}>{fmtShort(subTotals[s])} · {Math.round(p*100)}%</span></div>
                <div style={{background:th.card2,borderRadius:6,height:8}}><div style={{background:COLORS[i%COLORS.length],height:"100%",width:`${p*100}%`,borderRadius:6,transition:"width 0.5s"}}/></div>
              </div>
            );
          })}
          {subjects.every(s=>!subTotals[s]) && <div style={{color:th.sub,fontSize:13,textAlign:"center"}}>Data nahi. Padhai karo! 📚</div>}
        </div>
        <div style={S.card}>
          <div style={S.h3}>Overview</div>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            {[{e:"🔥",v:streak.count,l:"Streak",c:th.warn},{e:"🎯",v:sessions.length,l:"Sessions",c:th.accent},{e:"⭐",v:Math.floor(allTotal/3600),l:"Hours",c:th.accent2}].map(({e,v,l,c}) => (
              <div key={l} style={{textAlign:"center"}}><div style={{fontSize:28}}>{e}</div><div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div><div style={{fontSize:11,color:th.sub}}>{l}</div></div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const NotesPage = () => {
    const [fSub,setFSub] = useState("All");
    const filtered = fSub==="All"?notes:notes.filter(n=>n.subject===fSub);
    return (
      <div style={S.page}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:20,fontWeight:800}}>📚 Notes</span>
          <button style={S.btn(th.accent)} onClick={()=>{setEditNote(null);setNoteTitle("");setNoteBody("");setNoteSub("");setShowNoteForm(true);}}><Icon name="plus" size={16}/>New</button>
        </div>
        {showNoteForm && (
          <div style={S.card}>
            <div style={S.h3}>{editNote?"Edit":"New"} Note</div>
            <input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="Title..." style={{...S.inp,marginBottom:10}}/>
            <select value={noteSub} onChange={e=>setNoteSub(e.target.value)} style={{...S.inp,marginBottom:10}}><option value="">— Subject —</option>{subjects.map(s=><option key={s} value={s}>{s}</option>)}</select>
            <textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} placeholder="Notes likhein..." rows={5} style={{...S.inp,resize:"vertical",lineHeight:1.6}}/>
            <div style={{display:"flex",gap:8,marginTop:12}}><button style={S.btn(th.accent)} onClick={saveNote}>{editNote?"Update":"Save"}</button><button style={S.ghost} onClick={()=>setShowNoteForm(false)}>Cancel</button></div>
          </div>
        )}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {["All",...subjects].map(s => <button key={s} onClick={()=>setFSub(s)} style={{background:fSub===s?th.accent:th.card2,color:fSub===s?"#0A0E1A":th.sub,border:"none",borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s}</button>)}
        </div>
        {filtered.length===0 ? <div style={{textAlign:"center",color:th.sub,padding:"40px 0"}}>Koi note nahi 📝</div> : filtered.sort((a,b)=>b.id-a.id).map((n,i) => (
          <div key={n.id} style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{n.title}</div>
                <div style={{display:"flex",gap:6,marginTop:4}}>{n.subject && <span style={S.tag(COLORS[subjects.indexOf(n.subject)%COLORS.length]||th.accent)}>{n.subject}</span>}<span style={{fontSize:11,color:th.sub}}>{new Date(n.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span></div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setEditNote(n.id);setNoteTitle(n.title);setNoteBody(n.body);setNoteSub(n.subject);setShowNoteForm(true);}} style={{background:"none",border:"none",color:th.sub,cursor:"pointer"}}><Icon name="edit" size={14}/></button>
                <button onClick={()=>{setNotes(ns=>ns.filter(x=>x.id!==n.id));notify("Note deleted");}} style={{background:"none",border:"none",color:th.danger,cursor:"pointer"}}><Icon name="trash" size={14}/></button>
              </div>
            </div>
            <div style={{fontSize:13,color:th.sub,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.body?.slice(0,200)}{n.body?.length>200?"...":""}</div>
          </div>
        ))}
      </div>
    );
  };

  const AIPage = () => {
    const cRef = useRef(null);
    useEffect(() => { if(cRef.current) cRef.current.scrollTop=cRef.current.scrollHeight; },[aiMsgs,aiLoading]);
    return (
      <div style={{...S.page,display:"flex",flexDirection:"column",height:"calc(100vh - 140px)",paddingBottom:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:20,fontWeight:800}}>🤖 AI Doubt Solver</span>
          <button style={S.ghost} onClick={()=>setAiMsgs([])}>Clear</button>
        </div>
        <select value={aiSub} onChange={e=>setAiSub(e.target.value)} style={{...S.inp,marginBottom:12}}><option value="">Subject (optional)</option>{subjects.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <div ref={cRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,paddingBottom:16}}>
          {aiMsgs.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:48,marginBottom:12}}>🧠</div>
              <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Kuch bhi poochho!</div>
              <div style={{fontSize:13,color:th.sub}}>Main aapke doubts solve karunga.</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:16}}>
                {["Newton ke laws?","Photosynthesis kya hai?","Quadratic equations?"].map(q => <button key={q} onClick={()=>setAiInput(q)} style={{background:th.card2,border:`1px solid ${th.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,color:th.sub,cursor:"pointer",fontFamily:"inherit"}}>{q}</button>)}
              </div>
            </div>
          )}
          {aiMsgs.map((m,i) => (
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"85%",background:m.role==="user"?th.accent:th.card,padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",fontSize:13,lineHeight:1.6,color:m.role==="user"?"#0A0E1A":th.text,border:m.role==="assistant"?`1px solid ${th.border}`:"none",whiteSpace:"pre-wrap"}}>{m.content}</div>
            </div>
          ))}
          {aiLoading && <div style={{display:"flex",gap:6,padding:"10px 14px",background:th.card,borderRadius:16,border:`1px solid ${th.border}`,width:"fit-content"}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:th.accent,animation:`bounce 1s ${i*0.2}s infinite`}}/>)}</div>}
        </div>
        <div style={{display:"flex",gap:8,paddingTop:12,borderTop:`1px solid ${th.border}`,paddingBottom:8}}>
          <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&askAI()} placeholder="Doubt likhein..." style={{...S.inp,flex:1}}/>
          <button style={{...S.btn(th.accent),flexShrink:0}} onClick={askAI} disabled={aiLoading}><Icon name="send" size={16}/></button>
        </div>
      </div>
    );
  };

  const ProfilePage = () => (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:`linear-gradient(135deg,${th.accent},${th.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:28,fontWeight:900,color:"#0A0E1A"}}>{uname.charAt(0).toUpperCase()}</div>
          <div style={{fontSize:20,fontWeight:900}}>{uname}</div>
          <div style={{fontSize:12,color:th.sub,marginTop:4}}>{user?.email}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
          {[{l:"Streak",v:streak.count+"🔥",c:th.warn},{l:"Sessions",v:sessions.length,c:th.accent},{l:"Hours",v:Math.floor(allTotal/3600),c:th.accent2}].map(({l,v,c}) => (
            <div key={l} style={{...S.stat(c),padding:10}}><div style={{fontSize:18,fontWeight:900,color:c}}>{v}</div><div style={{fontSize:10,color:th.sub}}>{l}</div></div>
          ))}
        </div>
        <button onClick={syncCloud} style={{...S.btn(th.accent2),width:"100%",justifyContent:"center",marginBottom:10,color:"#fff"}}><Icon name="cloud" size={16}/>{syncSt==="syncing"?"Sync ho raha...":syncSt==="synced"?"✅ Synced!":"☁️ Cloud Sync"}</button>
        <button onClick={handleLogout} style={{...S.btn(th.danger),width:"100%",justifyContent:"center",color:"#0A0E1A"}}><Icon name="logout" size={16}/>Logout</button>
      </div>
      <div style={S.card}>
        <div style={S.h3}>Study Goals</div>
        <div style={{display:"flex",gap:12,marginBottom:12}}>
          <div style={{flex:1}}><div style={{fontSize:11,color:th.sub,marginBottom:4}}>Daily (hours)</div><input type="number" value={goalInput.daily} onChange={e=>setGoalInput(g=>({...g,daily:+e.target.value}))} style={S.inp} min={0.5} max={24} step={0.5}/></div>
          <div style={{flex:1}}><div style={{fontSize:11,color:th.sub,marginBottom:4}}>Weekly (hours)</div><input type="number" value={goalInput.weekly} onChange={e=>setGoalInput(g=>({...g,weekly:+e.target.value}))} style={S.inp} min={1} max={168} step={1}/></div>
        </div>
        <button style={S.btn(th.accent)} onClick={()=>{setGoals({daily:goalInput.daily*3600,weekly:goalInput.weekly*3600});notify("Goals saved! 🎯");}}>Save Goals</button>
      </div>
      <div style={S.card}>
        <div style={S.h3}>Subjects</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {subjects.map((s,i) => <div key={s} style={{...S.tag(COLORS[i%COLORS.length]),display:"flex",alignItems:"center",gap:6}}>{s}<button onClick={()=>setSubjects(ss=>ss.filter(x=>x!==s))} style={{background:"none",border:"none",cursor:"pointer",color:"inherit",padding:0}}>×</button></div>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newSub} onChange={e=>setNewSub(e.target.value)} onKeyDown={e=>e.key==="Enter"&&newSub.trim()&&(setSubjects(s=>[...s,newSub.trim()]),setNewSub(""))} placeholder="Subject add karein..." style={{...S.inp,flex:1}}/>
          <button style={S.btn(th.accent)} onClick={()=>{if(newSub.trim()){setSubjects(s=>[...s,newSub.trim()]);setNewSub("");}}}><Icon name="plus" size={16}/></button>
        </div>
      </div>
      <div style={S.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700}}>Dark Mode</span>
          <div onClick={()=>setDark(d=>!d)} style={{width:48,height:26,borderRadius:13,background:dark?th.accent:th.card2,cursor:"pointer",position:"relative",transition:"background 0.3s",border:`1px solid ${th.border}`}}>
            <div style={{position:"absolute",top:3,left:dark?24:3,width:18,height:18,borderRadius:"50%",background:dark?"#0A0E1A":th.sub,transition:"left 0.3s"}}/>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    {id:"home",icon:"home",label:"Home"},
    {id:"timer",icon:"timer",label:"Timer"},
    {id:"todo",icon:"check",label:"Tasks"},
    {id:"analytics",icon:"chart",label:"Stats"},
    {id:"notes",icon:"book",label:"Notes"},
    {id:"group",icon:"users",label:"Group"},
    {id:"ai",icon:"brain",label:"AI"},
    {id:"profile",icon:"user",label:"Me"},
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        select option { background: #111827; color: #F1F5F9; }
        @keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus, textarea:focus, select:focus { border-color: #6EE7B7 !important; }
      `}</style>
      <div style={S.app}>
        <div style={S.header}>
          <span style={S.logo}>SJ StudyFlow</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {timerRunning && (
              <div style={{display:"flex",alignItems:"center",gap:6,background:th.accent+"22",border:`1px solid ${th.accent}44`,borderRadius:20,padding:"4px 12px"}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:th.accent,animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:12,color:th.accent,fontWeight:700}}>{fmt(timerSecs)}</span>
              </div>
            )}
            {syncSt==="syncing" && <span style={{fontSize:11,color:th.sub}}>⏳</span>}
            {syncSt==="synced" && <span style={{fontSize:11,color:th.accent}}>✅</span>}
            <button onClick={()=>setDark(d=>!d)} style={{background:"none",border:"none",cursor:"pointer",color:th.sub}}><Icon name={dark?"sun":"moon"} size={18}/></button>
          </div>
        </div>

        {notif && (
          <div style={{position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",background:th.card,border:`1px solid ${notif.type==="warn"?th.warn:th.accent}`,color:th.text,padding:"10px 20px",borderRadius:12,fontSize:13,fontWeight:600,zIndex:999,boxShadow:"0 8px 32px rgba(0,0,0,0.3)",whiteSpace:"nowrap"}}>
            {notif.msg}
          </div>
        )}

        {tab==="home" && <HomePage />}
        {tab==="timer" && <TimerPage />}
        {tab==="todo" && <TodoPage />}
        {tab==="analytics" && <AnalyticsPage />}
        {tab==="notes" && <NotesPage />}
        {tab==="group" && <GroupStudyPage token={token} user={user} uname={uname} timerRunning={timerRunning} timerSecs={timerSecs} todayTotal={todayTotal} th={th} S={S} notify={notify} />}
        {tab==="ai" && <AIPage />}
        {tab==="profile" && <ProfilePage />}

        <nav style={S.nav}>
          {tabs.map(t => (
            <button key={t.id} style={S.navBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
              <Icon name={t.icon} size={20}/>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
