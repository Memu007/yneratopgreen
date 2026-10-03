import {chromium,login,ctx,FE,avisos,pid} from './lib.mjs';
const PID='1f6fa360-18ee-416f-848e-bf5765995dc9';
const s=await login('cliente@ejemplo.com','cliente123');
const b=await chromium.launch();
// --- K1 keyboard focus after closing last toast
{
const c=await ctx(b,s); const p=await c.newPage(); await p.goto(`${FE}/?section=product&id=${PID}`);
const btn=p.getByRole('button',{name:/^Agregar/}); await btn.click({timeout:20000}); await p.waitForTimeout(500);
await p.keyboard.press('Tab'); // from add button focus? mouse click focuses button
let n=0; for(;n<30;n++){const l=await p.evaluate(()=>document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.trim().slice(0,15)); if(l==='Ver carrito')break; await p.keyboard.press('Tab');}
console.log('K1 tabs to Ver carrito',n+2);
await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
console.log('K1 after Enter on Cerrar: toasts',(await avisos(p)).length,'activeElement',await p.evaluate(()=>document.activeElement?.tagName+'.'+(document.activeElement?.className||'')));
await p.keyboard.press('Tab'); console.log('K1 next Tab lands on', await p.evaluate(()=>document.activeElement?.tagName+' '+(document.activeElement?.textContent||'').trim().slice(0,25)));
await c.close();}
// --- R1 reduced motion
{
const c=await ctx(b,s,{reducedMotion:'reduce'}); const p=await c.newPage(); await p.goto(`${FE}/?section=product&id=${PID}`);
await p.getByRole('button',{name:/^Agregar/}).click({timeout:20000}); await p.waitForTimeout(300);
console.log('R1 anim', await p.evaluate(()=>{const t=document.querySelector('[class*="_toastContainer_"] [role]');return getComputedStyle(t).animationName+' / lugar transition '+getComputedStyle(t.closest('li')).transitionDuration}));
const t0=Date.now(); await p.waitForFunction(()=>!document.querySelector('[class*="_toastContainer_"] [role]'),null,{timeout:8000}); console.log('R1 gone at',Date.now()-t0+300);
await c.close();}
// --- B1 burst while hovered
{
const c=await ctx(b,s); const p=await c.newPage(); await p.goto(`${FE}/?section=product&id=${PID}`);
const btn=p.getByRole('button',{name:/^Agregar/}); await btn.click({timeout:20000}); await p.waitForTimeout(500);
const bx=await p.evaluate(()=>{const r=document.querySelector('[class*="_toastContainer_"] [role]').getBoundingClientRect();return [r.x+60,r.y+20]});
await p.mouse.move(...bx); await p.waitForTimeout(300);
for(let i=0;i<3;i++){await btn.evaluate(e=>e.click()); await p.waitForTimeout(300);}
console.log('B1 hovered, toasts',(await avisos(p)).length);
await p.waitForTimeout(6000); console.log('B1 after 6s hover toasts',(await avisos(p)).length);
const t0=Date.now(); await p.mouse.move(2,300);
const gone=[]; while(Date.now()-t0<9000){const n=(await avisos(p)).filter(a=>!a.saliendo).length; if(!gone.length||gone[gone.length-1][1]!==n)gone.push([Date.now()-t0,n]); if(n===0)break; await p.waitForTimeout(100);}
console.log('B1 after leaving [ms,count]',JSON.stringify(gone));
await c.close();}
await b.close();
