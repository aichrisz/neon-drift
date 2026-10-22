/* Rendering is read-only: perspective and decoration never change world geometry. */
(function(root){
 'use strict';
 const N=root.Neon;
 function create(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas 2D tidak tersedia.');
  let w=1,h=1,dpr=1;
  function resize(){const box=canvas.getBoundingClientRect();w=box.width;h=box.height;dpr=Math.min(2,root.devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function poly(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function line(x,y,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
  function car(x,y,width,color,player,boost){
   const height=width*.67;
   const reflection=ctx.createLinearGradient(0,y,0,y+height*1.5);reflection.addColorStop(0,color+'55');reflection.addColorStop(1,color+'00');
   poly([[x-width*.45,y],[x+width*.45,y],[x+width*.7,y+height*1.5],[x-width*.7,y+height*1.5]],reflection);
   ctx.fillStyle='#02070c';ctx.fillRect(x-width*.55,y-height*.38,width*.17,height*.46);ctx.fillRect(x+width*.38,y-height*.38,width*.17,height*.46);
   poly([[x-width*.5,y],[x-width*.49,y-height*.62],[x-width*.28,y-height],[x+width*.27,y-height],[x+width*.49,y-height*.62],[x+width*.5,y]],'#0b1720');
   poly([[x-width*.49,y-height*.62],[x-width*.28,y-height],[x+width*.27,y-height],[x+width*.49,y-height*.62]],color);
   poly([[x-width*.32,y-height*.64],[x-width*.22,y-height*.88],[x+width*.21,y-height*.88],[x+width*.32,y-height*.64]],'#102837');
   line(x-width*.19,y-height*.83,x+width*.17,y-height*.83,'#78a7ac',Math.max(1,width*.014));
   poly([[x-width*.49,y-height*.61],[x+width*.49,y-height*.61],[x+width*.5,y-height*.12],[x-width*.5,y-height*.12]],color);
   poly([[x-width*.45,y-height*.46],[x+width*.45,y-height*.46],[x+width*.4,y-height*.14],[x-width*.4,y-height*.14]],player?'#153b40':'#26343e');
   ctx.fillStyle=player?'#ffcc82':'#ff6a70';ctx.fillRect(x-width*.44,y-height*.43,width*.28,height*.08);ctx.fillRect(x+width*.16,y-height*.43,width*.28,height*.08);
   line(x-width*.46,y-height*.58,x+width*.46,y-height*.58,player?'#c2ffec':'#e0e8eb',Math.max(1,width*.016));
   ctx.fillStyle='#b7d5d5';ctx.fillRect(x-width*.09,y-height*.21,width*.18,height*.07);
   if(player){ctx.fillStyle='#0b151e';ctx.fillRect(x-width*.54,y-height*.67,width*1.08,height*.06);line(x-width*.54,y-height*.68,x+width*.54,y-height*.68,'#7ffce6',2);}
   if(boost){poly([[x-width*.3,y],[x-width*.12,y],[x-width*.21,y+height*.6]],'#9fffe5');poly([[x+width*.12,y],[x+width*.3,y],[x+width*.21,y+height*.6]],'#9fffe5');}
  }
  function draw(s,decorations=true){
   const horizon=h*.29,bottom=h*.91,half=Math.min(w*.57,h*.95),center=w*.5;
   const projection=z=>45/(45+Math.max(-7,z));
   const point=(x,z)=>{const p=projection(z);return [center+x*half/1.5*p,horizon+(bottom-horizon)*p];};
   const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#091426');sky.addColorStop(.32,'#233749');sky.addColorStop(.58,'#142330');sky.addColorStop(1,'#0a1420');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
   // Fixed procedural skyline: no asset downloads and no random per-frame flicker.
   for(let i=0;i<38;i++){
    const bw=w/30+(i*17%23),x=i*w/34-w*.05,top=horizon-(.04+(i*19%13)/100)*h;
    ctx.fillStyle=i%3?'#102030':'#162b3c';ctx.fillRect(x,top,bw,horizon-top+30);
    for(let row=0;row<7;row++)for(let col=0;col<3;col++)if((i+row*3+col)%4===0){ctx.fillStyle=i%4?'#386072':'#b4a374';ctx.fillRect(x+5+col*8,top+9+row*12,3,5);}
    if(i%7===0){line(x+bw*.5,top,x+bw*.5,top-12,'#355568');ctx.fillStyle='#7be8da';ctx.fillRect(x+bw*.5-1,top-13,2,2);}
   }
   const haze=ctx.createRadialGradient(center,horizon,0,center,horizon,w*.42);haze.addColorStop(0,'#64b7b333');haze.addColorStop(1,'#64b7b300');ctx.fillStyle=haze;ctx.fillRect(0,0,w,h*.6);
   poly([[0,h],[0,horizon+25],[center,horizon],[w,horizon+25],[w,h]],'#122532');
   const left=point(-1.52,-7),right=point(1.52,-7);
   poly([[center-8,horizon],[center+8,horizon],right,left],'#111c29');
   // Road strips are in world space. They keep moving with decorations disabled.
   const offset=s.distance%16;
   for(let z=440;z>-8;z-=8){
    const a=z-offset,b=a+8;if(a<-7)continue;
    if(Math.floor(z/8)%2===0)poly([point(-1.5,a),point(1.5,a),point(1.5,b),point(-1.5,b)],'#14222e');
   }
   for(const side of [-1,1]){
    poly([point(side*1.49,-7),point(side*1.55,-7),point(side*1.55,440),point(side*1.49,440)],'#79e1d5');
    poly([point(side*1.58,-7),point(side*1.73,-7),point(side*1.73,440),point(side*1.58,440)],'#285357');
    for(let z=430-(s.distance%28);z>0;z-=28){
     const [x,y]=point(side*1.64,z),p=projection(z),height=h*.38*p;
     line(x,y,x,y-height,'#446578',Math.max(1,3*p));line(x,y-height,x-side*20*p,y-height,'#6dd7d0',Math.max(1,3*p));
     if(decorations){const glow=ctx.createRadialGradient(x,y-height,0,x,y-height,22*p+1);glow.addColorStop(0,'#a7ffda55');glow.addColorStop(1,'#a7ffda00');ctx.fillStyle=glow;ctx.fillRect(x-24*p,y-height-24*p,48*p,48*p);}
    }
   }
   for(let z=440-(s.distance%20);z>0;z-=20)for(const x of [-.5,.5])poly([point(x-.014,z),point(x+.014,z),point(x+.014,z+8),point(x-.014,z+8)],'#72999d');
   // Wet asphalt: long reflected signs, broken by transverse dark seams.
   if(decorations){
    for(let i=0;i<18;i++){
     const x=((i*73)%109)/109*w,y=horizon+((i*47+s.distance*2)%263)/263*(h-horizon);
     ctx.fillStyle=i%3?'#68d5cb0a':'#ffd58a12';ctx.fillRect(x,y,3+(i%3)*4,18+i%5*14);
    }
   }
   function sign(x,y,text,color){ctx.font=`700 ${Math.max(9,Math.min(w*.019,19))}px Arial`;const tw=ctx.measureText(text).width;ctx.fillStyle='#0c1a2a';ctx.fillRect(x-tw/2-10,y-18,tw+20,29);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(x-tw/2-10,y-18,tw+20,29);ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,x,y+2);}
   sign(w*.13,h*.32,'夜 / 07','#7ef3df');sign(w*.87,h*.25,'24 : 7','#ffc881');
   // Sort far to near. Width uses precisely the engine's world-width convention.
   const colors=['#b3beca','#e6b36d','#65acbb'];
   for(const c of [...s.traffic].sort((a,b)=>b.z-a.z))if(c.z>-7&&c.z<N.CONFIG.viewDistance){const p=projection(c.z),[x,y]=point(c.x,c.z);car(x,y,N.CONFIG.trafficWidth*half/1.5*p,colors[c.color],false,false);}
   const [px,py]=point(s.playerX,0);car(px,py,N.CONFIG.playerWidth*half/1.5,'#76e7ce',true,s.boosting);
   if(decorations){
    ctx.strokeStyle='#a3d6e132';ctx.lineWidth=.7;
    for(let i=0;i<95;i++){const x=((i*137.9+s.elapsed*38)%(w+30))-15,y=((i*83.7+s.elapsed*410)%(h+35))-20;line(x,y,x-5,y+15,'#a3d6e132',.7);}
    if(s.boosting)for(let i=0;i<12;i++){const x=i%2?w-12-i*8:12+i*8;line(x,h*.55,x+(x-center)*.16,h*.85,'#72fce34a',1);}
   }
   const vignette=ctx.createRadialGradient(center,h*.53,h*.18,center,h*.53,Math.max(w,h)*.7);vignette.addColorStop(0,'#02081400');vignette.addColorStop(1,'#0208149c');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
   if(s.phase==='results'){ctx.fillStyle='#07101a70';ctx.fillRect(0,0,w,h);}
  }
  resize();return Object.freeze({resize,draw});
 }
 N.Renderer=Object.freeze({create});
})(globalThis);
