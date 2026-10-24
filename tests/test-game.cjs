
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
class Element{constructor(){this.hidden=false;this.style={setProperty(){}};this.classList={toggle(){},add(){},remove(){}};this.children=[];this.dataset={};this.textContent='';this.listeners={};}appendChild(e){this.children.push(e);}setAttribute(){}addEventListener(k,fn){this.listeners[k]=fn;}remove(){}showModal(){this.open=true;}close(){this.open=false;}}
const els={},events={};const difficulties=['easy','normal','hard'].map(d=>{const e=new Element();e.dataset.difficulty=d;return e;});
const doc={getElementById:id=>els[id]??=(new Element()),createElement:()=>new Element(),querySelector:()=>els.timerClass??=new Element(),querySelectorAll:s=>s==='.character-card'?els.characterCards.children:difficulties,addEventListener:(k,f)=>events[k]=f,exitPointerLock(){},hidden:false};
const fakeRenderer=class{setPixelRatio(){}setSize(){}render(){}};
const ctx={THREE:{...THREE,WebGLRenderer:fakeRenderer},document:doc,devicePixelRatio:1,innerWidth:1280,innerHeight:800,performance:{now:()=>0},location:{search:'?test'},URLSearchParams,console,localStorage:{getItem(){return null;},setItem(){}},addEventListener:(k,f)=>events[k]=f,requestAnimationFrame:fn=>ctx.frame=fn};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8'),ctx);
const g=ctx.__game;assert.ok(g);let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
check('4 character selection buttons',()=>assert.equal(els.characterCards.children.length,4));
for(let c=0;c<4;c++)check('class '+c+' attack damages a target',()=>{g.selectClass(c);g.start();g.setInvulnerable(999);g.setEnemyPosition(0,0,0,c===3?6:0);g.setEnemyPosition(1,25,0,25);g.setEnemyPosition(2,-25,0,25);const before=g.snapshot().enemyHP[0];g.attack();for(let i=0;i<45;i++)g.step(1/60);const after=g.snapshot();assert.ok(after.kills>0||after.enemyHP[0]<before,JSON.stringify(after));g.menu();});
check('pause freezes timer and resume restores play',()=>{g.start();g.step(.1);g.pause();const time=g.snapshot().timeLeft;g.step(1);assert.equal(g.snapshot().timeLeft,time);g.resume();g.step(.1);assert.ok(g.snapshot().timeLeft<time);});
check('W movement and sprint',()=>{g.start();events.keydown({code:'KeyW',preventDefault(){}});g.step(.1);const p=g.snapshot().position[2];assert.ok(p<9);events.keydown({code:'ShiftLeft'});g.step(.1);assert.ok(p-g.snapshot().position[2]>.9);events.keyup({code:'KeyW'});events.keyup({code:'ShiftLeft'});});
check('jump rises and lands',()=>{g.start();events.keydown({code:'Space',preventDefault(){}});g.step(.1);assert.ok(g.snapshot().position[1]>0);for(let i=0;i<100;i++)g.step(.02);assert.equal(g.snapshot().position[1],0);});
check('arena boundary collision',()=>{g.setPlayerPosition(100,0,0);g.step(.01);const p=g.snapshot().position;assert.ok(Math.hypot(p[0],p[2])<=39.01);});
check('death and respawn restore health',()=>{g.start();g.setInvulnerable(0);g.damagePlayer(999);assert.equal(g.snapshot().hp,0);assert.ok(g.snapshot().respawn>0);for(let i=0;i<160;i++)g.step(.02);assert.ok(g.snapshot().hp>0);assert.ok(g.snapshot().respawn<=0);});
check('kills grant score and level is capped at 10',()=>{g.start();g.setXP(10000);g.damageEnemy(0,9999);assert.equal(g.snapshot().level,10);assert.equal(g.snapshot().kills,1);assert.ok(g.snapshot().score>0);g.step(.01);assert.ok(g.snapshot().enemies>=3);});
check('difficulty changes enemy count and health',()=>{g.setDifficulty('easy');g.start();const easy=g.snapshot();g.setDifficulty('hard');g.start();const hard=g.snapshot();assert.ok(hard.enemies>easy.enemies);assert.ok(hard.enemyHP[0]>easy.enemyHP[0]);});
check('AI damages player over time',()=>{g.setDifficulty('easy');g.start();g.setInvulnerable(0);const initial=g.snapshot().hp;for(let i=0;i<800;i++)g.step(.02);assert.ok(g.snapshot().hp<initial||g.snapshot().respawn>0);});
check('180-second round ends and restart resets all counters',()=>{g.start();for(let i=0;i<3601;i++)g.step(.05);assert.equal(g.snapshot().state,'ended');assert.equal(g.snapshot().timeLeft,0);assert.equal(els.endScreen.hidden,false);g.start();assert.equal(g.snapshot().timeLeft,180);assert.equal(g.snapshot().score,0);assert.equal(g.snapshot().level,1);});
check('render loop does not throw',()=>{g.menu();ctx.frame(100);g.start();ctx.frame(116);assert.ok(!els.error);});
console.log('Passed '+passed+' checks. WebGL rendering is mocked; visual/browser verification is separate.');


