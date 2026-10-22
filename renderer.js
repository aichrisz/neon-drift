/* Read-only perspective: world anchors/widths never move for decorative steering. */
(function(root){
  "use strict";
  const N=root.Neon;
  function create(canvas){
    const ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx)throw Error("Canvas 2D tidak tersedia.");
    let w=1,h=1,previousX=0,previousTime=0,roll=0;
    function resize(){
      const box=canvas.getBoundingClientRect(),dpr=Math.min(2,root.devicePixelRatio||1);
      w=box.width;h=box.height;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    function poly(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
    function line(x,y,a,b,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();}
    function car(x,y,width,color,type,player,boost,lean,braking,effects,time){
      const height=width*(type==="van"?1.04:type==="compact"?.57:.67),roof=type==="van"?.42:.29;
      const reflection=ctx.createLinearGradient(0,y,0,y+height*1.6);
      reflection.addColorStop(0,color+"55");reflection.addColorStop(1,color+"00");
      poly([[x-width*.45,y],[x+width*.45,y],[x+width*.65,y+height*1.6],[x-width*.65,y+height*1.6]],reflection);
      // Tires and spoiler remain inside the domain width. Suspension changes roof
      // height only (at most 3px), never lateral placement or collision silhouette.
      ctx.fillStyle="#02070c";
      for(const side of [-1,1])ctx.fillRect(x+side*width*.44-width*.06,y-height*.4,width*.12,height*.47);
      const body=ctx.createLinearGradient(x-width/2,0,x+width/2,0);
      body.addColorStop(0,"#243947");body.addColorStop(.25,color);body.addColorStop(.6,color);body.addColorStop(1,"#172936");
      poly([[x-width*.5,y],[x-width*.49,y-height*.63],[x-width*roof,y-height+lean],[x+width*roof,y-height-lean],[x+width*.49,y-height*.63],[x+width*.5,y]],body);
      poly([[x-width*.35,y-height*.65],[x-width*(roof-.05),y-height*.9+lean],[x+width*(roof-.05),y-height*.9-lean],[x+width*.35,y-height*.65]],"#0b2333");
      line(x-width*.23,y-height*.83,x+width*.20,y-height*.83,"#8cb8c1",Math.max(1,width*.015));
      poly([[x-width*.45,y-height*.54],[x+width*.45,y-height*.54],[x+width*.43,y-height*.17],[x-width*.43,y-height*.17]],player?"#16434b":"#253641");
      line(x-width*.46,y-height*.59,x+width*.46,y-height*.59,"#c7f4e6",Math.max(1,width*.016));
      line(x-width*.42,y-height*.1,x+width*.42,y-height*.1,"#050b12",Math.max(1,width*.045));
      if(type==="van"){
        line(x,y-height*.91,x,y-height*.18,"#122730",Math.max(1,width*.018));
        for(const side of [-1,1])line(x+side*width*.11,y-height*.48,x+side*width*.2,y-height*.48,"#bdced7",1);
      }else for(let i=0;i<4;i++)line(x-width*.13,y-height*(.29+i*.035),x+width*.13,y-height*(.29+i*.035),"#07131d",Math.max(1,width*.013));
      const light=braking?"#fff0c9":player?"#ffad70":"#ff6a70";
      for(const side of [-1,1]){
        ctx.fillStyle=light;ctx.fillRect(x+side*width*.3-width*.12,y-height*.44,width*.24,height*(braking?.12:.08));
        line(x+side*width*.3,y+2,x+side*width*.33,y+height*.55,light+"44",Math.max(1,width*.055));
      }
      ctx.fillStyle="#c4d7d8";ctx.fillRect(x-width*.09,y-height*.23,width*.18,height*.07);
      if(player){
        ctx.fillStyle="#09121c";ctx.fillRect(x-width*.49,y-height*.68,width*.98,height*.07);
        line(x-width*.49,y-height*.69,x+width*.49,y-height*.69,"#91ffe2",Math.max(1,width*.022));
      }
      if(effects)for(const side of [-1,1]){
        line(x+side*width*.43,y,x+side*width*.49,y+height*.9,"#090f1880",width*.08);
        for(let i=0;i<6;i++){
          const age=(time*2+i/6)%1;
          line(x+side*width*(.43+age*.3),y+age*height*.8,x+side*width*(.46+age*.32),y+age*height*.8+3,"#a5e5ed44",1);
        }
      }
      if(boost)for(const side of [-1,1]){
        const exhaust=x+side*width*.22;
        poly([[exhaust-width*.1,y],[exhaust+width*.1,y],[exhaust,y+height*.85]],"#33c4ce70");
        poly([[exhaust-width*.06,y],[exhaust+width*.06,y],[exhaust,y+height*.58]],"#beffe3");
      }
    }
    function draw(s,decorations=true){
      // Repeated render of the same simulation snapshot is idempotent. Replay
      // resets suspension; pause has no wall-clock-driven visual animation.
      if(s.elapsed!==previousTime){
        roll=s.elapsed<previousTime?0:Math.max(-3,Math.min(3,(s.playerX-previousX)/Math.max(.008,s.elapsed-previousTime)*1.8));
        previousX=s.playerX;previousTime=s.elapsed;
      }
      const horizon=h*.29,bottom=h*.91,half=Math.min(w*.57,h*.95),center=w*.5;
      const projection=z=>45/(45+Math.max(-7,z));
      const point=(x,z)=>{const p=projection(z);return [center+x*half/1.5*p,horizon+(bottom-horizon)*p];};
      const sky=ctx.createLinearGradient(0,0,0,h);
      sky.addColorStop(0,"#081222");sky.addColorStop(.32,"#294251");sky.addColorStop(1,"#09131e");ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      // Deterministic layered districts: bounded work, no per-frame random noise.
      for(let layer=0;layer<2;layer++)for(let i=0;i<38;i++){
        const bw=w/30+(i*17)%23,x=(i*w/34+(decorations?s.distance*(.008+layer*.012):0))%(w*1.1)-w*.05;
        const top=horizon-(.04+((i*19+layer*7)%13)/100)*h*(layer?.7:1.3);
        ctx.fillStyle=layer?(i%3?"#102030":"#162b3c"):"#172a39";ctx.fillRect(x,top,bw,horizon-top+30);
        for(let row=0;row<7;row++)for(let col=0;col<3;col++)if((i+row*3+col)%4===0){ctx.fillStyle=i%4?"#386072":"#b4a374";ctx.fillRect(x+5+col*8,top+9+row*12,3,5);}
        if(i%7===0)line(x+bw/2,top,x+bw/2,top-14,"#69b6b9");
      }
      const haze=ctx.createRadialGradient(center,horizon,0,center,horizon,w*.42);haze.addColorStop(0,"#64b7b333");haze.addColorStop(1,"#64b7b300");ctx.fillStyle=haze;ctx.fillRect(0,0,w,h*.6);
      poly([[0,h],[0,horizon+25],[center,horizon],[w,horizon+25],[w,h]],"#122532");
      poly([[center-8,horizon],[center+8,horizon],point(1.52,-7),point(-1.52,-7)],"#111c29");
      // Essential road markings always use world distance, also in reduced mode.
      for(let z=440;z>-8;z-=8){const a=z-s.distance%16;if(a>=-7&&Math.floor(z/8)%2===0)poly([point(-1.5,a),point(1.5,a),point(1.5,a+8),point(-1.5,a+8)],"#14222e");}
      for(const side of [-1,1]){
        poly([point(side*1.49,-7),point(side*1.55,-7),point(side*1.55,440),point(side*1.49,440)],"#79e1d5");
        poly([point(side*1.58,-7),point(side*1.73,-7),point(side*1.73,440),point(side*1.58,440)],"#285357");
        for(let z=430-s.distance%28;z>0;z-=28){
          const [x,y]=point(side*1.64,z),p=projection(z),height=h*.38*p;
          line(x,y,x,y-height,"#446578",Math.max(1,3*p));line(x,y-height,x-side*20*p,y-height,"#6dd7d0",Math.max(1,3*p));
          if(decorations){const glow=ctx.createRadialGradient(x,y-height,0,x,y-height,22*p+1);glow.addColorStop(0,"#a7ffda55");glow.addColorStop(1,"#a7ffda00");ctx.fillStyle=glow;ctx.fillRect(x-24*p,y-height-24*p,48*p,48*p);}
        }
      }
      for(let z=440-s.distance%20;z>0;z-=20)for(const x of [-.5,.5])poly([point(x-.014,z),point(x+.014,z),point(x+.014,z+8),point(x-.014,z+8)],"#72999d");
      if(decorations)for(let i=0;i<18;i++){
        const x=((i*73)%109)/109*w,y=horizon+((i*47+s.distance*2)%263)/263*(h-horizon);
        ctx.fillStyle=i%3?"#68d5cb0a":"#ffd58a12";ctx.fillRect(x,y,3+i%3*4,18+i%5*14);
      }
      function sign(x,y,text,color){
        ctx.font=`700 ${Math.max(9,Math.min(w*.019,19))}px Arial`;const tw=ctx.measureText(text).width;
        ctx.fillStyle="#0c1a2a";ctx.fillRect(x-tw/2-10,y-18,tw+20,29);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(x-tw/2-10,y-18,tw+20,29);ctx.fillStyle=color;ctx.textAlign="center";ctx.fillText(text,x,y+2);
      }
      sign(w*.13,h*.32,"夜 / 07","#7ef3df");sign(w*.87,h*.25,"24 : 7","#ffc881");
      sign(w*.08,h*.52,"DOCK / 04","#80b8cc");sign(w*.93,h*.45,"MIDNIGHT","#debc85");
      const colors=["#b3beca","#e6b36d","#65acbb"];
      function vehicle(c,player=false){
        const rear=c.z-c.length/2,[x,y]=point(c.x,rear);
        // Actual ground footprint spans center ± length/2 and x ± width/2.
        // Body width uses the same rear-edge perspective, not a uniform hitbox.
        poly([point(c.x-c.width/2,rear),point(c.x+c.width/2,rear),point(c.x+c.width/2,c.z+c.length/2),point(c.x-c.width/2,c.z+c.length/2)],"#02070c99");
        car(x,y,c.width*half/1.5*projection(rear),player?"#76e7ce":colors[c.color],c.type,player,player&&decorations&&s.boosting,player&&decorations?roll:0,player&&s.braking,decorations&&s.phase==="running",s.elapsed);
      }
      for(const c of [...s.traffic].sort((a,b)=>b.z-a.z))if(c.z>-7&&c.z<N.CONFIG.viewDistance)vehicle(c);
      vehicle({x:s.playerX,z:0,width:N.CONFIG.playerWidth,length:N.CONFIG.playerLength,type:"sedan"},true);
      if(decorations){
        for(let i=0;i<95;i++){
          const x=(i*137.9+s.elapsed*38)%(w+30)-15,y=(i*83.7+s.elapsed*410)%(h+35)-20;
          line(x,y,x-5,y+15,"#a3d6e132",.7);
        }
        if(s.boosting)for(let i=0;i<16;i++){
          const x=i%2?w-12-i*7:12+i*7,dy=(s.elapsed*1.5+i/16)%1;
          line(x,h*(.38+dy*.2),x+(x-center)*.16,h*(.65+dy*.2),"#72fce34a",1);
        }
      }
      const vignette=ctx.createRadialGradient(center,h*.53,h*.18,center,h*.53,Math.max(w,h)*.7);
      vignette.addColorStop(0,"#02081400");vignette.addColorStop(1,"#0208149c");ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
      if(s.phase==="results"){ctx.fillStyle="#07101a70";ctx.fillRect(0,0,w,h);}
    }
    resize();return Object.freeze({resize,draw});
  }
  N.Renderer=Object.freeze({create});
})(globalThis);
