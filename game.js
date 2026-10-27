const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const FONT = "Times New Roman, 'brittanic bold', Arial, sans-serif";
const COLORS = {
  indigo: "#020617",
  indigoDark: "#02040a",
  lavender: "#94a3b8",
  light: "#0f172a",
  blueAccent: "#2563eb",
  cyanAccent: "#38bdf8",
  yellow: "#d4af37",
  text: "#f8fafc",
  muted: "#94a3b8"
};

const WIN_SCORE = 500;
const COIN_VALUE = 10;
const START_TIME = 60;
const MAX_HP = 5; // Nyawa maksimal player

// Sprite karakter, musuh, background, koin, dan item HP
const playerImage = new Image();
playerImage.src = 'cartethyia.png';
const dangerImage = new Image();
dangerImage.src = 'tacetdiscord.png';
const backgroundImage = new Image();
backgroundImage.src = 'background.jpg';
const coinImage = new Image();
coinImage.src = 'radiant_coin.png';
const hpItemImage = new Image();
hpItemImage.src = 'revival.png';

const player = {
  x: 100,
  y: 100,
  width: 100,
  height: 65,
  speed: 4,
};

let muted = false;
let highScore = Number(localStorage.getItem("highScore")) || 0;

const card = { x: W / 2 - 260, y: H / 2 - 155, width: 520, height: 310 };
const startButton = { x: W / 2 - 95, y: card.y + 200, width: 190, height: 56 };
const restartButton = { x: W / 2 - 95, y: card.y + 200, width: 190, height: 56 };
const muteButton = { x: W - 150, y: H - 46, width: 130, height: 32 };

const bgmAudio = document.getElementById("bgmAudio");
if (bgmAudio) {
  bgmAudio.volume = 0.5;
}

function fontOf(size, weight) {
  return (weight || "normal") + " " + size + "px " + FONT;
}

function randomPosition(size) {
  return {
    x: Math.random() * (canvas.width - size),
    y: Math.random() * (canvas.height - size)
  };
}

function createCoins() {
  return [
    { width: 40, height: 40 },
    { width: 40, height: 40 },
    { width: 40, height: 40 }
  ].map(function (coin) {
    const pos = randomPosition(coin.width);
    coin.x = pos.x;
    coin.y = pos.y;
    return coin;
  });
}

function createDanger() {
  const pos = randomPosition(100);
  return { 
    x: pos.x, 
    y: pos.y, 
    width: 100, 
    height: 100,
    dx: 3 * (Math.random() < 0.5 ? 1 : -1),
    dy: 3 * (Math.random() < 0.5 ? 1 : -1)
  };
}

let coins = createCoins();
let dangers = [createDanger(), createDanger()];

let score = 0;
let timeLeft = START_TIME;
let playerHP = MAX_HP; 
let messageTimer = 0;
let flashTimer = 0;
let popups = [];
let gameState = "START";
let timerInterval = null;
let touchingDanger = false;

// Variabel untuk Item HP (+1 HP)
let hpItem = null;
let hpSpawnTimer = 10;

const keysPressed = {};

let audioCtx = null;
let masterGain = null;

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq, start, duration, type, volume, destination) {
  const audio = getAudio();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration);
}

function playCoinSound() {
  const t = getAudio().currentTime;
  playTone(987, t, 0.1, "sine", 0.2, masterGain);
  playTone(1567, t + 0.1, 0.2, "sine", 0.2, masterGain);
}

function playWinSound() {
  const t = getAudio().currentTime;
  [349, 440, 523, 698, 880].forEach(function (freq, i) {
    playTone(freq, t + i * 0.12, 0.2, "square", 0.1, masterGain);
  });
}

function playLoseSound() {
  const t = getAudio().currentTime;
  [330, 277, 233, 164].forEach(function (freq, i) {
    playTone(freq, t + i * 0.25, 0.4, "triangle", 0.15, masterGain);
  });
}

function playDangerSound() {
  const t = getAudio().currentTime;
  playTone(180, t, 0.15, "sawtooth", 0.12, masterGain);
  playTone(130, t + 0.1, 0.25, "sawtooth", 0.15, masterGain);
}

function startBgm() {
  if (bgmAudio && !muted) {
    bgmAudio.currentTime = 0;
    bgmAudio.play().catch(err => console.log("Autoplay diblokir browser:", err));
  }
}

function stopBgm() {
  if (bgmAudio) {
    bgmAudio.pause();
  }
}

function toggleMute() {
  muted = !muted;
  getAudio();
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : 1;
  }
  if (bgmAudio) {
    bgmAudio.muted = muted;
  }
}

function isInside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function addPopup(x, y, text, color) {
  popups.push({ x: x, y: y, text: text, color: color || COLORS.cyanAccent, life: 40 });
}

function startGame() {
  clearInterval(timerInterval);

  player.x = 100;
  player.y = 100;
  coins = createCoins();
  dangers = [createDanger(), createDanger()];
  score = 0;
  timeLeft = START_TIME;
  playerHP = MAX_HP; 
  messageTimer = 0;
  flashTimer = 0;
  touchingDanger = false;
  popups = [];
  
  hpItem = null;
  hpSpawnTimer = 10;

  gameState = "PLAYING";
  startBgm();

  timerInterval = setInterval(function () {
    timeLeft--;

    if (hpItem === null) {
      hpSpawnTimer--;
      if (hpSpawnTimer <= 0) {
        // Menggunakan ukuran selebar player agar pas di dalam canvas saat spawn
        const pos = randomPosition(player.width);
        hpItem = {
          x: pos.x,
          y: pos.y,
          width: player.width,   // Diubah menjadi 100 (seukuran player)
          height: player.height  // Diubah menjadi 65 (seukuran player)
        };
        hpSpawnTimer = 10;
      }
    }

    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame("GAME_OVER");
    }
  }, 1000);
}

function endGame(state) {
  gameState = state;
  clearInterval(timerInterval);
  stopBgm();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("highScore", highScore);
  }

  if (state === "WIN") {
    playWinSound();
  } else {
    playLoseSound();
    flashTimer = 30;
  }
}

function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function update() {
  if (messageTimer > 0) messageTimer--;
  if (flashTimer > 0) flashTimer--;

  if (gameState !== "PLAYING") return;

  if (keysPressed["d"] || keysPressed["D"] || keysPressed["ArrowRight"]) player.x += player.speed;
  if (keysPressed["a"] || keysPressed["A"] || keysPressed["ArrowLeft"]) player.x -= player.speed;
  if (keysPressed["w"] || keysPressed["W"] || keysPressed["ArrowUp"]) player.y -= player.speed;
  if (keysPressed["s"] || keysPressed["S"] || keysPressed["ArrowDown"]) player.y += player.speed;

  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
  if (player.y < 0) player.y = 0;
  if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;

  // Cek tabrakan dengan radiant_coin
  coins.forEach(function (coin) {
    if (isColliding(player, coin)) {
      addPopup(coin.x, coin.y, "+" + COIN_VALUE, COLORS.cyanAccent);
      playCoinSound();

      const pos = randomPosition(coin.width);
      coin.x = pos.x;
      coin.y = pos.y;
      score += COIN_VALUE;

      if (score >= WIN_SCORE) {
        endGame("WIN");
      }
    }
  });

  // Cek tabrakan dengan item revival.png
  if (hpItem && isColliding(player, hpItem)) {
    if (playerHP < MAX_HP) {
      playerHP++;
      addPopup(hpItem.x, hpItem.y, "+1 HP", "#22c55e");
    } else {
      addPopup(hpItem.x, hpItem.y, "MAX HP", "#22c55e");
    }
    playCoinSound();
    hpItem = null;          
    hpSpawnTimer = 10;      
  }

  // Cek tabrakan dengan Tacet Discord
  let touching = false;
  dangers.forEach(function (d) {
    d.x += d.dx;
    d.y += d.dy;

    if (d.x < 0 || d.x + d.width > canvas.width) d.dx *= -1;
    if (d.y < 0 || d.y + d.height > canvas.height) d.dy *= -1;

    if (isColliding(player, d)) {
      touching = true;
      if (messageTimer === 0) {
        score -= 10;
        if (score < 0) score = 0;
        
        playerHP -= 1; 
        messageTimer = 60;
        playDangerSound();

        addPopup(player.x, player.y, "-10 Poin, -1 HP", "#ff4444");

        if (playerHP <= 0) {
          playerHP = 0;
          endGame("GAME_OVER");
        }
      }
    }
  });
  touchingDanger = touching;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function measurePill(text, fontStr) {
  ctx.font = fontStr;
  return ctx.measureText(text).width + 28;
}

function drawPill(text, x, y, bg, fg, fontStr) {
  const w = measurePill(text, fontStr);
  ctx.save();
  roundRect(x, y, w, 30, 15);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.font = fontStr;
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + 15);
  ctx.restore();
}

function drawCenteredPill(text, y, bg, fg) {
  const fontStr = fontOf(14, "bold");
  drawPill(text, W / 2 - measurePill(text, fontStr) / 2, y, bg, fg, fontStr);
}

function drawCenteredText(text, y, fontStr, color) {
  ctx.save();
  ctx.font = fontStr;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

function drawBackground() {
  if (backgroundImage.complete && backgroundImage.naturalWidth !== 0) {
    ctx.drawImage(backgroundImage, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#020617");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPlayer() {
  ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
}

function drawCoin(coin) {
  ctx.drawImage(coinImage, coin.x, coin.y, coin.width, coin.height);
}

// Menggambar sprite item HP (revival.png) seukuran player
function drawHpItem() {
  if (hpItem) {
    ctx.drawImage(hpItemImage, hpItem.x, hpItem.y, hpItem.width, hpItem.height);
  }
}

function drawDanger(danger) {
  ctx.drawImage(dangerImage, danger.x, danger.y, danger.width, danger.height);
}

function drawPopups() {
  ctx.save();
  ctx.font = fontOf(20, "bold");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 4;
  popups.forEach(function (p) {
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
    p.y -= 1;
    p.life--;
  });
  ctx.restore();
  popups = popups.filter(function (p) {
    return p.life > 0;
  });
}

function drawHUD() {
  const hudFont = fontOf(17, "bold");
  const dark = "rgba(15, 23, 42, 0.9)";
  const timeText = "TIME  " + timeLeft;

  drawPill("SCORE  " + score, 20, 18, dark, "#fff", hudFont);
  const timeWidth = measurePill(timeText, hudFont);
  drawPill(timeText, W - 20 - timeWidth, 18, timeLeft <= 10 ? COLORS.blueAccent : dark, "#fff", hudFont);
}

function drawFlash() {
  ctx.fillStyle = "rgba(37, 99, 235, " + (flashTimer / 30) * 0.35 + ")";
  ctx.fillRect(0, 0, W, H);
}

function drawOverlay() {
  ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
  ctx.fillRect(0, 0, W, H);
}

function drawCard() {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  roundRect(card.x, card.y, card.width, card.height, 18);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#1e293b";
  ctx.stroke();
  ctx.restore();
}

function drawButton(rect, label) {
  ctx.save();
  roundRect(rect.x, rect.y, rect.width, rect.height, 14);
  ctx.fillStyle = COLORS.blueAccent;
  ctx.fill();
  ctx.font = fontOf(22, "bold");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.restore();
}

function drawStartScreen() {
  drawOverlay();
  drawCard();
  drawCenteredPill("Blessed Maiden", card.y + 40, COLORS.cyanAccent, "#020617");
drawCenteredText("Gacha Mayhem", card.y + 100, fontOf(42, "bold"), "#f8fafc");
  drawCenteredText("Collect the radiant tides for " + WIN_SCORE + " points before time runs out", card.y + 138, fontOf(18), COLORS.muted);
  drawCenteredText("High Score: " + highScore, card.y + 172, fontOf(18, "bold"), COLORS.cyanAccent);
  drawButton(startButton, "START");
  drawCenteredText("or press Enter/Space", card.y + 285, fontOf(14), COLORS.muted);
}

function drawEndScreen() {
  const won = gameState === "WIN";
  drawOverlay();
  drawCard();
  drawCenteredPill(won ? "FINISHED · YOU WIN" : "FINISHED · GAME OVER", card.y + 26, won ? COLORS.cyanAccent : COLORS.lavender, "#020617");
  drawCenteredText(won ? "YOU WIN!" : "GAME OVER", card.y + 100, fontOf(44, "bold"), won ? COLORS.cyanAccent : COLORS.blueAccent);
  drawCenteredText("Final Score: " + score, card.y + 142, fontOf(22), COLORS.text);
  drawCenteredText("High Score: " + highScore, card.y + 174, fontOf(18, "bold"), COLORS.cyanAccent);
  drawButton(restartButton, "RESTART");
  drawCenteredText("or press Enter/Space", card.y + 285, fontOf(14), COLORS.muted);
}

function drawMuteButton() {
  ctx.save();
  roundRect(muteButton.x, muteButton.y, muteButton.width, muteButton.height, 16);
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#1e293b";
  ctx.stroke();
  ctx.font = fontOf(15, "bold");
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(muted ? "Sound: OFF" : "Sound: ON", muteButton.x + muteButton.width / 2, muteButton.y + muteButton.height / 2);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  dangers.forEach(drawDanger);
  coins.forEach(drawCoin);
  drawHpItem(); 
  drawPlayer();

  drawPopups();
  drawHUD();

  if (flashTimer > 0) drawFlash();
  if (gameState === "START") drawStartScreen();
  if (gameState === "WIN" || gameState === "GAME_OVER") drawEndScreen();
  drawMuteButton();

  let hearts = "";
  for (let i = 0; i < playerHP; i++) {
    hearts += "❤️ ";
  }
  document.getElementById("message").textContent = "HP: " + hearts;
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", function (event) {
  keysPressed[event.key] = true;

  if (event.key === " " || event.key === "Enter") {
    if (gameState !== "PLAYING") {
      event.preventDefault();
      startGame();
    }
  }

  (event.key === "m" || event.key === "M") && toggleMute();
});

document.addEventListener("keyup", function (event) {
  keysPressed[event.key] = false;
});

canvas.addEventListener("click", function (event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (W / rect.width);
  const y = (event.clientY - rect.top) * (H / rect.height);

  if (isInside(x, y, muteButton)) {
    toggleMute();
  } else if (gameState === "START" && isInside(x, y, startButton)) {
    startGame();
  } else if ((gameState === "WIN" || gameState === "GAME_OVER") && isInside(x, y, restartButton)) {
    startGame();
  }
});

gameLoop();