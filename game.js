/* Super Devin Bros. -- a Mario-style platformer on a plain 2D canvas. */
(function () {
  "use strict";

  const TILE = 32;
  const VIEW_W = 768;
  const VIEW_H = 480;

  const GRAVITY = 0.62;
  const MAX_FALL = 13;
  const WALK_ACCEL = 0.55;
  const RUN_ACCEL = 0.8;
  const WALK_MAX = 3.6;
  const RUN_MAX = 5.6;
  const GROUND_FRICTION = 0.78;
  const AIR_FRICTION = 0.94;
  const JUMP_VELOCITY = -12.2;
  const JUMP_HOLD_BOOST = -0.55;
  const JUMP_HOLD_FRAMES = 11;
  const LEVEL_TIME = 320;

  const SOLID = "XBPS=?MU";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  /* ---------------------------------------------------------------- input */

  const keys = Object.create(null);
  const KEYMAP = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "jump",
    KeyW: "jump",
    Space: "jump",
    ShiftLeft: "run",
    ShiftRight: "run",
    ArrowDown: "down",
    KeyS: "down"
  };

  window.addEventListener("keydown", function (e) {
    const action = KEYMAP[e.code];
    if (action) {
      if (!keys[action]) keys[action + "Pressed"] = true;
      keys[action] = true;
      e.preventDefault();
    }
    if (e.code === "KeyR") restartGame();
    if (e.code === "KeyM") audio.toggleMute();
    if (e.code === "Enter" && game.state === "title") startGame();
  });

  window.addEventListener("keyup", function (e) {
    const action = KEYMAP[e.code];
    if (action) {
      keys[action] = false;
      e.preventDefault();
    }
  });

  canvas.addEventListener("mousedown", function () {
    if (game.state === "title") startGame();
  });

  /* ---------------------------------------------------------------- audio */

  const audio = (function () {
    let ctxA = null;
    let muted = false;
    let musicTimer = null;
    let step = 0;

    function ensure() {
      if (!ctxA) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctxA = new AC();
      }
      if (ctxA.state === "suspended") ctxA.resume();
      return ctxA;
    }

    function tone(freq, duration, type, volume, delay) {
      const ac = ensure();
      if (!ac || muted) return;
      const t0 = ac.currentTime + (delay || 0);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(volume === undefined ? 0.08 : volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    function slide(from, to, duration, volume) {
      const ac = ensure();
      if (!ac || muted) return;
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(from, t0);
      osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
      gain.gain.setValueAtTime(volume === undefined ? 0.08 : volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    // A cheerful original chiptune loop (bass + lead) that plays while running.
    const BASS = [131, 131, 165, 131, 175, 131, 196, 175];
    const LEAD = [523, 659, 784, 659, 587, 523, 440, 494];

    function startMusic() {
      stopMusic();
      step = 0;
      musicTimer = setInterval(function () {
        if (muted || game.state !== "playing") return;
        const i = step % 8;
        tone(BASS[i] / 2, 0.22, "triangle", 0.09);
        tone(LEAD[i], 0.13, "square", 0.035);
        if (i % 2 === 0) tone(LEAD[(i + 2) % 8], 0.08, "square", 0.02, 0.09);
        step++;
      }, 190);
    }

    function stopMusic() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
    }

    return {
      jump: function () {
        slide(320, 720, 0.16, 0.07);
      },
      coin: function () {
        tone(988, 0.07, "square", 0.07);
        tone(1319, 0.16, "square", 0.07, 0.07);
      },
      stomp: function () {
        slide(420, 120, 0.14, 0.09);
      },
      bump: function () {
        tone(140, 0.08, "square", 0.06);
      },
      brick: function () {
        for (let i = 0; i < 4; i++) tone(200 + i * 90, 0.06, "sawtooth", 0.05, i * 0.03);
      },
      powerup: function () {
        [392, 523, 659, 784, 1047].forEach(function (f, i) {
          tone(f, 0.1, "square", 0.07, i * 0.06);
        });
      },
      hurt: function () {
        slide(500, 180, 0.3, 0.09);
      },
      die: function () {
        [523, 466, 392, 311, 233].forEach(function (f, i) {
          tone(f, 0.18, "square", 0.09, i * 0.14);
        });
      },
      flag: function () {
        [392, 494, 587, 784, 988, 1175].forEach(function (f, i) {
          tone(f, 0.12, "square", 0.07, i * 0.1);
        });
      },
      gameover: function () {
        [330, 262, 220, 165].forEach(function (f, i) {
          tone(f, 0.3, "triangle", 0.1, i * 0.25);
        });
      },
      startMusic: startMusic,
      stopMusic: stopMusic,
      toggleMute: function () {
        muted = !muted;
        return muted;
      },
      isMuted: function () {
        return muted;
      },
      ensure: ensure
    };
  })();

  /* ----------------------------------------------------------------- game */

  const game = {
    state: "title", // title | playing | dying | levelClear | gameOver | victory
    levelIndex: 0,
    score: 0,
    coins: 0,
    lives: 3,
    time: LEVEL_TIME,
    timeAccum: 0,
    stateTimer: 0,
    cameraX: 0
  };

  let level = null;
  let player = null;
  let entities = [];
  let particles = [];
  let floatingTexts = [];

  function makeLevel(index) {
    const rows = LEVELS[index].map(function (r) {
      return r.split("");
    });
    return {
      rows: rows,
      width: rows[0].length,
      height: rows.length,
      pixelWidth: rows[0].length * TILE,
      pixelHeight: rows.length * TILE,
      flagX: 0,
      flagTopY: 0,
      flagHeight: 0
    };
  }

  function tileAt(col, row) {
    if (row < 0 || row >= level.height) return " ";
    if (col < 0 || col >= level.width) return "X"; // walls at the edges
    return level.rows[row][col];
  }

  function setTile(col, row, ch) {
    if (row < 0 || row >= level.height || col < 0 || col >= level.width) return;
    level.rows[row][col] = ch;
  }

  function isSolid(ch) {
    return SOLID.indexOf(ch) !== -1;
  }

  function solidAtPixel(x, y) {
    return isSolid(tileAt(Math.floor(x / TILE), Math.floor(y / TILE)));
  }

  /* --------------------------------------------------------------- actors */

  function makePlayer(x, y) {
    return {
      x: x,
      y: y,
      w: 22,
      h: 30,
      vx: 0,
      vy: 0,
      dir: 1,
      big: false,
      onGround: false,
      jumpFrames: 0,
      invincible: 0,
      walkTimer: 0,
      crouching: false,
      starPose: 0
    };
  }

  function makeGoomba(col, row) {
    return {
      type: "goomba",
      x: col * TILE + 3,
      y: row * TILE + 6,
      w: 26,
      h: 26,
      vx: -1.2,
      vy: 0,
      dead: 0,
      squashed: false,
      walkTimer: 0
    };
  }

  function makeKoopa(col, row) {
    return {
      type: "koopa",
      x: col * TILE + 4,
      y: row * TILE - 6,
      w: 24,
      h: 38,
      vx: -1,
      vy: 0,
      shell: false,
      shellTimer: 0,
      dead: 0,
      walkTimer: 0
    };
  }

  function makeMushroom(col, row) {
    return {
      type: "mushroom",
      x: col * TILE + 4,
      y: row * TILE,
      w: 24,
      h: 24,
      vx: 1.6,
      vy: 0,
      emerge: 24
    };
  }

  function makeCoinPop(col, row) {
    return {
      type: "coinpop",
      x: col * TILE + 8,
      y: row * TILE,
      w: 16,
      h: 20,
      vy: -8,
      life: 34
    };
  }

  function spawnParticles(x, y, count, color, speed) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * (speed || 5),
        vy: -Math.random() * (speed || 5) - 1,
        life: 30 + Math.random() * 20,
        color: color || "#c85a20",
        size: 3 + Math.random() * 4
      });
    }
  }

  function addScore(amount, x, y) {
    game.score += amount;
    if (x !== undefined) {
      floatingTexts.push({ x: x, y: y, text: String(amount), life: 45 });
    }
  }

  /* ------------------------------------------------------------ level init */

  function loadLevel(index) {
    level = makeLevel(index);
    entities = [];
    particles = [];
    floatingTexts = [];
    let spawnCol = 3;
    let spawnRow = 12;

    for (let row = 0; row < level.height; row++) {
      for (let col = 0; col < level.width; col++) {
        const ch = tileAt(col, row);
        if (ch === "g") {
          entities.push(makeGoomba(col, row));
          setTile(col, row, " ");
        } else if (ch === "k") {
          entities.push(makeKoopa(col, row));
          setTile(col, row, " ");
        } else if (ch === "F") {
          level.flagX = col * TILE + TILE / 2;
          level.flagTopY = (row - 8) * TILE;
          level.flagHeight = 9 * TILE;
        }
      }
    }

    player = makePlayer(spawnCol * TILE, spawnRow * TILE - 30);
    game.time = LEVEL_TIME;
    game.timeAccum = 0;
    game.cameraX = 0;
  }

  function startGame() {
    audio.ensure();
    game.state = "playing";
    game.score = 0;
    game.coins = 0;
    game.lives = 3;
    game.levelIndex = 0;
    loadLevel(0);
    audio.startMusic();
  }

  function restartGame() {
    if (game.state === "title") return;
    startGame();
  }

  function killPlayer() {
    if (game.state !== "playing") return;
    game.state = "dying";
    game.stateTimer = 0;
    player.vy = -11;
    player.vx = 0;
    audio.stopMusic();
    audio.die();
  }

  function damagePlayer() {
    if (player.invincible > 0 || game.state !== "playing") return;
    if (player.big) {
      player.big = false;
      player.h = 30;
      player.y += 18;
      player.invincible = 90;
      audio.hurt();
    } else {
      killPlayer();
    }
  }

  function nextLevel() {
    if (game.levelIndex + 1 < LEVELS.length) {
      game.levelIndex++;
      loadLevel(game.levelIndex);
      game.state = "playing";
      audio.startMusic();
    } else {
      game.state = "victory";
      game.stateTimer = 0;
    }
  }

  /* ------------------------------------------------------------- collision */

  function moveActor(actor) {
    actor.x += actor.vx;
    const hit = collideAxis(actor, "x");
    actor.y += actor.vy;
    actor.onGround = false;
    collideAxis(actor, "y");
    return hit;
  }

  function collideAxis(actor, axis) {
    const left = Math.floor(actor.x / TILE);
    const right = Math.floor((actor.x + actor.w - 1) / TILE);
    const top = Math.floor(actor.y / TILE);
    const bottom = Math.floor((actor.y + actor.h - 1) / TILE);
    let hit = false;

    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (!isSolid(tileAt(col, row))) continue;
        hit = true;
        if (axis === "x") {
          if (actor.vx > 0) actor.x = col * TILE - actor.w;
          else if (actor.vx < 0) actor.x = (col + 1) * TILE;
          actor.vx = 0;
        } else {
          if (actor.vy > 0) {
            actor.y = row * TILE - actor.h;
            actor.vy = 0;
            actor.onGround = true;
          } else if (actor.vy < 0) {
            actor.y = (row + 1) * TILE;
            actor.vy = 0;
            if (actor === player) headBump(col, row);
          }
        }
      }
    }
    return hit;
  }

  function headBump(col, row) {
    const ch = tileAt(col, row);
    if (ch === "?" || ch === "M") {
      setTile(col, row, "U");
      if (ch === "M") {
        entities.push(makeMushroom(col, row));
        audio.powerup();
      } else {
        entities.push(makeCoinPop(col, row - 1));
        game.coins++;
        addScore(200, col * TILE, row * TILE);
        audio.coin();
      }
      spawnParticles(col * TILE + 16, row * TILE, 4, "#ffd75e", 3);
    } else if (ch === "B") {
      if (player.big) {
        setTile(col, row, " ");
        spawnParticles(col * TILE + 16, row * TILE + 16, 10, "#b5501f", 6);
        addScore(50, col * TILE, row * TILE);
        audio.brick();
      } else {
        audio.bump();
        spawnParticles(col * TILE + 16, row * TILE, 3, "#b5501f", 2);
      }
    } else {
      audio.bump();
    }
  }

  function overlaps(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  /* --------------------------------------------------------------- updates */

  function updatePlayer() {
    const running = !!keys.run;
    const maxSpeed = running ? RUN_MAX : WALK_MAX;
    const accel = running ? RUN_ACCEL : WALK_ACCEL;

    player.crouching = player.big && player.onGround && !!keys.down;

    if (keys.left && !player.crouching) {
      player.vx -= accel;
      player.dir = -1;
    } else if (keys.right && !player.crouching) {
      player.vx += accel;
      player.dir = 1;
    } else {
      player.vx *= player.onGround ? GROUND_FRICTION : AIR_FRICTION;
      if (Math.abs(player.vx) < 0.08) player.vx = 0;
    }
    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

    if (keys.jumpPressed && player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.jumpFrames = JUMP_HOLD_FRAMES;
      player.onGround = false;
      audio.jump();
    }
    keys.jumpPressed = false;

    if (keys.jump && player.jumpFrames > 0) {
      player.vy += JUMP_HOLD_BOOST;
      player.jumpFrames--;
    } else {
      player.jumpFrames = 0;
    }

    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
    moveActor(player);

    if (player.x < 0) {
      player.x = 0;
      player.vx = 0;
    }
    if (player.x + player.w > level.pixelWidth) {
      player.x = level.pixelWidth - player.w;
      player.vx = 0;
    }

    if (Math.abs(player.vx) > 0.2 && player.onGround) player.walkTimer += Math.abs(player.vx);
    if (player.invincible > 0) player.invincible--;

    if (player.y > level.pixelHeight + 40) killPlayer();

    // Reached the flagpole?
    if (level.flagHeight && player.x + player.w > level.flagX - 6) {
      game.state = "levelClear";
      game.stateTimer = 0;
      audio.stopMusic();
      audio.flag();
      addScore(1000);
    }
  }

  function updateEntities() {
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];

      if (e.dead) {
        e.dead--;
        if (e.squashed === false && e.vy !== undefined) {
          e.vy += GRAVITY;
          e.y += e.vy;
          e.x += e.vx;
        }
        if (e.dead <= 0) entities.splice(i, 1);
        continue;
      }

      if (e.type === "coinpop") {
        e.vy += 0.6;
        e.y += e.vy;
        e.life--;
        if (e.life <= 0) entities.splice(i, 1);
        continue;
      }

      // Off-screen entities idle until the camera is near.
      if (e.x < game.cameraX - 200 || e.x > game.cameraX + VIEW_W + 320) continue;

      if (e.type === "mushroom") {
        if (e.emerge > 0) {
          e.emerge--;
          e.y -= 1;
        } else {
          e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
          const before = e.vx;
          e.x += e.vx;
          if (collideAxis(e, "x")) e.vx = -before;
          e.y += e.vy;
          e.onGround = false;
          collideAxis(e, "y");
        }
        if (overlaps(e, player)) {
          entities.splice(i, 1);
          if (!player.big) {
            player.big = true;
            player.h = 46;
            player.y -= 16;
          }
          addScore(1000, e.x, e.y);
          audio.powerup();
        }
        continue;
      }

      // goomba / koopa walking
      e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
      const beforeVx = e.vx;
      e.x += e.vx;
      if (collideAxis(e, "x")) e.vx = -beforeVx;
      e.y += e.vy;
      e.onGround = false;
      collideAxis(e, "y");
      e.walkTimer++;

      // Turn around at ledges (only while walking, not as a sliding shell).
      const walking = !(e.type === "koopa" && e.shell && Math.abs(e.vx) > 2);
      if (walking && e.onGround) {
        const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        if (!solidAtPixel(aheadX, e.y + e.h + 4)) e.vx = -e.vx;
      }

      if (e.y > level.pixelHeight + 60) {
        entities.splice(i, 1);
        continue;
      }

      if (e.type === "koopa" && e.shell) {
        if (Math.abs(e.vx) < 0.2) {
          e.shellTimer--;
          if (e.shellTimer <= 0) {
            e.shell = false;
            e.h = 38;
            e.y -= 14;
            e.vx = -1;
          }
        }
      }

      // Shells knock out other enemies.
      if (e.type === "koopa" && e.shell && Math.abs(e.vx) > 2) {
        for (let j = entities.length - 1; j >= 0; j--) {
          const other = entities[j];
          if (other === e || other.dead || other.type === "coinpop" || other.type === "mushroom") continue;
          if (overlaps(e, other)) {
            other.dead = 40;
            other.squashed = false;
            other.vy = -6;
            other.vx = e.vx > 0 ? 2 : -2;
            addScore(200, other.x, other.y);
            audio.stomp();
          }
        }
      }

      if (game.state !== "playing") continue;
      if (!overlaps(e, player)) continue;

      const falling = player.vy > 0;
      const above = player.y + player.h - player.vy <= e.y + 10;

      if (falling && above) {
        if (e.type === "goomba") {
          e.squashed = true;
          e.dead = 24;
          e.h = 12;
          e.y += 14;
          addScore(100, e.x, e.y);
        } else if (e.type === "koopa" && !e.shell) {
          e.shell = true;
          e.shellTimer = 240;
          e.h = 24;
          e.y += 14;
          e.vx = 0;
          addScore(100, e.x, e.y);
        } else if (e.type === "koopa" && e.shell) {
          if (Math.abs(e.vx) > 0.2) {
            e.vx = 0;
            e.shellTimer = 240;
          } else {
            e.vx = player.x + player.w / 2 < e.x + e.w / 2 ? 6 : -6;
            e.shellTimer = 240;
          }
        }
        player.vy = keys.jump ? -10 : -7.5;
        audio.stomp();
      } else if (e.type === "koopa" && e.shell && Math.abs(e.vx) < 0.2) {
        e.vx = player.x + player.w / 2 < e.x + e.w / 2 ? 6 : -6;
        e.shellTimer = 240;
        audio.stomp();
      } else {
        damagePlayer();
      }
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const t = floatingTexts[i];
      t.y -= 0.8;
      t.life--;
      if (t.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  function collectCoins() {
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w) / TILE);
    const top = Math.floor(player.y / TILE);
    const bottom = Math.floor((player.y + player.h) / TILE);
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (tileAt(col, row) === "o") {
          setTile(col, row, " ");
          game.coins++;
          addScore(100, col * TILE, row * TILE);
          audio.coin();
          spawnParticles(col * TILE + 16, row * TILE + 16, 4, "#ffd75e", 3);
        }
      }
    }
  }

  function updateCamera() {
    const target = player.x + player.w / 2 - VIEW_W * 0.42;
    game.cameraX += (target - game.cameraX) * 0.12;
    game.cameraX = Math.max(0, Math.min(level.pixelWidth - VIEW_W, game.cameraX));
  }

  function updateTimer() {
    game.timeAccum++;
    if (game.timeAccum >= 40) {
      game.timeAccum = 0;
      game.time--;
      if (game.time <= 0) {
        game.time = 0;
        killPlayer();
      }
    }
  }

  function update() {
    if (game.state === "playing") {
      updatePlayer();
      collectCoins();
      updateEntities();
      collectCoins();
      updateParticles();
      updateCamera();
      updateTimer();
    } else if (game.state === "dying") {
      game.stateTimer++;
      player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
      player.y += player.vy;
      updateParticles();
      if (game.stateTimer > 110) {
        game.lives--;
        if (game.lives <= 0) {
          game.state = "gameOver";
          game.stateTimer = 0;
          audio.gameover();
        } else {
          loadLevel(game.levelIndex);
          game.state = "playing";
          audio.startMusic();
        }
      }
    } else if (game.state === "levelClear") {
      game.stateTimer++;
      player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
      player.y += player.vy;
      if (player.y > level.pixelHeight) player.y = level.pixelHeight;
      collideAxis(player, "y");
      if (game.stateTimer > 40) player.x += 2;
      updateParticles();
      if (game.stateTimer > 150) nextLevel();
    } else {
      updateParticles();
      game.stateTimer++;
    }
  }

  /* --------------------------------------------------------------- drawing */

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, "#5c94fc");
    grad.addColorStop(1, "#9fc6ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const camX = game.cameraX;

    // Hills (slow parallax)
    ctx.fillStyle = "#3ea34a";
    for (let i = -1; i < 12; i++) {
      const hx = i * 420 - (camX * 0.25) % 420 + 200;
      hill(hx, VIEW_H - 96, 120, 70);
      hill(hx - 210, VIEW_H - 96, 80, 46);
    }

    // Clouds
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (let i = -1; i < 14; i++) {
      const cx = i * 330 - (camX * 0.12) % 330;
      const cy = 60 + ((i * 53) % 90);
      cloud(cx, cy, 1);
      cloud(cx + 170, cy + 46, 0.7);
    }

    // Bushes near the ground
    ctx.fillStyle = "#2f8f3d";
    for (let i = -1; i < 16; i++) {
      const bx = i * 260 - (camX * 0.6) % 260;
      bush(bx, VIEW_H - 64);
    }
  }

  function hill(x, baseY, w, h) {
    ctx.beginPath();
    ctx.moveTo(x - w, baseY);
    ctx.quadraticCurveTo(x, baseY - h * 2, x + w, baseY);
    ctx.closePath();
    ctx.fill();
  }

  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 20 * s, 0, Math.PI * 2);
    ctx.arc(x + 24 * s, y - 10 * s, 26 * s, 0, Math.PI * 2);
    ctx.arc(x + 52 * s, y, 20 * s, 0, Math.PI * 2);
    ctx.rect(x, y, 52 * s, 20 * s);
    ctx.fill();
  }

  function bush(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.arc(x + 22, y - 8, 24, 0, Math.PI * 2);
    ctx.arc(x + 46, y, 18, 0, Math.PI * 2);
    ctx.rect(x - 18, y, 64, 20);
    ctx.fill();
  }

  function drawTiles() {
    const startCol = Math.max(0, Math.floor(game.cameraX / TILE) - 1);
    const endCol = Math.min(level.width - 1, Math.ceil((game.cameraX + VIEW_W) / TILE));

    for (let row = 0; row < level.height; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const ch = tileAt(col, row);
        if (ch === " " || ch === "F") continue;
        const x = Math.round(col * TILE - game.cameraX);
        const y = row * TILE;
        drawTile(ch, x, y, col, row);
      }
    }
  }

  function drawTile(ch, x, y, col, row) {
    switch (ch) {
      case "X":
        ctx.fillStyle = "#c2703a";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#8b4a20";
        ctx.fillRect(x, y + TILE - 6, TILE, 6);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x + 2, y + 2, TILE - 4, 4);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (row > 0 && tileAt(col, row - 1) !== "X") {
          ctx.fillStyle = "#4fbf50";
          ctx.fillRect(x, y, TILE, 8);
          ctx.fillStyle = "#3a9c3c";
          ctx.fillRect(x, y + 6, TILE, 3);
        }
        break;
      case "B":
        ctx.fillStyle = "#b5501f";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x, y + i * 8);
          ctx.lineTo(x + TILE, y + i * 8);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(x + 16, y);
        ctx.lineTo(x + 16, y + 8);
        ctx.moveTo(x + 8, y + 8);
        ctx.lineTo(x + 8, y + 16);
        ctx.moveTo(x + 24, y + 8);
        ctx.lineTo(x + 24, y + 16);
        ctx.moveTo(x + 16, y + 16);
        ctx.lineTo(x + 16, y + 24);
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      case "?":
      case "M": {
        const pulse = Math.sin(Date.now() / 180 + col) * 0.5 + 0.5;
        ctx.fillStyle = "#e6a020";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "rgba(255,255,255," + (0.15 + pulse * 0.2) + ")";
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = "#8a5a12";
        [[3, 3], [TILE - 8, 3], [3, TILE - 8], [TILE - 8, TILE - 8]].forEach(function (p) {
          ctx.fillRect(x + p[0], y + p[1], 5, 5);
        });
        ctx.fillStyle = "#5a3a08";
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";
        ctx.fillText("?", x + TILE / 2, y + TILE - 9);
        ctx.textAlign = "left";
        break;
      }
      case "U":
        ctx.fillStyle = "#9a6a2c";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#7a5220";
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        break;
      case "S":
        ctx.fillStyle = "#d9b382";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#a5825a";
        ctx.fillRect(x, y + TILE - 5, TILE, 5);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        break;
      case "=":
        ctx.fillStyle = "#8e6bd6";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#6c4bb0";
        ctx.fillRect(x, y + TILE - 6, TILE, 6);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(x + 2, y + 2, TILE - 4, 4);
        break;
      case "P": {
        const isTop = tileAt(col, row - 1) !== "P";
        const isLeft = tileAt(col - 1, row) !== "P";
        ctx.fillStyle = "#37b34a";
        if (isTop) {
          ctx.fillRect(x - (isLeft ? 4 : 0), y, TILE + 4, 14);
          ctx.fillStyle = "#249235";
          ctx.fillRect(x - (isLeft ? 4 : 0), y + 11, TILE + 4, 4);
          ctx.fillStyle = "#6fe07f";
          ctx.fillRect(x + (isLeft ? 2 : 0), y + 2, 6, 9);
          ctx.fillStyle = "#37b34a";
          ctx.fillRect(x, y + 15, TILE, TILE - 15);
          ctx.fillStyle = "#6fe07f";
          if (isLeft) ctx.fillRect(x + 4, y + 15, 6, TILE - 15);
        } else {
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "#6fe07f";
          if (isLeft) ctx.fillRect(x + 4, y, 6, TILE);
        }
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x + (isLeft ? TILE - 6 : 0), y, 6, TILE);
        break;
      }
      case "o": {
        const t = Date.now() / 130 + col;
        const wobble = Math.abs(Math.cos(t)) * 8 + 3;
        ctx.fillStyle = "#ffd75e";
        ctx.beginPath();
        ctx.ellipse(x + TILE / 2, y + TILE / 2, wobble, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c99512";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      default:
        break;
    }
  }

  function drawFlag() {
    if (!level.flagHeight) return;
    const x = Math.round(level.flagX - game.cameraX);
    const top = level.flagTopY;
    const bottom = top + level.flagHeight;
    ctx.fillStyle = "#cfcfcf";
    ctx.fillRect(x - 3, top, 6, level.flagHeight);
    ctx.fillStyle = "#2f8f3d";
    ctx.beginPath();
    ctx.arc(x, top, 8, 0, Math.PI * 2);
    ctx.fill();

    const slide = game.state === "levelClear" ? Math.min(game.stateTimer * 6, level.flagHeight - 60) : 0;
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.moveTo(x - 4, top + 14 + slide);
    ctx.lineTo(x - 46, top + 30 + slide);
    ctx.lineTo(x - 4, top + 46 + slide);
    ctx.closePath();
    ctx.fill();

    // Castle behind the flag
    ctx.fillStyle = "#c4c4cc";
    const cx = x + 90;
    ctx.fillRect(cx, bottom - 96, 128, 96);
    ctx.fillStyle = "#8f8f9c";
    ctx.fillRect(cx + 48, bottom - 40, 32, 40);
    for (let i = 0; i < 5; i++) ctx.fillRect(cx + i * 28, bottom - 112, 18, 20);
    ctx.fillStyle = "#c4c4cc";
    ctx.fillRect(cx + 40, bottom - 130, 48, 40);
  }

  function drawEntities() {
    entities.forEach(function (e) {
      const x = Math.round(e.x - game.cameraX);
      const y = Math.round(e.y);
      if (x < -80 || x > VIEW_W + 80) return;

      if (e.type === "coinpop") {
        ctx.fillStyle = "#ffd75e";
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 10, Math.abs(Math.cos(e.life / 3)) * 7 + 2, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (e.type === "mushroom") {
        ctx.fillStyle = "#f5e0c0";
        ctx.fillRect(x + 4, y + 12, 16, 12);
        ctx.fillStyle = "#e33b2e";
        ctx.beginPath();
        ctx.arc(x + 12, y + 12, 12, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x + 6, y + 7, 3.5, 0, Math.PI * 2);
        ctx.arc(x + 18, y + 7, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a2a1a";
        ctx.fillRect(x + 7, y + 16, 3, 4);
        ctx.fillRect(x + 14, y + 16, 3, 4);
        return;
      }

      const flip = e.dead && !e.squashed;
      ctx.save();
      if (flip) {
        ctx.translate(x + e.w / 2, y + e.h / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-(x + e.w / 2), -(y + e.h / 2));
      }

      if (e.type === "goomba") {
        const squashed = e.squashed;
        const h = squashed ? 10 : 26;
        const yy = squashed ? y + 16 : y;
        ctx.fillStyle = "#8b5a2b";
        ctx.beginPath();
        ctx.ellipse(x + 13, yy + h / 2, 13, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (!squashed) {
          ctx.fillStyle = "#5a3a1a";
          ctx.fillRect(x + 1, yy + 20, 8, 6);
          ctx.fillRect(x + 17, yy + 20, 8, 6);
          const step = Math.floor(e.walkTimer / 10) % 2;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.ellipse(x + 8 + step, yy + 12, 4, 5, 0, 0, Math.PI * 2);
          ctx.ellipse(x + 18 + step, yy + 12, 4, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1a1a1a";
          ctx.beginPath();
          ctx.arc(x + 9 + step, yy + 13, 2, 0, Math.PI * 2);
          ctx.arc(x + 19 + step, yy + 13, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(x + 6, yy + 5, 5, 3);
          ctx.fillRect(x + 16, yy + 5, 5, 3);
        }
      } else if (e.type === "koopa") {
        if (e.shell) {
          ctx.fillStyle = "#2f9c4a";
          ctx.beginPath();
          ctx.ellipse(x + 12, y + 12, 13, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#f5e6a0";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x + 12, y + 12, 8, 7, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        } else {
          const step = Math.floor(e.walkTimer / 9) % 2;
          ctx.fillStyle = "#f2d16b";
          ctx.fillRect(x + 4, y + 30, 7, 8 - step);
          ctx.fillRect(x + 14, y + 30, 7, 8 - (1 - step));
          ctx.fillStyle = "#2f9c4a";
          ctx.beginPath();
          ctx.ellipse(x + 12, y + 22, 12, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f2d16b";
          ctx.beginPath();
          ctx.ellipse(x + 12, y + 8, 9, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1a1a1a";
          ctx.beginPath();
          ctx.arc(x + (e.vx < 0 ? 7 : 16), y + 6, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e8a33d";
          ctx.fillRect(x + (e.vx < 0 ? 1 : 18), y + 9, 6, 4);
        }
      }
      ctx.restore();
    });
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) return;

    const x = Math.round(player.x - game.cameraX);
    const y = Math.round(player.y);
    const w = player.w;
    const big = player.big;
    const h = player.h;
    const stepping = player.onGround && Math.abs(player.vx) > 0.3;
    const step = Math.floor(player.walkTimer / 6) % 4;
    const airborne = !player.onGround;
    const faceRight = player.dir > 0;

    ctx.save();
    ctx.translate(x + w / 2, y);
    if (!faceRight) ctx.scale(-1, 1);
    ctx.translate(-w / 2, 0);

    const unit = big ? h / 46 : h / 30;
    const px = function (a, b, c, d, color) {
      ctx.fillStyle = color;
      ctx.fillRect(a * unit, b * unit, c * unit, d * unit);
    };

    const legFrame = airborne ? 2 : stepping ? step % 2 : 0;

    if (big) {
      // shoes
      px(-1, 40, 11, 6, "#5a2d0c");
      px(12, 40, 11, 6, "#5a2d0c");
      if (legFrame === 1) {
        px(1, 40, 9, 6, "#5a2d0c");
        px(14, 38, 10, 6, "#5a2d0c");
      }
      px(2, 28, 8, 13, "#2b5fd0"); // overalls legs
      px(12, 28, 8, 13, "#2b5fd0");
      px(1, 16, 20, 14, "#e33b2e"); // shirt
      px(4, 18, 14, 13, "#2b5fd0"); // overalls body
      px(7, 18, 8, 4, "#2b5fd0");
      px(5, 21, 2, 2, "#f2d16b"); // buttons
      px(15, 21, 2, 2, "#f2d16b");
      px(-2, 17, 5, 10, "#e33b2e"); // arms
      px(19, 17, 5, 10, "#e33b2e");
      px(-3, 25, 5, 5, "#f7c9a0");
      px(20, 25, 5, 5, "#f7c9a0");
      px(3, 4, 16, 12, "#f7c9a0"); // face
      px(2, 0, 18, 6, "#e33b2e"); // cap
      px(14, 2, 9, 4, "#e33b2e"); // brim
      px(3, 5, 4, 4, "#3a2a1a"); // hair
      px(14, 8, 3, 3, "#1a1a1a"); // eye
      px(9, 11, 8, 3, "#7a4a20"); // moustache
      px(17, 9, 3, 4, "#f7c9a0"); // nose
    } else {
      px(0, 25, 9, 5, "#5a2d0c");
      px(11, 25, 9, 5, "#5a2d0c");
      if (legFrame === 1) {
        px(2, 25, 8, 5, "#5a2d0c");
        px(12, 23, 9, 5, "#5a2d0c");
      }
      px(2, 14, 18, 12, "#2b5fd0"); // overalls
      px(1, 12, 20, 5, "#e33b2e"); // shirt
      px(-2, 13, 4, 8, "#e33b2e");
      px(20, 13, 4, 8, "#e33b2e");
      px(-3, 19, 4, 4, "#f7c9a0");
      px(20, 19, 4, 4, "#f7c9a0");
      px(4, 15, 2, 2, "#f2d16b");
      px(15, 15, 2, 2, "#f2d16b");
      px(3, 3, 15, 10, "#f7c9a0");
      px(2, 0, 17, 5, "#e33b2e");
      px(13, 1, 9, 4, "#e33b2e");
      px(3, 4, 4, 4, "#3a2a1a");
      px(13, 6, 3, 3, "#1a1a1a");
      px(8, 9, 8, 3, "#7a4a20");
      px(16, 7, 3, 4, "#f7c9a0");
    }
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 25);
      ctx.fillRect(Math.round(p.x - game.cameraX), Math.round(p.y), p.size, p.size);
      ctx.globalAlpha = 1;
    });
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#fff";
    floatingTexts.forEach(function (t) {
      ctx.globalAlpha = Math.min(1, t.life / 25);
      ctx.fillText(t.text, Math.round(t.x - game.cameraX), Math.round(t.y));
      ctx.globalAlpha = 1;
    });
  }

  function drawHud() {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, VIEW_W, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + String(game.score).padStart(6, "0"), 16, 23);
    ctx.fillStyle = "#ffd75e";
    ctx.beginPath();
    ctx.ellipse(196, 17, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("x" + String(game.coins).padStart(2, "0"), 208, 23);
    ctx.fillText("WORLD 1-" + (game.levelIndex + 1), 320, 23);
    ctx.fillText("LIVES " + game.lives, 470, 23);
    ctx.fillText("TIME " + String(game.time).padStart(3, "0"), 600, 23);
    if (audio.isMuted()) {
      ctx.fillStyle = "#ffb0b0";
      ctx.fillText("MUTED", 700, 23);
    }
  }

  function centerBox(lines, sub) {
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(VIEW_W / 2 - 240, VIEW_H / 2 - 100, 480, 200);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(VIEW_W / 2 - 240, VIEW_H / 2 - 100, 480, 200);
    ctx.lineWidth = 1;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 34px monospace";
    lines.forEach(function (line, i) {
      ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 - 40 + i * 40);
    });
    if (sub) {
      ctx.font = "16px monospace";
      ctx.fillStyle = "#ffd75e";
      ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 70);
    }
    ctx.textAlign = "left";
  }

  function drawTitle() {
    drawBackground();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(VIEW_W / 2 - 280, 90, 560, 300);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.strokeRect(VIEW_W / 2 - 280, 90, 560, 300);
    ctx.lineWidth = 1;
    ctx.fillStyle = "#ffd75e";
    ctx.font = "bold 44px monospace";
    ctx.fillText("SUPER DEVIN BROS.", VIEW_W / 2, 165);
    ctx.fillStyle = "#fff";
    ctx.font = "18px monospace";
    ctx.fillText("Stomp goombas. Grab coins. Reach the flag.", VIEW_W / 2, 205);
    ctx.font = "16px monospace";
    ctx.fillText("MOVE      \u2190 \u2192  or  A D", VIEW_W / 2, 250);
    ctx.fillText("JUMP      SPACE / \u2191 / W   (hold to jump higher)", VIEW_W / 2, 278);
    ctx.fillText("RUN       SHIFT", VIEW_W / 2, 306);
    ctx.fillText("RESTART R        MUTE M", VIEW_W / 2, 334);
    ctx.fillStyle = "#7fff9f";
    ctx.font = "bold 20px monospace";
    ctx.fillText("PRESS ENTER OR CLICK TO START", VIEW_W / 2, 372);
    ctx.textAlign = "left";
  }

  function render() {
    if (game.state === "title") {
      drawTitle();
      return;
    }
    drawBackground();
    drawFlag();
    drawTiles();
    drawEntities();
    drawParticles();
    if (game.state !== "gameOver") drawPlayer();
    drawHud();

    if (game.state === "gameOver") {
      centerBox(["GAME OVER"], "Press R to play again  |  Score " + game.score);
    } else if (game.state === "victory") {
      centerBox(["YOU WIN!", "SCORE " + game.score], "Press R to play again");
    } else if (game.state === "levelClear") {
      centerBox(["COURSE CLEAR!"], "World 1-" + (game.levelIndex + 1) + " complete");
    }
  }

  /* ------------------------------------------------------------- main loop */

  let last = performance.now();
  let accumulator = 0;
  const STEP = 1000 / 60;

  function loop(now) {
    accumulator += Math.min(now - last, 100);
    last = now;
    while (accumulator >= STEP) {
      update();
      accumulator -= STEP;
    }
    render();
    requestAnimationFrame(loop);
  }

  loadLevel(0);
  requestAnimationFrame(loop);

  // Exposed for quick debugging in the console.
  window.__game = { game: game, getPlayer: function () { return player; } };
})();
