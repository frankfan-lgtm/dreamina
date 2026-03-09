import React, { useState, useEffect, useRef, useCallback } from "react";
import { WORLD_CONFIG, NPCS, INITIAL_RELATIONSHIPS, SCHEDULE_TEMPLATE, NPC_STATIONS } from "./world.js";
import { simulateTick, applyResult, chatWithNPC } from "./engine.js";

// ─── 工具函数 ───
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function moodColor(val) {
  if (val >= 70) return "#5a9868";
  if (val >= 40) return "#c08850";
  return "#a85050";
}

function relColor(val) {
  if (val > 30) return "#5a9868";
  if (val > 0) return "#7a9860";
  if (val > -30) return "#c08850";
  return "#a85050";
}

function barStr(val, max = 100) {
  const pct = Math.round((val / max) * 100);
  return `${pct}%`;
}

// ─── 像素精灵系统（Pokemon GBA overworld 风格）───
// 12x18 高精度模板，自动描边生成黑色轮廓线
// H=发色 h=发色亮 S=肤色 s=肤色暗 M=嘴 W=眼白 E=眼瞳
// T=上衣 t=上衣暗 P=裤子 p=裤子暗 B=腰带 A=肤色(长发侧)

const MALE_BODY = [ // 短发男性 12x18
  "....HHH.....",
  "...HHHHH....",
  "..HHHhHHH...",
  "..HHHHHHH...",
  "..SSSSSSS...",
  "..SWESEWS...",
  "..sSSMSSs...",
  "...SSSSS....",
  "....SSS.....",
  "...tTTTt....",
  "..tTTTTTt...",
  "..TTTTTTT...",
  ".sTTTTTTTs..",
  "..sTtTtTs...",
  "...BBBBB....",
  "...PPPPP....",
  "...PP.PP....",
  "...pp.pp....",
];

const FEMALE_BODY = [ // 长发女性 12x18
  "...hHHHh....",
  "..hHHhHHh...",
  ".hHHHHHHHh..",
  ".HHHHHHHHH..",
  ".HHSSSSSHH..",
  ".HSWESEWSH..",
  ".HsSSMSSsH..",
  "..HSSSSSH...",
  "...HSSH.....",
  "...tTTTt....",
  "..tTTTTTt...",
  "..TTTTTTT...",
  ".sTTTTTTTs..",
  "..sTtTtTs...",
  "...BBBBB....",
  "...PPPPP....",
  "...PP.PP....",
  "...pp.pp....",
];

const SPRITE_COLORS = {
  kelly: { // Kelly - 优雅深紫色西装外套，大女主
    H: "#2a1520", h: "#3a2530", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#5a3868", t: "#4a2858", P: "#2a2038", p: "#1a1028", B: "#3a2848",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "female",
  },
  pine: { // 🌲 - 森林绿polo衫，年轻leader
    H: "#1a1a28", h: "#28283a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#2a6a48", t: "#1a5a38", P: "#2a3040", p: "#1a2030", B: "#223038",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  frank: { // Frank - 时尚蓝色夹克，摄影达人
    H: "#2a2035", h: "#3a3048", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#3a6a9a", t: "#2a5a8a", P: "#2a2a3a", p: "#1a1a2a", B: "#2a3848",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  benzema: { // Benzema - 黑灰科技风卫衣
    H: "#1a1a1a", h: "#2a2a2a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#3a3a42", t: "#2a2a32", P: "#1a1a22", p: "#121218", B: "#2a2a30",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  yanfei: { // 陈妍霏 - 活力珊瑚橙，女汉子
    H: "#2a1818", h: "#3a2828", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#d06848", t: "#b05838", P: "#3a3048", p: "#2a2038", B: "#2a2838",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "female",
  },
  haoran: { // 张浩然 - 卡其色休闲衬衫，稳重奶爸
    H: "#2a2020", h: "#3a3030", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#8a7a60", t: "#7a6a50", P: "#3a3a42", p: "#2a2a32", B: "#4a4038",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  xinyi: { // 查心怡 - 淡蓝紫色针织衫，安静温柔
    H: "#3a2838", h: "#4a3848", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#7080a8", t: "#607098", P: "#3a3048", p: "#2a2038", B: "#2a2838",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "female",
  },
};

// 缓存渲染结果
const spriteCache = {};

function buildSpriteShadows(npcId, size) {
  const key = `${npcId}_${size}`;
  if (spriteCache[key]) return spriteCache[key];

  const colors = SPRITE_COLORS[npcId];
  if (!colors) return null;

  const rows = colors.body === "male" ? MALE_BODY : FEMALE_BODY;
  const outline = "#12101a";
  const w = rows[0].length;
  const h = rows.length;

  // Build color grid
  const grid = rows.map(row =>
    [...row].map(ch => ch === "." ? null : (colors[ch] || null))
  );

  const shadows = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) {
        shadows.push(`${x * size}px ${y * size}px 0 ${grid[y][x]}`);
      } else {
        // Auto-outline: transparent pixel adjacent to colored pixel → dark border
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1 && !near; dx++) {
            if (dy === 0 && dx === 0) continue;
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w && grid[ny][nx]) near = true;
          }
        }
        if (near) shadows.push(`${x * size}px ${y * size}px 0 ${outline}`);
      }
    }
  }

  const result = { shadows: shadows.join(","), w: w * size, h: h * size };
  spriteCache[key] = result;
  return result;
}

function PixelSprite({ npcId, size = 4 }) {
  const sprite = buildSpriteShadows(npcId, size);
  if (!sprite) return <span style={{ fontSize: 10 }}>?</span>;

  return (
    <div style={{ width: sprite.w, height: sprite.h, position: "relative", flexShrink: 0 }}>
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: size, height: size,
        boxShadow: sprite.shadows,
      }} />
    </div>
  );
}

const STORAGE_KEY = "dreamina_api_config";

// ─── 初始化NPC状态 ───
function initNpcs() {
  return NPCS.map((npc) => ({
    ...JSON.parse(JSON.stringify(npc)),
    action: "",
    thought: "",
    decisionChain: "",
    relationships: INITIAL_RELATIONSHIPS[npc.id] || {},
  }));
}

// ─── API设置页 ───
function ApiSetupScreen({ config, onSave }) {
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || "https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  const [model, setModel] = useState(config.model || "doubao-seed-2-0-pro-260215");
  const canSave = apiKey.trim() && model.trim();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="text-5xl mb-4 pixel-text">🏢</div>
      <h1 className="text-2xl font-bold text-accent mb-2">像素办公室</h1>
      <p className="text-text-dim mb-1 text-sm">AI 世界模拟引擎 — 观察生命的涌现</p>
      <p className="text-text-dim mb-8 text-xs">首次使用需要配置 API</p>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
        <div>
          <label className="text-xs text-text-dim block mb-1">API Key *</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="你的 API 密钥"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
        </div>
        <div>
          <label className="text-xs text-text-dim block mb-1">模型 / 接入点 ID *</label>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
            placeholder="如 doubao-seed-2-0-pro-260215"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none" />
        </div>
        <div>
          <label className="text-xs text-text-dim block mb-1">API 地址</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent outline-none font-mono text-xs" />
          <p className="text-xs text-text-dim mt-1">默认火山引擎 ARK，兼容 OpenAI 格式</p>
        </div>
        <button onClick={() => canSave && onSave({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() })}
          disabled={!canSave}
          className="w-full bg-accent/20 border border-accent text-accent py-2 rounded-lg text-sm hover:bg-accent/30 transition-colors cursor-pointer disabled:opacity-40">
          进入像素办公室
        </button>
      </div>
    </div>
  );
}

// ─── Canvas 地图引擎 ───
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function rgbHex(r,g,b) {
  return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
}

// Pre-render sprite to offscreen canvas
function prerenderSprite(npcId, scale) {
  const colors = SPRITE_COLORS[npcId];
  if (!colors) return null;
  const rows = colors.body === "male" ? MALE_BODY : FEMALE_BODY;
  const outline = "#12101a";
  const w = rows[0].length, h = rows.length;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const grid = rows.map(row => [...row].map(ch => ch === "." ? null : (colors[ch] || null)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x*scale, y*scale, scale, scale);
      } else {
        let near = false;
        for (let dy=-1; dy<=1&&!near; dy++) for (let dx=-1; dx<=1&&!near; dx++) {
          if (!dy&&!dx) continue;
          const ny=y+dy, nx=x+dx;
          if (ny>=0&&ny<h&&nx>=0&&nx<w&&grid[ny][nx]) near=true;
        }
        if (near) { ctx.fillStyle=outline; ctx.fillRect(x*scale,y*scale,scale,scale); }
      }
    }
  }
  return c;
}

// Draw checkerboard floor
function drawFloor(ctx, x, y, w, h, color) {
  const [r,g,b] = hexToRgb(color);
  const ts = 16;
  for (let ty=0; ty<h; ty+=ts) for (let tx=0; tx<w; tx+=ts) {
    const light = ((Math.floor(tx/ts)+Math.floor(ty/ts))%2)===0;
    ctx.fillStyle = rgbHex(r+(light?10:-6), g+(light?10:-6), b+(light?10:-6));
    ctx.fillRect(x+tx, y+ty, Math.min(ts,w-tx), Math.min(ts,h-ty));
  }
}

// Draw 3D room border
function drawBorder(ctx, x, y, w, h) {
  ctx.fillStyle='#3a3a55'; ctx.fillRect(x,y,w,3); ctx.fillRect(x,y,3,h);
  ctx.fillStyle='#16162a'; ctx.fillRect(x,y+h-3,w,3); ctx.fillRect(x+w-3,y,3,h);
}

// ─── 房间家具绘制系统（俯视图像素画）───
// 每个房间根据类型绘制不同的家具和装饰物

function drawRoomFurniture(ctx, x, y, w, h, roomId, isZoomed) {
  const s = isZoomed ? 2 : 1; // 缩放系数

  switch (roomId) {
    case 'desk': drawDeskRoom(ctx, x, y, w, h, s); break;
    case 'meeting': drawMeetingRoom(ctx, x, y, w, h, s); break;
    case 'pantry': drawPantryRoom(ctx, x, y, w, h, s); break;
    case 'boss': drawBossRoom(ctx, x, y, w, h, s); break;
    case 'canteen': drawCanteenRoom(ctx, x, y, w, h, s); break;
    case 'home': drawHomeRoom(ctx, x, y, w, h, s); break;
  }
}

// 工位区：电脑桌椅排列（即梦产品团队工位）
function drawDeskRoom(ctx, x, y, w, h, s) {
  const deskW = 28*s, deskH = 16*s, gap = 8*s;
  const rows = Math.max(1, Math.floor((h - 30*s) / (deskH + gap + 12*s)));
  const cols = Math.max(1, Math.floor((w - 16*s) / (deskW + gap)));
  const startX = x + (w - cols * (deskW + gap) + gap) / 2;
  const startY = y + 20*s;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = startX + c * (deskW + gap);
      const dy = startY + r * (deskH + gap + 12*s);
      // 桌面（白色现代办公桌）
      ctx.fillStyle = '#d8d0c8';
      ctx.fillRect(dx, dy, deskW, deskH);
      ctx.fillStyle = '#e8e0d8';
      ctx.fillRect(dx+1*s, dy+1*s, deskW-2*s, deskH-2*s);
      ctx.fillStyle = '#c8c0b8';
      ctx.fillRect(dx, dy+deskH-1*s, deskW, 1*s); // 桌面阴影
      // 显示器（Mac风格）
      ctx.fillStyle = '#c0c0c8';
      ctx.fillRect(dx + 8*s, dy + 1*s, 2*s, 2*s); // 支架
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(dx + 3*s, dy + 1*s, 14*s, 3*s); // 屏幕边框
      ctx.fillStyle = '#4a7aaa';
      ctx.fillRect(dx + 4*s, dy + 1*s, 12*s, 2*s); // 屏幕光（蓝色）
      // 键盘（浅灰色）
      ctx.fillStyle = '#c8c8d0';
      ctx.fillRect(dx + 4*s, dy + 7*s, 10*s, 3*s);
      ctx.fillStyle = '#d8d8e0';
      ctx.fillRect(dx + 5*s, dy + 7*s, 8*s, 2*s);
      // 鼠标
      ctx.fillStyle = '#c0c0c8';
      ctx.fillRect(dx + 16*s, dy + 8*s, 3*s, 3*s);
      // 咖啡杯
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(dx + 21*s, dy + 3*s, 3*s, 3*s);
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(dx + 22*s, dy + 4*s, 1*s, 1*s); // 咖啡
      // 椅子（深灰色人体工学椅）
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(dx + 7*s, dy + deskH + 1*s, 12*s, 8*s);
      ctx.fillStyle = '#3a3a42';
      ctx.fillRect(dx + 9*s, dy + deskH + 2*s, 8*s, 6*s);
      // 椅子轮子
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(dx + 7*s, dy + deskH + 8*s, 2*s, 2*s);
      ctx.fillRect(dx + 17*s, dy + deskH + 8*s, 2*s, 2*s);
      ctx.fillRect(dx + 12*s, dy + deskH + 9*s, 2*s, 1*s);
    }
  }

  // 墙上白板（上方）
  ctx.fillStyle = '#e8e4e0';
  ctx.fillRect(x + 6*s, y + 4*s, Math.min(30*s, w*0.3), 10*s);
  ctx.fillStyle = '#d0ccc8';
  ctx.fillRect(x + 7*s, y + 5*s, Math.min(28*s, w*0.3-2*s), 8*s);
  // 白板上的便利贴
  ctx.fillStyle = '#f0e068';
  ctx.fillRect(x + 8*s, y + 6*s, 4*s, 3*s);
  ctx.fillStyle = '#68c0f0';
  ctx.fillRect(x + 14*s, y + 6*s, 4*s, 3*s);
  ctx.fillStyle = '#f08888';
  ctx.fillRect(x + 20*s, y + 7*s, 4*s, 3*s);
  ctx.fillStyle = '#88e088';
  ctx.fillRect(x + 11*s, y + 10*s, 4*s, 2*s);

  // 绿植（角落大盆栽）
  ctx.fillStyle = '#6a4a38';
  ctx.fillRect(x + w - 10*s, y + h - 8*s, 6*s, 5*s); // 花盆
  ctx.fillStyle = '#2a6a2a';
  ctx.fillRect(x + w - 12*s, y + h - 14*s, 10*s, 8*s);
  ctx.fillStyle = '#3a8a3a';
  ctx.fillRect(x + w - 10*s, y + h - 12*s, 6*s, 5*s);
  ctx.fillStyle = '#4aaa4a';
  ctx.fillRect(x + w - 9*s, y + h - 10*s, 3*s, 3*s);

  // 右上角小植物
  ctx.fillStyle = '#5a3a28';
  ctx.fillRect(x + w - 8*s, y + 8*s, 4*s, 3*s);
  ctx.fillStyle = '#3a7a3a';
  ctx.fillRect(x + w - 9*s, y + 5*s, 6*s, 5*s);

  // 墙上装饰（即梦logo区域）
  ctx.fillStyle = '#3a3858';
  ctx.fillRect(x + w*0.55, y + 4*s, 14*s, 8*s);
  ctx.fillStyle = '#c08850';
  ctx.font = `${Math.max(4, 3*s)}px monospace`;
  ctx.fillText('✨即梦', x + w*0.55 + 2*s, y + 5*s + 4*s);
}

// 会议室：长桌 + 白板 + 投影
function drawMeetingRoom(ctx, x, y, w, h, s) {
  // 长会议桌（白色现代风）
  const tw = Math.min(w * 0.6, 80*s);
  const th = Math.min(h * 0.3, 36*s);
  const tx = x + (w - tw) / 2;
  const ty = y + (h - th) / 2 + 6*s;
  ctx.fillStyle = '#c8c0b8';
  ctx.fillRect(tx, ty, tw, th);
  ctx.fillStyle = '#d8d0c8';
  ctx.fillRect(tx + 2*s, ty + 2*s, tw - 4*s, th - 4*s);
  // 桌腿（细金属腿）
  ctx.fillStyle = '#808088';
  ctx.fillRect(tx + 3*s, ty + 3*s, 2*s, 2*s);
  ctx.fillRect(tx + tw - 5*s, ty + 3*s, 2*s, 2*s);
  ctx.fillRect(tx + 3*s, ty + th - 5*s, 2*s, 2*s);
  ctx.fillRect(tx + tw - 5*s, ty + th - 5*s, 2*s, 2*s);
  // 桌上笔记本/文件
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(tx + 8*s, ty + 5*s, 5*s, 4*s);
  ctx.fillStyle = '#68a0d0';
  ctx.fillRect(tx + tw - 16*s, ty + 6*s, 4*s, 3*s);
  // 桌上水杯
  ctx.fillStyle = '#e0e8f0';
  ctx.fillRect(tx + tw/2 - 1*s, ty + th/2 - 1*s, 2*s, 2*s);

  // 椅子围绕桌子
  const chairS = 6*s;
  const chairCount = Math.max(2, Math.floor(tw / (chairS + 6*s)));
  for (let i = 0; i < chairCount; i++) {
    const cx = tx + 4*s + i * (tw - 8*s) / Math.max(1, chairCount - 1) - chairS/2;
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(cx, ty - chairS - 3*s, chairS, chairS);
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(cx + 1*s, ty - chairS - 2*s, chairS - 2*s, chairS - 2*s);
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(cx, ty + th + 3*s, chairS, chairS);
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(cx + 1*s, ty + th + 4*s, chairS - 2*s, chairS - 2*s);
  }

  // 大白板（上方墙壁，带彩色内容）
  ctx.fillStyle = '#f0ece8';
  ctx.fillRect(x + w * 0.2, y + 4*s, w * 0.6, 14*s);
  ctx.fillStyle = '#e8e4e0';
  ctx.fillRect(x + w * 0.2 + 2*s, y + 6*s, w * 0.6 - 4*s, 10*s);
  // 白板上的线条和便利贴
  ctx.fillStyle = '#4a8ab0';
  ctx.fillRect(x + w*0.25, y + 7*s, w*0.15, 1*s);
  ctx.fillRect(x + w*0.25, y + 10*s, w*0.1, 1*s);
  ctx.fillStyle = '#f0e068';
  ctx.fillRect(x + w*0.5, y + 7*s, 4*s, 3*s);
  ctx.fillStyle = '#f09068';
  ctx.fillRect(x + w*0.5 + 5*s, y + 7*s, 4*s, 3*s);
  ctx.fillStyle = '#68d090';
  ctx.fillRect(x + w*0.5 + 2*s, y + 11*s, 4*s, 2*s);

  // 投影仪
  ctx.fillStyle = '#2a2a32';
  ctx.fillRect(x + w/2 - 4*s, y + 1*s, 8*s, 3*s);
  ctx.fillStyle = '#4a80b0';
  ctx.fillRect(x + w/2 - 1*s, y + 2*s, 2*s, 1*s); // 投影灯

  // 角落绿植
  ctx.fillStyle = '#5a3a28';
  ctx.fillRect(x + 4*s, y + h - 8*s, 4*s, 4*s);
  ctx.fillStyle = '#3a7a3a';
  ctx.fillRect(x + 3*s, y + h - 12*s, 6*s, 6*s);
  ctx.fillStyle = '#4a9a4a';
  ctx.fillRect(x + 4*s, y + h - 10*s, 3*s, 3*s);

  // 右下角立式台灯
  ctx.fillStyle = '#808080';
  ctx.fillRect(x + w - 6*s, y + h - 14*s, 1*s, 10*s);
  ctx.fillStyle = '#c8c0b0';
  ctx.fillRect(x + w - 8*s, y + h - 16*s, 5*s, 3*s);
}

// 茶水间：咖啡机 + 吧台 + 冰箱 + 小沙发
function drawPantryRoom(ctx, x, y, w, h, s) {
  // 吧台/料理台（上方，大理石纹理）
  ctx.fillStyle = '#d0c8c0';
  ctx.fillRect(x + 6*s, y + 6*s, w - 12*s, 12*s);
  ctx.fillStyle = '#e0d8d0';
  ctx.fillRect(x + 7*s, y + 7*s, w - 14*s, 10*s);
  // 大理石纹理
  ctx.fillStyle = '#c8c0b8';
  ctx.fillRect(x + 12*s, y + 9*s, 8*s, 1*s);
  ctx.fillRect(x + 30*s, y + 11*s, 6*s, 1*s);

  // 咖啡机（精致款）
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x + 8*s, y + 7*s, 8*s, 8*s);
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(x + 9*s, y + 7*s, 6*s, 2*s);
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(x + 10*s, y + 10*s, 4*s, 2*s);
  ctx.fillStyle = '#dd3030';
  ctx.fillRect(x + 9*s, y + 13*s, 2*s, 1*s); // 红灯

  // 水壶
  ctx.fillStyle = '#e0e0e8';
  ctx.fillRect(x + 20*s, y + 8*s, 5*s, 5*s);
  ctx.fillStyle = '#c8c8d0';
  ctx.fillRect(x + 25*s, y + 9*s, 1*s, 2*s); // 壶嘴

  // 零食区
  ctx.fillStyle = '#e8c860';
  ctx.fillRect(x + w - 20*s, y + 8*s, 4*s, 3*s); // 饼干盒
  ctx.fillStyle = '#d04040';
  ctx.fillRect(x + w - 14*s, y + 8*s, 3*s, 4*s); // 薯片
  ctx.fillStyle = '#40a060';
  ctx.fillRect(x + w - 10*s, y + 9*s, 2*s, 3*s); // 茶包

  // 冰箱（左下，银色）
  ctx.fillStyle = '#c0c8d0';
  ctx.fillRect(x + 4*s, y + h - 20*s, 10*s, 16*s);
  ctx.fillStyle = '#d0d8e0';
  ctx.fillRect(x + 5*s, y + h - 19*s, 8*s, 6*s);
  ctx.fillStyle = '#b8c0c8';
  ctx.fillRect(x + 5*s, y + h - 12*s, 8*s, 7*s);
  ctx.fillStyle = '#909898';
  ctx.fillRect(x + 12*s, y + h - 17*s, 1*s, 3*s);
  ctx.fillRect(x + 12*s, y + h - 10*s, 1*s, 3*s);

  // 圆桌（中央，木质）
  const cx2 = x + w/2, cy2 = y + h/2 + 4*s;
  ctx.fillStyle = '#7a6a58';
  ctx.beginPath(); ctx.arc(cx2, cy2, 10*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#8a7a68';
  ctx.beginPath(); ctx.arc(cx2, cy2, 8*s, 0, Math.PI*2); ctx.fill();
  // 杯子和杂志
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(cx2 - 4*s, cy2 - 2*s, 3*s, 3*s);
  ctx.fillStyle = '#88c0e0';
  ctx.fillRect(cx2 + 2*s, cy2 - 1*s, 2*s, 2*s);
  ctx.fillStyle = '#e0d0c0';
  ctx.fillRect(cx2 - 1*s, cy2 + 2*s, 4*s, 3*s); // 杂志

  // 小沙发（右下）
  ctx.fillStyle = '#6a8a7a';
  ctx.fillRect(x + w - 18*s, y + h - 14*s, 14*s, 8*s);
  ctx.fillStyle = '#7a9a8a';
  ctx.fillRect(x + w - 16*s, y + h - 12*s, 10*s, 5*s);
  // 靠垫
  ctx.fillStyle = '#c0a880';
  ctx.fillRect(x + w - 15*s, y + h - 11*s, 4*s, 3*s);

  // 墙上海报
  ctx.fillStyle = '#3a5868';
  ctx.fillRect(x + w - 12*s, y + 5*s, 8*s, 6*s);
  ctx.fillStyle = '#c08850';
  ctx.font = `${Math.max(3, 2*s)}px monospace`;
  ctx.fillText('☕', x + w - 10*s, y + 6*s + 3*s);
}

// Kelly办公室：大桌 + 书柜 + 沙发 + 装饰
function drawBossRoom(ctx, x, y, w, h, s) {
  // 大办公桌（深色实木）
  const dw = Math.min(w * 0.5, 50*s), dh = 18*s;
  const dx = x + (w - dw) / 2;
  const dy = y + 14*s;
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = '#6a5040';
  ctx.fillRect(dx + 2*s, dy + 2*s, dw - 4*s, dh - 4*s);
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(dx, dy + dh - 1*s, dw, 1*s);

  // Mac显示器
  ctx.fillStyle = '#c0c0c8';
  ctx.fillRect(dx + dw/2 - 1*s, dy + 2*s, 2*s, 2*s); // 支架
  ctx.fillStyle = '#2a2a32';
  ctx.fillRect(dx + dw/2 - 8*s, dy + 2*s, 16*s, 4*s);
  ctx.fillStyle = '#4a7ab0';
  ctx.fillRect(dx + dw/2 - 7*s, dy + 2*s, 14*s, 3*s);

  // 文件和笔筒
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(dx + 4*s, dy + 4*s, 5*s, 7*s);
  ctx.fillStyle = '#d8d0c0';
  ctx.fillRect(dx + 4*s, dy + 5*s, 5*s, 2*s);
  // 笔筒
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(dx + dw - 8*s, dy + 5*s, 4*s, 5*s);
  ctx.fillStyle = '#c08850';
  ctx.fillRect(dx + dw - 7*s, dy + 3*s, 1*s, 3*s); // 笔
  ctx.fillStyle = '#5080c0';
  ctx.fillRect(dx + dw - 6*s, dy + 4*s, 1*s, 2*s); // 笔

  // 老板椅（深色皮椅）
  ctx.fillStyle = '#3a2020';
  ctx.fillRect(dx + dw/2 - 7*s, dy + dh + 2*s, 14*s, 10*s);
  ctx.fillStyle = '#4a3030';
  ctx.fillRect(dx + dw/2 - 5*s, dy + dh + 3*s, 10*s, 8*s);
  // 椅子扶手
  ctx.fillStyle = '#3a2020';
  ctx.fillRect(dx + dw/2 - 8*s, dy + dh + 5*s, 2*s, 4*s);
  ctx.fillRect(dx + dw/2 + 6*s, dy + dh + 5*s, 2*s, 4*s);

  // 书柜（左墙，精装）
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(x + 4*s, y + 6*s, 10*s, h - 12*s);
  ctx.fillStyle = '#4a3020';
  for (let i = 0; i < 4; i++) {
    const sy = y + 10*s + i * ((h - 20*s) / 4);
    ctx.fillRect(x + 4*s, sy, 10*s, 1*s);
    const bookColors = ['#a83030','#3080a8','#80a830','#a88030','#8030a8'];
    for (let b = 0; b < 3; b++) {
      ctx.fillStyle = bookColors[(i*3+b) % bookColors.length];
      ctx.fillRect(x + 5*s + b*3*s, sy + 1*s, 2*s, (h - 20*s) / 4 - 3*s);
    }
  }

  // 来访沙发（右下，深绿色高档沙发）
  ctx.fillStyle = '#3a5a4a';
  ctx.fillRect(x + w - 20*s, y + h - 16*s, 16*s, 10*s);
  ctx.fillStyle = '#4a6a5a';
  ctx.fillRect(x + w - 18*s, y + h - 14*s, 12*s, 6*s);
  // 茶几
  ctx.fillStyle = '#5a4a38';
  ctx.fillRect(x + w - 24*s, y + h - 12*s, 6*s, 4*s);
  ctx.fillStyle = '#6a5a48';
  ctx.fillRect(x + w - 23*s, y + h - 11*s, 4*s, 2*s);

  // 绿植（大型落地植物）
  ctx.fillStyle = '#6a4a30';
  ctx.fillRect(x + w - 10*s, y + 10*s, 5*s, 5*s);
  ctx.fillStyle = '#2a7a2a';
  ctx.fillRect(x + w - 12*s, y + 5*s, 9*s, 8*s);
  ctx.fillStyle = '#3a9a3a';
  ctx.fillRect(x + w - 10*s, y + 6*s, 5*s, 5*s);

  // 墙上标语
  ctx.fillStyle = '#e8e0d8';
  ctx.fillRect(x + w*0.3, y + 4*s, w*0.4, 6*s);
  ctx.fillStyle = '#c08850';
  ctx.font = `${Math.max(4, 3*s)}px monospace`;
  ctx.fillText('让想象力自由', x + w*0.3 + 2*s, y + 5*s + 3*s);

  // 地毯
  ctx.fillStyle = 'rgba(100,70,50,0.12)';
  ctx.fillRect(x + w*0.2, y + h*0.4, w*0.6, h*0.35);
}

// 食堂：餐桌 + 餐盘 + 打饭台
function drawCanteenRoom(ctx, x, y, w, h, s) {
  // 打饭台（上方，不锈钢风格）
  ctx.fillStyle = '#a0a098';
  ctx.fillRect(x + 6*s, y + 5*s, w - 12*s, 10*s);
  ctx.fillStyle = '#b0b0a8';
  ctx.fillRect(x + 7*s, y + 6*s, w - 14*s, 8*s);
  // 菜盆（更丰富的颜色）
  const dishes = ['#cc6633','#66aa44','#ddaa33','#aa4433','#44aa88'];
  const dw2 = Math.min(8*s, (w - 24*s) / dishes.length);
  for (let i = 0; i < dishes.length; i++) {
    const dx = x + 10*s + i * (dw2 + 2*s);
    ctx.fillStyle = '#d8d8d0';
    ctx.fillRect(dx, y + 7*s, dw2, 4*s);
    ctx.fillStyle = dishes[i];
    ctx.fillRect(dx + 1*s, y + 8*s, dw2 - 2*s, 2*s);
  }
  // 打饭台上方的灯
  ctx.fillStyle = '#f0e870';
  ctx.fillRect(x + w/2 - 2*s, y + 2*s, 4*s, 2*s);

  // 餐桌
  const tableRows = Math.max(1, Math.floor((h - 28*s) / (22*s)));
  const tableCols = Math.max(1, Math.floor((w - 14*s) / (34*s)));
  for (let r = 0; r < tableRows; r++) {
    for (let c = 0; c < tableCols; c++) {
      const tx = x + 8*s + c * 34*s;
      const ty = y + 20*s + r * 22*s;
      ctx.fillStyle = '#d0c8c0';
      ctx.fillRect(tx, ty, 26*s, 10*s);
      ctx.fillStyle = '#e0d8d0';
      ctx.fillRect(tx + 1*s, ty + 1*s, 24*s, 8*s);
      // 餐盘
      ctx.fillStyle = '#f0e8e0';
      ctx.beginPath(); ctx.arc(tx + 7*s, ty + 5*s, 3*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 19*s, ty + 5*s, 3*s, 0, Math.PI*2); ctx.fill();
      // 筷子
      ctx.fillStyle = '#8a6a40';
      ctx.fillRect(tx + 10*s, ty + 3*s, 1*s, 4*s);
      ctx.fillRect(tx + 12*s, ty + 3*s, 1*s, 4*s);
      // 凳子（圆形）
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath(); ctx.arc(tx + 6*s, ty - 3*s, 3*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 20*s, ty - 3*s, 3*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 6*s, ty + 13*s, 3*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 20*s, ty + 13*s, 3*s, 0, Math.PI*2); ctx.fill();
    }
  }

  // 饮水机（右上角）
  ctx.fillStyle = '#e0e0e8';
  ctx.fillRect(x + w - 10*s, y + 6*s, 5*s, 8*s);
  ctx.fillStyle = '#4090d0';
  ctx.fillRect(x + w - 9*s, y + 7*s, 3*s, 3*s);
  ctx.fillStyle = '#d04040';
  ctx.fillRect(x + w - 8*s, y + 12*s, 1*s, 1*s); // 红灯
}

// 家：床 + 桌 + 沙发 + 电视 + 温馨装饰
function drawHomeRoom(ctx, x, y, w, h, s) {
  // 地毯（先画，在最底层）
  ctx.fillStyle = 'rgba(140,100,80,0.12)';
  ctx.fillRect(x + w*0.15, y + h*0.45, w*0.7, h*0.35);

  // 床（左上，温暖色调）
  ctx.fillStyle = '#5a4a38';
  ctx.fillRect(x + 6*s, y + 6*s, 22*s, 28*s);
  // 枕头（两个）
  ctx.fillStyle = '#d0c8b8';
  ctx.fillRect(x + 7*s, y + 7*s, 9*s, 5*s);
  ctx.fillRect(x + 17*s, y + 7*s, 9*s, 5*s);
  ctx.fillStyle = '#e0d8c8';
  ctx.fillRect(x + 8*s, y + 8*s, 7*s, 3*s);
  ctx.fillRect(x + 18*s, y + 8*s, 7*s, 3*s);
  // 被子（暖色格纹）
  ctx.fillStyle = '#7090b8';
  ctx.fillRect(x + 7*s, y + 13*s, 20*s, 19*s);
  ctx.fillStyle = '#6080a8';
  ctx.fillRect(x + 9*s, y + 15*s, 16*s, 15*s);
  // 格纹装饰
  ctx.fillStyle = '#80a0c8';
  ctx.fillRect(x + 11*s, y + 18*s, 6*s, 1*s);
  ctx.fillRect(x + 11*s, y + 22*s, 6*s, 1*s);

  // 床头柜
  ctx.fillStyle = '#5a4a38';
  ctx.fillRect(x + 29*s, y + 8*s, 6*s, 6*s);
  ctx.fillStyle = '#6a5a48';
  ctx.fillRect(x + 30*s, y + 9*s, 4*s, 4*s);
  // 台灯
  ctx.fillStyle = '#c0b8a8';
  ctx.fillRect(x + 31*s, y + 6*s, 2*s, 3*s);
  ctx.fillStyle = '#f0e0b0';
  ctx.fillRect(x + 30*s, y + 5*s, 4*s, 2*s); // 灯罩

  // 书桌（右上，浅木色）
  ctx.fillStyle = '#c8b8a0';
  ctx.fillRect(x + w - 24*s, y + 6*s, 18*s, 10*s);
  ctx.fillStyle = '#d8c8b0';
  ctx.fillRect(x + w - 22*s, y + 7*s, 14*s, 8*s);
  // 笔记本电脑
  ctx.fillStyle = '#c0c0c8';
  ctx.fillRect(x + w - 20*s, y + 8*s, 10*s, 6*s);
  ctx.fillStyle = '#3a6a9a';
  ctx.fillRect(x + w - 19*s, y + 9*s, 8*s, 4*s);
  // 水杯
  ctx.fillStyle = '#e0e8f0';
  ctx.fillRect(x + w - 9*s, y + 9*s, 2*s, 3*s);

  // 沙发（下方偏左，布艺）
  ctx.fillStyle = '#7a6878';
  ctx.fillRect(x + 6*s, y + h - 16*s, 26*s, 10*s);
  ctx.fillStyle = '#8a7888';
  ctx.fillRect(x + 8*s, y + h - 14*s, 22*s, 7*s);
  // 靠垫
  ctx.fillStyle = '#c0a070';
  ctx.fillRect(x + 9*s, y + h - 13*s, 5*s, 5*s);
  ctx.fillStyle = '#a0c0a0';
  ctx.fillRect(x + 24*s, y + h - 13*s, 5*s, 5*s);

  // 电视（右墙）
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x + w - 14*s, y + h - 26*s, 10*s, 8*s);
  ctx.fillStyle = '#3a6a9a';
  ctx.fillRect(x + w - 13*s, y + h - 25*s, 8*s, 6*s);
  // 电视柜
  ctx.fillStyle = '#5a4a38';
  ctx.fillRect(x + w - 16*s, y + h - 17*s, 14*s, 4*s);
  ctx.fillStyle = '#6a5a48';
  ctx.fillRect(x + w - 15*s, y + h - 16*s, 12*s, 2*s);

  // 拖鞋
  ctx.fillStyle = '#d0a070';
  ctx.fillRect(x + w/2 - 5*s, y + h - 5*s, 3*s, 2*s);
  ctx.fillRect(x + w/2 + 1*s, y + h - 5*s, 3*s, 2*s);

  // 窗户（上方墙中间）
  ctx.fillStyle = '#4a6a8a';
  ctx.fillRect(x + w*0.4, y + 2*s, w*0.2, 2*s);
  ctx.fillStyle = '#6090b8';
  ctx.fillRect(x + w*0.4 + 1*s, y + 2*s, w*0.2 - 2*s, 1*s);
}

// ─── NPC 移动位置系统（工位固定 + 偶尔走动）───
// NPC大部分时间坐在自己的工位，只有偶尔站起来走动
const npcPositions = {}; // { npcId: { x, y, targetX, targetY, lastMove, isIdle, stationX, stationY } }
const NPC_IDLE_CHECK_INTERVAL = 8000; // 每8秒检查一次是否要走动
const NPC_WANDER_CHANCE = 0.15; // 15%概率走动（大部分时间坐着）
const NPC_WANDER_RADIUS = 30; // 走动范围（像素）
const NPC_RETURN_CHANCE = 0.6; // 走动后60%概率回到工位
const NPC_MOVE_SPEED = 0.03; // 平滑移动速度

// 计算NPC在房间中的工位位置（固定位置）
// 注意：roomX/Y/W/H 是含边框的房间坐标，家具绘制在 (roomX+bw, roomY+bw) 的内部区域
function getStationPosition(npcId, roomId, roomX, roomY, roomW, roomH, bw, labelH, spriteW, spriteH, isZoomed) {
  const station = NPC_STATIONS[npcId];
  const s = isZoomed ? 2 : 1;
  // 内部区域（与 drawRoomFurniture 一致）
  const innerX = roomX + bw;
  const innerY = roomY + bw;
  const innerW = roomW - 2*bw;
  const innerH = roomH - 2*bw;

  // 如果NPC在自己的"主场"房间，分配固定工位
  if (station && station.room === roomId) {
    if (roomId === 'desk') {
      // 工位区：与 drawDeskRoom 完全一致的计算
      const deskW = 28*s, deskH = 16*s, gap = 8*s;
      const cols = Math.max(1, Math.floor((innerW - 16*s) / (deskW + gap)));
      const startX = innerX + (innerW - cols * (deskW + gap) + gap) / 2;
      const startY = innerY + 20*s;
      const row = Math.floor(station.seat / cols);
      const col = station.seat % cols;
      // 坐在椅子的位置（桌子下方，椅子中心）
      return {
        x: startX + col * (deskW + gap) + deskW/2 - spriteW/2,
        y: startY + row * (deskH + gap + 12*s) + deskH + 1*s,
      };
    }
    if (roomId === 'boss') {
      // Kelly坐在老板椅位置 — 与 drawBossRoom 一致
      const dw = Math.min(innerW * 0.5, 50*s);
      const dx = innerX + (innerW - dw) / 2;
      const dy = innerY + 14*s;
      return {
        x: dx + dw/2 - spriteW/2,
        y: dy + 20*s + 2*s,
      };
    }
  }

  // 其他情况：在房间内随机分配一个合理位置
  const minX = innerX + 8;
  const maxX = innerX + innerW - spriteW - 8;
  const minY = innerY + 8;
  const maxY = innerY + innerH - spriteH - 16;
  // 用npcId生成一个稳定的伪随机位置
  let hash = 0;
  for (let i = 0; i < npcId.length; i++) hash = ((hash << 5) - hash + npcId.charCodeAt(i)) | 0;
  const px = (Math.abs(hash) % 100) / 100;
  const py = (Math.abs(hash * 7 + 13) % 100) / 100;
  return {
    x: minX + px * Math.max(1, maxX - minX),
    y: minY + py * Math.max(1, maxY - minY),
  };
}

function getNpcPosition(npcId, roomX, roomY, roomW, roomH, bw, labelH, spriteW, spriteH, time, roomId, isZoomed) {
  const innerX = roomX + bw;
  const innerY = roomY + bw;
  const innerW = roomW - 2*bw;
  const innerH = roomH - 2*bw;
  const minX = innerX + 2;
  const maxX = innerX + innerW - spriteW - 2;
  const minY = innerY + 2;
  const maxY = innerY + innerH - spriteH - 14;

  // 每帧重新计算工位位置（应对窗口大小变化）
  const stationPos = getStationPosition(npcId, roomId, roomX, roomY, roomW, roomH, bw, labelH, spriteW, spriteH, isZoomed);

  if (!npcPositions[npcId]) {
    npcPositions[npcId] = {
      x: stationPos.x,
      y: stationPos.y,
      targetX: stationPos.x,
      targetY: stationPos.y,
      stationX: stationPos.x,
      stationY: stationPos.y,
      lastMove: time - Math.random() * NPC_IDLE_CHECK_INTERVAL,
      isIdle: true,
    };
  }

  const pos = npcPositions[npcId];

  // 更新工位基准位置（应对窗口/缩放变化）
  pos.stationX = stationPos.x;
  pos.stationY = stationPos.y;
  // 如果正在idle（坐着），目标也跟随工位
  if (pos.isIdle) {
    pos.targetX = stationPos.x;
    pos.targetY = stationPos.y;
  }

  // 定期检查：是否走动 or 回到工位
  if (time - pos.lastMove > NPC_IDLE_CHECK_INTERVAL) {
    pos.lastMove = time;
    if (pos.isIdle) {
      // 坐着 → 决定是否走动
      if (Math.random() < NPC_WANDER_CHANCE) {
        // 在工位附近小范围走动
        pos.targetX = pos.stationX + (Math.random() - 0.5) * NPC_WANDER_RADIUS * 2;
        pos.targetY = pos.stationY + (Math.random() - 0.5) * NPC_WANDER_RADIUS * 2;
        pos.isIdle = false;
      }
    } else {
      // 走动中 → 决定是否回到工位
      if (Math.random() < NPC_RETURN_CHANCE) {
        pos.targetX = pos.stationX;
        pos.targetY = pos.stationY;
        pos.isIdle = true;
      } else {
        // 继续在附近晃悠
        pos.targetX = pos.stationX + (Math.random() - 0.5) * NPC_WANDER_RADIUS * 2;
        pos.targetY = pos.stationY + (Math.random() - 0.5) * NPC_WANDER_RADIUS * 2;
      }
    }
  }

  // 平滑移动
  pos.x += (pos.targetX - pos.x) * NPC_MOVE_SPEED;
  pos.y += (pos.targetY - pos.y) * NPC_MOVE_SPEED;

  // 确保在边界内
  pos.x = Math.max(minX, Math.min(maxX, pos.x));
  pos.y = Math.max(minY, Math.min(maxY, pos.y));

  return { x: pos.x, y: pos.y };
}

// 当NPC切换房间时，重置位置
function resetNpcPosition(npcId) {
  delete npcPositions[npcId];
}

// Main Canvas Map component with zoom
function CanvasMap({ locations, npcs, selectedNPC, onSelectNPC }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const spriteCacheRef = useRef({});
  const [zoomedRoom, setZoomedRoom] = useState(null);
  const zoomRef = useRef(null);
  const roomRectsRef = useRef([]);
  const npcRectsRef = useRef([]);
  const propsRef = useRef({});
  propsRef.current = { locations, npcs, selectedNPC, onSelectNPC };

  // Pre-render sprites at two scales
  useEffect(() => {
    const cache = {};
    for (const id of Object.keys(SPRITE_COLORS)) {
      cache[id] = { s: prerenderSprite(id, 3), l: prerenderSprite(id, 5) };
    }
    spriteCacheRef.current = cache;
  }, []);

  useEffect(() => {
    zoomRef.current = zoomedRoom;
    // 缩放切换时房间坐标完全不同，必须重算工位位置
    Object.keys(npcPositions).forEach(id => delete npcPositions[id]);
  }, [zoomedRoom]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = containerRef.current;
    if (!canvas || !box) return;
    let raf;

    const render = () => {
      const { locations: locs, npcs: ns, selectedNPC: sel } = propsRef.current;
      const cw = box.clientWidth, ch = box.clientHeight;
      if (canvas.width!==cw||canvas.height!==ch) { canvas.width=cw; canvas.height=ch; }
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle='#0a0a14'; ctx.fillRect(0,0,cw,ch);
      const t = Date.now();
      const pad=8, gap=6, bw=3, labelH=20;
      const zoomed = zoomRef.current;

      if (zoomed) {
        // ─── Zoomed into one room ───
        const loc = locs.find(l=>l.id===zoomed);
        if (!loc) { raf=requestAnimationFrame(render); return; }
        const present = ns.filter(n=>n.region===loc.id);
        const rx=pad, ry=pad, rw=cw-2*pad, rh=ch-2*pad;
        drawFloor(ctx, rx+bw, ry+bw, rw-2*bw, rh-2*bw, loc.color);
        // 绘制家具
        drawRoomFurniture(ctx, rx+bw, ry+bw, rw-2*bw, rh-2*bw, loc.id, true);
        drawBorder(ctx, rx, ry, rw, rh);

        // Label
        ctx.fillStyle='#d8d0c4'; ctx.font='bold 14px monospace'; ctx.textBaseline='top';
        ctx.fillText(`${loc.emoji} ${loc.name}`, rx+bw+8, ry+bw+4);

        // Back button
        const bbx=cw-pad-62, bby=pad+bw+3;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bbx,bby,54,18);
        ctx.strokeStyle='#58506a'; ctx.strokeRect(bbx,bby,54,18);
        ctx.fillStyle='#c08850'; ctx.font='11px monospace';
        ctx.fillText('◀ 返回', bbx+6, bby+4);

        // NPCs large - 使用工位系统
        const sc=5, sw=12*sc, sh=18*sc;
        const nRects=[];
        present.forEach((npc,i)=>{
          const pos = getNpcPosition(npc.id, rx, ry, rw, rh, bw, labelH, sw, sh, t, loc.id, true);
          const nx = pos.x;
          const floatY = Math.sin(t/1200+i*1.7)*0.8; // 微小呼吸动画
          const ny = pos.y + floatY;
          // Shadow
          ctx.fillStyle='rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.ellipse(nx+sw/2, ny+sh+3, sw*0.4, 5, 0, 0, Math.PI*2); ctx.fill();
          // Sprite
          const sc2 = spriteCacheRef.current[npc.id]?.l;
          if (sc2) ctx.drawImage(sc2, nx, ny);
          // Selection
          if (npc.id===sel) {
            ctx.strokeStyle='#c08850'; ctx.lineWidth=2;
            ctx.strokeRect(nx-4,ny-4,sw+8,sh+28);
          }
          // Name
          ctx.fillStyle='#d8d0c4'; ctx.font='12px monospace'; ctx.textAlign='center';
          ctx.fillText(npc.name, nx+sw/2, ny+sh+8); ctx.textAlign='left';
          // Mood bar
          const mbw=32, mbx=nx+(sw-mbw)/2, mby=ny+sh+22;
          ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(mbx,mby,mbw,4);
          ctx.fillStyle=moodColor(npc.state.moodValue);
          ctx.fillRect(mbx,mby,mbw*npc.state.moodValue/100,4);
          // Thought bubble
          if (npc.thought||npc.action) {
            const txt = npc.thought || npc.action;
            const display = txt.length>14 ? txt.slice(0,14)+'..' : txt;
            ctx.font='10px monospace';
            const tw = ctx.measureText(display).width+8;
            const bx2=nx+sw/2-tw/2, by2=ny-18;
            ctx.fillStyle='rgba(10,10,20,0.9)';
            ctx.fillRect(bx2,by2,tw,16);
            ctx.strokeStyle = npc.thought ? 'rgba(192,136,80,0.5)' : '#2a2a40';
            ctx.lineWidth=1; ctx.strokeRect(bx2,by2,tw,16);
            ctx.fillStyle = npc.thought ? '#c08850' : '#8880a0';
            ctx.textAlign='center';
            ctx.fillText(display, nx+sw/2, by2+3); ctx.textAlign='left';
          }
          nRects.push({id:npc.id, x:nx-4, y:ny-4, w:sw+8, h:sh+32});
        });
        if (present.length===0) {
          ctx.fillStyle='#28283a'; ctx.font='12px monospace'; ctx.textAlign='center';
          ctx.fillText('空无一人...', cw/2, ch/2); ctx.textAlign='left';
        }
        npcRectsRef.current = nRects;
        roomRectsRef.current = [{id:'__back', x:bbx, y:bby, w:54, h:18}];

      } else {
        // ─── Overview: 3x2 grid ───
        const cols=3, rows=2;
        const rw = Math.floor((cw-2*pad-(cols-1)*gap)/cols);
        const rh = Math.floor((ch-2*pad-(rows-1)*gap)/rows);
        const rects=[];
        locs.forEach((loc,i)=>{
          const col=i%cols, row=Math.floor(i/cols);
          const rx=pad+col*(rw+gap), ry=pad+row*(rh+gap);
          drawFloor(ctx, rx+bw, ry+bw, rw-2*bw, rh-2*bw, loc.color);
          // 绘制家具（缩略图版本）
          drawRoomFurniture(ctx, rx+bw, ry+bw, rw-2*bw, rh-2*bw, loc.id, false);
          drawBorder(ctx, rx, ry, rw, rh);
          // Label
          ctx.fillStyle='#b8b0a8'; ctx.font='11px monospace'; ctx.textBaseline='top';
          ctx.fillText(`${loc.emoji} ${loc.name}`, rx+bw+4, ry+bw+3);
          // Count badge
          const present=ns.filter(n=>n.region===loc.id);
          ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(rx+rw-bw-20,ry+bw+2,17,14);
          ctx.fillStyle=present.length>0?'#c08850':'#58506a';
          ctx.font='10px monospace'; ctx.textAlign='center';
          ctx.fillText(String(present.length), rx+rw-bw-11, ry+bw+4); ctx.textAlign='left';
          // NPCs with station-based positioning
          const sw=12*3, sh=18*3;
          present.forEach((npc,ni)=>{
            const pos = getNpcPosition(npc.id, rx, ry, rw, rh, bw, labelH, sw, sh+14, t, loc.id, false);
            const nx = pos.x;
            const floatY=Math.sin(t/1200+ni*1.7+i*0.5)*0.5; // 微小呼吸动画
            const ny = pos.y + floatY;
            // Shadow
            ctx.fillStyle='rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.ellipse(nx+sw/2,ny+sh+1,sw*0.35,3,0,0,Math.PI*2); ctx.fill();
            // Sprite
            const spr=spriteCacheRef.current[npc.id]?.s;
            if(spr) ctx.drawImage(spr,nx,ny);
            // Selection
            if(npc.id===sel){ ctx.strokeStyle='#c08850'; ctx.lineWidth=1; ctx.strokeRect(nx-2,ny-2,sw+4,sh+14); }
            // Name
            ctx.fillStyle='#c8c0b8'; ctx.font='9px monospace'; ctx.textAlign='center';
            ctx.fillText(npc.name, nx+sw/2, ny+sh+3); ctx.textAlign='left';
            // Mini mood
            const mbw2=22, mbx2=nx+(sw-mbw2)/2, mby2=ny+sh+12;
            ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(mbx2,mby2,mbw2,2);
            ctx.fillStyle=moodColor(npc.state.moodValue);
            ctx.fillRect(mbx2,mby2,mbw2*npc.state.moodValue/100,2);
          });
          rects.push({id:loc.id, x:rx, y:ry, w:rw, h:rh});
        });
        roomRectsRef.current=rects; npcRectsRef.current=[];
      }
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);
    return ()=>cancelAnimationFrame(raf);
  }, []);

  // Click handler
  const handleClick = useCallback((e)=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
    const x=(e.clientX-rect.left)*scaleX, y=(e.clientY-rect.top)*scaleY;
    const zoomed=zoomRef.current;
    if(zoomed){
      for(const r of roomRectsRef.current) if(r.id==='__back'&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h){ setZoomedRoom(null); return; }
      for(const r of npcRectsRef.current) if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h){
        propsRef.current.onSelectNPC(r.id===propsRef.current.selectedNPC?null:r.id); return;
      }
    } else {
      for(const r of roomRectsRef.current) if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h){ setZoomedRoom(r.id); return; }
    }
  },[]);

  useEffect(()=>{
    const h=e=>{ if(e.key==='Escape') setZoomedRoom(null); };
    window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h);
  },[]);

  return (
    <div ref={containerRef} className="canvas-map-container">
      <canvas ref={canvasRef} onClick={handleClick} className="canvas-map" />
    </div>
  );
}

// ─── 对话流（主体区域）───
function DialogueStream({ dialogues, npcs }) {
  const npcMap = {};
  for (const n of npcs) npcMap[n.id] = n;
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [dialogues.length]);

  if (dialogues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
        <div className="text-center">
          <div className="text-3xl mb-2">...</div>
          <div>点击下方播放按钮，世界开始运转</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="dialogue-stream">
      {[...dialogues].reverse().slice(0, 50).map((d, i) => {
        const from = npcMap[d.from];
        const to = npcMap[d.to];
        const isEvent = !from; // 事件类消息
        if (isEvent) {
          return (
            <div key={i} className="dialogue-event animate-fade-in">
              <span className="text-text-dim">[{d.day}d {d.hour}h]</span>
              <span>{d.text || d.content}</span>
            </div>
          );
        }
        return (
          <div key={i} className={`dialogue-row animate-fade-in ${i === 0 ? "dialogue-latest" : ""}`}>
            <div className="dialogue-meta">
              <span className="dialogue-time">{d.day}d {d.hour}h</span>
            </div>
            <div className="dialogue-body">
              <div className="dialogue-speakers">
                <span className="dialogue-from">
                  <PixelSprite npcId={d.from} size={2} />
                  <span>{from?.name}</span>
                </span>
                <span className="dialogue-arrow">&#10132;</span>
                <span className="dialogue-to">
                  <PixelSprite npcId={d.to} size={2} />
                  <span>{to?.name}</span>
                </span>
              </div>
              <div className="dialogue-content" style={{whiteSpace:'pre-wrap'}}>"{d.content}"</div>
              {d.subtext && <div className="dialogue-subtext">{d.subtext}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 世界仪表盘（右侧默认）───
function WorldDashboard({ world, npcs, events, tensions, gameTime }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="text-center">
        <div className="text-xl mb-1">🏢 {world.name}</div>
        <div className="text-xs text-text-dim">第{gameTime.day}天 {String(gameTime.hour).padStart(2, "0")}:00</div>
      </div>

      {/* 资源仪表盘 */}
      <div>
        <div className="panel-section-title">📊 有限资源</div>
        <div className="space-y-2">
          {Object.entries(world.resources).map(([key, res]) => (
            <div key={key} className="bg-bg rounded px-2 py-1.5 border border-border">
              <div className="flex justify-between text-xs">
                <span>{res.name}</span>
                {res.total && <span className="text-accent">{res.current}/{res.total}</span>}
              </div>
              {res.total && (
                <div className="w-full h-1.5 bg-border rounded mt-1">
                  <div className="h-full rounded transition-all" style={{
                    width: `${(res.current / res.total) * 100}%`,
                    backgroundColor: res.current < res.total * 0.5 ? "#a85050" : "#5a9868"
                  }} />
                </div>
              )}
              <div className="text-[10px] text-text-dim mt-0.5">{res.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 张力热力图 */}
      {tensions.length > 0 && (
        <div>
          <div className="panel-section-title">🔥 张力热力图</div>
          <div className="space-y-1">
            {tensions.map((t, i) => {
              const a = npcs.find((n) => n.id === t.between[0]);
              const b = npcs.find((n) => n.id === t.between[1]);
              return (
                <div key={i} className="bg-bg rounded px-2 py-1 border border-border text-xs flex items-center gap-2">
                  <span>{a?.emoji}{a?.name}</span>
                  <span className="text-negative">{"⚡".repeat(Math.min(t.level, 5))}</span>
                  <span>{b?.emoji}{b?.name}</span>
                  <span className="text-text-dim ml-auto">{t.about}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 事件流 */}
      <div>
        <div className="panel-section-title">📜 事件编年史</div>
        {events.length === 0 ? (
          <div className="text-xs text-text-dim text-center py-4">世界尚未开始...</div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {[...events].reverse().map((ev, i) => (
              <div key={i} className="text-xs bg-bg rounded px-2 py-1.5 border border-border animate-fade-in">
                <span className="text-accent font-semibold">D{ev.day} {ev.hour}h</span> {ev.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 世界规则 */}
      <div>
        <div className="panel-section-title">📋 世界规则</div>
        <div className="space-y-1">
          {world.rules.map((rule, i) => (
            <div key={i} className="text-[10px] text-text-dim">· {rule}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NPC档案面板（8个tab，含上帝对话）───
function NPCPanel({ npc, allNpcs, apiConfig, world, gameTime }) {
  const [tab, setTab] = useState("soul");
  const tabs = [
    { id: "chat", label: "对话", icon: "💬" },
    { id: "soul", label: "灵魂", icon: "🧬" },
    { id: "goals", label: "目标", icon: "🎯" },
    { id: "memory", label: "记忆", icon: "🧠" },
    { id: "skills", label: "技能", icon: "⚡" },
    { id: "state", label: "状态", icon: "📊" },
    { id: "relations", label: "关系", icon: "🤝" },
    { id: "decision", label: "决策", icon: "💡" },
  ];

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* NPC头部 */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <span className="text-3xl">{npc.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-accent">{npc.name}</div>
          <div className="text-xs text-text-dim">{npc.title} | {npc.age}岁</div>
          <div className="text-xs text-text-dim mt-0.5 truncate">{npc.state.mood} | 压力{npc.state.pressure} | 精力{npc.state.energy}</div>
        </div>
      </div>

      {/* Tab栏 */}
      <div className="flex gap-0.5 py-2 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-1 rounded text-[10px] cursor-pointer transition-all whitespace-nowrap ${
              tab === t.id ? "bg-accent/20 text-accent" : "text-text-dim hover:text-accent"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab内容 */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-3" style={{ minHeight: 0 }}>
        {tab === "chat" && <ChatTab npc={npc} allNpcs={allNpcs} apiConfig={apiConfig} world={world} gameTime={gameTime} />}
        {tab === "soul" && <SoulTab npc={npc} />}
        {tab === "goals" && <GoalsTab npc={npc} />}
        {tab === "memory" && <MemoryTab npc={npc} />}
        {tab === "skills" && <SkillsTab npc={npc} />}
        {tab === "state" && <StateTab npc={npc} />}
        {tab === "relations" && <RelationsTab npc={npc} allNpcs={allNpcs} />}
        {tab === "decision" && <DecisionTab npc={npc} />}
      </div>
    </div>
  );
}

// ── 灵魂/基因 Tab ──
function SoulTab({ npc }) {
  const { gene, personality } = npc;
  return (
    <div className="space-y-3">
      <div className="text-xs text-text-dim">{npc.background}</div>

      <div>
        <div className="panel-section-title">核心驱力</div>
        {Object.entries(gene.core_drives).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} />
        ))}
      </div>

      <div>
        <div className="panel-section-title">认知风格</div>
        {Object.entries(gene.cognitive_style).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} />
        ))}
      </div>

      <div>
        <div className="panel-section-title">天赋基因</div>
        {Object.entries(gene.talent_genes).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} color="#c08850" />
        ))}
      </div>

      <div>
        <div className="panel-section-title">情绪基线</div>
        {Object.entries(gene.emotional_baseline).map(([k, v]) => (
          <GeneBar key={k} label={k} value={v} color="#8868a0" />
        ))}
      </div>

      {gene.mutation_log.length > 0 && (
        <div>
          <div className="panel-section-title">🔀 突变历史</div>
          {gene.mutation_log.map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">
              <span className="text-accent">D{m.tick}</span> {m.trait}: {m.from.toFixed(2)}→{m.to.toFixed(2)} — {m.reason}
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="panel-section-title">成长经历</div>
        {personality.origin.map((o, i) => (
          <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">
            <span className="text-accent">{o.age}</span> {o.event}
            <div className="text-text-dim mt-0.5">→ {o.expression}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="panel-section-title">行为倾向</div>
        {Object.entries(personality.tendencies).map(([k, v]) => (
          <div key={k} className="text-[10px] mb-1">
            <span className="text-text-dim">{k}：</span>{v}
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneBar({ label, value, color = "#5a9868" }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] text-text-dim w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-border rounded overflow-hidden">
        <div className="h-full rounded transition-all duration-500"
          style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] w-8 text-right">{value.toFixed(2)}</span>
    </div>
  );
}

// ── 目标 Tab ──
function GoalsTab({ npc }) {
  const sorted = Object.entries(npc.goals).sort((a, b) => b[1].priority - a[1].priority);
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-dim">目标优先级由基因核心驱力决定，满足度受环境影响</div>
      {sorted.map(([name, goal]) => (
        <div key={name} className="bg-bg rounded px-2 py-2 border border-border">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold">{goal.priority >= 4 ? "❗" : "  "} {name}</span>
            <span className="text-[10px] text-accent">优先级 {goal.priority}/5</span>
          </div>
          <div className="w-full h-2 bg-border rounded mt-1.5 overflow-hidden">
            <div className="h-full rounded transition-all duration-500" style={{
              width: `${goal.satisfaction}%`,
              backgroundColor: goal.satisfaction > 60 ? "#5a9868" : goal.satisfaction > 30 ? "#c08850" : "#a85050"
            }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-dim">{goal.desc}</span>
            <span className="text-[10px]">{goal.satisfaction}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 记忆 Tab ──
function MemoryTab({ npc }) {
  const { memories } = npc;
  return (
    <div className="space-y-3">
      <div>
        <div className="panel-section-title">💭 短期记忆（当天）</div>
        {(!memories.short || memories.short.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : [...memories.short].reverse().map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">{m}</div>
          ))}
      </div>
      <div>
        <div className="panel-section-title">📝 中期记忆（近期重要事件）</div>
        {(!memories.medium || memories.medium.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : [...memories.medium].reverse().map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-border mb-1">{m}</div>
          ))}
      </div>
      <div>
        <div className="panel-section-title">📚 长期记忆（永久）</div>
        {(!memories.long || memories.long.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : memories.long.map((m, i) => (
            <div key={i} className="text-[10px] bg-bg rounded px-2 py-1 border border-accent/30 mb-1 text-accent/80">{m}</div>
          ))}
      </div>
    </div>
  );
}

// ── 技能 Tab ──
function SkillsTab({ npc }) {
  const talents = npc.gene.talent_genes;
  const skillEntries = Object.entries(npc.skills).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-text-dim">技能上限由天赋基因决定（虚线），当前水平由实践决定</div>
      {skillEntries.map(([name, level]) => {
        // 尝试找到对应天赋来显示天花板
        let ceiling = 10;
        if (name === "编程" || name === "数据分析") ceiling = Math.round(talents.逻辑天赋 * 10);
        else if (name === "沟通" || name === "演讲") ceiling = Math.round(talents.语言天赋 * 10);
        else if (name === "向上管理" || name === "人际关系") ceiling = Math.round((talents.共情天赋 + talents.语言天赋) / 2 * 10);
        else if (name === "管理") ceiling = Math.round(talents.领导力天赋 * 10);
        else if (name === "摸鱼" || name === "甩锅") ceiling = Math.round(talents.适应力天赋 * 10);

        return (
          <div key={name} className="mb-2">
            <div className="flex justify-between text-xs">
              <span>{name}</span>
              <span>{level}/10</span>
            </div>
            <div className="relative w-full h-3 bg-border rounded mt-0.5 overflow-visible">
              <div className="absolute h-full rounded transition-all duration-500"
                style={{ width: `${(level / 10) * 100}%`, backgroundColor: "#5a9868" }} />
              <div className="absolute h-full border-r-2 border-dashed border-accent/50"
                style={{ width: `${(ceiling / 10) * 100}%` }}
                title={`天赋天花板: ${ceiling}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 状态 Tab ──
function StateTab({ npc }) {
  const { state } = npc;
  const gauges = [
    { label: "情绪", value: state.moodValue, desc: state.mood, color: moodColor(state.moodValue), warn: state.moodValue < 30 },
    { label: "压力", value: state.pressure, desc: state.pressure > 80 ? "⚠️ 临界" : "", color: state.pressure > 80 ? "#a85050" : state.pressure > 50 ? "#c08850" : "#5a9868", warn: state.pressure > 80 },
    { label: "精力", value: state.energy, desc: state.energy < 30 ? "⚠️ 耗竭" : "", color: state.energy < 30 ? "#a85050" : "#5a9868", warn: state.energy < 30 },
  ];

  return (
    <div className="space-y-3">
      {gauges.map((g) => (
        <div key={g.label} className={`bg-bg rounded px-3 py-2 border ${g.warn ? "border-negative" : "border-border"}`}>
          <div className="flex justify-between text-xs">
            <span>{g.label}</span>
            <span style={{ color: g.color }}>{g.value}/100 {g.desc}</span>
          </div>
          <div className="w-full h-3 bg-border rounded mt-1.5 overflow-hidden">
            <div className="h-full rounded transition-all duration-500" style={{ width: `${g.value}%`, backgroundColor: g.color }} />
          </div>
        </div>
      ))}

      <div className="bg-bg rounded px-3 py-2 border border-border">
        <div className="flex justify-between text-xs">
          <span>薪资</span>
          <span className="text-accent">¥{state.salary?.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-bg rounded px-3 py-2 border border-border">
        <div className="flex justify-between text-xs">
          <span>绩效</span>
          <span className={`font-bold ${
            state.performance === "S" ? "text-positive" :
            state.performance === "A" ? "text-accent" :
            state.performance === "C" ? "text-negative" : "text-text-dim"
          }`}>{state.performance || "待定"}</span>
        </div>
      </div>

      {/* 情绪基线参考 */}
      <div>
        <div className="panel-section-title">情绪基线（基因决定）</div>
        <div className="text-[10px] text-text-dim space-y-0.5">
          <div>焦虑倾向: {npc.gene.emotional_baseline.焦虑倾向} — {npc.gene.emotional_baseline.焦虑倾向 > 0.6 ? "同等压力下更容易焦虑" : "抗焦虑能力较强"}</div>
          <div>韧性: {npc.gene.emotional_baseline.韧性} — {npc.gene.emotional_baseline.韧性 > 0.6 ? "能扛住持续压力" : "持续高压下容易崩溃"}</div>
          <div>敏感度: {npc.gene.emotional_baseline.敏感度} — {npc.gene.emotional_baseline.敏感度 > 0.6 ? "对外界刺激反应强烈" : "比较迟钝"}</div>
        </div>
      </div>
    </div>
  );
}

// ── 关系 Tab ──
function RelationsTab({ npc, allNpcs }) {
  const rels = npc.relationships || {};
  if (Object.keys(rels).length === 0) return <div className="text-xs text-text-dim">暂无关系数据</div>;

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-dim">内心真实态度 vs 外在表现 — 差值越大越"城府深"</div>
      {Object.entries(rels).map(([tid, rel]) => {
        const target = allNpcs.find((n) => n.id === tid);
        if (!target) return null;
        const gap = Math.abs(rel.inner - rel.outer);
        return (
          <div key={tid} className="bg-bg rounded px-2 py-2 border border-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs">{target.emoji} {target.name}</span>
              {gap > 20 && <span className="text-[10px] text-negative">🎭 城府深</span>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-dim w-8">内心</span>
                <div className="flex-1 h-2 bg-border rounded overflow-hidden relative">
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 border-r border-bg/30" />
                  </div>
                  <div className="h-full rounded transition-all"
                    style={{
                      width: `${(rel.inner + 100) / 2}%`,
                      backgroundColor: relColor(rel.inner),
                      marginLeft: rel.inner < 0 ? `${(rel.inner + 100) / 2}%` : "50%",
                      ...(rel.inner < 0 ? { marginLeft: `${(rel.inner + 100) / 2}%`, width: `${50 - (rel.inner + 100) / 2}%` } : { marginLeft: "50%", width: `${(rel.inner) / 2}%` })
                    }} />
                </div>
                <span className="text-[10px] w-8 text-right" style={{ color: relColor(rel.inner) }}>
                  {rel.inner > 0 ? "+" : ""}{rel.inner}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-dim w-8">表面</span>
                <div className="flex-1 h-2 bg-border rounded overflow-hidden">
                  <div className="h-full rounded transition-all"
                    style={{
                      ...(rel.outer < 0 ? { marginLeft: `${(rel.outer + 100) / 2}%`, width: `${50 - (rel.outer + 100) / 2}%` } : { marginLeft: "50%", width: `${(rel.outer) / 2}%` })
                    }} />
                </div>
                <span className="text-[10px] w-8 text-right" style={{ color: relColor(rel.outer) }}>
                  {rel.outer > 0 ? "+" : ""}{rel.outer}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-text-dim mt-1">{rel.notes}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 决策 Tab ──
function DecisionTab({ npc }) {
  return (
    <div className="space-y-3">
      {npc.action && (
        <div className="bg-bg rounded px-2 py-2 border border-border">
          <div className="text-[10px] text-text-dim mb-1">🎬 当前行为</div>
          <div className="text-xs">{npc.action}</div>
        </div>
      )}
      {npc.thought && (
        <div className="bg-bg rounded px-2 py-2 border border-border">
          <div className="text-[10px] text-text-dim mb-1">💭 内心独白</div>
          <div className="text-xs italic">"{npc.thought}"</div>
        </div>
      )}
      {npc.decisionChain && (
        <div className="bg-bg rounded px-2 py-2 border border-accent/30">
          <div className="text-[10px] text-text-dim mb-1">🔗 决策推理链</div>
          <div className="text-xs text-accent/80">{npc.decisionChain}</div>
        </div>
      )}
      {!npc.action && !npc.thought && !npc.decisionChain && (
        <div className="text-xs text-text-dim text-center py-4">尚无决策记录，等待世界运转...</div>
      )}
    </div>
  );
}

// ─── 上帝对话 Tab ───
function ChatTab({ npc, allNpcs, apiConfig, world, gameTime }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const prevNpcId = useRef(npc.id);

  // NPC切换时清空聊天记录
  useEffect(() => {
    if (prevNpcId.current !== npc.id) {
      setMessages([]);
      prevNpcId.current = npc.id;
    }
  }, [npc.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const reply = await chatWithNPC(apiConfig, npc, allNpcs, world, gameTime, history, text);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `[错误] ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, apiConfig, npc, allNpcs, world, gameTime]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <div className="text-[10px] text-text-dim mb-2 px-1">
        以上帝视角和{npc.name}的分身对话，不影响世界运行。TA会按照自己的性格回应你。
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-2" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">{npc.emoji}</div>
            <div className="text-xs text-text-dim">试着和{npc.name}聊聊吧</div>
            <div className="text-[10px] text-text-dim mt-1">比如问问TA对工作的看法、对同事的评价……</div>
            <div className="flex flex-wrap gap-1 mt-3 justify-center">
              {["最近工作怎么样？", "你觉得同事们怎么样？", "有什么烦心事吗？"].map((q, i) => (
                <button key={i} onClick={() => { setInput(q); }}
                  className="text-[10px] px-2 py-1 rounded border border-border text-text-dim hover:border-accent hover:text-accent cursor-pointer transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
              m.role === "user"
                ? "bg-accent/20 text-accent border border-accent/30"
                : "bg-card border border-border"
            }`}>
              {m.role === "assistant" && (
                <div className="text-[10px] text-text-dim mb-1 flex items-center gap-1">
                  <span>{npc.emoji}</span>
                  <span>{npc.name}</span>
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs">
              <span className="text-text-dim animate-pulse">{npc.name}正在思考...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`对${npc.name}说点什么...`}
          disabled={loading}
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-xs focus:border-accent outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg text-xs bg-accent/20 border border-accent text-accent hover:bg-accent/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          发送
        </button>
      </div>
    </div>
  );
}

// ─── 底部时间条 ───
function TimeBar({ gameTime, isPlaying, isBusy, onAdvance, onTogglePlay, speed, onSpeedChange }) {
  const hourLabel = SCHEDULE_TEMPLATE.find((s) => s.hour === gameTime.hour)?.label || "";

  return (
    <div className="time-bar">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-sm font-bold text-accent">
          第{gameTime.day}天 {String(gameTime.hour).padStart(2, "0")}:00
        </span>
        <span className="text-xs text-text-dim">{hourLabel}</span>

        {/* 时间进度条 */}
        <div className="flex-1 h-2 bg-border rounded overflow-hidden mx-2">
          <div className="h-full bg-accent/50 rounded transition-all duration-300"
            style={{ width: `${((gameTime.hour - 7) / 16) * 100}%` }} />
        </div>

        {isBusy && <span className="text-accent text-xs animate-pulse-glow">⟳ 推演中...</span>}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onAdvance} disabled={isBusy}
          className="px-3 py-1 rounded text-xs bg-accent/20 border border-accent text-accent hover:bg-accent/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          ▶ 下一步
        </button>
        <button onClick={onTogglePlay}
          className={`px-3 py-1 rounded text-xs border cursor-pointer ${
            isPlaying ? "bg-negative/20 border-negative text-negative" : "bg-card border-border text-text-dim hover:border-accent hover:text-accent"
          }`}>
          {isPlaying ? "⏸ 暂停" : "⏩ 自动"}
        </button>
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="bg-card border border-border rounded px-2 py-1 text-xs text-text-dim cursor-pointer">
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
      </div>
    </div>
  );
}

// ─── 主模拟界面 ───
function SimulationScreen({ apiConfig, onSettings }) {
  const [npcs, setNpcs] = useState(initNpcs);
  const [gameTime, setGameTime] = useState({ day: 1, hour: 9 });
  const [events, setEvents] = useState([]);
  const [dialogues, setDialogues] = useState([]);
  const [tensions, setTensions] = useState([]);
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(null);
  const [showIntervention, setShowIntervention] = useState(false);
  const playRef = useRef(false);

  const world = WORLD_CONFIG;

  const advanceTick = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const result = await simulateTick(apiConfig, world, npcs, gameTime, intervention);
      // 检测NPC换房间，重置走动位置
      const oldRegions = {};
      npcs.forEach(n => { oldRegions[n.id] = n.region; });
      const updatedNpcs = applyResult(npcs, result);
      updatedNpcs.forEach(n => {
        if (n.region !== oldRegions[n.id]) resetNpcPosition(n.id);
      });
      setNpcs(updatedNpcs);

      if (result.sum) {
        setEvents((prev) => [...prev, { day: gameTime.day, hour: gameTime.hour, text: result.sum }]);
      }

      if (result.talks && Array.isArray(result.talks)) {
        const newDialogues = result.talks.map((t) => ({
          day: gameTime.day, hour: gameTime.hour,
          from: t.f, to: t.t, content: t.s, subtext: t.subtext || "",
        }));
        setDialogues((prev) => [...prev, ...newDialogues]);
      }

      if (result.tensions && Array.isArray(result.tensions)) {
        setTensions(result.tensions);
      }

      // 基因突变
      if (result.mutation) {
        // 应用突变后在事件中记录
        const mutNpc = updatedNpcs.find((n) => n.id === result.mutation.npc_id);
        if (mutNpc) {
          setEvents((prev) => [...prev, {
            day: gameTime.day, hour: gameTime.hour,
            text: `🔀 ${mutNpc.name}发生基因突变：${result.mutation.trait} ${result.mutation.old_value}→${result.mutation.new_value}（${result.mutation.reason}）`
          }]);
        }
      }

      setIntervention(null);

      // 推进时间
      setGameTime((prev) => {
        let nextHour = prev.hour + 1;
        let nextDay = prev.day;
        if (nextHour > 23) {
          nextHour = 7;
          nextDay += 1;
        }
        return { day: nextDay, hour: nextHour };
      });
    } catch (e) {
      setError(e.message);
      setIsPlaying(false);
      playRef.current = false;
    } finally {
      setIsBusy(false);
    }
  }, [apiConfig, world, npcs, gameTime, intervention, isBusy]);

  // 自动模式
  useEffect(() => { playRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => {
    if (!isPlaying) return;
    const delay = Math.max(500, 3000 / speed);
    const timer = setTimeout(() => {
      if (playRef.current && !isBusy) advanceTick();
    }, delay);
    return () => clearTimeout(timer);
  }, [isPlaying, isBusy, gameTime, advanceTick, speed]);

  const selectedNpcData = npcs.find((n) => n.id === selectedNPC);

  return (
    <div className="simulation-layout">
      {/* 左侧：地图 + 对话 */}
      <div className="simulation-main">
        {/* 顶栏 */}
        <header className="sim-header">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏢 像素办公室</span>
            {error && <span className="text-negative text-xs">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowIntervention(!showIntervention)}
              className={`px-3 py-1 rounded text-xs border cursor-pointer transition-all ${
                showIntervention ? "bg-accent/20 border-accent text-accent" : "border-border text-text-dim hover:border-accent"
              }`}>
              🌩️ 天命干预
            </button>
            <button onClick={onSettings}
              className="px-3 py-1 rounded text-xs border border-border text-text-dim hover:border-accent hover:text-accent cursor-pointer">
              ⚙️
            </button>
          </div>
        </header>

        {/* 干预面板 */}
        {showIntervention && (
          <div className="intervention-bar">
            {world.interventions.map((iv) => (
              <button key={iv.id}
                onClick={() => setIntervention(intervention === iv.id ? null : iv.id)}
                title={iv.description}
                className={`px-3 py-1 rounded text-xs border cursor-pointer transition-all ${
                  intervention === iv.id ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-text-dim hover:border-accent"
                }`}>
                {iv.emoji} {iv.name}
              </button>
            ))}
            {intervention && <span className="text-xs text-accent ml-2">⚡ 下次推演时生效</span>}
          </div>
        )}

        {/* Canvas 地图 */}
        <CanvasMap locations={world.locations} npcs={npcs} selectedNPC={selectedNPC} onSelectNPC={setSelectedNPC} />

        {/* 众生之声（主体区域） */}
        <div className="dialogue-container">
          <div className="dialogue-header">
            <span>&#128172; 众生之声</span>
            <span className="text-text-dim text-xs">{dialogues.length} 条记录</span>
          </div>
          <DialogueStream dialogues={dialogues} npcs={npcs} />
        </div>
      </div>

      {/* 右侧面板 */}
      <aside className="simulation-panel">
        <div className="flex-1 overflow-y-auto p-3">
          {selectedNpcData ? (
            <NPCPanel npc={selectedNpcData} allNpcs={npcs} apiConfig={apiConfig} world={world} gameTime={gameTime} />
          ) : (
            <WorldDashboard world={world} npcs={npcs} events={events} tensions={tensions} gameTime={gameTime} />
          )}
        </div>

        {/* NPC快速选择栏 */}
        <div className="border-t border-border px-3 py-2 flex items-center justify-center gap-1">
          <button onClick={() => setSelectedNPC(null)}
            className={`px-2 py-1 rounded text-xs cursor-pointer ${!selectedNPC ? "bg-accent/20 text-accent" : "text-text-dim hover:text-accent"}`}>
            🏢
          </button>
          {npcs.map((n) => (
            <button key={n.id} onClick={() => setSelectedNPC(n.id === selectedNPC ? null : n.id)}
              title={`${n.name} - ${n.state.mood}`}
              className={`px-1.5 py-1 rounded text-base cursor-pointer transition-all ${
                n.id === selectedNPC ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-card-hover"
              }`}>
              {n.emoji}
            </button>
          ))}
        </div>
      </aside>

      {/* 底部时间条 */}
      <TimeBar gameTime={gameTime} isPlaying={isPlaying} isBusy={isBusy}
        onAdvance={advanceTick} onTogglePlay={() => setIsPlaying(!isPlaying)}
        speed={speed} onSpeedChange={setSpeed} />
    </div>
  );
}

// ─── App Root ───
export default function App() {
  const [phase, setPhase] = useState("sim"); // 默认进入模拟（如果有API配置的话）
  const [apiConfig, setApiConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const handleSaveConfig = (config) => {
    setApiConfig(config);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
    setPhase("sim");
  };

  // 只在用户主动点设置时才进设置页（server.js 已内置默认 API Key）
  if (phase === "setup") {
    return <ApiSetupScreen config={apiConfig} onSave={handleSaveConfig} />;
  }

  return (
    <SimulationScreen
      apiConfig={apiConfig}
      onSettings={() => setPhase("setup")}
    />
  );
}
