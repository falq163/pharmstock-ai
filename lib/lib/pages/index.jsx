import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase, getTodayTransactions, getCriticalStock, getHourlyRevenue, getTopSelling } from "../lib/supabase";

const fmt      = (n) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n||0);
const fmtShort = (n) => n>=1000000?`${(n/1000000).toFixed(1)}Jt`:n>=1000?`${(n/1000).toFixed(0)}Rb`:(n||0);
const nowStr   = () => new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

function Pulse({color="#10b981"}) {
  return (
    <span style={{position:"relative",display:"inline-flex",width:10,height:10}}>
      <span style={{position:"absolute",inset:0,borderRadius:"50%",background:color,opacity:0.4,animation:"ping 1.5s cubic-bezier(0,0,0.2,1) infinite"}}/>
      <span style={{position:"relative",width:10,height:10,borderRadius:"50%",background:color,display:"inline-flex"}}/>
    </span>
  );
}

function KpiCard({label,value,sub,color="#10b981",icon,flash}) {
  return (
    <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",border:`1px solid ${flash?"#10b981":"rgba(255,255,255,0.08)"}`,borderRadius:16,padding:"16px 18px",transition:"border-color 0.5s",boxShadow:flash?"0 0 20px #10b98130":"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:20}}>{icon}</span><Pulse color={color}/></div>
      <div style={{fontSize:22,fontWeight:800,color:"white",letterSpacing:"-0.5px"}}>{value}</div>
      <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>{label}</div>
      {sub&&<div style={{fontSize:10,color,marginTop:2,fontWeight:600}}>{sub}</div>}
    </div>
  );
}

function AIModal({onClose,liveData}) {
  const [msgs,setMsgs]       = useState([{role:"assistant",content:`Halo Boss 👋\n\nRevenue hari ini **${fmt(liveData.revenue)}** dari **${liveData.txCount} transaksi**. Ada yang ingin ditanyakan?`}]);
  const [inp,setInp]         = useState("");
  const [loading,setLoading] = useState(false);
  const ref = useRef();
  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const prompt = () => `Kamu adalah PharmAI, asisten pemilik apotek Faliq. Jawab singkat & actionable.
DATA REAL (${nowStr()}):
Revenue: ${fmt(liveData.revenue)} | Transaksi: ${liveData.txCount}
Stok kritis: ${liveData.critical?.map(d=>`${d.name}(${d.stock}/${d.min_stock})`).join(", ")||"Tidak ada"}
Top produk: ${liveData.topSelling?.map(d=>`${d.drug_name}(${fmt(d.total_revenue)})`).join(", ")||"Belum ada"}`;

  const send = async(text) => {
    const t=(text||inp).trim(); if(!t||loading) return;
    setInp(""); const nm=[...msgs,{role:"user",content:t}]; setMsgs(nm); setLoading(true);
    try {
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,system:prompt(),messages:nm.map(m=>({role:m.role,content:m.content}))})});
      const d=await r.json();
      setMsgs(p=>[...p,{role:"assistant",content:d.content?.[0]?.text||"Error"}]);
    } catch { setMsgs(p=>[...p,{role:"assistant",content:"❌ Gagal."}]); }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{background:"#0f172a",borderRadius:"20px 20px 0 0",border:"1px solid rgba(16,185,129,0.3)",maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#059669,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
            <div><div style={{color:"white",fontWeight:700,fontSize:14}}>PharmAI</div><div style={{color:"#10b981",fontSize:10,display:"flex",alignItems:"center",gap:5}}><Pulse/> Data real Supabase</div></div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",color:"#94a3b8",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"80%",padding:"9px 13px",borderRadius:m.role==="user"?"16px 16px 3px 16px":"3px 16px 16px 16px",background:m.role==="user"?"linear-gradient(135deg,#059669,#10b981)":"rgba(255,255,255,0.06)",color:"white",fontSize:13,lineHeight:1.6,border:m.role==="assistant"?"1px solid rgba(255,255,255,0.08)":"none"}}
                dangerouslySetInnerHTML={{__html:m.content.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>")}}/>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:5,padding:"10px 14px",background:"rgba(255,255,255,0.06)",borderRadius:12,width:"fit-content"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#10b981",animation:"bounce 1.2s infinite",animationDelay:`${i*0.2}s`}}/>)}</div>}
          <div ref={ref}/>
        </div>
        <div style={{padding:"10px 14px 20px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            {["Laporan hari ini","Stok kritis?","Saran reorder","Top produk?"].map(q=>(
              <button key={q} onClick={()=>send(q)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid rgba(16,185,129,0.4)",background:"transparent",color:"#10b981",fontSize:11,fontWeight:600,cursor:"pointer"}}>{q}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Tanya kondisi apotek..." style={{flex:1,padding:"9px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"white",fontSize:13,fontFamily:"inherit"}}/>
            <button onClick={()=>send()} disabled={loading||!inp.trim()} style={{width:40,height:40,borderRadius:10,border:"none",background:loading||!inp.trim()?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#059669,#10b981)",color:"white",cursor:loading||!inp.trim()?"not-allowed":"pointer",fontSize:16}}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const [revenue,setRevenue]       = useState(0);
  const [txCount,setTxCount]       = useState(0);
  const [critical,setCritical]     = useState([]);
  const [hourly,setHourly]         = useState([]);
  const [topSelling,setTopSelling] = useState([]);
  const [recentTx,setRecentTx]     = useState([]);
  const [lastUpdate,setLastUpdate] = useState(nowStr());
  const [flash,setFlash]           = useState(false);
  const [showAI,setShowAI]         = useState(false);
  const [loading,setLoading]       = useState(true);
  const [activeChart,setActiveChart] = useState("revenue");

  const loadData = async () => {
    try {
      const [txData,critData,hourlyData,topData] = await Promise.all([
        getTodayTransactions(), getCriticalStock(), getHourlyRevenue(), getTopSelling()
      ]);
      const totalRev = txData?.reduce((s,t)=>s+(t.total||0),0)||0;
      setRevenue(totalRev); setTxCount(txData?.length||0);
      setCritical(critData||[]); setRecentTx(txData?.slice(0,10)||[]);
      setTopSelling(topData||[]);
      const hf = Array.from({length:new Date().getHours()+1},(_,h)=>{
        const f=hourlyData?.find(d=>parseInt(d.hour)===h);
        return {hour:`${String(h).padStart(2,"0")}:00`,rev:f?.revenue||0,tx:f?.tx_count||0};
      }).filter(h=>parseInt(h.hour)>=7);
      setHourly(hf);
      setLastUpdate(nowStr()); setFlash(true); setTimeout(()=>setFlash(false),600);
    } catch(e){console.error(e);}
    setLoading(false);
  };

  useEffect(()=>{
    loadData();
    const ch = supabase.channel("owner-live")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"transactions"},()=>loadData())
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"drugs"},()=>loadData())
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[]);

  if(loading) return <div style={{minHeight:"100vh",background:"#080f1a",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{fontSize:48}}>💊</div><div style={{color:"#10b981",fontSize:14,fontWeight:600}}>Memuat data real-time...</div></div>;

  return (
    <div style={{minHeight:"100vh",background:"#080f1a",fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:100}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');@keyframes ping{75%,100%{transform:scale(2);opacity:0}}@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:10px}`}</style>

      <div style={{padding:"20px 18px 14px",background:"linear-gradient(180deg,#0d1f2d,#080f1a)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{color:"#64748b",fontSize:11,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Owner Dashboard</div><div style={{color:"white",fontSize:22,fontWeight:800}}>Apotek Faliq 💊</div></div>
          <div style={{textAlign:"right"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",marginBottom:4}}><Pulse/><span style={{color:"#10b981",fontSize:11,fontWeight:600}}>LIVE</span></div>
            <div style={{color:"#475569",fontSize:10}}>{lastUpdate}</div>
            <button onClick={loadData} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:6,padding:"3px 8px",color:"#94a3b8",fontSize:10,cursor:"pointer",marginTop:4}}>🔄 Refresh</button>
          </div>
        </div>
      </div>

      <div style={{padding:"0 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <KpiCard icon="💰" label="Revenue Hari Ini" value={fmtShort(revenue)} sub={`${txCount} transaksi`} flash={flash}/>
        <KpiCard icon="🛒" label="Avg/Transaksi" value={txCount>0?fmtShort(Math.round(revenue/txCount)):"-"} color="#6366f1"/>
        <KpiCard icon="⚠️" label="Stok Kritis" value={critical.length} sub="perlu reorder" color="#f59e0b"/>
        <KpiCard icon="🔴" label="Stok Habis" value={critical.filter(d=>d.stock===0).length} color="#ef4444"/>
      </div>

      <div style={{margin:"0 16px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{color:"white",fontWeight:700,fontSize:14}}>{activeChart==="revenue"?"📈 Revenue per Jam":"📊 Transaksi per Jam"}</div>
          <div style={{display:"flex",gap:6}}>{[["revenue","Revenue"],["tx","Transaksi"]].map(([k,l])=><button key={k} onClick={()=>setActiveChart(k)} style={{padding:"4px 10px",borderRadius:8,border:"none",background:activeChart===k?"rgba(16,185,129,0.2)":"rgba(255,255,255,0.05)",color:activeChart===k?"#10b981":"#64748b",fontSize:11,fontWeight:600,cursor:"pointer"}}>{l}</button>)}</div>
        </div>
        {hourly.length>0?(
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={hourly} barSize={12}>
              <XAxis dataKey="hour" tick={{fill:"#475569",fontSize:9}} axisLine={false} tickLine={false} interval={2}/>
              <YAxis hide/><Tooltip content={({active,payload,label})=>active&&payload?.length?<div style={{background:"#1e293b",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px"}}><div style={{color:"#94a3b8",fontSize:10}}>{label}</div><div style={{color:"#10b981",fontWeight:700}}>{fmtShort(payload[0].value)}</div></div>:null}/>
              <Bar dataKey={activeChart} radius={[4,4,0,0]}>{hourly.map((_,i)=><Cell key={i} fill={i===hourly.length-1?"#10b981":"rgba(16,185,129,0.35)"}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        ):<div style={{textAlign:"center",color:"#475569",padding:"30px 0",fontSize:12}}>Belum ada transaksi hari ini</div>}
      </div>

      <div style={{margin:"0 16px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:16}}>
        <div style={{color:"white",fontWeight:700,fontSize:14,marginBottom:12}}>🏆 Top Penjualan</div>
        {topSelling.length>0?topSelling.map((d,i)=>{
          const pct=Math.round((d.total_revenue/topSelling[0].total_revenue)*100);
          const colors=["#10b981","#6366f1","#f59e0b","#ec4899","#3b82f6"];
          return <div key={d.drug_name} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#e2e8f0",fontSize:12,fontWeight:600}}>{i+1}. {d.drug_name}</span><span style={{color:colors[i],fontSize:12,fontWeight:700}}>{fmtShort(d.total_revenue)}</span></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2}}><div style={{width:`${pct}%`,height:"100%",background:colors[i],borderRadius:2}}/></div></div>;
        }):<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:"12px 0"}}>Belum ada penjualan</div>}
      </div>

      <div style={{margin:"0 16px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{color:"white",fontWeight:700,fontSize:14}}>⚡ Transaksi Terbaru</div><div style={{display:"flex",alignItems:"center",gap:5}}><Pulse/><span style={{color:"#10b981",fontSize:10,fontWeight:600}}>Real-time</span></div></div>
        {recentTx.length===0?<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:"12px 0"}}>Belum ada transaksi</div>
        :[...recentTx].reverse().map((t,i)=>(
          <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:10,background:i===0?"rgba(16,185,129,0.08)":"transparent",marginBottom:4}}>
            <div><div style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{t.staff_name}</div><div style={{fontSize:10,color:"#64748b"}}>{new Date(t.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</div></div>
            <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>+{fmt(t.total)}</div>
          </div>
        ))}
      </div>

      <div style={{margin:"0 16px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:16}}>
        <div style={{color:"white",fontWeight:700,fontSize:14,marginBottom:12}}>🚨 Status Stok</div>
        {critical.length===0?<div style={{textAlign:"center",color:"#10b981",fontSize:12,fontWeight:600,padding:"8px 0"}}>✓ Semua stok aman</div>
        :critical.map(d=>{
          const color=d.stock===0?"#ef4444":"#f59e0b";
          return <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:10,marginBottom:6}}><span>{d.stock===0?"🔴":"🟡"}</span><div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:"#f1f5f9"}}>{d.name}</div><div style={{height:3,background:"#1e293b",borderRadius:2,marginTop:4}}><div style={{width:`${Math.round((d.stock/d.min_stock)*100)}%`,height:"100%",background:color,borderRadius:2}}/></div></div><div style={{fontSize:11,fontWeight:700,color}}>{d.stock===0?"HABIS":`${d.stock}/${d.min_stock}`}</div></div>;
        })}
      </div>

      <div style={{position:"fixed",bottom:24,right:20,zIndex:40}}>
        <button onClick={()=>setShowAI(true)} style={{width:58,height:58,borderRadius:"50%",border:"none",cursor:"pointer",background:"linear-gradient(135deg,#059669,#10b981)",boxShadow:"0 8px 30px rgba(16,185,129,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🤖</button>
        <div style={{position:"absolute",top:-8,right:-4,background:"#ef4444",color:"white",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,border:"2px solid #080f1a"}}>AI</div>
      </div>
      {showAI&&<AIModal onClose={()=>setShowAI(false)} liveData={{revenue,txCount,critical,topSelling}}/>}
    </div>
  );
}
