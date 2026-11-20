import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async (_req: Request) => new Response(JSON.stringify({ error: "Web Push notifications have been removed from KYRO." }), {
  status: 410,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
}));
