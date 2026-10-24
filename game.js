/* 판도라 라이벌 3D: procedural original characters and arena. */
'use strict';
(() => {
const $=id=>document.getElementById(id);
function fail(msg){$('loading').hidden=true;$('error').hidden=false;$('errorMessage').textContent=msg;}
if(!window.THREE){fail('vendor 폴더를 index.html 옆에 놓아주세요. Three.js를 찾지 못했어요.');return;}
const T=THREE,V=T.Vector3,TAU=Math.PI*2;
const CLASSES=[
{name:'루미',role:'궁수',weapon:'빛결 활',icon:'➶',accent:'#7affdc',skin:0x278ac2,glow:0x68ffe5,hp:120,speed:7.5,damage:48,rate:.55,scale:[.91,1.08,.94],desc:'정확하게 날아가는 빛의 화살',power:4,agility:4},
{name:'제트',role:'사수',weapon:'펄스 라이플',icon:'⌁',accent:'#8bc8ff',skin:0x317bc9,glow:0x75c9ff,hp:130,speed:7,damage:17,rate:.115,scale:[1,1,1],desc:'빠른 연사로 쉴 틈 없이 공격',power:3,agility:4},
{name:'토르',role:'포병',weapon:'별빛 대포',icon:'◉',accent:'#c5a0ff',skin:0x5964bc,glow:0xdb9bff,hp:170,speed:5.9,damage:90,rate:1.15,scale:[1.24,1.04,1.15],desc:'묵직한 한 방! 넓은 범위 폭발',power:5,agility:2},
{name:'키라',role:'검사',weapon:'초승달 검',icon:'⚔',accent:'#90ffe9',skin:0x167e9f,glow:0x74ffdf,hp:145,speed:8.5,damage:44,rate:.31,scale:[.91,.97,.94],desc:'빠르게 다가가 빛의 검 휘두르기',power:4,agility:5}
];
const DIFF={easy:{label:'쉬움',hp:.8,damage:.6,speed:.75,base:3,assist:.16,hint:'조준 보정 · 약한 적 · 넉넉한 체력'},normal:{label:'보통',hp:1,damage:1,speed:1,base:4,assist:.065,hint:'균형 잡힌 대전 · 가벼운 조준 보정'},hard:{label:'어려움',hp:1.25,damage:1.35,speed:1.18,base:5,assist:0,hint:'빠르고 강한 적 · 직접 조준'}};
let renderer;
try{renderer=new T.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});}catch(e){fail('WebGL을 실행할 수 없어요. Chrome 또는 Edge의 그래픽 가속을 켜주세요.');return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new T.Scene();scene.background=new T.Color(0x081b30);scene.fog=new T.FogExp2(0x0b2d44,.024);
const camera=new T.PerspectiveCamera(52,innerWidth/innerHeight,.1,180);
scene.add(new T.HemisphereLight(0x97d9ff,0x153d44,2.1));
const sun=new T.DirectionalLight(0xa9e4ff,2.9);sun.position.set(8,20,12);scene.add(sun);
const rim=new T.DirectionalLight(0xb576ff,2.6);rim.position.set(-12,9,-15);scene.add(rim);
const cyanLight=new T.PointLight(0x42ffe1,35,20);cyanLight.position.set(0,5,4);scene.add(cyanLight);
const geometries={sphere:new T.SphereGeometry(1,12,9),box:new T.BoxGeometry(1,1,1),cone:new T.ConeGeometry(1,1,9),cylinder:new T.CylinderGeometry(1,1,1,10),ico:new T.IcosahedronGeometry(1,0)};
const materialCache=new Map();
function mat(color,glow=0,intensity=0){const key=[color,glow,intensity].join(':');if(!materialCache.has(key))materialCache.set(key,new T.MeshStandardMaterial({color,emissive:glow,emissiveIntensity:intensity,roughness:.7,metalness:.12}));return materialCache.get(key);}
function mesh(parent,geo,material,pos=[0,0,0],scale=[1,1,1]){const m=new T.Mesh(typeof geo==='string'?geometries[geo]:geo,material);m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
function group(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function bone(parent,a,b,r,material,r2=r){const va=new V(...a),vb=new V(...b);const m=mesh(parent,new T.CylinderGeometry(r2,r,va.distanceTo(vb),8),material);m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new V(0,1,0),vb.sub(va).normalize());return m;}
function tube(parent,points,r,material){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new V(...p))),18,r,6,false),material);}
function ring(parent,r,color,y=.03,width=.035){const m=mesh(parent,new T.TorusGeometry(r,width,6,64),mat(color,color,1.5),[0,y,0]);m.rotation.x=Math.PI/2;return m;}

// Merge rigid pieces sharing a material, while retaining every animated joint.
function batchDirect(parent){
const buckets=new Map();for(const m of parent.children){if(!m.isMesh)continue;const key=m.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m);}
for(const list of buckets.values()){if(list.length<2)continue;const chunks=[];let total=0;for(const m of list){m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);chunks.push(g);total+=g.attributes.position.count;}
const merged=new T.BufferGeometry();for(const name of ['position','normal','uv']){const size=name==='uv'?2:3,buffer=new Float32Array(total*size);let offset=0;for(const g of chunks){const a=g.attributes[name];if(a)buffer.set(a.array,offset);offset+=g.attributes.position.count*size;}merged.setAttribute(name,new T.BufferAttribute(buffer,size));}
for(const g of chunks)g.dispose();for(const m of list){parent.remove(m);if(!Object.values(geometries).includes(m.geometry))m.geometry.dispose();}parent.add(new T.Mesh(merged,list[0].material));}
}

function character(type,enemy=false){
const c=CLASSES[type],root=new T.Group(),body=group(root),skin=mat(c.skin),dark=mat(0x11385d),hairMat=mat(0x101c35),glow=mat(c.glow,c.glow,1.8),armor=mat(type===2?0x35305b:0x193650),gold=mat(0xd3ae70);
body.scale.set(...c.scale);
mesh(body,'sphere',skin,[0,1.59,0],[.39,.59,.24]);mesh(body,'sphere',skin,[0,1.18,-.01],[.3,.29,.22]);
mesh(body,'cone',armor,[0,1.02,0],[.39,.5,.3]);mesh(body,'cylinder',gold,[0,1.24,0],[.32,.075,.24]);
mesh(body,'cylinder',skin,[0,2.1,0],[.115,.25,.13]);
const head=group(body,0,2.43,0);mesh(head,'sphere',skin,[0,0,0],[.27,.37,.25]);mesh(head,'sphere',skin,[0,-.12,.16],[.19,.18,.14]);mesh(head,'sphere',skin,[0,-.025,.255],[.072,.075,.075]);
for(const s of [-1,1]){
const ear=mesh(head,'cone',skin,[s*.38,.06,-.015],[.125,.5,.08]);ear.rotation.z=-s*1.05;
const inner=mesh(head,'cone',mat(0x7192e2),[s*.39,.07,.035],[.065,.34,.025]);inner.rotation.z=-s*1.05;
mesh(head,'sphere',mat(0xffdd76,0xffc451,.7),[s*.112,.015,.226],[.075,.046,.045]);mesh(head,'sphere',mat(0x071521),[s*.112,.015,.264],[.014,.031,.009]);
mesh(head,'box',dark,[s*.115,.08,.223],[.16,.032,.04]).rotation.z=s*.14;
for(let j=0;j<4;j++)mesh(head,'sphere',glow,[s*(.09+j*.035),-.07-j*.025,.242-j*.016],[.014,.014,.009]);
}
mesh(head,'sphere',hairMat,[0,.22,-.07],[.275,.22,.23]);
const hair=group(head,0,.17,-.12);
for(let j=0;j<7;j++){const x=(j-3)*.065;tube(hair,[[x,.03,0],[x*1.2,-.28,-.16],[x*1.1,-.65,-.21],[x*.8,-1.05-(j%3)*.12,-.14]],.037,hairMat);mesh(hair,'cylinder',gold,[x*.8,-.85,-.18],[.043,.09,.043]);}
tube(hair,[[.22,0,0],[.36,-.32,-.05],[.31,-.8,-.15],[.26,-1.35,-.13]],.045,hairMat);mesh(hair,'sphere',glow,[.26,-1.35,-.13],[.055,.06,.055]);
const legs=[],knees=[],arms=[],elbows=[];
for(const s of [-1,1]){
const leg=group(body,s*.18,1.05,0);legs.push(leg);bone(leg,[0,0,0],[s*.025,-.48,.015],.125,skin,.15);
const knee=group(leg,s*.025,-.48,.015);knees.push(knee);mesh(knee,'sphere',dark,[0,0,.055],[.12,.12,.085]);bone(knee,[0,0,0],[0,-.45,-.01],.085,skin,.115);mesh(knee,'sphere',skin,[0,-.47,.09],[.11,.085,.24]);mesh(knee,'cylinder',gold,[0,-.32,0],[.1,.07,.11]);
const arm=group(body,s*.4,1.95,0);arms.push(arm);mesh(arm,'sphere',type===2?armor:skin,[s*.035,-.03,0],[type===2?.23:.16,.19,.17]);bone(arm,[0,-.05,0],[s*.09,-.39,.035],.085,skin,.12);
const elbow=group(arm,s*.09,-.39,.035);elbows.push(elbow);bone(elbow,[0,0,0],[0,-.37,.07],.065,skin,.09);mesh(elbow,'cylinder',armor,[0,-.25,.045],[.095,.18,.1]);mesh(elbow,'sphere',skin,[0,-.41,.085],[.095,.14,.075]);
for(let f=0;f<3;f++)bone(elbow,[(f-1)*.04,-.43,.09],[(f-1)*.04,-.56,.11],.018,skin);
for(let j=0;j<3;j++){mesh(body,'box',dark,[s*(.13+j*.035),1.8-j*.16,.225],[.18,.025,.02]).rotation.z=s*.35;mesh(arm,'sphere',glow,[s*.1,-.13-j*.07,.105],[.025,.018,.012]);}
}
for(let j=0;j<7;j++)mesh(body,'sphere',glow,[Math.sin(j*2)*.13,1.35+j*.09,.244],[.02,.018,.012]);
bone(body,[-.3,1.98,.2],[.24,1.3,.23],.035,gold);
if(type===0)for(let j=0;j<4;j++)bone(body,[-.22+j*.09,1.3,-.3],[-.32+j*.09,2.24,-.3],.017,gold);
if(type===1){mesh(body,'box',armor,[.3,1.7,.05],[.15,.33,.55]);for(let j=0;j<3;j++)mesh(body,'box',glow,[.3,1.65+j*.07,.335],[.1,.025,.015]);}
if(type===2)for(const s of [-1,1]){mesh(body,'ico',armor,[s*.5,1.99,0],[.3,.29,.3]);mesh(body,'ico',glow,[s*.54,2.08,.21],[.11,.12,.07]);}
if(type===3)for(let j=0;j<3;j++){const f=mesh(head,'cone',mat(0x5dffe1,0x1a776b,.3),[.12+j*.09,.35+j*.04,-.1],[.08,.45,.04]);f.rotation.z=-.4-j*.2;}
const tail=group(body,0,1.18,-.18),tailParts=[];let tp=tail;
for(let j=0;j<8;j++){const p=group(tp,0,j===0?0:-.025,j===0?0:-.19);bone(p,[0,0,0],[0,-.025,-.2],.048-j*.004,skin);tailParts.push(p);tp=p;}
mesh(tp,'sphere',glow,[0,0,-.2],[.065,.07,.15]);
const weapon=group(elbows[1],0,-.4,.12);
if(type===0){tube(weapon,[[0,-.65,.05],[.08,-.4,.27],[.12,0,.4],[.08,.4,.27],[0,.65,.05]],.045,gold);bone(weapon,[0,-.65,.05],[0,.65,.05],.009,glow);bone(weapon,[0,0,-.2],[0,0,.65],.017,dark);mesh(weapon,'cone',glow,[0,0,.7],[.045,.16,.045]).rotation.x=Math.PI/2;}
if(type===1){mesh(weapon,'box',armor,[0,.07,.25],[.17,.2,.65]);bone(weapon,[0,.07,.4],[0,.07,.95],.065,dark);mesh(weapon,'box',glow,[0,.18,.3],[.08,.035,.38]);mesh(weapon,'box',gold,[0,-.1,.13],[.1,.25,.14]);}
if(type===2){bone(weapon,[0,.05,.05],[0,.05,.85],.24,armor,.19);bone(weapon,[0,.05,.69],[0,.05,.9],.17,glow);mesh(weapon,'sphere',dark,[0,.05,.91],[.12,.12,.02]);for(const s of [-1,1])mesh(weapon,'box',gold,[s*.24,.05,.35],[.09,.15,.45]);}
if(type===3){bone(weapon,[0,-.15,0],[0,.18,0],.04,gold);mesh(weapon,'box',gold,[0,.17,0],[.36,.055,.09]);mesh(weapon,'cone',glow,[0,.81,0],[.12,1.25,.04]).rotation.z=-.09;mesh(weapon,'box',dark,[0,.6,-.025],[.035,.8,.03]);}
const groundRing=ring(root,.62,enemy?0xff607e:c.glow,.035,.025);groundRing.visible=enemy;
const hpRoot=group(root,0,3.25,0);hpRoot.visible=enemy;mesh(hpRoot,'box',mat(0x26374c),[0,0,0],[.9,.085,.025]);const hpBar=mesh(hpRoot,'box',mat(0xff627e,0xff345b,.8),[0,0,.02],[.86,.055,.025]);
root.userData={type,body,head,hair,arms,elbows,legs,knees,tail,tailParts,weapon,groundRing,hpRoot,hpBar,phase:Math.random()*6};const pivots=[];root.traverse(o=>{if(o.isGroup)pivots.push(o);});pivots.reverse().forEach(batchDirect);return root;
}
function animateCharacter(root,time,moving=0,attack=0){
const d=root.userData,phase=time*10+d.phase;d.body.position.y=Math.sin(time*2+d.phase)*.025+Math.abs(Math.sin(phase))*.045*moving;d.head.rotation.y=Math.sin(time*1.1+d.phase)*.05;d.hair.rotation.x=Math.sin(time*2+d.phase)*.06+moving*.08;
d.legs.forEach((l,i)=>{l.rotation.x=Math.sin(phase+i*Math.PI)*.55*moving;d.knees[i].rotation.x=Math.max(0,-Math.sin(phase+i*Math.PI))*.6*moving;});
d.tail.rotation.y=Math.sin(time*2+d.phase)*.4;d.tailParts.forEach((p,i)=>{p.rotation.y=Math.sin(time*3-i*.5+d.phase)*.12;p.rotation.x=-.09+Math.sin(time+i*.3)*.04;});
const kick=Math.sin(Math.min(1,attack)*Math.PI);d.arms[0].rotation.set(-.2+Math.sin(phase)*.35*moving,0,-.13);d.arms[1].rotation.set(-.3-Math.sin(phase)*.3*moving,0,.12);d.elbows[0].rotation.x=-.3;d.elbows[1].rotation.x=-.45;
if(d.type===0){d.arms[1].rotation.x=-1.1+kick*.25;d.elbows[1].rotation.x=-.2;d.arms[0].rotation.x=-1.05;d.arms[0].rotation.y=.45+kick*.5;}
if(d.type===1||d.type===2){d.arms[1].rotation.x=-1.05+kick*.35;d.elbows[1].rotation.x=-.45;d.arms[0].rotation.x=-.8;d.arms[0].rotation.z=-.65;}
if(d.type!==3)d.weapon.rotation.x=-(d.arms[1].rotation.x+d.elbows[1].rotation.x);
if(d.type===3&&attack>0){d.arms[1].rotation.x=-1.5;d.arms[1].rotation.z=-1.5+attack*2.8;d.body.rotation.y=kick*.35;}else d.body.rotation.y=0;
}


const environment=new T.Group();scene.add(environment);const obstacles=[],floaters=[],plants=[];
let seed=182;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}function range(a,b){return a+(b-a)*random();}
mesh(environment,'cylinder',mat(0x0c3540),[0,-.55,0],[43,1,43]);
for(const r of [7,16,27,40])ring(environment,r,0x245c65,.005,.023);
for(let j=0;j<24;j++){
const a=j/24*TAU,x=Math.sin(a)*42,z=Math.cos(a)*42,h=range(13,23),tr=range(1,1.7);
bone(environment,[x,0,z],[x+range(-2,2),h,z],tr,mat(0x18394b),tr*.48);obstacles.push({x,z,r:tr+.1,h});
for(let k=0;k<4;k++){const ba=a+k*1.5;bone(environment,[x,4,z],[x+Math.sin(ba)*4,0,z+Math.cos(ba)*4],.2,mat(0x18394b));mesh(environment,'ico',mat(k%2?0x13434b:0x164857),[x+Math.sin(ba)*4,h-1,z+Math.cos(ba)*4],[5.5,2.7,5]);}
tube(environment,[[x+.6,0,z],[x+.7,h*.3,z+.2],[x+.3,h*.6,z],[x+.5,h*.9,z]],.045,mat(0x3ea6a4,0x1bdcbe,.6));
}
for(let j=0;j<12;j++){const a=j/12*TAU+.1,r=range(14,32),x=Math.sin(a)*r,z=Math.cos(a)*r;if(z>0&&Math.abs(x)<10)continue;const h=range(3.2,6);mesh(environment,'ico',mat(0x284a60),[x,h*.38,z],[1.6,h*.5,1.4]);obstacles.push({x,z,r:1.55,h});mesh(environment,'ico',mat(0x46d9de,0x33dada,.7),[x+.1,h*.78,z],[.5,.6,.5]);}
for(let j=0;j<85;j++){const a=range(0,TAU),r=range(10,41),x=Math.sin(a)*r,z=Math.cos(a)*r,g=group(environment,x,0,z),col=j%3===0?0xa16afa:j%3===1?0x51f2cf:0x49bfff,h=range(.4,1.4);bone(g,[0,0,0],[0,h,0],.025,mat(0x2c777d));
if(j%3===0){mesh(g,'sphere',mat(col,col,.7),[0,h,0],[.5,.13,.5]);for(let k=0;k<3;k++)bone(g,[0,h-.03,0],[Math.sin(k*2)*.25,h-.5,Math.cos(k*2)*.25],.012,mat(col,col,.8));}
else for(let k=0;k<5;k++){const leaf=mesh(g,'sphere',mat(col,col,.35),[Math.sin(k*1.25)*.21,h*.6,Math.cos(k*1.25)*.21],[.09,h*.65,.2]);leaf.rotation.z=Math.sin(k)*.6;leaf.rotation.y=k*1.25;}
plants.push(g);}
for(let j=0;j<13;j++){const a=range(0,TAU),r=range(23,55),g=group(environment,Math.sin(a)*r,range(11,24),Math.cos(a)*r);mesh(g,'ico',mat(0x23425e),[0,0,0],[range(2,5),range(1.5,3),range(2,4)]);mesh(g,'sphere',mat(0x20595d),[0,1,0],[2.4,.4,2.1]);for(let k=0;k<4;k++)bone(g,[range(-1,1),-.5,0],[range(-1,1),-range(2,5),0],.025,mat(0x4ae4c4,0x1aa9a4,.6));g.userData.base=g.position.y;floaters.push(g);}
const starPos=new Float32Array(400*3);for(let i=0;i<starPos.length;i+=3){starPos[i]=range(-48,48);starPos[i+1]=range(.4,23);starPos[i+2]=range(-48,48);}
const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.BufferAttribute(starPos,3));const stars=new T.Points(starGeo,new T.PointsMaterial({color:0x7effe1,size:.075,transparent:true,opacity:.8,depthWrite:false}));scene.add(stars);
plants.forEach(batchDirect);floaters.forEach(batchDirect);batchDirect(environment);
const lobby=new T.Group();scene.add(lobby);const previews=[];
CLASSES.forEach((c,i)=>{const x=(i-1.5)*3.25;mesh(lobby,'cylinder',mat(0x172f45),[x,-.05,0],[1.2,.18,1.2]);ring(lobby,1.2,c.glow,.055,.025).position.x=x;const ch=character(i);ch.position.set(x,.05,0);ch.scale.setScalar(1.38);lobby.add(ch);previews.push(ch);});
let selected=0,difficulty='easy',state='menu',player=null,enemies=[],projectiles=[],effects=[],numbers=[];
let score=0,kills=0,level=1,xp=0,timeLeft=180,yaw=0,pitch=.1,vy=0,cooldown=0,attackAnim=0,respawn=0,invulnerable=0,shake=0,hitFlash=0,hurtFlash=0,toastTime=0,spawnTimer=0,simTime=0;
let hp=120,maxHp=120,mouseDown=false,muted=false,audio=null,lastFrame=performance.now(),hudClock=0;
const keys=new Set(),raycaster=new T.Raycaster(),forward=new V(),movement=new V(),target=new V(),cameraTarget=new V(),cameraDesired=new V();
function tone(freq,duration=.1,type='sine',volume=.07,slide=0){if(muted||!audio)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(25,freq+slide),audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}
function initAudio(){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function toast(text){$('toast').textContent=text;toastTime=2.6;}
function selectClass(i){selected=i;document.querySelectorAll('.character-card').forEach((b,n)=>{b.classList.toggle('selected',n===i);b.setAttribute('aria-pressed',String(n===i));});}
CLASSES.forEach((c,i)=>{const b=document.createElement('button');b.className='character-card';b.style.setProperty('--accent',c.accent);b.innerHTML='<span class="check">✓</span><div class="card-top"><span class="class-icon">'+c.icon+'</span><strong>'+c.name+'</strong><span class="role">'+c.role+'</span></div><p>'+c.desc+'</p><div class="stats"><span>체력 <b>'+c.hp+'</b></span><span>공격 <b>'+'◆'.repeat(c.power)+'</b></span><span>속도 <b>'+c.agility+'</b></span></div>';b.onclick=()=>selectClass(i);$('characterCards').appendChild(b);});selectClass(0);
for(const b of document.querySelectorAll('[data-difficulty]'))b.onclick=()=>{difficulty=b.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));});$('difficultyHint').textContent=DIFF[difficulty].hint;};
function disposeCharacter(root){root.traverse(o=>{if(o.isMesh&&!Object.values(geometries).includes(o.geometry))o.geometry.dispose();});scene.remove(root);}
function clearBattle(){if(player){disposeCharacter(player);player=null;}for(const e of enemies)disposeCharacter(e.root);enemies=[];for(const p of projectiles)scene.remove(p.mesh);projectiles=[];for(const e of effects){scene.remove(e.mesh);if(e.ownedMaterial)e.mesh.material.dispose();if(e.ownedGeometry)e.mesh.geometry.dispose();}effects=[];for(const n of numbers)n.el.remove();numbers=[];}
function requestLock(){try{const p=$('world').requestPointerLock?.();if(p&&p.catch)p.catch(()=>{if(state==='playing')$('lockHint').hidden=false;});}catch{$('lockHint').hidden=false;}}
function start(){initAudio();clearBattle();state='playing';lobby.visible=false;score=kills=xp=0;level=1;timeLeft=180;yaw=0;pitch=.1;vy=cooldown=respawn=attackAnim=0;invulnerable=3;spawnTimer=0;shake=hitFlash=hurtFlash=0;keys.clear();mouseDown=false;maxHp=CLASSES[selected].hp;hp=maxHp;player=character(selected);player.position.set(0,0,9);scene.add(player);$('menu').hidden=true;$('pauseScreen').hidden=true;$('endScreen').hidden=true;$('hud').hidden=false;$('respawn').hidden=true;$('lockHint').hidden=true;$('playerName').textContent=CLASSES[selected].name+' · '+CLASSES[selected].role;$('weaponName').textContent=CLASSES[selected].weapon;$('modeLabel').textContent=DIFF[difficulty].label+' · 3분 대전';for(let i=0;i<DIFF[difficulty].base;i++)spawnEnemy();updateCamera(1,true);updateHud();toast('출발! 빨간 링의 상대를 맞혀보세요');requestLock();}
function pause(){if(state!=='playing')return;state='paused';mouseDown=false;keys.clear();$('pauseScreen').hidden=false;document.exitPointerLock?.();}
function resume(){if(state!=='paused')return;state='playing';$('pauseScreen').hidden=true;lastFrame=performance.now();initAudio();requestLock();}
function menu(){state='menu';document.exitPointerLock?.();clearBattle();lobby.visible=true;keys.clear();mouseDown=false;$('menu').hidden=false;$('hud').hidden=true;$('pauseScreen').hidden=true;$('endScreen').hidden=true;}
function finish(){if(state!=='playing')return;state='ended';mouseDown=false;keys.clear();document.exitPointerLock?.();$('endScreen').hidden=false;$('finalScore').textContent=score.toLocaleString();$('finalKills').textContent=kills;$('finalLevel').textContent=level;let best=score;try{best=Math.max(Number(localStorage.getItem('pandora-rivals-best'))||0,score);localStorage.setItem('pandora-rivals-best',best);}catch{}$('bestScore').textContent=best.toLocaleString();tone(660,.25,'sine',.08,330);}
$('start').onclick=start;$('restart').onclick=start;$('pause').onclick=pause;$('resume').onclick=resume;$('backMenu').onclick=menu;$('chooseAgain').onclick=menu;$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('sound').onclick=()=>{muted=!muted;$('sound').textContent='소리 '+(muted?'OFF':'ON');$('sound').setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');};
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&state==='playing')e.preventDefault();if(e.code==='KeyP'||e.code==='Escape'){if(!e.repeat){if(state==='playing')pause();else if(state==='paused')resume();}return;}if(state==='playing'){keys.add(e.code);if(e.code==='Space'&&player.position.y<=.001&&respawn<=0){vy=9.5;tone(240,.12,'sine',.025,160);}}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='playing')pause();else if(document.pointerLockElement)$('lockHint').hidden=true;});
$('world').addEventListener('mousedown',e=>{if(e.button===0&&state==='playing'){mouseDown=true;initAudio();if(!document.pointerLockElement)requestLock();}});addEventListener('mouseup',()=>mouseDown=false);$('world').addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(state!=='playing')return;if(document.pointerLockElement||mouseDown){yaw-=e.movementX*.0024;pitch=T.MathUtils.clamp(pitch+e.movementY*.002,-.65,.65);}});
function blocked(x,z,r=.6){return obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);}
function constrain(pos,r=.6){const len=Math.hypot(pos.x,pos.z);if(len>39){pos.x*=39/len;pos.z*=39/len;}for(const o of obstacles){const dx=pos.x-o.x,dz=pos.z-o.z,d=Math.hypot(dx,dz),min=o.r+r;if(d<min&&pos.y<o.h){pos.x=o.x+(d>0?dx/d:1)*min;pos.z=o.z+(d>0?dz/d:0)*min;}}}
function spawnEnemy(){if(!player)return;const type=Math.floor(random()*4);let p=new V();for(let tries=0;tries<35;tries++){const a=range(0,TAU),r=range(13,23);p.set(player.position.x+Math.sin(a)*r,0,player.position.z+Math.cos(a)*r);if(p.length()<37&&!blocked(p.x,p.z,1.3))break;}if(p.length()>37)p.set(range(-12,12),0,-22);const root=character(type,true);root.position.copy(p);scene.add(root);const health=(62+level*7)*DIFF[difficulty].hp;enemies.push({root,type,hp:health,maxHp:health,cd:range(.8,2),attack:0,windup:0,aim:new V()});burst(p.clone().add(new V(0,1,0)),0xbe77ff,8,1);}


const particleGeo=new T.IcosahedronGeometry(.065,0),projectileGeo=new T.SphereGeometry(1,8,6),arrowGeo=new T.CylinderGeometry(.025,.025,.95,6),trailGeo=new T.CylinderGeometry(.035,.035,.65,6);
function burst(pos,color,count=12,power=2){for(let i=0;i<count;i++){if(effects.length>230)break;const m=new T.Mesh(particleGeo,mat(color,color,1.8));m.position.copy(pos);scene.add(m);effects.push({mesh:m,velocity:new V((random()-.5)*power*2,random()*power+1,(random()-.5)*power*2),life:range(.25,.65),max:.65,kind:'particle'});}}
function wave(pos,color,radius=4){const m=new T.Mesh(new T.TorusGeometry(1,.05,5,40),new T.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false}));m.rotation.x=Math.PI/2;m.position.copy(pos);m.position.y=Math.max(.1,m.position.y);scene.add(m);effects.push({mesh:m,life:.38,max:.38,kind:'wave',radius,ownedMaterial:true,ownedGeometry:true});}
function floatNumber(pos,text,kill=false){if(numbers.length>30){const old=numbers.shift();old.el.remove();}const el=document.createElement('div');el.className='damage-number'+(kill?' kill':'');el.textContent=text;$('floating').appendChild(el);numbers.push({el,pos:pos.clone(),life:.85});}
function xpNeeded(){return 40+level*15;}
function hurtEnemy(e,damage,pos){if(e.hp<=0)return;e.hp-=damage;burst(pos,CLASSES[selected].glow,6,2);floatNumber(pos,Math.round(damage));hitFlash=.16;shake=Math.max(shake,.07);tone(720,.055,'triangle',.035,140);e.root.userData.hpBar.scale.x=.86*Math.max(0,e.hp/e.maxHp);
if(e.hp<=0){kills++;score+=100+level*15;xp+=25;burst(e.root.position.clone().add(new V(0,1.2,0)),0xc5b3ff,18,4);floatNumber(e.root.position.clone().add(new V(0,2.6,0)),'+'+(100+level*15),true);tone(1000,.12,'sine',.055,350);disposeCharacter(e.root);
while(level<10&&xp>=xpNeeded()){xp-=xpNeeded();level++;hp=Math.min(maxHp,hp+28);toast('LEVEL '+level+'!  체력 +28');tone(500,.23,'triangle',.08,500);}if(level===10)xp=Math.min(xp,xpNeeded());}}
function hurtPlayer(damage){if(respawn>0||invulnerable>0||state!=='playing')return;hp=Math.max(0,hp-damage);hurtFlash=.55;shake=.24;tone(100,.13,'triangle',.08,-60);if(hp<=0){respawn=2.5;player.visible=false;mouseDown=false;burst(player.position.clone().add(new V(0,1,0)),0x72efff,24,4);$('respawn').hidden=false;}}
function explode(pos,damage,enemy=false){burst(pos,enemy?0xff608d:0xc692ff,28,6);wave(pos,enemy?0xff608d:0xaf8aff,4.8);tone(72,.32,'sawtooth',.06,-40);shake=Math.max(shake,.32);if(enemy){if(player.position.clone().add(new V(0,1,0)).distanceTo(pos)<4.8)hurtPlayer(damage);}else for(const e of enemies){const center=e.root.position.clone().add(new V(0,1.4,0)),d=center.distanceTo(pos);if(d<4.8)hurtEnemy(e,damage*(.55+.45*(1-d/4.8)),center);}}
function shootProjectile(origin,direction,type,enemy=false,damage=0){let geo=projectileGeo,scale=type===2?.22:type===0?.08:.09,col=enemy?0xff668d:CLASSES[selected].glow;if(type===0&&!enemy)geo=arrowGeo;if(type===1&&!enemy)geo=trailGeo;const m=new T.Mesh(geo,mat(col,col,2));m.position.copy(origin);if(geo===projectileGeo)m.scale.setScalar(scale);else m.quaternion.setFromUnitVectors(new V(0,1,0),direction);scene.add(m);projectiles.push({mesh:m,velocity:direction.clone().multiplyScalar(enemy?(type===2?13:18):(type===2?25:type===0?43:70)),life:enemy?3.5:2.8,type,enemy,damage,gravity:type===2?3:0});}
function aimDirection(origin){raycaster.setFromCamera(new T.Vector2(0,0),camera);let best=80;target.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction,best);for(const e of enemies){if(e.hp<=0)continue;const center=e.root.position.clone().add(new V(0,1.5,0)),delta=center.clone().sub(raycaster.ray.origin),along=delta.dot(raycaster.ray.direction),distance=delta.length(),off=Math.sqrt(Math.max(0,distance*distance-along*along));if(along>0&&along<best&&off<Math.max(.65,along*DIFF[difficulty].assist)){best=along;target.copy(center);}}
if(best===80){const hit=raycaster.ray.intersectPlane(new T.Plane(new V(0,1,0),0),new V());if(hit&&hit.distanceTo(camera.position)<80)target.copy(hit);}return target.clone().sub(origin).normalize();}
function attack(){if(cooldown>0||respawn>0)return;const c=CLASSES[selected];cooldown=c.rate;attackAnim=1;player.rotation.y=yaw+Math.PI;const origin=player.position.clone().add(new V(-Math.cos(yaw)*.43,1.65,Math.sin(yaw)*.43));forward.set(-Math.sin(yaw),0,-Math.cos(yaw));origin.addScaledVector(forward,.65);
if(selected===3){const g=new T.Mesh(new T.RingGeometry(.9,3.5,32,1,0,Math.PI*1.25),new T.MeshBasicMaterial({color:c.glow,side:T.DoubleSide,transparent:true,opacity:.7,depthWrite:false}));g.rotation.set(-Math.PI/2,0,-yaw);g.position.copy(player.position).add(new V(0,1.3,0));scene.add(g);effects.push({mesh:g,life:.19,max:.19,kind:'slash',ownedGeometry:true,ownedMaterial:true});for(const e of enemies){const delta=e.root.position.clone().sub(player.position),dist=delta.length();if(dist<4.6&&Math.abs(delta.y)<2&&delta.normalize().dot(forward)>-.15)hurtEnemy(e,c.damage,e.root.position.clone().add(new V(0,1.5,0)));}tone(330,.13,'triangle',.06,-250);shake=.06;}
else{shootProjectile(origin,aimDirection(origin),selected,false,c.damage);burst(origin,c.glow,selected===2?10:3,1.1);shake=selected===2?.16:selected===1?.04:.045;pitch=Math.max(-.65,pitch-(selected===1?.006:.002));tone(selected===2?90:selected===1?180:480,selected===2?.23:.08,selected===0?'sine':'triangle',.055,selected===0?-220:-90);}}
function segmentHit(a,b,center,r){const ab=b.clone().sub(a),t=T.MathUtils.clamp(center.clone().sub(a).dot(ab)/(ab.lengthSq()||1),0,1);return a.clone().addScaledVector(ab,t).distanceToSquared(center)<=r*r?t:null;}
function stepProjectiles(dt){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],a=p.mesh.position.clone();p.velocity.y-=p.gravity*dt;p.mesh.position.addScaledVector(p.velocity,dt);const b=p.mesh.position;p.life-=dt;let hitPos=null,victim=null,nearest=Infinity;
const targets=p.enemy?(respawn<=0?[{root:player}]:[]):enemies.filter(e=>e.hp>0);
for(const e of targets){const center=e.root.position.clone().add(new V(0,1.45,0)),t=segmentHit(a,b,center,p.type===2?1.1:.9);if(t!==null&&t<nearest){nearest=t;victim=e;hitPos=a.clone().lerp(b,t);}}
for(const o of obstacles){const t=segmentHit(a,b,new V(o.x,Math.min(o.h*.5,3),o.z),o.r);if(t!==null&&t<nearest){nearest=t;victim=null;hitPos=a.clone().lerp(b,t);}}
if(b.y<.05&&!hitPos)hitPos=b.clone().setY(.05);
if(hitPos){if(p.type===2)explode(hitPos,p.damage,p.enemy);else if(victim){if(p.enemy){hurtPlayer(p.damage);burst(hitPos,0xff668d,5,2);}else hurtEnemy(victim,p.damage,hitPos);}else burst(hitPos,p.enemy?0xff668d:0x8ddae5,4,1);p.life=0;}
if(p.life<=0||b.length()>110){scene.remove(p.mesh);projectiles.splice(i,1);}}
}
function updateEnemies(dt){const diff=DIFF[difficulty];for(const e of enemies){if(e.hp<=0)continue;e.cd-=dt;e.attack=Math.max(0,e.attack-dt*4);const delta=player.position.clone().sub(e.root.position);delta.y=0;const dist=delta.length(),dir=delta.clone().normalize();e.root.rotation.y=Math.atan2(dir.x,dir.z);let moving=0;
if(respawn<=0){const desired=e.type===3?1.9:e.type===2?11:8;if(dist>desired){let travel=dir.clone();const ahead=e.root.position.clone().addScaledVector(dir,1.8);if(blocked(ahead.x,ahead.z,.75))travel.set(dir.z,0,-dir.x);const vel=travel.multiplyScalar((2.7+level*.13)*diff.speed*dt);if(e.windup>0)vel.multiplyScalar(.3);e.root.position.add(vel);moving=1;}else if(e.type!==3&&dist<5){e.root.position.addScaledVector(dir,-dt*2);moving=.7;}
if(e.windup>0){e.windup-=dt;e.root.userData.groundRing.scale.setScalar(1+Math.sin(simTime*25)*.15);if(e.windup<=0){e.attack=1;const origin=e.root.position.clone().add(new V(0,1.6,0)),aim=e.aim.clone().sub(origin).normalize();if(e.type===3){if(dist<3.1&&player.position.y<2)hurtPlayer((14+level)*diff.damage);wave(e.root.position,0xff668d,2.2);}else shootProjectile(origin,aim,e.type,true,(e.type===2?24:11+level)*diff.damage);e.cd=(e.type===1?1.1:e.type===3?1.1:1.9)/diff.speed;e.root.userData.groundRing.scale.setScalar(1);}}
else if(e.cd<=0&&dist<(e.type===3?2.9:24)){e.windup=e.type===3?.35:.55;e.aim.copy(player.position).add(new V(range(-.45,.45),1.35,range(-.45,.45)));}
}
constrain(e.root.position,.65);if(respawn<=0&&Math.abs(player.position.y-e.root.position.y)<2.4){const d=player.position.clone().sub(e.root.position);d.y=0;const l=d.length();if(l<1.15){if(l===0)d.set(1,0,0);else d.normalize();e.root.position.addScaledVector(d,-(1.15-l)*.5);player.position.addScaledVector(d,(1.15-l)*.5);}}
for(const other of enemies){if(other===e||other.hp<=0)continue;const d=e.root.position.clone().sub(other.root.position);d.y=0;const l=d.length();if(l>0&&l<1.25)e.root.position.addScaledVector(d,(1.25-l)*.5/l);}
animateCharacter(e.root,simTime,moving,e.attack);e.root.userData.hpRoot.quaternion.copy(camera.quaternion);
}enemies=enemies.filter(e=>e.hp>0);}


function updateCamera(dt,snap=false){if(!player)return;cameraTarget.copy(player.position).add(new V(0,1.8,0));const distance=6.2;cameraDesired.copy(cameraTarget).add(new V(Math.sin(yaw)*Math.cos(pitch)*distance,1+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance));cameraDesired.add(new V(Math.cos(yaw)*.75,0,-Math.sin(yaw)*.75));cameraDesired.y=Math.max(.45,cameraDesired.y);
for(const o of obstacles){const t=segmentHit(cameraTarget,cameraDesired,new V(o.x,Math.min(o.h*.5,3),o.z),o.r+.4);if(t!==null)cameraDesired.lerp(cameraTarget,Math.max(.15,1-t+.15));}
if(snap)camera.position.copy(cameraDesired);else camera.position.lerp(cameraDesired,1-Math.exp(-14*dt));if(shake>0)camera.position.add(new V((Math.random()-.5)*shake,(Math.random()-.5)*shake,0));camera.lookAt(cameraTarget.clone().add(new V(-Math.sin(yaw)*10,-Math.sin(pitch)*10,-Math.cos(yaw)*10)));camera.updateMatrixWorld();}
function updateHud(){const secs=Math.ceil(Math.max(0,timeLeft));$('timer').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');document.querySelector('.timer').classList.toggle('urgent',secs<=20);$('score').textContent=score.toLocaleString();$('kills').textContent=kills+' 처치';$('hpText').textContent=Math.ceil(hp)+' / '+maxHp;$('hpFill').style.width=100*hp/maxHp+'%';$('level').textContent='LV. '+level;$('xpText').textContent=level===10?'최고 레벨!':'경험치 '+xp+' / '+xpNeeded();$('xpFill').style.width=(level===10?100:100*xp/xpNeeded())+'%';$('cooldownFill').style.width=100*(1-Math.max(0,cooldown)/CLASSES[selected].rate)+'%';$('weaponStatus').textContent=respawn>0?'다시 준비 중':cooldown>.06?'공격 중':'공격 준비';}
function step(dt){if(state!=='playing')return;simTime+=dt;timeLeft=Math.max(0,timeLeft-dt);if(timeLeft<=0){finish();updateHud();return;}cooldown=Math.max(0,cooldown-dt);attackAnim=Math.max(0,attackAnim-dt/(CLASSES[selected].rate*.85));invulnerable=Math.max(0,invulnerable-dt);shake=Math.max(0,shake-dt*1.8);
if(respawn>0){respawn-=dt;$('respawn').textContent='다시 출발까지 '+Math.max(1,Math.ceil(respawn))+'초';if(respawn<=0){hp=maxHp;vy=0;player.position.set(0,0,9);for(let k=0;k<30;k++){const candidate=new V(range(-20,20),0,range(-20,20));if(!blocked(candidate.x,candidate.z,2)&&enemies.every(e=>e.root.position.distanceTo(candidate)>7)){player.position.copy(candidate);break;}}player.visible=true;invulnerable=3;$('respawn').hidden=true;toast('다시 출발! 3초 동안 보호받아요');}}
else{movement.set(0,0,0);forward.set(-Math.sin(yaw),0,-Math.cos(yaw));if(keys.has('KeyW')||keys.has('ArrowUp'))movement.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))movement.sub(forward);const right=new V(Math.cos(yaw),0,-Math.sin(yaw));if(keys.has('KeyD')||keys.has('ArrowRight'))movement.add(right);if(keys.has('KeyA')||keys.has('ArrowLeft'))movement.sub(right);const moving=movement.lengthSq()>0?1:0;movement.normalize().multiplyScalar(CLASSES[selected].speed*(keys.has('ShiftLeft')||keys.has('ShiftRight')?1.5:1)*dt);player.position.add(movement);vy-=24*dt;player.position.y=Math.max(0,player.position.y+vy*dt);if(player.position.y===0)vy=0;constrain(player.position);player.rotation.y=yaw+Math.PI;animateCharacter(player,simTime,moving,attackAnim);player.visible=invulnerable<=0||Math.floor(simTime*12)%3!==0;if(mouseDown)attack();}
updateEnemies(dt);stepProjectiles(dt);spawnTimer-=dt;const desired=DIFF[difficulty].base+Math.floor((level-1)*.7);if(spawnTimer<=0&&enemies.length<desired){spawnEnemy();spawnTimer=1.4;}updateCamera(dt);hudClock-=dt;if(hudClock<=0){updateHud();hudClock=.075;}
}
function updateEffects(dt){for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.kind==='particle'){e.velocity.y-=7*dt;e.mesh.position.addScaledVector(e.velocity,dt);e.mesh.scale.setScalar(Math.max(.01,e.life/e.max));}else if(e.kind==='wave'){e.mesh.scale.setScalar(.2+(1-e.life/e.max)*e.radius);e.mesh.material.opacity=Math.max(0,e.life/e.max)*.8;}else{e.mesh.material.opacity=Math.max(0,e.life/e.max)*.7;e.mesh.rotation.z+=dt*8;}if(e.life<=0){scene.remove(e.mesh);if(e.ownedMaterial)e.mesh.material.dispose();if(e.ownedGeometry)e.mesh.geometry.dispose();effects.splice(i,1);}}
for(let i=numbers.length-1;i>=0;i--){const n=numbers[i];n.life-=dt;n.pos.y+=dt*1.3;const p=n.pos.clone().project(camera);n.el.style.left=(p.x*.5+.5)*innerWidth+'px';n.el.style.top=(-p.y*.5+.5)*innerHeight+'px';n.el.style.opacity=p.z>1?'0':Math.min(1,n.life*2);if(n.life<=0){n.el.remove();numbers.splice(i,1);}}
hitFlash=Math.max(0,hitFlash-dt);hurtFlash=Math.max(0,hurtFlash-dt*1.7);toastTime=Math.max(0,toastTime-dt);$('hitmarker').style.opacity=hitFlash>0?'1':'0';$('damageFlash').style.opacity=hurtFlash;$('toast').style.opacity=toastTime>0?'1':'0';}
function frame(now){const elapsed=Math.max(0,(now-lastFrame)/1000),dt=Math.min(.05,elapsed);lastFrame=now;try{if(state==='menu'){simTime+=dt;const narrow=innerWidth<600;camera.position.set(Math.sin(simTime*.12)*.22,narrow?5.2:4.4,narrow?21:15.4);camera.lookAt(0,narrow?1.5:.15,0);const spread=narrow?3.25:Math.min(6.6,3.25*camera.aspect/1.05);previews.forEach((p,i)=>{p.position.x=(i-1.5)*spread;lobby.children[i*3].position.x=p.position.x;lobby.children[i*3+1].position.x=p.position.x;p.rotation.y=Math.sin(simTime*.35+i)*.13+(i-1.5)*-.08;animateCharacter(p,simTime,0,0);p.scale.setScalar(i===selected?1.43:1.33);});}else if(state==='playing'){timeLeft-=Math.max(0,elapsed-dt);step(dt);updateEffects(dt);}
if(state==='menu'||state==='playing'){floaters.forEach((f,i)=>f.position.y=f.userData.base+Math.sin(simTime*.5+i)*.6);plants.forEach((p,i)=>p.rotation.z=Math.sin(simTime+i)*.035);stars.rotation.y=simTime*.007;}
renderer.render(scene,camera);requestAnimationFrame(frame);}catch(e){console.error(e);fail('게임 실행 중 문제가 생겼어요. 새로고침해 주세요. '+e.message);}}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();fail('그래픽 연결이 끊겼어요. 다른 3D 탭을 닫고 다시 불러와 주세요.');});
$('loading').hidden=true;requestAnimationFrame(frame);
// Explicit test mode only; not exposed in ordinary play.
if(new URLSearchParams(location.search).has('test'))window.__game={start,step,attack,finish,menu,pause,resume,selectClass,setDifficulty:d=>difficulty=d,snapshot:()=>({state,selected,difficulty,score,kills,level,xp,hp,timeLeft,enemies:enemies.length,enemyHP:enemies.map(e=>e.hp),projectiles:projectiles.length,respawn,position:player?.position.toArray()}),damagePlayer:hurtPlayer,damageEnemy:(i,d)=>hurtEnemy(enemies[i],d,enemies[i].root.position.clone().add(new V(0,1.5,0))),setEnemyPosition:(i,x,y,z)=>enemies[i].root.position.set(x,y,z),setPlayerPosition:(x,y,z)=>player.position.set(x,y,z),setInvulnerable:v=>invulnerable=v,setCooldown:v=>cooldown=v,setTime:v=>timeLeft=v,setXP:v=>xp=v,getScene:()=>scene};
})();

