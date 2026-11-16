const BASE='https://www.knightmedicalbilling.com'
const xml=await (await fetch(BASE+'/sitemap.xml')).text()
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1])
const out=[]; const queue=[...urls]
async function worker(){while(queue.length){const url=queue.shift();try{const r=await fetch(url,{redirect:'follow'});const html=await r.text();const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.replace(/&amp;/g,'&').replace(/&#x27;/g,"'").trim()||'';const desc=(html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)||[])[1]||'';const h1=(html.match(/<h1\b/gi)||[]).length;const canonical=(html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)||[])[1]||'';out.push({url:url.replace(BASE,'')||'/',status:r.status,title,titleLen:title.length,desc,descLen:desc.length,h1,canonical})}catch(e){out.push({url:url.replace(BASE,''),status:0,error:e.message,title:'',titleLen:0,desc:'',descLen:0,h1:0,canonical:''})}}}
await Promise.all(Array.from({length:8},worker))
out.sort((a,b)=>a.url.localeCompare(b.url))
console.log(JSON.stringify({count:out.length,longTitles:out.filter(x=>x.titleLen>60).length,longDescs:out.filter(x=>x.descLen>160).length,badStatus:out.filter(x=>x.status!==200).length,badH1:out.filter(x=>x.h1!==1).length,out},null,2))
