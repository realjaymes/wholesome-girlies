// Run: node scripts/test-campaign-redirect.mjs. Proves the First 1,000 redirect: on, off, end date, 1,000 taken, status failure, cache.
const P=new URL("../functions/_lib/campaign-redirect.js", import.meta.url).href;
let fails=0; const ok=(c,l)=>{console.log((c?"pass  ":"FAIL  ")+l); if(!c) fails++;};
const store=new Map();
globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(),put:async(k,r)=>{store.set(k.url,r)}}};
let status={ok:true,taken:5}, calls=0;
globalThis.fetch=async()=>{calls++; if(status==="down") throw new Error("down"); return new Response(JSON.stringify(status));};
let n=0;
async function run(cfg, st){ status=st; store.clear(); const m=await import(P+"?"+(n++)); // fresh module = fresh config cache
  return m.campaignRedirect(new Request("https://x.test/programs/first-pregnancy-plan?utm_source=a"),{ASSETS:{fetch:async()=>new Response(JSON.stringify(cfg))}}); }
const on={redirect:true,endDate:""};
ok((await run(on,{ok:true,taken:5}))?.status===302,"on, 5 taken -> 302");
ok((await run(on,{ok:true,taken:999}))?.status===302,"999 taken -> 302");
ok(await run(on,{ok:true,taken:1000,cap:100,open:false})===null,"1000 taken -> off");
ok((await run(on,{ok:true,taken:400,cap:500,open:false}))?.status===302,"public cap closed at 500, 400 taken -> 302");
ok((await run(on,"down"))?.status===302,"status call fails -> 302");
ok((await run(on,{ok:false}))?.status===302,"status ok:false -> 302");
ok(await run({redirect:false,endDate:""},{ok:true,taken:5})===null,"redirect:false -> off");
ok(await run({redirect:true,endDate:"2020-01-01"},{ok:true,taken:5})===null,"endDate in the past -> off");
ok((await run({redirect:true,endDate:"2999-01-01"},{ok:true,taken:5}))?.status===302,"endDate in future -> 302");
calls=0; status={ok:true,taken:3}; store.clear(); const m=await import(P+"?c");
const env={ASSETS:{fetch:async()=>new Response(JSON.stringify(on))}};
await m.campaignRedirect(new Request("https://x.test/programs/postpartum-reset"),env); await m.campaignRedirect(new Request("https://x.test/go/postpartum-reset"),env);
ok(calls===1,"status cached: 1 fetch for 2 requests");
ok(await m.campaignRedirect(new Request("https://x.test/programs/postpartum-reset",{method:"POST"}),env)===null,"POST not redirected");
ok(m.salesPage("/programs/first-baby-playbook/read")===null && m.salesPage("/first/")===null && m.salesPage("/programs/nope")===null && m.salesPage("/programs/first-baby-playbook/thank-you.html")===null,"read/thank-you/first/unknown not sales");
process.exit(fails?1:0);
