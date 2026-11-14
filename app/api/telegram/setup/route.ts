import { NextRequest,NextResponse } from "next/server";
import { telegram } from "@/lib/telegram";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const setupSecret=process.env.TELEGRAM_SETUP_SECRET,webhookSecret=process.env.TELEGRAM_WEBHOOK_SECRET,siteUrl=process.env.NEXT_PUBLIC_SITE_URL;
 if(!setupSecret||!webhookSecret||!siteUrl)return NextResponse.json({error:"Missing Telegram setup configuration"},{status:503});
 if(request.headers.get("authorization")!==\`Bearer \${setupSecret}\`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const base=siteUrl.replace(/\\/$/,"");
 const [webhook,menu]=await Promise.all([
  telegram("setWebhook",{url:base+"/api/telegram/webhook",secret_token:webhookSecret,allowed_updates:["message","callback_query"],drop_pending_updates:true}),
  telegram("setChatMenuButton",{menu_button:{type:"web_app",text:"Открыть приложение",web_app:{url:base}}})
 ]);
 return NextResponse.json({ok:true,webhook,menu});
}