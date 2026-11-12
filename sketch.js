let stopSheet;
let walkSheet;
let magicSheet;
let effectSheet;

let stopFrames = [];
let walkFrames = [];
let magicFrames = [];
let effectFrames = [];

let errorLogs = [];

const stopTotalFrames = 10;
const stopSheetWidth = 1524;
const stopSheetHeight = 212;

const walkTotalFrames = 9;
const walkSheetWidth = 1246;
const walkSheetHeight = 198;

const magicTotalFrames = 4;
const magicSheetWidth = 1039;
const magicSheetHeight = 146;

const effectTotalFrames = 5;
const effectSheetWidth = 740;
const effectSheetHeight = 19;

let currentState = 'stop';
let currentFrame = 0;

let charX;
let moveSpeed = 8;
let facing = 1;

let activeEffects = [];
let effectSpeed = 18;

function preload() {
  stopSheet = loadImage('1/stop/stop.png', null, () => errorLogs.push('找不到：1/stop/stop.png'));
  walkSheet = loadImage('1/walk/walk.png', null, () => errorLogs.push('找不到：1/walk/walk.png'));
  magicSheet = loadImage('1/magic 1/magic 1.png', null, () => errorLogs.push('找不到：1/magic 1/magic 1.png'));
  effectSheet = loadImage('1/magic 1 effect/magic 1 effect.png', null, () => errorLogs.push('找不到：1/magic 1 effect/magic 1 effect.png'));
}

// 徹底消除跑馬燈的獨立個體切圖函式
function extractCleanFrames(sheet, expectedCount) {
  let frames = [];
  if (!sheet || sheet.width === 0) return frames;

  sheet.loadPixels();

  // 計算每一條垂直像素線的不透明像素總和，找出真正的角色實體區間
  let colDensity = new Array(sheet.width).fill(0);
  for (let x = 0; x < sheet.width; x++) {
    let count = 0;
    for (let y = 0; y < sheet.height; y++) {
      let idx = (y * sheet.width + x) * 4;
      // 使用較高透明度門檻 (Alpha > 50)，避免半透明殘影把兩個角色黏在一起
      if (sheet.pixels[idx + 3] > 50) {
        count++;
      }
    }
    colDensity[x] = count;
  }

  let segments = [];
  let inSprite = false;
  let startX = 0;

  for (let x = 0; x < sheet.width; x++) {
    // 該垂直線至少要有 2 個以上實體像素才算角色本體
    let hasSprite = colDensity[x] >= 2;
    if (hasSprite && !inSprite) {
      inSprite = true;
      startX = x;
    } else if (!hasSprite && inSprite) {
      inSprite = false;
      if (x - startX > 8) {
        segments.push({ left: startX, right: x });
      }
    }
  }
  if (inSprite && sheet.width - startX > 8) {
    segments.push({ left: startX, right: sheet.width });
  }

  // 只要有抓到獨立區塊（超過 1 個），就直接依真實邊界切割，絕不退回會產生跑馬燈的等分硬切
  if (segments.length > 1) {
    for (let i = 0; i < segments.length; i++) {
      let w = segments[i].right - segments[i].left;
      frames.push(sheet.get(segments[i].left, 0, w, sheet.height));
    }
  } else {
    // 僅在整張圖完全黏成一塊時才使用等分備案
    let fw = sheet.width / expectedCount;
    for (let i = 0; i < expectedCount; i++) {
      let sx = Math.round(i * fw);
      let sw = Math.round((i + 1) * fw) - sx;
      frames.push(sheet.get(sx, 0, sw, sheet.height));
    }
  }

  return frames;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(12);
  charX = width * (2 / 3);

  stopFrames = extractCleanFrames(stopSheet, stopTotalFrames);
  walkFrames = extractCleanFrames(walkSheet, walkTotalFrames);
  magicFrames = extractCleanFrames(magicSheet, magicTotalFrames);
  effectFrames = extractCleanFrames(effectSheet, effectTotalFrames);
}

function draw() {
  background(135, 206, 235);

  if (errorLogs.length > 0) {
    fill(200, 0, 0);
    noStroke();
    textSize(18);
    textAlign(LEFT, TOP);
    text('圖片載入警告：\n' + errorLogs.join('\n'), 20, 20);
  }

  let displayHeight = height / 3;
  let posY = height - displayHeight;

  if (currentState !== 'magic') {
    let moveDir = 0;
    let targetState = 'stop';

    if (keyIsDown(RIGHT_ARROW)) {
      targetState = 'walk';
      moveDir = 1;
      facing = 1;
    } else if (keyIsDown(LEFT_ARROW)) {
      targetState = 'walk';
      moveDir = -1;
      facing = -1;
    }

    if (currentState !== targetState) {
      currentState = targetState;
      currentFrame = 0;
    }

    charX += moveSpeed * moveDir;
  }

  let activeFrames = stopFrames;
  let origHeight = stopSheetHeight;
  if (currentState === 'walk' && walkFrames.length > 0) {
    activeFrames = walkFrames;
    origHeight = walkSheetHeight;
  } else if (currentState === 'magic' && magicFrames.length > 0) {
    activeFrames = magicFrames;
    origHeight = magicSheetHeight;
  }

  if (activeFrames.length > 0) {
    currentFrame = currentFrame % activeFrames.length;
    let currentImg = activeFrames[currentFrame];

    let scaleRatio = displayHeight / origHeight;
    let displayWidth = currentImg.width * scaleRatio;
    let halfWidth = displayWidth / 2;

    if (charX >= width - halfWidth) {
      charX = width - halfWidth;
    }
    if (charX <= halfWidth) {
      charX = halfWidth;
    }

    push();
    translate(charX, posY);
    scale(facing, 1);
    // 每張獨立影格皆以自身中心點對齊角色座標，原地定點播放
    image(currentImg, -halfWidth, 0, displayWidth, displayHeight);
    pop();

    if (currentState === 'magic') {
      if (currentFrame < activeFrames.length - 1) {
        currentFrame++;
      } else {
        spawnMagicEffect(charX, posY, displayWidth, displayHeight, facing);
        currentState = 'stop';
        currentFrame = 0;
      }
    } else {
      currentFrame = (currentFrame + 1) % activeFrames.length;
    }
  }

  updateAndDrawEffects(displayHeight);
}

function spawnMagicEffect(cX, cY, charW, charH, dir) {
  if (effectFrames.length === 0) return;
  let startX = cX + dir * (charW * 0.4);
  let startY = cY + charH * 0.5;
  activeEffects.push({
    x: startX,
    y: startY,
    dir: dir,
    frame: 0
  });
}

function updateAndDrawEffects(charDisplayHeight) {
  if (effectFrames.length === 0) return;

  let effectScale = charDisplayHeight / magicSheetHeight;

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    let eff = activeEffects[i];
    let effImg = effectFrames[eff.frame % effectFrames.length];
    let effW = effImg.width * effectScale;
    let effH = effImg.height * effectScale;
    let effHalfW = effW / 2;

    push();
    translate(eff.x, eff.y);
    scale(eff.dir, 1);
    image(effImg, -effHalfW, -effH / 2, effW, effH);
    pop();

    eff.x += effectSpeed * eff.dir;
    eff.frame = (eff.frame + 1) % effectFrames.length;

    if ((eff.dir === 1 && eff.x - effHalfW > width) || (eff.dir === -1 && eff.x + effHalfW < 0)) {
      activeEffects.splice(i, 1);
    }
  }
}

function keyPressed() {
  if (key === ' ' || keyCode === 32) {
    if (magicFrames.length > 0 && currentState !== 'magic') {
      currentState = 'magic';
      currentFrame = 0;
    }
    return false;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  charX = constrain(charX, 50, width - 50);
}