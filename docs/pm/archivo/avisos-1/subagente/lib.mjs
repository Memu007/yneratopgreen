import { chromium } from '/root/pm-entorno/cand/node_modules/playwright/index.mjs';
export const API='http://localhost:8000/api', FE='http://localhost:5173';
export async function login(email,password){
  const r=await fetch(API+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  const j=await r.json(); return {a:j.access_token,r:j.refresh_token,j};
}
export async function ctx(browser,sess,opts={}){
  const c=await browser.newContext({viewport:{width:1440,height:900},...opts});
  if(sess) await c.addInitScript(({a,r})=>{localStorage.setItem('access_token',a);localStorage.setItem('refresh_token',r);},sess);
  return c;
}
export const avisos=(page)=>page.evaluate(()=>[...document.querySelectorAll('[class*="_toastContainer_"] [role]')].map(n=>{const b=n.getBoundingClientRect();return {role:n.getAttribute('role'),t:n.textContent.replace(/\s+/g,' ').trim(),saliendo:/_saliendo_/.test(n.className),top:Math.round(b.top),bottom:Math.round(b.bottom),left:Math.round(b.left),right:Math.round(b.right)}}));
export {chromium};
export async function pid(name='Urea Granulada'){const j=await (await fetch(API+'/catalog/products?page=1&page_size=100')).json();return j.items.find(p=>p.name.startsWith(name)).id;}
