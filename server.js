"use strict";
require("./content");
const QRCode = require("qrcode");
const http = require("node:http");
const fs = require("node:fs");
const {randomBytes,timingSafeEqual,createHash} = require("node:crypto");
const token = () => randomBytes(24).toString("hex");
const password = process.env.TEACHER_PASSWORD || token();
if (process.env.RENDER === "true" && !process.env.TEACHER_PASSWORD) throw Error("TEACHER_PASSWORD requis.");
const admin = token();
const hash = text => createHash("sha256").update(text).digest();
function option(name) {
  const index=process.argv.indexOf(name,2);
  return index<0?undefined:process.argv[index+1];
}
const port = Number(process.env.PORT || option("--port") || 3000);
const host = option("--host") || "0.0.0.0";
let room = makeRoom();

function makeRoom() {
  return {code:randomBytes(4).toString("hex").toUpperCase(), phase:0, chapter:0, example:0,
    students:[], pairs:[], reveal:null, projectedPair:null, projectedStudent:null, invite:false};
}
function summary(key, students) {
  const completed = students.filter(student => student[key]);
  return {count:completed.length, scores:[0,1,2,3].map(i => completed.reduce((sum,p) => sum+p[key][i],0))};
}
function aggregates() {
  return {reflexes:summary("reflexes",room.students), attentes:summary("attentes",room.students)};
}
function pairView(pair, current) {
  const m = room.students.find(s=>s.id===pair.m);
  const c = room.students.find(s=>s.id===pair.c);
  const ready = Number.isInteger(pair.mAnswer) && Number.isInteger(pair.cAnswer);
  return {id:pair.id, caseId:pair.caseId, manager:m.name, collaborator:c.name, managerReady:Number.isInteger(pair.mAnswer),
    collaboratorReady:Number.isInteger(pair.cAnswer), ...(ready ? {mAnswer:pair.mAnswer,cAnswer:pair.cAnswer} : {}),
    ...(current ? {role:current.id===pair.m?"manager":"collaborateur", answered:Number.isInteger(current.id===pair.m?pair.mAnswer:pair.cAnswer)} : {})};
}
function publicProfile({name,avatar,reflexes,attentes}) {
  return {name,avatar,reflexes,attentes};
}
function state(role, credential) {
  const base = {phase:room.phase};
  if (role==="teacher") return {...base, chapter:room.chapter, example:room.example, code:room.code, reveal:room.reveal, projectedPair:room.projectedPair, projectedStudent:room.projectedStudent, invite:room.invite,
    students:room.students.map(({id,name,avatar,reflexes,attentes})=>({id,name,avatar,reflexes,attentes})),
    pairs:room.pairs.map(pair=>pairView(pair)), groups:aggregates()};
  if (role==="student") {
    const me = room.students.find(s=>s.token===credential);
    if (!me) return null;
    const pair=room.pairs.find(p=>p.m===me.id||p.c===me.id);
    return {...base, me:{name:me.name,avatar:me.avatar,reflexes:me.reflexes,attentes:me.attentes}, pair:pair?pairView(pair,me):null};
  }
  const pair = room.phase===3 && room.pairs.find(p=>p.id===room.projectedPair);
  const student=room.students.find(p=>p.id===room.projectedStudent);
  return {...base, chapter:room.chapter, example:room.example, invite:room.invite?room.code:null, student:student?publicProfile(student):null, group:room.reveal?{key:room.reveal,...summary(room.reveal,room.students)}:null, pair:pair?pairView(pair):null};
}
function send(res,status,body,type="application/json") {
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"});
  res.end(type==="application/json"?JSON.stringify(body):body);
}
async function read(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw Error("Format de requête incorrect.");
  let input=""; req.setEncoding("utf8");
  for await (const chunk of req) {input+=chunk;if(input.length>8000) throw Error("Requête trop longue.");}
  return JSON.parse(input);
}
function clearProjection() {
  room.reveal=null;
  room.projectedPair=null;
  room.projectedStudent=null;
  room.invite=false;
}
function command(data) {
  const {action} = data;
  if (action==="phase" && Number.isInteger(data.phase) && data.phase>=0 && data.phase<=3) {
    if(room.phase!==data.phase)clearProjection();
    room.phase=data.phase;
  } else if (action==="lesson") {
    if(!Number.isInteger(data.chapter) || data.chapter<0 || data.chapter>=DISC.lesson.chapters.length) throw Error("Chapitre inconnu.");
    room.chapter=data.chapter;
  } else if (action==="lesson-example") {
    if (!Number.isInteger(data.example) || !DISC.roleExamples[data.example]) throw Error("Exemple inconnu.");
    room.example=data.example;
  } else if (action==="project-group" && [null,"reflexes","attentes"].includes(data.key)) {
    clearProjection();
    room.reveal=data.key;
  } else if (action==="project-student") {
    const student=room.students.find(p=>p.id===data.id);
    if(data.id!==null && !student?.reflexes && !student?.attentes) throw Error("Aucun bilan terminé pour cet étudiant.");
    clearProjection();
    room.projectedStudent=data.id;
  } else if (action==="project-invite" && typeof data.value==="boolean") {
    clearProjection();
    room.invite=data.value;
  } else if (action==="reset") room=makeRoom();
  else if (action==="pair") {
    if (data.m===data.c || ![data.m,data.c].every(id=>room.students.some(s=>s.id===id)) ||
        room.pairs.some(pair=>[data.m,data.c].some(id=>id===pair.m||id===pair.c))) throw Error("Choisissez deux étudiants disponibles.");
    const caseId = data.caseId ?? DISC.pairCases.find(item=>!room.pairs.some(pair=>pair.caseId===item.id))?.id ?? DISC.pairCases[0].id;
    if(!DISC.pairCases.some(item=>item.id===caseId)) throw Error("Situation inconnue.");
    room.pairs.push({id:token(),m:data.m,c:data.c,caseId});
  } else if (action==="unpair" && room.pairs.some(pair=>pair.id===data.id)) {
    room.pairs=room.pairs.filter(pair=>pair.id!==data.id);
    if(room.projectedPair===data.id) room.projectedPair=null;
  } else if (action==="project-pair") {
    const pair=room.pairs.find(p=>p.id===data.id);
    if(data.id!==null && (!pair || !Number.isInteger(pair.mAnswer) || !Number.isInteger(pair.cAnswer))) throw Error("Attendez les deux réponses.");
    clearProjection();
    room.projectedPair=data.id;
  } else throw Error("Commande indisponible.");
}

const staticRoutes = new Map([
  ["/",["index.html","text/html; charset=utf-8"]],["/teacher",["index.html","text/html; charset=utf-8"]],
  ["/student",["index.html","text/html; charset=utf-8"]],["/projection",["index.html","text/html; charset=utf-8"]],
  ["/app.js",["app.js","text/javascript; charset=utf-8"]],["/content.js",["content.js","text/javascript; charset=utf-8"]],
  ["/style.css",["style.css","text/css; charset=utf-8"]],["/assets/signature.jpg",["assets/signature.jpg","image/jpeg"]]
]);
const server = http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://localhost");
    const route=url.pathname;
    const method=req.method;
    const credential=req.headers.authorization?.replace(/^Bearer /,"");
    if(method==="GET"&&route==="/invite-qr.png"){
      const code=url.searchParams.get("code");
      if(!room.invite||code!==room.code) return send(res,404,{error:"Invitation indisponible."});
      const scheme=req.socket?.encrypted||req.headers["x-forwarded-proto"]==="https"?"https":"http";
      const origin=process.env.RENDER_EXTERNAL_URL || scheme+"://"+(req.headers.host||"localhost:"+port);
      const target=new URL("/student",origin);
      target.searchParams.set("code",code);
      const png=await QRCode.toBuffer(target.href,{width:640,margin:4,errorCorrectionLevel:"M"});
      if(!room.invite||room.code!==code) return send(res,404,{error:"Invitation indisponible."});
      return send(res,200,png,"image/png");
    }
    if(method==="GET"&&route==="/health") return send(res,200,{ok:true});
    if(method==="GET"&&staticRoutes.has(route)){
      const [file,type]=staticRoutes.get(route);
      return send(res,200,fs.readFileSync(__dirname+"/"+file),type);
    }
    if(method==="POST"&&route==="/api/login"){
      const data=await read(req);
      if(typeof data?.password!=="string"||!timingSafeEqual(hash(data.password),hash(password))) return send(res,401,{error:"Mot de passe incorrect."});
      return send(res,200,{token:admin});
    }
    if(route==="/api/teacher"){
      if(credential!==admin) return send(res,401,{error:"Connexion enseignant requise."});
      if(method==="POST") command(await read(req));
      if(method==="GET"||method==="POST") return send(res,200,state("teacher"));
    }
    if(method==="GET"&&route==="/api/projection") return send(res,200,state("projection"));
    if(method==="POST"&&route==="/api/join"){
      const data=await read(req);
      if(String(data?.code||"").trim().toUpperCase()!==room.code) return send(res,404,{error:"Code de séance inconnu ou expiré."});
      const name=typeof data.name==="string"?data.name.normalize("NFC").trim().replace(/ +/g," "):"";
      if(!name||name.length>40||!/^\p{L}[\p{L}\p{M} .’'-]*$/u.test(name)) throw Error("Saisissez un prénom valide.");
      if(!["fille","garçon","neutre"].includes(data.avatar)) throw Error("Silhouette inconnue.");
      if(room.students.some(s=>s.name.toLocaleLowerCase("fr")===name.toLocaleLowerCase("fr"))) throw Error("Ce prénom est déjà utilisé. Ajoutez l’initiale de votre nom.");
      if(room.students.length>=300) throw Error("Cette séance est complète.");
      const student={id:token(),token:token(),name,avatar:data.avatar,reflexes:null,attentes:null};
      room.students.push(student);
      return send(res,200,{token:student.token,state:state("student",student.token)});
    }
    if(route==="/api/student"){
      const data=method==="POST"?await read(req):null;
      const student=room.students.find(s=>s.token===credential);
      if(!student) return send(res,401,{error:"Rejoignez la séance avec son code."});
      if(method==="POST"){
        if(data.action==="questionnaire"){
          const key=room.phase===1?"reflexes":room.phase===2?"attentes":null;
          if(!key||key!==data.key) throw Error("Ce questionnaire est fermé.");
          if(!student[key]){
            const answers=data.answers;
            if(!Array.isArray(answers)||answers.length!==DISC[key].length||answers.some(a=>!Number.isInteger(a)||a<0||a>3)) throw Error("Toutes les questions doivent être renseignées.");
            student[key]=[0,1,2,3].map(t=>answers.filter(a=>a===t).length);
          }
        } else if(data.action==="answer"){
          const pair=room.phase===3&&room.pairs.find(p=>p.id===data.pair&&(p.m===student.id||p.c===student.id));
          if(!pair||!Number.isInteger(data.choice)||data.choice<0||data.choice>3) throw Error("Ce binôme est indisponible.");
          const field=pair.m===student.id?"mAnswer":"cAnswer";
          if(!Number.isInteger(pair[field]))pair[field]=data.choice;
        } else throw Error("Action inconnue.");
      }
      if(method==="GET"||method==="POST") return send(res,200,state("student",credential));
    }
    return send(res,404,{error:"Page introuvable."});
  }catch(e){if(!res.headersSent&&!res.destroyed)send(res,e.code==="ENOENT"?404:400,{error:e.code==="ENOENT"?"Fichier introuvable.":e.message});}
});

if (require.main === module) server.listen(port,host,()=>{
  console.log("DISC LIVE · http://localhost:"+port+"/teacher");
  if(!process.env.TEACHER_PASSWORD)console.log("Mot de passe local temporaire : "+password);
});

module.exports = server;
