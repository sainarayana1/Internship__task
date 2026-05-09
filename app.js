/**
 * app.js — UI controller + evaluation framework
 * Zero API calls. All logic in engine.js.
 */

// ─── helpers ───────────────────────────────────
function setEx(btn){
  document.getElementById("promptInput").value = btn.textContent.replace(/^⚡ Edge: /,"").trim();
}

function addLog(msg, type=""){
  const box = document.getElementById("logBox");
  if(box.querySelector(".muted")) box.innerHTML="";
  const d = document.createElement("div");
  d.className = "log-" + type;
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function clearLog(){ document.getElementById("logBox").innerHTML=""; }

const STAGE_IDS = ["s0","s1","s2","s3","s4"];

function markStage(idx, state){
  STAGE_IDS.forEach((id,i)=>{
    const el = document.getElementById(id);
    el.className = "stage-pill";
    if(i < idx) el.classList.add("done");
    else if(i === idx) el.classList.add(state);
  });
}

function allDone(){ STAGE_IDS.forEach(id => document.getElementById(id).className="stage-pill done"); }
function resetStages(){ STAGE_IDS.forEach(id => document.getElementById(id).className="stage-pill"); }

function showTab(name){
  ["intent","design","schema","exec"].forEach(t=>{
    document.getElementById("tab-"+t).style.display = t===name?"block":"none";
  });
  document.querySelectorAll(".tab").forEach((tab,i)=>{
    tab.classList.toggle("active",["intent","design","schema","exec"][i]===name);
  });
}

// JSON syntax highlight
function hl(obj){
  return JSON.stringify(obj,null,2).replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    m=>{
      if(/^"/.test(m)) return /:$/.test(m)?`<span class="jk">${m}</span>`:`<span class="js">${m}</span>`;
      if(/true|false/.test(m)) return `<span class="jb">${m}</span>`;
      if(/null/.test(m)) return `<span class="jl">${m}</span>`;
      return `<span class="jn">${m}</span>`;
    }
  );
}

function renderJSON(id, data){ document.getElementById(id).innerHTML = hl(data); }

// ─── MAIN PIPELINE ─────────────────────────────
function runPipeline(){
  const prompt = document.getElementById("promptInput").value.trim();
  if(!prompt){ alert("Please enter an app description."); return; }

  document.getElementById("runBtn").disabled = true;
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("outputArea").style.display = "none";
  document.getElementById("repairNotice").style.display = "none";
  document.getElementById("ambigNotice").style.display = "none";
  document.getElementById("metricsGrid").style.display = "none";
  clearLog();
  resetStages();

  // Simulate async with setTimeout so UI updates between stages
  setTimeout(()=>{
    try {
      const result = runFullPipeline(prompt, {
        onStageStart(i){ markStage(i,"active"); },
        onStageDone(i){ markStage(i+1,"active"); },
        onLog(msg,type){ addLog(msg,type); },
        onRepair(){ document.getElementById("repairNotice").style.display="block"; }
      });

      renderJSON("tab-intent", result.intent);
      renderJSON("tab-design", result.design);
      renderJSON("tab-schema", result.schema);
      renderJSON("tab-exec",   result.exec);

      if(result.intent.prompt_quality !== "clear" || result.intent.ambiguities.length > 0)
        document.getElementById("ambigNotice").style.display = "block";

      // metrics
      document.getElementById("metricsGrid").style.display = "grid";
      document.getElementById("mLatency").textContent  = result.meta.latency_ms + "ms";
      document.getElementById("mRepairs").textContent  = result.meta.repairs;
      document.getElementById("mStages").textContent   = "5 / 5";
      document.getElementById("mExec").textContent     = result.exec.score;

      document.getElementById("outputArea").style.display = "block";
      showTab("intent");
      allDone();
      addLog(`Pipeline complete in ${result.meta.latency_ms}ms. ${result.exec.verdict}`, result.exec.executable?"ok":"warn");

    } catch(err){
      addLog("Pipeline error: "+err.message,"err");
      STAGE_IDS.forEach(id=>{
        if(document.getElementById(id).classList.contains("active"))
          document.getElementById(id).className="stage-pill error";
      });
    }
    document.getElementById("runBtn").disabled = false;
  }, 50);
}

// ─── EVALUATION FRAMEWORK ──────────────────────
const EVAL_CASES = [
  // 10 real
  {id:1,type:"real",label:"real",prompt:"Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics."},
  {id:2,type:"real",label:"real",prompt:"Task manager with teams, deadlines, file attachments, notifications, and Kanban board."},
  {id:3,type:"real",label:"real",prompt:"E-commerce store with product catalog, cart, checkout, order tracking, and admin panel."},
  {id:4,type:"real",label:"real",prompt:"Project management SaaS with sprints, tickets, comments, team workspaces, and reporting dashboards."},
  {id:5,type:"real",label:"real",prompt:"Online learning platform with courses, video lessons, quizzes, progress tracking, and certificate generation."},
  {id:6,type:"real",label:"real",prompt:"Healthcare patient portal with appointment booking, medical records, prescription refills, and doctor messaging."},
  {id:7,type:"real",label:"real",prompt:"HR management system with employee profiles, leave requests, payroll, org chart, and performance reviews."},
  {id:8,type:"real",label:"real",prompt:"Food delivery app with restaurant listings, menus, cart, real-time order tracking, and driver assignment."},
  {id:9,type:"real",label:"real",prompt:"Real estate platform with property listings, filters, agent profiles, appointment booking, and admin panel."},
  {id:10,type:"real",label:"real",prompt:"Inventory management for retail with stock tracking, purchase orders, supplier management, and low-stock alerts."},
  // 10 edge
  {id:11,type:"edge",label:"edge (vague)",      prompt:"Make something"},
  {id:12,type:"edge",label:"edge (vague)",      prompt:"Build everything."},
  {id:13,type:"edge",label:"edge (conflicting)",prompt:"App with login but no accounts needed, free but also premium, simple but also enterprise."},
  {id:14,type:"edge",label:"edge (conflicting)",prompt:"Social platform with payments and AI and admin and real-time and also offline."},
  {id:15,type:"edge",label:"edge (incomplete)", prompt:"CRM"},
  {id:16,type:"edge",label:"edge (incomplete)", prompt:"dashboard"},
  {id:17,type:"edge",label:"edge (conflicting)",prompt:"Airbnb for renting tools where host is also renter and payment happens before and after and during."},
  {id:18,type:"edge",label:"edge (vague)",      prompt:"I need an app for my business."},
  {id:19,type:"edge",label:"edge (conflicting)",prompt:"Twitter clone with moderation, no ads but monetized, verified badges, and dark mode."},
  {id:20,type:"edge",label:"edge (incomplete)", prompt:"inventory"},
];

function runEval(){
  const btn = document.getElementById("evalBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Running…";

  const area = document.getElementById("evalArea");
  const tbody = document.getElementById("evalBody");
  area.style.display = "block";
  tbody.innerHTML = "";

  let pass=0, totalRepairs=0, totalMs=0, failTypes={};

  EVAL_CASES.forEach(tc=>{
    const tr = document.createElement("tr");
    tr.innerHTML=`<td>${tc.id}</td><td style="max-width:220px;font-size:11px">${tc.prompt.slice(0,90)}${tc.prompt.length>90?"…":""}</td><td class="type-${tc.type}">${tc.label}</td><td id="es-${tc.id}">…</td><td id="er-${tc.id}">–</td><td id="esc-${tc.id}">–</td><td id="el-${tc.id}">–</td>`;
    tbody.appendChild(tr);

    try {
      const r = runFullPipeline(tc.prompt, { onLog:()=>{}, onStageStart:()=>{}, onStageDone:()=>{}, onRepair:()=>{} });
      const ok = r.exec.executable;
      if(ok) pass++;
      totalRepairs += r.meta.repairs;
      totalMs += r.meta.latency_ms;
      if(!ok){ const ft = tc.label.includes("edge") ? tc.label : "schema_issue"; failTypes[ft]=(failTypes[ft]||0)+1; }

      document.getElementById(`es-${tc.id}`).innerHTML  = ok ? '<span class="badge badge-ok">✓ Pass</span>' : '<span class="badge badge-warn">⚠ Partial</span>';
      document.getElementById(`er-${tc.id}`).textContent = r.meta.repairs;
      document.getElementById(`esc-${tc.id}`).textContent= r.exec.score;
      document.getElementById(`el-${tc.id}`).textContent = r.meta.latency_ms+"ms";
    } catch(e){
      failTypes["error"]=(failTypes["error"]||0)+1;
      document.getElementById(`es-${tc.id}`).innerHTML = '<span class="badge badge-fail">✗ Error</span>';
    }
  });

  const total = EVAL_CASES.length;
  const avgMs = Math.round(totalMs/total);
  const rate  = Math.round(pass/total*100);

  document.getElementById("evalSummary").style.display="grid";
  document.getElementById("evalSummary").innerHTML=`
    <div class="mcard"><div class="mval" style="color:${rate>=70?"#085041":"#A32D2D"}">${rate}%</div><div class="mlabel">Success rate</div></div>
    <div class="mcard"><div class="mval">${pass}/${total}</div><div class="mlabel">Cases passed</div></div>
    <div class="mcard"><div class="mval">${totalRepairs}</div><div class="mlabel">Total repairs</div></div>
    <div class="mcard"><div class="mval">${avgMs}ms</div><div class="mlabel">Avg latency</div></div>
    <div class="mcard" style="grid-column:span 2">
      <div class="mlabel" style="text-align:left;margin-bottom:5px">Failure breakdown</div>
      <div>${Object.entries(failTypes).map(([k,v])=>`<span class="badge badge-warn" style="margin:2px">${k}: ${v}</span>`).join("")||'<span style="color:#085041">No failures ✓</span>'}</div>
    </div>
  `;

  btn.disabled=false;
  btn.textContent="▶ Run Full Evaluation";
}
