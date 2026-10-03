import {chromium,login,ctx,FE,avisos,pid} from './lib.mjs';
const PID='1f6fa360-18ee-416f-848e-bf5765995dc9';
const s=await login('cliente@ejemplo.com','cliente123');
const b=await chromium.launch();
const c=await ctx(b,s,{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}); const p=await c.newPage();
await p.goto(`${FE}/?section=product&id=${PID}`);
const add=async()=>{await p.getByRole('button',{name:/^Agregar/}).tap({timeout:20000}); await p.waitForTimeout(600);};
const cdp=await c.newCDPSession(p);
const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
const swipe=async(x0,y0,x1,y1,steps=8)=>{await touch('touchStart',x0,y0);for(let i=1;i<=steps;i++){await touch('touchMove',x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps);}await touch('touchEnd');};
const box=async()=>p.evaluate(()=>{const r=document.querySelector('[class*="_toastContainer_"] [role]').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
// 1. tap on text of toast, then wait 7s
await add(); let bx=await box(); await p.touchscreen.tap(bx.x+100,bx.y+bx.h/2);
console.log('after tap', await p.evaluate(()=>({desplegada:!!document.querySelector('[data-desplegada]'),hover:document.querySelector('[class*="_toastContainer_"]').matches(':hover'),active:document.activeElement?.tagName})));
await p.waitForTimeout(7000); console.log('T1 tap on toast text -> alive after 7s:',JSON.stringify((await avisos(p)).map(a=>a.t)));
// tap elsewhere
await p.touchscreen.tap(200,200); await p.waitForTimeout(5000); console.log('after tapping elsewhere +5s:',(await avisos(p)).length);
// 2. small swipe 40px -> should not close; swipe 80 -> close
await add(); bx=await box(); await swipe(bx.x+150,bx.y+30,bx.x+190,bx.y+30); await p.waitForTimeout(500); console.log('T2 swipe 40px right alive:',(await avisos(p)).length);
await swipe(bx.x+150,bx.y+30,bx.x+250,bx.y+30); await p.waitForTimeout(700); console.log('T2 swipe 100px right alive:',(await avisos(p)).length);
// 3. swipe up / vertical scroll starting on toast
await add(); bx=await box(); const y0=await p.evaluate(()=>scrollY); await swipe(bx.x+150,bx.y+30,bx.x+150,bx.y-250); await p.waitForTimeout(500);
console.log('T3 swipe up from toast: scrollY',y0,'->',await p.evaluate(()=>scrollY),'toasts',(await avisos(p)).length);
// scroll outside toast for reference
await swipe(200,500,200,200); await p.waitForTimeout(500); console.log('scroll elsewhere scrollY', await p.evaluate(()=>scrollY));
await b.close();
