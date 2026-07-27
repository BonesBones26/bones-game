(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const groundY = 635;
  const launcher = {x: 160, y: 530};
  const MAX_DRAG = 150;
  const LAUNCH_FORCE = 6.65;
  const GRAVITY = 430;

  const startOverlay = document.getElementById('startOverlay');
  const resultOverlay = document.getElementById('resultOverlay');
  const resultLabel = document.getElementById('resultLabel');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
  const nextBtn = document.getElementById('nextBtn');
  const retryBtn = document.getElementById('retryBtn');
  const soundBtn = document.getElementById('soundBtn');
  let soundEnabled = false;
  let audioContext = null;
  let lastImpactSoundAt = 0;
  let musicTimer = null;
  let musicBus = null;
  let musicPlaying = false;

  function getAudioContext(){
    if(!audioContext){
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(!AudioCtx) return null;
      audioContext = new AudioCtx();
    }
    if(audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function playLaunchSound(){
    if(!soundEnabled) return;
    const ac = getAudioContext();
    if(!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + .22);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.22, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .25);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + .26);

    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * .18), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
    const noise = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const noiseGain = ac.createGain();
    filter.type='highpass';
    filter.frequency.value=900;
    noiseGain.gain.setValueAtTime(.12,now);
    noiseGain.gain.exponentialRampToValueAtTime(.0001,now+.18);
    noise.buffer=buffer;
    noise.connect(filter).connect(noiseGain).connect(ac.destination);
    noise.start(now);
  }

  function playImpactSound(intensity=1){
    if(!soundEnabled) return;
    const nowMs = performance.now();
    if(nowMs-lastImpactSoundAt < 70) return;
    lastImpactSoundAt = nowMs;
    const ac = getAudioContext();
    if(!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(115 + Math.min(90,intensity*25), now);
    osc.frequency.exponentialRampToValueAtTime(48, now+.16);
    gain.gain.setValueAtTime(Math.min(.3,.11+intensity*.035),now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.2);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now+.21);
  }


  function playTone(ac, frequency, start, duration, volume=.03, type='triangle', destination=null){
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain).connect(destination || ac.destination);
    osc.start(start);
    osc.stop(start + duration + .03);
  }

  function playAbilitySound(ci=0){
    if(!soundEnabled) return;
    const ac = getAudioContext();
    if(!ac) return;
    const now = ac.currentTime;
    const sets = [
      [560, 760],
      [220, 160],
      [420, 520, 680],
      [300, 450, 600]
    ];
    const seq = sets[ci] || sets[0];
    seq.forEach((freq, index) => playTone(ac, freq, now + index * .05, .12, .045, index % 2 ? 'sine' : 'triangle'));
  }

  function playTargetSound(){
    if(!soundEnabled) return;
    const ac = getAudioContext();
    if(!ac) return;
    const now = ac.currentTime;
    [660, 880, 1108].forEach((freq, i) => playTone(ac, freq, now + i * .06, .16, .05, 'triangle'));
  }

  function playCompleteSound(finalDemo=false){
    if(!soundEnabled) return;
    const ac = getAudioContext();
    if(!ac) return;
    const now = ac.currentTime;
    const notes = finalDemo ? [392, 523.25, 659.25, 783.99, 1046.5] : [392, 523.25, 659.25];
    notes.forEach((freq, i) => playTone(ac, freq, now + i * .09, .22, finalDemo ? .06 : .05, 'triangle'));
  }

  function startMusic(){
    if(!soundEnabled || musicPlaying) return;
    const ac = getAudioContext();
    if(!ac) return;
    musicBus = ac.createGain();
    musicBus.gain.setValueAtTime(.0001, ac.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(.12, ac.currentTime + .6);
    musicBus.connect(ac.destination);
    musicPlaying = true;
    const melody = [
      [523.25,.28],[659.25,.28],[783.99,.28],[659.25,.28],[587.33,.28],[523.25,.28],[659.25,.36],[0,.12],
      [493.88,.28],[587.33,.28],[659.25,.28],[587.33,.28],[523.25,.28],[493.88,.28],[440,.36],[0,.12]
    ];
    const bass = [261.63,261.63,220,220,293.66,293.66,246.94,246.94];
    let nextTime = ac.currentTime + .08;
    const loopDuration = melody.reduce((sum, item) => sum + item[1], 0);
    function scheduleLoop(start){
      let t = start;
      melody.forEach(([freq, len], idx) => {
        if(freq > 0) playTone(ac, freq, t, Math.max(.12, len * .9), .03, idx % 3 === 0 ? 'sine' : 'triangle', musicBus);
        t += len;
      });
      bass.forEach((freq, idx) => {
        playTone(ac, freq, start + idx * .5, .42, .022, 'sine', musicBus);
      });
    }
    function tick(){
      if(!soundEnabled || !musicPlaying) return;
      while(nextTime < ac.currentTime + 1.1){
        scheduleLoop(nextTime);
        nextTime += loopDuration;
      }
      musicTimer = setTimeout(tick, 250);
    }
    tick();
  }

  function stopMusic(){
    if(musicTimer){
      clearTimeout(musicTimer);
      musicTimer = null;
    }
    if(musicBus && audioContext){
      const now = audioContext.currentTime;
      try {
        musicBus.gain.cancelScheduledValues(now);
        musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value || .12), now);
        musicBus.gain.exponentialRampToValueAtTime(.0001, now + .25);
      } catch(e) {}
      setTimeout(() => {
        try { musicBus.disconnect(); } catch(e) {}
      }, 320);
    }
    musicBus = null;
    musicPlaying = false;
  }

  if(soundBtn){
    soundBtn.addEventListener('click',()=>{
      soundEnabled=!soundEnabled;
      if(soundEnabled){
        getAudioContext();
        startMusic();
        playTargetSound();
      } else {
        stopMusic();
      }
      soundBtn.textContent=`Sound: ${soundEnabled?'on':'off'}`;
      soundBtn.setAttribute('aria-pressed',String(soundEnabled));
    });
  }

  const registryForm = document.getElementById('walletRegistryForm');
  const walletInput = document.getElementById('walletInput');
  const walletRegisterBtn = document.getElementById('walletRegisterBtn');
  const walletRegistryMessage = document.getElementById('walletRegistryMessage');
  const walletRegistryList = document.getElementById('walletRegistryList');
  const levelsProgress = document.getElementById('levelsProgress');
  const registryCount = document.getElementById('registryCount');
  const REGISTRY_KEY = 'bones_wallet_registry_v18';
  const COMPLETED_KEY = 'bones_completed_levels_v18';

  const chars = [
    {name:'Green Ranger',accent:'#83b761',dark:'#35583a',power:'BOOST',mass:1.08},
    {name:'Forest Centurion',accent:'#6e965d',dark:'#334b35',power:'SLAM',mass:1.72},
    {name:'Green Scholar',accent:'#9bb66d',dark:'#38513c',power:'BLAST',mass:1.02},
    {name:'Shadow Scout',accent:'#86b764',dark:'#111715',power:'DASH',mass:1.18}
  ];

  const levels = [
    {
      name:'Greenwood Stack', sky:'#0c1930', shots:[0,3,1,2,0,1],
      blocks:[
        [735,535,48,100,'wood'],[855,535,48,100,'wood'],[720,505,205,30,'book'],
        [785,420,44,85,'stone'],[870,420,44,85,'wood'],[760,390,180,30,'book'],
        [820,310,48,80,'wood'],[790,280,140,28,'stone']
      ], targets:[[905,358,22]]
    },
    {
      name:'Shadow Library', sky:'#10152d', shots:[3,0,2,1,3,0,2],
      blocks:[
        [705,555,55,80,'stone'],[805,555,48,80,'wood'],[915,555,55,80,'stone'],[1020,555,48,80,'wood'],
        [685,520,405,35,'book'],[755,430,44,90,'wood'],[875,430,48,90,'stone'],[995,430,44,90,'wood'],
        [725,395,350,35,'book'],[825,315,50,80,'wood'],[930,315,50,80,'wood'],[795,282,215,33,'stone']
      ], targets:[[815,248,21],[1005,290,22]]
    },
    {
      name:'Moonbone Citadel', sky:'#07172b', shots:[1,3,0,2,1,0,3],
      blocks:[
        [680,535,50,100,'stone'],[775,535,44,100,'wood'],[870,535,50,100,'stone'],[970,535,44,100,'wood'],[1065,535,50,100,'stone'],
        [660,505,480,30,'book'],[720,410,45,95,'wood'],[830,410,50,95,'stone'],[945,410,45,95,'wood'],[1050,410,50,95,'stone'],
        [690,378,440,32,'book'],[780,295,48,83,'wood'],[900,295,52,83,'stone'],[1025,295,48,83,'wood'],
        [745,262,360,33,'book'],[855,180,50,82,'wood'],[955,180,50,82,'wood'],[825,148,210,32,'stone']
      ], targets:[[1030,350,22],[895,114,23],[780,347,20]]
    },
    {
      name:'Lantern Rampart', sky:'#0b2030', shots:[0,1,3,2,0,3,1],
      blocks:[
        [710,540,48,95,'wood'],[790,540,48,95,'wood'],[870,540,48,95,'stone'],[950,540,48,95,'wood'],
        [690,505,330,30,'book'],[760,430,48,75,'stone'],[845,430,48,75,'wood'],[930,430,48,75,'stone'],
        [740,398,275,28,'book'],[810,320,48,78,'wood'],[900,320,48,78,'wood'],[785,288,195,28,'stone'],
        [1015,520,42,115,'wood'],[1000,485,72,25,'book']
      ], targets:[[1008,455,19],[920,285,21]]
    },
    {
      name:'Verdant Vault', sky:'#102233', shots:[2,3,0,1,2,0,3,1],
      blocks:[
        [690,545,58,90,'stone'],[790,545,52,90,'wood'],[890,545,58,90,'stone'],[990,545,52,90,'wood'],
        [680,512,385,28,'book'],[740,430,44,82,'wood'],[840,430,52,82,'stone'],[940,430,44,82,'wood'],
        [720,398,350,28,'book'],[790,320,44,78,'wood'],[900,320,52,78,'stone'],[760,288,250,28,'book'],
        [830,208,44,80,'wood'],[930,208,44,80,'wood'],[805,176,175,28,'stone']
      ], targets:[[930,170,21],[825,170,21],[1000,502,18]]
    },
    {
      name:'Masked Keep', sky:'#091520', shots:[3,0,1,2,3,0,1,2],
      blocks:[
        [700,550,52,85,'stone'],[780,550,48,85,'wood'],[860,550,52,85,'stone'],[940,550,48,85,'wood'],[1020,550,52,85,'stone'],
        [690,520,400,28,'book'],[735,448,44,72,'wood'],[820,448,48,72,'stone'],[905,448,44,72,'wood'],[990,448,48,72,'stone'],
        [715,418,390,26,'book'],[770,340,44,76,'wood'],[860,340,48,76,'stone'],[950,340,44,76,'wood'],
        [750,310,315,26,'book'],[835,230,48,76,'wood'],[935,230,48,76,'wood'],[810,198,205,28,'stone']
      ], targets:[[1015,515,18],[930,224,20],[860,190,22]]
    }
  ];

  let levelIndex = 0;
  let blocks = [];
  let targets = [];
  let shotQueue = [];
  let shotIndex = 0;
  let score = 0;
  let started = false;
  let aiming = false;
  let drag = {x:launcher.x,y:launcher.y};
  let projectile = null;
  let particles = [];
  let last = performance.now();
  let resultShown = false;

  let completedLevelsSet = new Set(JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]'));
  let registeredWallets = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]');

  function saveCompletedLevels(){
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...completedLevelsSet].sort((a,b)=>a-b)));
  }

  function saveRegisteredWallets(){
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registeredWallets));
  }

  function shortWallet(address){
    return `${address.slice(0,6)}…${address.slice(-4)}`;
  }

  function isQualifiedForRegistry(){
    return completedLevelsSet.size >= 5;
  }

  function renderRegisteredWallets(){
    if(!walletRegistryList) return;
    walletRegistryList.innerHTML = '';
    registeredWallets.forEach(address => {
      const li = document.createElement('li');
      li.textContent = shortWallet(address);
      walletRegistryList.appendChild(li);
    });
  }

  function updateRegistryUI(message=''){
    if(levelsProgress) levelsProgress.textContent = `${Math.min(completedLevelsSet.size,5)} / 5 levels completed`;
    if(registryCount) registryCount.textContent = `${registeredWallets.length} / 500 wallets registered`;
    if(walletRegisterBtn){
      const enabled = isQualifiedForRegistry() && registeredWallets.length < 500;
      walletRegisterBtn.disabled = !enabled;
      walletRegisterBtn.textContent = enabled ? 'Register wallet' : (registeredWallets.length >= 500 ? 'Registry full' : 'Unlock after 5 levels');
    }
    if(walletRegistryMessage){
      if(message) walletRegistryMessage.textContent = message;
      else if(registeredWallets.length >= 500) walletRegistryMessage.textContent = 'The local prototype registry is full.';
      else if(isQualifiedForRegistry()) walletRegistryMessage.textContent = 'Registry unlocked. Enter one EVM wallet to save your spot locally.';
      else walletRegistryMessage.textContent = 'Clear 5 levels to unlock the registry.';
    }
    renderRegisteredWallets();
  }

  function markLevelCompleted(index){
    const before = completedLevelsSet.size;
    completedLevelsSet.add(index);
    if(completedLevelsSet.size !== before) saveCompletedLevels();
    if(isQualifiedForRegistry() && before < 5) {
      updateRegistryUI('Registry unlocked — you can now register one wallet.');
    } else {
      updateRegistryUI();
    }
  }

  function loadLevel(index){
    levelIndex = index;
    const level = levels[index];
    blocks = level.blocks.map((b,i) => {
      const vertical = b[3] > b[2] * 1.25;
      const heightMultiplier = vertical ? 1.24 : 1;
      const boostedHeight = Math.round(b[3] * heightMultiplier);
      const boostedY = vertical ? b[1] - (boostedHeight - b[3]) : b[1];
      return {
        id:i,x:b[0],y:boostedY,w:b[2],h:boostedHeight,type:b[4],vx:0,vy:0,angle:0,spin:0,
        hp:b[4] === 'stone' ? 1.55 : b[4] === 'book' ? .9 : .72,
        active:true,hitFlash:0
      };
    });
    targets = level.targets.map((t,i)=>({id:i,x:t[0],y:t[1],r:t[2],active:true,wobble:Math.random()*6}));
    shotQueue = [...level.shots];
    shotIndex = 0;
    score = 0;
    projectile = null;
    particles = [];
    resultShown = false;
    aiming = false;
    drag = {x:launcher.x,y:launcher.y};
    resultOverlay.classList.add('hidden');
  }

  function resetLevel(){
    loadLevel(levelIndex);
    started = true;
    startOverlay.classList.add('hidden');
  }

  function getPointer(event){
    const rect = canvas.getBoundingClientRect();
    const p = event.touches ? event.touches[0] : event;
    return {
      x:(p.clientX-rect.left)*W/rect.width,
      y:(p.clientY-rect.top)*H/rect.height
    };
  }

  canvas.addEventListener('pointerdown', event => {
    if(!started || resultShown) return;
    const p = getPointer(event);
    if(projectile && projectile.active){
      activateAbility();
      return;
    }
    if(!projectile && shotIndex < shotQueue.length && Math.hypot(p.x-launcher.x,p.y-launcher.y) < 175){
      aiming = true;
      drag = p;
      canvas.setPointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener('pointermove', event => {
    if(!aiming) return;
    const p = getPointer(event);
    let dx = p.x-launcher.x;
    let dy = p.y-launcher.y;
    const distance = Math.hypot(dx,dy);
    if(distance > MAX_DRAG){
      dx *= MAX_DRAG/distance;
      dy *= MAX_DRAG/distance;
    }
    drag = {
      x:launcher.x + Math.min(dx,20),
      y:launcher.y + dy
    };
  });

  canvas.addEventListener('pointerup', () => {
    if(!aiming) return;
    aiming = false;
    launch();
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  window.addEventListener('keydown', event => {
    if(event.key.toLowerCase() === 'r') resetLevel();
    if(event.code === 'Space' && projectile && projectile.active){
      event.preventDefault();
      activateAbility();
    }
  });

  document.getElementById('startBtn').onclick = () => {
    started = true;
    startOverlay.classList.add('hidden');
    if(soundEnabled) startMusic();
    loadLevel(0);
  };
  retryBtn.onclick = () => { if(soundEnabled) startMusic(); resetLevel(); };
  nextBtn.onclick = () => {
    if (nextBtn.dataset.action === 'registry') {
      resultOverlay.classList.add('hidden');
      if(soundEnabled) startMusic();
      const panel = document.querySelector('.registry-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    loadLevel(levelIndex < levels.length-1 ? levelIndex+1 : 0);
    started = true;
    if(soundEnabled) startMusic();
    resultOverlay.classList.add('hidden');
  };


  if (registryForm) {
    registryForm.addEventListener('submit', event => {
      event.preventDefault();
      if(!isQualifiedForRegistry()) {
        updateRegistryUI('You must clear 5 levels before registering a wallet.');
        return;
      }
      if(registeredWallets.length >= 500) {
        updateRegistryUI('The local prototype registry is already full.');
        return;
      }
      const wallet = (walletInput.value || '').trim();
      if(!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        updateRegistryUI('Enter a valid EVM wallet address.');
        return;
      }
      const exists = registeredWallets.some(entry => entry.toLowerCase() === wallet.toLowerCase());
      if(exists) {
        updateRegistryUI('That wallet is already registered in this local demo.');
        return;
      }
      registeredWallets.push(wallet);
      saveRegisteredWallets();
      walletInput.value = '';
      updateRegistryUI(`Wallet saved locally as entry #${registeredWallets.length}.`);
    });
  }

  function launch(){
    const dx = launcher.x-drag.x;
    const dy = launcher.y-drag.y;
    const power = Math.hypot(dx,dy);
    if(power < 14) return;
    const ci = shotQueue[shotIndex++];
    playLaunchSound();
    projectile = {
      x:launcher.x+28,
      y:launcher.y-10,
      vx:dx*LAUNCH_FORCE,
      vy:dy*LAUNCH_FORCE,
      r:24,
      ci,
      active:true,
      ability:false,
      age:0,
      trail:[]
    };
    burst(projectile.x,projectile.y,12,chars[ci].accent);
    playLaunchSound();
  }

  function activateAbility(){
    const p = projectile;
    if(!p || p.ability) return;
    p.ability = true;
    const c = p.ci;
    playAbilitySound(c);
    if(c === 0){
      p.vx *= 1.85;
      p.vy *= .92;
      p.r = 26;
      burst(p.x,p.y,24,chars[c].accent);
    }
    if(c === 1){
      p.vx *= .42;
      p.vy = 690;
      p.r = 31;
      burst(p.x,p.y,30,chars[c].accent);
    }
    if(c === 2){
      explode(p.x,p.y,185,2.65);
      burst(p.x,p.y,50,'#d8f5a9');
    }
    if(c === 3){
      p.vx = Math.max(840,Math.abs(p.vx)*2.05);
      p.vy *= .28;
      p.r = 25;
      burst(p.x,p.y,35,'#91c771');
    }
  }

  function explode(x,y,r,power){
    blocks.forEach(block => {
      if(!block.active) return;
      const bx = block.x+block.w/2;
      const by = block.y+block.h/2;
      const distance = Math.hypot(bx-x,by-y);
      if(distance < r){
        const falloff = 1-distance/r;
        block.hp -= power*falloff;
        block.vx += (bx-x)/(distance||1)*420*falloff;
        block.vy += (by-y)/(distance||1)*320*falloff-160;
        block.spin += (Math.random()-.5)*4;
        if(block.hp <= 0) destroyBlock(block);
      }
    });
    targets.forEach(target => {
      if(target.active && Math.hypot(target.x-x,target.y-y) < r){
        target.active = false;
        score += 2500;
        burst(target.x,target.y,35,'#fff3b0');
        playTargetSound();
      }
    });
  }

  function destroyBlock(block){
    if(!block.active) return;
    block.active = false;
    score += block.type === 'stone' ? 700 : 450;
    burst(block.x+block.w/2,block.y+block.h/2,18,block.type === 'stone' ? '#aeb5c1' : block.type === 'book' ? '#c65048' : '#d69b53');
    playImpactSound(block.type === 'stone' ? 2.1 : 1.4);
  }

  function burst(x,y,count,color){
    for(let i=0;i<count;i++) particles.push({
      x,y,
      vx:(Math.random()-.5)*460,
      vy:(Math.random()-.72)*420,
      life:.55+Math.random()*.7,
      size:2+Math.random()*6,
      color
    });
  }

  function update(dt){
    if(!started) return;

    blocks.forEach(block => {
      if(!block.active) return;
      block.hitFlash = Math.max(0,block.hitFlash-dt*4);
      if(Math.abs(block.vx)+Math.abs(block.vy)>.3 || block.y+block.h < groundY){
        block.vy += 690*dt;
        block.x += block.vx*dt;
        block.y += block.vy*dt;
        block.angle += block.spin*dt;
        block.vx *= .989;
        block.spin *= .991;
        if(block.y+block.h > groundY){
          block.y = groundY-block.h;
          block.vy *= -.19;
          block.vx *= .68;
          block.spin *= .57;
        }
        if(block.x > W+180 || block.x < -180) destroyBlock(block);
      }
    });

    if(projectile && projectile.active){
      const p = projectile;
      p.age += dt;
      p.vy += GRAVITY*dt;
      p.x += p.vx*dt;
      p.y += p.vy*dt;
      p.vx *= .9996;
      p.trail.unshift({x:p.x,y:p.y});
      if(p.trail.length > 24) p.trail.pop();

      blocks.forEach(block => {
        if(!block.active) return;
        const nx = Math.max(block.x,Math.min(p.x,block.x+block.w));
        const ny = Math.max(block.y,Math.min(p.y,block.y+block.h));
        const dx = p.x-nx;
        const dy = p.y-ny;
        if(dx*dx+dy*dy < p.r*p.r){
          const speed = Math.hypot(p.vx,p.vy);
          const mass = chars[p.ci].mass;
          const damage = (speed/300)*mass*1.35;
          playImpactSound(Math.min(4,speed/280));
          block.hp -= damage;
          block.hitFlash = 1;
          block.vx += p.vx*.34*mass;
          block.vy += p.vy*.22*mass-100;
          block.spin += (Math.random()-.5)*4;
          if(block.hp <= 0) destroyBlock(block);
          if(Math.abs(dx)>Math.abs(dy)) p.vx *= -.32;
          else p.vy *= -.28;
          p.vx *= .76;
          p.vy *= .76;
          score += Math.floor(speed*.42);
          burst(nx,ny,7,'#efe0bf');
          playImpactSound(Math.max(1, speed/180));
        }
      });

      targets.forEach(target => {
        if(target.active && Math.hypot(p.x-target.x,p.y-target.y) < p.r+target.r){
          target.active = false;
          playImpactSound(3.5);
          score += 2500;
          burst(target.x,target.y,42,'#fff3b0');
          p.vx *= .78;
          p.vy *= -.18;
        }
      });

      if(p.y+p.r > groundY){
        p.y = groundY-p.r;
        p.vy *= -.33;
        p.vx *= .77;
        if(Math.abs(p.vy)<48 && Math.abs(p.vx)<48) p.active = false;
      }
      if(p.x > W+130 || p.y > H+100 || p.age > 11) p.active = false;
      if(!p.active) setTimeout(()=>{if(projectile===p) projectile=null;},260);
    }

    particles.forEach(q => {
      q.life -= dt;
      q.vy += 500*dt;
      q.x += q.vx*dt;
      q.y += q.vy*dt;
      q.vx *= .98;
    });
    particles = particles.filter(q=>q.life>0);

    if(targets.length && targets.every(target=>!target.active) && !resultShown){
      resultShown = true;
      setTimeout(()=>showResult(true),650);
    }
    if(!projectile && shotIndex>=shotQueue.length && targets.some(target=>target.active) && !resultShown){
      resultShown = true;
      setTimeout(()=>showResult(false),650);
    }
  }

  function showResult(win){
    const remaining = shotQueue.length-shotIndex;
    const stars = win ? (remaining>=2?3:remaining>=1?2:1) : 0;
    if(win) markLevelCompleted(levelIndex);
    const finalLevel = levelIndex === levels.length - 1;
    if (win && finalLevel) {
      playCompleteSound(true);
      resultLabel.textContent = 'DEMO COMPLETE';
      resultTitle.textContent = 'All 6 levels cleared!';
      resultText.textContent = `Final score ${score.toLocaleString()} • You completed the full demo. If you have cleared at least 5 levels, you can now use the wallet registry below for the first-500 player list.`;
      nextBtn.style.display = 'block';
      nextBtn.textContent = 'Open wallet registry';
      nextBtn.dataset.action = 'registry';
    } else {
      if (win) playCompleteSound(false);
      resultLabel.textContent = win ? 'LEVEL COMPLETE' : 'OUT OF ARROWS';
      resultTitle.textContent = win ? 'Tower smashed!' : 'The tower still stands';
      resultText.textContent = win
        ? `${'★'.repeat(stars)}${'☆'.repeat(3-stars)}  Score ${score.toLocaleString()} • ${remaining} arrow${remaining===1?'':'s'} left`
        : `Score ${score.toLocaleString()}. Use the longer launch arc and hit the lower supports first.`;
      nextBtn.style.display = win ? 'block' : 'none';
      nextBtn.textContent = levelIndex===levels.length-1 ? 'Finish demo' : 'Next level';
      nextBtn.dataset.action = 'next';
    }
    resultOverlay.classList.remove('hidden');
  }

  function draw(){
    const level = levels[levelIndex];
    ctx.clearRect(0,0,W,H);
    drawBackground(level.sky);
    drawTerrain();
    drawStructures();
    drawTargets();
    drawLauncher();
    if(aiming) drawTrajectory();
    drawQueue();
    drawProjectile();
    drawParticles();
    drawHud(level);
  }

  function drawBackground(sky){
    const gradient = ctx.createLinearGradient(0,0,0,H);
    gradient.addColorStop(0,sky);
    gradient.addColorStop(1,'#293949');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,W,H);

    ctx.globalAlpha = .75;
    for(let i=0;i<95;i++){
      const x = (i*193)%W;
      const y = (i*i*37)%430;
      const r = i%4===0 ? 1.8 : .8;
      ctx.fillStyle = i%9===0 ? '#f4dca2' : '#d9e6ff';
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#15283a';
    ctx.beginPath();
    ctx.moveTo(0,520);
    for(let x=0;x<=W;x+=90) ctx.lineTo(x,440+Math.sin(x*.011)*35+(x%180?15:-15));
    ctx.lineTo(W,H);
    ctx.lineTo(0,H);
    ctx.fill();

    ctx.fillStyle = 'rgba(230,235,245,.08)';
    ctx.beginPath();
    ctx.ellipse(770,150,420,85,-.25,0,Math.PI*2);
    ctx.fill();
  }

  function drawTerrain(){
    ctx.fillStyle = '#23442d';
    ctx.fillRect(0,groundY,W,H-groundY);
    ctx.fillStyle = '#52784b';
    ctx.fillRect(0,groundY,W,8);
    for(let x=0;x<W;x+=18){
      ctx.strokeStyle = x%36 ? '#6f9657' : '#a2b96c';
      ctx.beginPath();
      ctx.moveTo(x,groundY+3);
      ctx.lineTo(x+4,groundY-10-(x%13));
      ctx.stroke();
    }
  }

  function drawStructures(){
    blocks.forEach(block => {
      if(!block.active) return;
      ctx.save();
      ctx.translate(block.x+block.w/2,block.y+block.h/2);
      ctx.rotate(block.angle);
      const x = -block.w/2;
      const y = -block.h/2;
      let fill = '#9a6b42';
      let edge = '#5c3e28';
      if(block.type==='stone'){fill='#7d8588';edge='#485052';}
      if(block.type==='book'){fill='#984943';edge='#572e31';}
      if(block.hitFlash>0) fill='#d6d9c7';
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      roundRect(ctx,x,y,block.w,block.h,Math.min(7,block.w*.12));
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = .24;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x+6,y+6,Math.max(0,block.w-12),4);
      ctx.globalAlpha = 1;
      if(block.type==='book'){
        ctx.fillStyle = '#d9b47e';
        ctx.fillRect(x+7,y+7,4,block.h-14);
      }
      ctx.restore();
    });
  }

  function drawTargets(){
    targets.forEach(target => {
      if(!target.active) return;
      target.wobble += .035;
      const y = target.y+Math.sin(target.wobble)*3;
      ctx.save();
      ctx.translate(target.x,y);
      ctx.fillStyle = '#172219';
      ctx.strokeStyle = '#d9c488';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0,0,target.r,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ede1ba';
      drawBone(ctx,0,0,target.r*1.25,target.r*.34);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawLauncher(){
    const activeChar = shotIndex<shotQueue.length ? shotQueue[shotIndex] : 0;
    ctx.strokeStyle = '#8c5b32';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(launcher.x-4,launcher.y-10,68,-1.22,1.2);
    ctx.stroke();
    ctx.strokeStyle = '#e3be64';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(launcher.x-4,launcher.y-10,68,-1.22,1.2);
    ctx.stroke();

    const anchorTop = {x:launcher.x+18,y:launcher.y-73};
    const anchorBottom = {x:launcher.x+18,y:launcher.y+54};
    const pull = aiming ? drag : {x:launcher.x+25,y:launcher.y-10};
    ctx.strokeStyle = '#e8dcc0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorTop.x,anchorTop.y);
    ctx.lineTo(pull.x,pull.y);
    ctx.lineTo(anchorBottom.x,anchorBottom.y);
    ctx.stroke();

    if(!projectile && shotIndex<shotQueue.length){
      drawDog(pull.x,pull.y,23,activeChar,0);
      drawArrow(pull.x+10,pull.y,launcher.x-pull.x,launcher.y-pull.y);
    }
  }

  function drawTrajectory(){
    const dx = launcher.x-drag.x;
    const dy = launcher.y-drag.y;
    let vx = dx*LAUNCH_FORCE;
    let vy = dy*LAUNCH_FORCE;
    let x = launcher.x+28;
    let y = launcher.y-10;
    for(let i=0;i<22;i++){
      const step = .085;
      vy += GRAVITY*step;
      x += vx*step;
      y += vy*step;
      if(y>groundY) break;
      ctx.globalAlpha = Math.max(.2,1-i/24);
      ctx.fillStyle = i%2 ? '#d9f1bd' : '#fff1b0';
      ctx.beginPath();
      ctx.arc(x,y,5-i*.12,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawQueue(){
    const start = 60;
    for(let i=shotIndex;i<shotQueue.length;i++){
      const x = start+(i-shotIndex)*61;
      drawDog(x,586,19,shotQueue[i],0);
    }
  }

  function drawProjectile(){
    if(!projectile) return;
    const p = projectile;
    p.trail.forEach((q,i) => {
      ctx.globalAlpha = (p.trail.length-i)/p.trail.length*.34;
      ctx.fillStyle = chars[p.ci].accent;
      ctx.beginPath();
      ctx.arc(q.x,q.y,Math.max(2,p.r-i*.75),0,Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    const angle = Math.atan2(p.vy,p.vx);
    drawDog(p.x,p.y,p.r,p.ci,angle);
    if(!p.ability){
      ctx.fillStyle = 'rgba(0,0,0,.58)';
      roundRect(ctx,p.x-40,p.y-57,80,20,9);
      ctx.fill();
      ctx.fillStyle = '#d8efc8';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(chars[p.ci].power,p.x,p.y-43);
      ctx.textAlign = 'left';
    }
  }

  function drawDog(x,y,r,ci,angle){
    const c = chars[ci];
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);

    ctx.fillStyle = '#eee7d8';
    ctx.strokeStyle = '#3e332b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0,0,r*1.12,r*.84,0,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a47753';
    ctx.beginPath();
    ctx.ellipse(-r*.68,-r*.36,r*.34,r*.58,-.28,0,Math.PI*2);
    ctx.ellipse(r*.55,-r*.4,r*.28,r*.52,.35,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(-r*.08,r*.45,r*.78,r*.32,0,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-r*.78,r*.48);
    ctx.lineTo(r*.38,r*.62);
    ctx.stroke();

    ctx.fillStyle = '#252329';
    ctx.beginPath();
    ctx.arc(r*.31,-r*.14,r*.095,0,Math.PI*2);
    ctx.arc(r*.74,r*.04,r*.11,0,Math.PI*2);
    ctx.fill();

    if(ci===0 || ci===2){
      ctx.fillStyle = ci===0 ? '#587143' : '#6d8047';
      ctx.beginPath();
      ctx.ellipse(-r*.08,-r*.78,r*.58,r*.24,0,0,Math.PI*2);
      ctx.fill();
      ctx.fillRect(-r*.45,-r*1.18,r*.78,r*.42);
      ctx.fillStyle = '#b8813f';
      ctx.fillRect(-r*.45,-r*.85,r*.8,r*.08);
    }

    if(ci===1){
      ctx.fillStyle = '#60775c';
      ctx.beginPath();
      ctx.arc(-r*.12,-r*.77,r*.58,Math.PI,0);
      ctx.fill();
      ctx.fillStyle = '#9bc071';
      for(let i=0;i<5;i++) ctx.fillRect(-r*.2+i*3,-r*1.55-i%2*4,3,r*.75);
    }

    if(ci===2){
      ctx.strokeStyle = '#24282a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r*.28,-r*.14,r*.25,0,Math.PI*2);
      ctx.stroke();
    }

    if(ci===3){
      ctx.fillStyle = '#111514';
      ctx.beginPath();
      ctx.ellipse(r*.15,-r*.14,r*.68,r*.58,0,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#2a302d';
      ctx.fillRect(-r*.36,-r*.8,r*1.02,r*.35);
      ctx.fillStyle = '#f1e8d8';
      ctx.beginPath();
      ctx.ellipse(r*.28,-r*.23,r*.16,r*.095,0,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#202220';
      ctx.beginPath();
      ctx.arc(r*.31,-r*.23,r*.05,0,Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawArrow(x,y,dx,dy){
    const angle = Math.atan2(dy,dx);
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#6e422a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20,0);
    ctx.lineTo(38,0);
    ctx.stroke();
    ctx.fillStyle = '#e1c37e';
    ctx.beginPath();
    ctx.moveTo(48,0);
    ctx.lineTo(32,-8);
    ctx.lineTo(32,8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(){
    particles.forEach(q => {
      ctx.globalAlpha = Math.max(0,q.life);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x-q.size/2,q.y-q.size/2,q.size,q.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawHud(level){
    ctx.fillStyle = 'rgba(5,9,18,.76)';
    roundRect(ctx,26,24,390,113,17);
    ctx.fill();
    ctx.fillStyle = '#83b761';
    ctx.font = '900 13px system-ui';
    ctx.fillText(`LEVEL ${levelIndex+1} • ${level.name.toUpperCase()}`,48,52);
    ctx.fillStyle = '#f3eada';
    ctx.font = '700 34px Georgia';
    ctx.fillText(score.toLocaleString(),48,92);
    ctx.font = '600 13px system-ui';
    ctx.fillStyle = '#aeb7c7';
    ctx.fillText(`ARROWS ${shotQueue.length-shotIndex}  •  TARGETS ${targets.filter(t=>t.active).length}  •  POWER +35%  •  6 LEVELS`,48,116);
    if(shotIndex<shotQueue.length && !projectile){
      ctx.textAlign = 'right';
      ctx.fillStyle = '#efbd58';
      ctx.font = '800 14px system-ui';
      ctx.fillText(`NEXT: ${chars[shotQueue[shotIndex]].name}`,W-40,48);
      ctx.textAlign = 'left';
    }
  }

  function roundRect(c,x,y,w,h,r){
    r = Math.min(r,w/2,h/2);
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
  }

  function drawBone(c,x,y,len,thick){
    c.beginPath();
    c.arc(x-len*.42,y-thick*.45,thick*.55,0,Math.PI*2);
    c.arc(x-len*.42,y+thick*.45,thick*.55,0,Math.PI*2);
    c.rect(x-len*.42,y-thick*.45,len*.84,thick*.9);
    c.arc(x+len*.42,y-thick*.45,thick*.55,0,Math.PI*2);
    c.arc(x+len*.42,y+thick*.45,thick*.55,0,Math.PI*2);
  }

  function loop(now){
    const dt = Math.min(.033,(now-last)/1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  updateRegistryUI();
  loadLevel(0);
  requestAnimationFrame(loop);
})();
