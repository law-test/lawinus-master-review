// Upload completed; this endpoint remains disabled.
Deno.serve(() => new Response(JSON.stringify({error:'Import complete; endpoint disabled'}), {status:410,headers:{'content-type':'application/json','cache-control':'no-store'}}));
