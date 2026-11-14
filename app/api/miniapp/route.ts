import { NextRequest,NextResponse } from "next/server";
import { createHmac,timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/lib/db";
export const runtime="nodejs"; export const dynamic="force-dynamic";
type TgUser={id:number;first_name?:string;last_name?:string;username?:string;language_code?:string};
function verifyInitData(initData:string){
 const token=process.env.TELEGRAM_BOT_TOKEN;if(!token||!initData)return null;
 const params=new URLSearchParams(initData),hash=params.get("hash"),authDate=Number(params.get("auth_date")),userRaw=params.get("user");
 if(!hash||!userRaw||!Number.isFinite(authDate)||Math.abs(Date.now()/1000-authDate)>86400)return null;
 params.delete("hash");params.delete("signature");
 const dataCheck=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
 const secret=createHmac("sha256","WebAppData").update(token).digest();
 const calculated=createHmac("sha256",secret).update(dataCheck).digest("hex");
 const a=Buffer.from(calculated,"hex"),b=Buffer.from(hash,"hex");
 if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 try{const user=JSON.parse(userRaw) as TgUser;return user&&Number.isSafeInteger(user.id)?user:null}catch{return null}
}
async function authorized(req:NextRequest){const h=req.headers.get("authorization")||"";return h.startsWith("tma ")?verifyInitData(h.slice(4)):null}
async function load(user:TgUser){
 const db=getDatabase(),month=new Date();month.setDate(1);month.setHours(0,0,0,0);
 const [upsert,tx,tasks]=await Promise.all([
  db.from("telegram_users").upsert({telegram_id:user.id,first_name:user.first_name||"",last_name:user.last_name||null,username:user.username||null,language_code:user.language_code||null,updated_at:new Date().toISOString()},{onConflict:"telegram_id"}),
  db.from("finance_transactions").select("id,kind,amount,currency,category,note,occurred_at").eq("telegram_id",user.id).gte("occurred_at",month.toISOString()).order("occurred_at",{ascending:false}).limit(100),
  db.from("planner_tasks").select("id,title,is_done,due_at,priority,created_at").eq("telegram_id",user.id).order("is_done",{ascending:true}).order("due_at",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false}).limit(100)
 ]);
 if(upsert.error)throw upsert.error;if(tx.error)throw tx.error;if(tasks.error)throw tasks.error;
 const transactions=tx.data||[],income=transactions.filter(x=>x.kind==="income").reduce((s,x)=>s+Number(x.amount),0),expenses=transactions.filter(x=>x.kind==="expense").reduce((s,x)=>s+Number(x.amount),0);
 return {user:{id:String(user.id),first_name:user.first_name||"Привет",username:user.username},transactions,tasks:tasks.data||[],totals:{income:Number(income.toFixed(2)),expenses:Number(expenses.toFixed(2))}};
}
function fail(e:unknown){console.error("Mini App API:",e instanceof Error?e.message:"unknown");return NextResponse.json({error:"Не удалось обработать запрос. Попробуй ещё раз."},{status:500})}
export async function GET(req:NextRequest){const user=await authorized(req);if(!user)return NextResponse.json({error:"Не удалось подтвердить вход Telegram. Закрой и снова открой приложение из бота."},{status:401});try{return NextResponse.json(await load(user))}catch(e){return fail(e)}}
export async function POST(req:NextRequest){const user=await authorized(req);if(!user)return NextResponse.json({error:"Telegram authorization failed"},{status:401});try{const body=await req.json(),db=getDatabase();if(body.action==="transaction"){const amount=Number(body.amount);if(!["income","expense"].includes(body.kind)||!Number.isFinite(amount)||amount<=0||amount>100000000||typeof body.category!=="string"||body.category.length>40)return NextResponse.json({error:"Проверь сумму и категорию"},{status:400});const {error}=await db.from("finance_transactions").insert({telegram_id:user.id,kind:body.kind,amount,currency:"EUR",category:body.category,note:typeof body.note==="string"?body.note.slice(0,240):null});if(error)throw error}else if(body.action==="task"){if(typeof body.title!=="string"||!body.title.trim()||body.title.length>120||!["low","normal","high"].includes(body.priority))return NextResponse.json({error:"Проверь название и приоритет"},{status:400});const due=body.due_at?new Date(body.due_at+"T12:00:00Z"):null;if(due&&Number.isNaN(due.getTime()))return NextResponse.json({error:"Неверная дата"},{status:400});const {error}=await db.from("planner_tasks").insert({telegram_id:user.id,title:body.title.trim(),due_at:due?.toISOString()||null,priority:body.priority});if(error)throw error}else return NextResponse.json({error:"Unknown action"},{status:400});return NextResponse.json(await load(user))}catch(e){return fail(e)}}
export async function PATCH(req:NextRequest){const user=await authorized(req);if(!user)return NextResponse.json({error:"Telegram authorization failed"},{status:401});try{const body=await req.json();if(typeof body.id!=="string"||typeof body.is_done!=="boolean")return NextResponse.json({error:"Invalid task"},{status:400});const {error}=await getDatabase().from("planner_tasks").update({is_done:body.is_done,completed_at:body.is_done?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",body.id).eq("telegram_id",user.id);if(error)throw error;return NextResponse.json(await load(user))}catch(e){return fail(e)}}
export async function DELETE(req:NextRequest){const user=await authorized(req);if(!user)return NextResponse.json({error:"Telegram authorization failed"},{status:401});try{const body=await req.json();if(typeof body.id!=="string")return NextResponse.json({error:"Invalid task"},{status:400});const {error}=await getDatabase().from("planner_tasks").delete().eq("id",body.id).eq("telegram_id",user.id);if(error)throw error;return NextResponse.json(await load(user))}catch(e){return fail(e)}}
