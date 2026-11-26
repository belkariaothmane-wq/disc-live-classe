"use strict";
const root=document.querySelector("#app");
const appRole=location.pathname.slice(1)||"home";
const phases=["Comprendre le DISC","Mes réflexes","Mes attentes","Jeu en binôme"];
const {traits}=DISC;
const authKey="disc-live-"+appRole;
let auth="", state=null, view="students", person="", pending=false, signature="", statusTimer;
let draftKey="", answers=[], question=0;
let pairSelected=null, pairId=null;
const demoPerson={id:"lina",name:"Lina",avatar:"fille",reflexes:[6,2,5,3],attentes:[2,3,4,7]};
const demoPair={id:"pair",manager:"Lina",collaborator:"Yanis",managerReady:true,collaboratorReady:true,mAnswer:0,cAnswer:2};
let demo=false, personal=false, polling=false, revision=0;
try {auth=sessionStorage.getItem(authKey)||"";signature=localStorage.getItem("disc-signature")||"";}catch{}
const e=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const button=(label,action,options={})=>`<button type="button" data-action="${action}" ${options.value===undefined?"":`data-value="${e(options.value)}"`} ${options.primary?'class="primary"':""} ${options.disabled?"disabled":""} ${options.pressed===undefined?"":`aria-pressed="${options.pressed}"`}>${e(label)}</button>`;
const sum=values=>values.reduce((a,b)=>a+b,0);
const share=(n,total)=>total?new Intl.NumberFormat("fr",{maximumFractionDigits:2}).format(n*100/total):"0";
const badge=t=>`<span class="badge ${t.id.toLowerCase()}" style="--tone:${t.color}">${t.id}</span>`;
const panel=(content,classes="")=>`<section class="panel ${classes}">${content}</section>`;

function notify(message) {
  const notice=document.querySelector("#notice");
  notice.textContent=message;
  clearTimeout(statusTimer);
  statusTimer=setTimeout(()=>{notice.textContent="";},6500);
}
function setAuth(value) {
  auth=value;
  try {sessionStorage.setItem(authKey,value);}catch{}
}
async function call(route,payload) {
  const headers=auth?{Authorization:"Bearer "+auth}:{};
  if(payload)headers["Content-Type"]="application/json";
  const response=await fetch("/api/"+route,{method:payload?"POST":"GET",headers,
    body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(8000)});
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(data.error),{status:response.status});
  return data;
}
function legend(scores) {
  const total=sum(scores);
  return `<ul class="legend">${traits.map((t,i)=>`<li><i style="--tone:${t.color}"></i><span><strong>${t.id}</strong> · ${t.label}</span><strong>${share(scores[i],total)} %</strong></li>`).join("")}</ul>`;
}
function profile(title,scores,avatar,groupCount) {
  if(!scores)return panel(`<h3>${title}</h3><p class="muted">Questionnaire à compléter.</p>`);
  const total=sum(scores);
  const stack=`<div class="stack" aria-hidden="true">${traits.map((t,i)=>`<span style="--tone:${t.color};--part:${total?scores[i]*100/total:0}%"></span>`).join("")}</div>`;
  const prominent=traits.filter((_,i)=>scores[i]===Math.max(...scores));
  const notes=avatar&&total?`<div class="sample">${prominent.map(t=>`<p><strong>${t.label}</strong><br>${t.strength}<br><strong>Point de vigilance</strong> · ${t.limit}</p>`).join("")}</div>`:"";
  return panel(`<h3>${title}</h3>${groupCount===undefined?"":`<p class="muted">${groupCount} questionnaire(s) terminé(s)</p>`}
    ${avatar?`<div class="figure"><canvas class="silhouette" width="160" height="246" aria-hidden="true" data-avatar="${e(avatar)}" data-scores="${scores.join(",")}"></canvas>${legend(scores)}</div>`:total?stack+legend(scores):'<p>Aucun questionnaire terminé.</p>'}${notes}`);
}
function studentProfile(student) {
  return `<h2>${e(student.name)} · Mon positionnement</h2><div class="columns">${profile("Mes réflexes",student.reflexes,student.avatar)}${profile("Mes attentes",student.attentes,student.avatar)}</div>
  <p class="muted">Les pourcentages correspondent aux réponses de l’exercice. Selon la situation, vous pouvez mobiliser plusieurs tendances.</p>`;
}
function groups(data) {
  return `<div class="columns">${profile("Comment le groupe agit",data.reflexes.scores,null,data.reflexes.count)}${profile("Ce que le groupe attend d’un manager",data.attentes.scores,null,data.attentes.count)}</div>`;
}
function lesson() {
  return `<p class="eyebrow">Comprendre la méthode</p><h2>Quatre façons d’aborder le travail</h2><p>Le DISC propose quatre tendances comportementales. Nous pouvons combiner ces tendances selon la situation, la tâche ou la personne avec qui nous travaillons.</p>
  <div class="tiles">${traits.map(t=>panel(`${badge(t)}<h3>${t.label}</h3><p>${t.description}</p><p><strong>Point de vigilance</strong><br>${t.limit}</p>`,"trait").replace('class="panel trait"',`class="panel trait" style="--tone:${t.color}"`)).join("")}</div>
  <p class="sample"><strong>À discuter</strong><br>Quand votre réflexe aide-t-il l’équipe ? À partir de quand peut-il la freiner ?</p>`;
}
function pairCompare(pair) {
  const choices=[{label:"Manager",name:pair.manager,ready:pair.managerReady,index:pair.mAnswer,items:DISC.manager},
    {label:"Collaborateur",name:pair.collaborator,ready:pair.collaboratorReady,index:pair.cAnswer,items:DISC.collaborateur}];
  const ready=choices.every(x=>Number.isInteger(x.index));
  const same=pair.mAnswer===pair.cAnswer;
  return `<div class="columns">${choices.map(x=>panel(`<p class="eyebrow">${x.label}</p><h3>${e(x.name)}</h3>${ready?badge(traits[x.index])+e(x.items[x.index]):`<p>${x.ready?"Réponse enregistrée":"En attente de réponse"}</p>`}`,"pair-choice").replace('class="panel pair-choice"',`class="panel pair-choice" style="--tone:${ready?traits[x.index].color:"#b5c1d4"}"`)).join("")}</div>
    ${ready?`<p class="sample"><strong>${same?"Même priorité":"Priorités différentes"}</strong><br>${same?"Avez-vous choisi cette option pour la même raison ?":"Comment le manager peut-il tenir l’échéance en tenant compte de ce dont le collaborateur a besoin ?"} Reformulez ensemble la première phrase du manager.</p>`:""}`;
}
function home() {
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">Atelier management</p><h1>DISC LIVE</h1><p>Repérer vos réflexes, comprendre ce que l’autre attend et adapter votre façon de manager.</p><div class="row"><a class="btn primary" href="/teacher">Préparer une séance</a><a class="btn" href="/student">Rejoindre une séance</a></div></div>
    <div class="hero-visual"><div class="deck-art" aria-hidden="true">${traits.map(t=>`<div style="--tone:${t.color}">${t.id}</div>`).join("")}</div><img id="signature" class="signature" alt="Signature illustrée Management" hidden></div></section>
    <section class="tiles" aria-label="Déroulé">${phases.map((title,i)=>panel(`<h3>${title}</h3><p>${["Les quatre tendances et leurs limites.","Votre manière d’agir en situation.","Ce qui vous aide à avancer.","Comparer une décision et une attente."][i]}</p>`)).join("")}</section>
    <label class="signature-upload">Ajouter la signature « Management » à cet aperçu <input id="signature-file" type="file" accept="image/png,image/jpeg,image/webp"></label>`;
}
function signIn() {
  return panel(`<p class="eyebrow">Tableau de bord</p><h1>Espace enseignant</h1><form id="login" class="label-form"><label for="password">Mot de passe enseignant</label><input id="password" name="password" type="password" required autocomplete="current-password"><button class="primary">Se connecter</button></form><p class="watch">${button("Voir la démonstration","demo")}</p>`,"narrow");
}
function join() {
  const code=new URLSearchParams(location.search).get("code")||"";
  return panel(`<p class="eyebrow">Espace étudiant</p><h1>Rejoindre la séance</h1><form id="join" class="label-form">
  <label for="code">Code de séance</label><input id="code" name="code" required maxlength="8" value="${e(code)}">
  <label for="name">Prénom</label><input id="name" name="name" required maxlength="40" autocomplete="given-name">
  <label for="avatar">Silhouette du bilan</label><select id="avatar" name="avatar"><option value="neutre">Neutre</option><option value="fille">Fille</option><option value="garçon">Garçon</option></select>
  <p class="muted">L’enseignant peut consulter vos bilans et vos réponses de binôme. Le bilan de groupe s’affiche sous forme agrégée.</p><button class="primary">Rejoindre</button></form>`,"narrow");
}
function teacher() {
  if(!state)return signIn();
  const selected=state.students.find(s=>s.id===person);
  const steps=`<div class="tabs" aria-label="Étape projetée">${phases.map((title,i)=>button(title,"phase",{value:i,pressed:state.phase===i})).join("")}</div>`;
  const views=`<div class="row watch">${["students","groups","pairs","lesson"].map((id,i)=>button(["Étudiants","Bilan du groupe","Binômes","Support de cours"][i],"view",{value:id,pressed:id===view})).join("")}</div>`;
  const roster=state.students.length?`<div class="roster">${state.students.map(s=>`<button type="button" data-action="person" data-value="${e(s.id)}"><strong>${e(s.name)}</strong><span>${Number(Boolean(s.reflexes))+Number(Boolean(s.attentes))}/2 questionnaires</span></button>`).join("")}</div>`:"<p>Aucun étudiant inscrit pour le moment.</p>";
  let contents=lesson();
  if(view==="students")contents=`<h2>Suivi des étudiants</h2>${roster}${selected?`<div class="watch">${studentProfile(selected)}</div>`:""}`;
  if(view==="groups")contents=`<h2>Bilan du groupe</h2>${groups(state.groups)}${button(state.reveal?"Masquer sur la projection":"Afficher sur la projection","reveal",{primary:true})}`;
  if(view==="pairs"){
    const assigned=new Set(state.pairs.flatMap(p=>[p.manager,p.collaborator]));
    const available=state.students.filter(p=>!assigned.has(p.name));
    const options=available.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join("");
    contents=`<h2>Binômes</h2><p class="context">${DISC.scene}</p>
    <form id="pair" class="row watch"><label>Manager <select name="m" required><option value="">Choisir</option>${options}</select></label><label>Collaborateur <select name="c" required><option value="">Choisir</option>${options}</select></label><button ${available.length<2?"disabled":""}>Former le binôme</button></form>
    ${state.pairs.map(p=>panel(`${pairCompare(p)}<div class="row watch">${button(p.id===state.projectedPair?"Retirer de la projection":"Projeter ce binôme","project-pair",{value:p.id,disabled:!p.managerReady||!p.collaboratorReady||state.phase!==3})}
      ${button("Dissoudre le binôme","unpair",{value:p.id})}</div>`)).join("")}`;
  }
  return `<p class="eyebrow">${demo?"Démonstration":"Pilotage de la séance"}</p><h1>Espace enseignant</h1>${steps}
  <div class="teacher-shell"><div>${panel(views+contents)}</div><aside>${panel(`<h2>Accès étudiant</h2><p>Code de séance <strong>${e(state.code)}</strong></p>
  <p>${state.students.length} inscrit(s)</p><div class="row">${demo?"":`<a class="btn" href="/student?code=${e(state.code)}" target="_blank" rel="noopener">Lien étudiant</a>${button("Copier le lien","copy")}`}<a class="btn" href="/projection" target="_blank" rel="noopener">Ouvrir la projection</a></div>${demo?button("Quitter la démonstration","exit-demo"):button("Nouvelle séance","reset")}`)}</aside></div>`;
}
function questionnaire(key) {
  if(key!==draftKey){draftKey=key;question=0;try{answers=JSON.parse(sessionStorage.getItem("disc-draft-"+auth+"-"+key))||[];}catch{answers=[];}}
  const item=DISC[key][question];
  const permutation=Array.from({length:4},(_,i)=>(i+question+Math.floor(question/4))%4);
  return panel(`<p class="eyebrow">${key==="reflexes"?"Comment j’agis":"Ce que j’attends de mon manager"} · ${question+1}/${DISC[key].length}</p>
  <progress max="${DISC[key].length}" value="${answers.filter(Number.isInteger).length}" aria-label="Progression"></progress>
  <h2>${e(item[0])}</h2><div class="answers">${permutation.map(i=>button(item[i+1],"option",{value:i,pressed:answers[question]===i})).join("")}</div>
  <div class="row form-actions">${button("Précédente","prev",{disabled:question===0})}${button(question===DISC[key].length-1?"Voir mon bilan":"Suivante","next",{primary:true,disabled:!Number.isInteger(answers[question])})}</div>`,"narrow");
}
function student() {
  if(!state)return join();
  if(personal)return panel(`<div class="row watch">${button("Revenir à l’activité","personal")}</div>${studentProfile(state.me)}`);
  if(state.phase===0)return panel(`<p class="eyebrow">${e(state.me.name)}</p>${lesson()}`);
  const key=state.phase===1?"reflexes":state.phase===2?"attentes":null;
  if(key&&!state.me[key])return questionnaire(key);
  if(state.phase===3){
    const pair=state.pair;
    if(!pair)return panel(`<h2>${e(state.me.name)}</h2><p>L’enseignant prépare les binômes.</p>`,"narrow");
    if(pairId!==pair.id){pairId=pair.id;pairSelected=null;}
    if(pair.answered)return panel(`<p class="eyebrow">Votre binôme</p><h2>${DISC.scene}</h2>${pairCompare(pair)}`);
    const manager=pair.role==="manager";
    return panel(`<p class="eyebrow">${e(state.me.name)} · ${manager?"Manager":"Collaborateur"}</p><h2>${DISC.scene}</h2>
    <p>${manager?"Que feriez-vous en premier ?":"Qu’attendriez-vous en priorité de votre manager ?"}</p>
    <div class="answers">${DISC[pair.role].map((text,i)=>button(text,"pair-option",{value:i,pressed:pairSelected===i})).join("")}</div>
    ${button("Valider ma réponse","pair-answer",{primary:true,disabled:pairSelected===null})}`,"narrow");
  }
  return panel(studentProfile(state.me));
}
function projection() {
  if(!state)return panel("<h1>Connexion à la séance…</h1>");
  if(state.groups)return panel(`<h1>Tendances du groupe</h1>${groups(state.groups)}`);
  if(state.phase===0)return panel(`<h1>Comprendre le DISC</h1>${lesson()}`);
  if(state.phase===3&&state.pair)return panel(`<h1>${DISC.scene}</h1>${pairCompare(state.pair)}`);
  if(state.phase===3)return panel(`<h1>Jeu en binôme</h1><p class="sample">${DISC.scene}</p><p>Répondez sur votre téléphone selon votre rôle.</p>`);
  return panel(`<h1>${phases[state.phase]}</h1><p>Répondez au questionnaire sur votre téléphone.</p>`);
}
function drawAvatar(canvas) {
  const scores=canvas.dataset.scores.split(",").map(Number);
  const shape=canvas.dataset.avatar;
  const ctx=canvas.getContext("2d");
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(80,35,25,29,0,0,Math.PI*2);
  if(shape==="fille"){ctx.moveTo(102,30);ctx.ellipse(104,45,14,27,-.25,0,Math.PI*2);}
  if(shape==="garçon")ctx.roundRect(58,10,45,20,6);
  ctx.moveTo(69,62);ctx.lineTo(92,62);ctx.lineTo(98,69);
  ctx.quadraticCurveTo(117,68,126,90);ctx.lineTo(145,150);ctx.quadraticCurveTo(145,161,133,161);
  ctx.lineTo(109,111);ctx.lineTo(shape==="fille"?118:108,178);ctx.lineTo(104,229);ctx.quadraticCurveTo(102,243,89,238);
  ctx.lineTo(80,184);ctx.lineTo(70,238);ctx.quadraticCurveTo(56,243,54,229);ctx.lineTo(45,178);
  ctx.lineTo(51,111);ctx.lineTo(27,161);ctx.quadraticCurveTo(15,161,15,150);ctx.lineTo(35,90);
  ctx.quadraticCurveTo(43,68,62,69);ctx.closePath();
  ctx.clip();
  let y=6;
  scores.forEach((n,i)=>{const height=235*n/sum(scores);ctx.fillStyle=traits[i].color;ctx.fillRect(0,y,160,height+.3);y+=height;});
  ctx.restore();
}
function render() {
  document.body.classList.toggle("projector",appRole==="projection");
  const pairValues = [...root.querySelectorAll("#pair select")].map(select=>select.value);
  root.innerHTML=({home,teacher,student,projection}[appRole]||home)();
  root.querySelectorAll("#pair select").forEach((select,i)=>{
    if([...select.options].some(option=>option.value===pairValues[i]))select.value=pairValues[i];
  });
  if(appRole==="student" && !personal && state?.phase===3 && (state.me.reflexes||state.me.attentes)) {
    root.insertAdjacentHTML("afterbegin",`<div class="row watch">${button("Mes bilans","personal")}</div>`);
  }
  root.querySelectorAll("canvas").forEach(drawAvatar);
  const img=root.querySelector("#signature");
  if(img){
    img.onload=()=>{img.hidden=false;};
    img.onerror=()=>{img.hidden=true;};
    img.src=signature||"/assets/signature.jpg";
  }
}
async function run(task) {
  if(pending)return;
  pending=true;
  revision++;
  try {await task();render();}
  catch(error){notify(error.message||"Connexion indisponible.");}
  finally{pending=false;}
}
async function teacherAction(payload) {
  if(!demo){state=await call("teacher",payload);return;}
  if(payload.action==="phase")state.phase=payload.phase;
  if(payload.action==="reveal")state.reveal=payload.value;
}
root.addEventListener("click",event=>{
  const target=event.target.closest("[data-action]");
  if(!target||target.disabled)return;
  const {action,value}=target.dataset;
  if(action==="personal"){personal=!personal;render();return;}
  if(action==="view"){view=value;render();return;}
  if(action==="person"){person=value;render();return;}
  if(action==="demo"){
    demo=true;state={code:"DÉMO",phase:0,students:[demoPerson,{id:"yanis",name:"Yanis",avatar:"garçon",reflexes:[4,4,6,2],attentes:[3,3,8,2]}],pairs:[demoPair],
      groups:{reflexes:{count:2,scores:[10,6,11,5]},attentes:{count:2,scores:[5,6,12,9]}}};render();return;
  }
  if(action==="exit-demo"){demo=false;state=null;render();return;}
  if(action==="copy"){navigator.clipboard.writeText(location.origin+"/student?code="+state.code).then(()=>notify("Lien copié.")).catch(()=>notify("Copiez l’adresse du lien étudiant."));return;}
  if(action==="option"){
    answers[question]=Number(value);
    try{sessionStorage.setItem("disc-draft-"+auth+"-"+draftKey,JSON.stringify(answers));}catch{}
    render();return;
  }
  if(action==="prev"){question--;render();return;}
  if(action==="next"){
    if(question<DISC[draftKey].length-1){question++;render();return;}
    const missing=DISC[draftKey].findIndex((_,i)=>!Number.isInteger(answers[i]));
    if(missing>=0){question=missing;render();return;}
    run(async()=>{state=await call("student",{action:"questionnaire",key:draftKey,answers});});
    return;
  }
  if(action==="pair-option"){pairSelected=Number(value);render();return;}
  if(action==="pair-answer"){run(async()=>{state=await call("student",{action:"answer",pair:state.pair.id,choice:pairSelected});});return;}
  if(action==="reset"&&!confirm("Ouvrir une nouvelle séance et vider les résultats actuels ?"))return;
  if(action==="unpair"&&!confirm("Dissoudre ce binôme et effacer ses réponses ?"))return;
  const inputs={
    phase:{phase:Number(value)},reveal:{value:!state.reveal},reset:{},
    unpair:{id:value},"project-pair":{id:state.projectedPair===value?null:value}
  };
  if(Object.hasOwn(inputs,action))run(()=>teacherAction({action,...inputs[action]}));
});
root.addEventListener("submit",event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(event.target));
  if(event.target.id==="login")run(async()=>{setAuth((await call("login",data)).token);state=await call("teacher");});
  if(event.target.id==="join")run(async()=>{const dataIn=await call("join",data);setAuth(dataIn.token);state=dataIn.state;draftKey="";});
  if(event.target.id==="pair")run(()=>teacherAction({action:"pair",...data}));
});
root.addEventListener("change",event=>{
  if(event.target.id!=="signature-file")return;
  const file=event.target.files[0];
  if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5_000_000)return notify("Choisissez une image PNG, JPG ou WebP de 5 Mo maximum.");
  const reader=new FileReader();
  reader.onload=()=>{
    signature=reader.result;
    try{localStorage.setItem("disc-signature",signature);}catch{notify("L’image sera affichée pour cet aperçu.");}
    render();
  };
  reader.readAsDataURL(file);
});
async function poll() {
  if(pending||polling||demo||appRole==="home"||(!auth&&appRole!=="projection"))return;
  polling=true;
  const requestRevision=revision;
  try{
    const next=await call(appRole);
    if(requestRevision===revision&&!demo&&JSON.stringify(next)!==JSON.stringify(state)){state=next;render();}
  }catch(error){
    if(requestRevision===revision&&error.status===401){setAuth("");state=null;render();notify(error.message);}
  }finally{polling=false;}
}
render();
poll();
setInterval(poll,1600);
