import React, { useState, useEffect, useRef, useCallback } from "react";
import { WORLD_CONFIG, NPCS, INITIAL_RELATIONSHIPS, SCHEDULE_TEMPLATE, NPC_STATIONS } from "./world.js";
import { simulateTick, applyResult, chatWithNPC, generateImagePrompt, generateSceneImage } from "./engine.js";
import { WORLD_PRESETS, generateWorld, autoAssignSprites } from "./sdk/index.js";

// ─── 工具函数 ───
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function moodColor(val) {
  if (val >= 70) return "#58c878";
  if (val >= 40) return "#e8b848";
  return "#d85858";
}

function relColor(val) {
  if (val > 30) return "#58c878";
  if (val > 0) return "#78c860";
  if (val > -30) return "#e8b848";
  return "#d85858";
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

// 动态精灵配色 — 会在世界选择时被设置
let SPRITE_COLORS = WORLD_PRESETS.office.spriteColors;

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
const WORLD_SAVE_KEY = "dreamina_world_save";

// ─── 初始化NPC状态 ───
function initNpcs(npcData, relationshipData) {
  const npcsSource = npcData || NPCS;
  const relsSource = relationshipData || INITIAL_RELATIONSHIPS;
  return npcsSource.map((npc) => ({
    ...JSON.parse(JSON.stringify(npc)),
    action: "",
    thought: "",
    decisionChain: "",
    relationships: relsSource[npc.id] || {},
  }));
}

// ─── API设置页 ───
function ApiSetupScreen({ config, onSave }) {
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || "https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  const [model, setModel] = useState(config.model || "doubao-seed-2-0-pro-260215");
  const canSave = apiKey.trim() && model.trim();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8" style={{background:'radial-gradient(ellipse at center, #2a2a45 0%, #1a1a2e 65%, #0e1119 100%)'}}>
      <div className="text-5xl mb-4">⭐</div>
      <h1 className="text-2xl font-bold mb-2" style={{color:'#ffd700'}}>像素办公室</h1>
      <p className="mb-1 text-sm" style={{color:'#9ca3af'}}>AI 世界模拟引擎 — 观察生命的涌现</p>
      <p className="mb-8 text-xs" style={{color:'#64748b'}}>首次使用需要配置 API</p>
      <div className="w-full max-w-md space-y-4" style={{background:'#141722', border:'2px solid #2a2a45', borderRadius:4, padding:24}}>
        <div>
          <label className="text-xs block mb-1" style={{color:'#9ca3af'}}>API Key *</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="你的 API 密钥"
            style={{width:'100%', background:'#0e1119', border:'2px solid #2a2a45', borderRadius:4, padding:'8px 12px', fontSize:13, color:'#e8e4d8', outline:'none'}} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{color:'#9ca3af'}}>模型 / 接入点 ID *</label>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
            placeholder="如 doubao-seed-2-0-pro-260215"
            style={{width:'100%', background:'#0e1119', border:'2px solid #2a2a45', borderRadius:4, padding:'8px 12px', fontSize:13, color:'#e8e4d8', outline:'none'}} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{color:'#9ca3af'}}>API 地址</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            style={{width:'100%', background:'#0e1119', border:'2px solid #2a2a45', borderRadius:4, padding:'8px 12px', fontSize:11, color:'#e8e4d8', outline:'none', fontFamily:'monospace'}} />
          <p className="text-xs mt-1" style={{color:'#64748b'}}>默认火山引擎 ARK，兼容 OpenAI 格式</p>
        </div>
        <button onClick={() => canSave && onSave({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() })}
          disabled={!canSave}
          className="btn-pokemon btn-pokemon-primary w-full"
          style={{padding:'10px 0', fontSize:14, borderRadius:4}}>
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

// Draw Pokemon-style room border with wall strip
function drawBorder(ctx, x, y, w, h) {
  // Top wall strip (Pokemon-style lighter wall area)
  const wallH = Math.min(18, h * 0.12);
  ctx.fillStyle='#8898a8'; ctx.fillRect(x+3, y+3, w-6, wallH);
  ctx.fillStyle='#98a8b8'; ctx.fillRect(x+4, y+4, w-8, wallH-2);
  // Baseboard
  ctx.fillStyle='#7a6a50'; ctx.fillRect(x+3, y+3+wallH, w-6, 2);

  // Border frame (Star-Office deep purple-navy)
  ctx.fillStyle='#2a2a45'; ctx.fillRect(x,y,w,3); ctx.fillRect(x,y,3,h);
  ctx.fillStyle='#1a1a2e'; ctx.fillRect(x,y+h-3,w,3); ctx.fillRect(x+w-3,y,3,h);
  // Inner edge highlight
  ctx.fillStyle='#3a3a55'; ctx.fillRect(x+3,y+3,w-6,1); ctx.fillRect(x+3,y+3,1,h-6);
  // Corner notch decorations (RPG dialog box style)
  ctx.fillStyle='#1a1a2e';
  ctx.fillRect(x,y,4,4); ctx.fillRect(x+w-4,y,4,4);
  ctx.fillRect(x,y+h-4,4,4); ctx.fillRect(x+w-4,y+h-4,4,4);
  // Outer highlight
  ctx.fillStyle='#3a3a55'; ctx.fillRect(x+1,y+1,w-2,1); ctx.fillRect(x+1,y+1,1,h-2);
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

// ─── Star-Office 素材加载器 ───
const ASSET_MANIFEST = {
  desk: { src: '/assets/desk-v3.webp' },                                                    // 276x214 办公桌
  cats: { src: '/assets/cats-spritesheet.webp', cols: 4, rows: 4, fw: 160, fh: 160 },       // 640x640
  plants: { src: '/assets/plants-spritesheet.webp', cols: 4, rows: 4, fw: 160, fh: 160 },   // 640x640
  coffee: { src: '/assets/coffee-machine-v3-grid.webp', cols: 12, rows: 8, fw: 230, fh: 230 }, // 2760x1840
  flowers: { src: '/assets/flowers-bloom-v2.webp', cols: 4, rows: 4, fw: 128, fh: 128 },    // 512x512
  posters: { src: '/assets/posters-spritesheet.webp', cols: 4, rows: 8, fw: 160, fh: 160 }, // 640x1280
  serverroom: { src: '/assets/serverroom-spritesheet.webp', cols: 40, rows: 1, fw: 180, fh: 251 }, // 7200x251
  memo_bg: { src: '/assets/memo-bg.webp' },
  star_idle: { src: '/assets/star-idle-v5.png', cols: 8, rows: 6, fw: 256, fh: 256 },       // 2048x1536 猫坐沙发
  star_work: { src: '/assets/star-working-spritesheet-grid.webp', cols: 8, rows: 5, fw: 300, fh: 300 }, // 2400x1500 猫工作
  guest1: { src: '/assets/guest_anim_1.webp', cols: 4, rows: 2, fw: 32, fh: 32 },
  guest2: { src: '/assets/guest_anim_2.webp', cols: 4, rows: 2, fw: 32, fh: 32 },
  guest3: { src: '/assets/guest_anim_3.webp', cols: 4, rows: 2, fw: 32, fh: 32 },
  guest4: { src: '/assets/guest_anim_4.webp', cols: 4, rows: 2, fw: 32, fh: 32 },
  guest5: { src: '/assets/guest_anim_5.webp', cols: 4, rows: 2, fw: 32, fh: 32 },
  guest6: { src: '/assets/guest_anim_6.webp', cols: 4, rows: 2, fw: 32, fh: 32 },
};

// 每个房间的视觉配置：地板色、墙面色、装饰素材
const ROOM_STYLES = {
  desk:    { floor: '#2a2a3e', wall: '#1e1e32', accent: '#4a6a8a', label: '工位区',
             decor: ['desk', 'star_work', 'serverroom', 'plants'] },
  meeting: { floor: '#2a2a42', wall: '#1e1e36', accent: '#6a5a8a', label: '会议室',
             decor: ['posters', 'flowers', 'plants'] },
  boss:    { floor: '#32283e', wall: '#261e32', accent: '#8a6a5a', label: '老板办公室',
             decor: ['desk', 'flowers', 'posters'] },
  pantry:  { floor: '#283228', wall: '#1e261e', accent: '#5a8a5a', label: '茶水间',
             decor: ['coffee', 'cats', 'plants'] },
  canteen: { floor: '#32302a', wall: '#26241e', accent: '#8a7a5a', label: '食堂',
             decor: ['plants', 'flowers', 'cats'] },
  home:    { floor: '#2e2838', wall: '#221e2e', accent: '#7a6a9a', label: '家',
             decor: ['star_idle', 'cats', 'plants', 'flowers'] },
};

// 绘制房间背景（替代 office_bg）
function drawRoomBg(ctx, x, y, w, h, roomId, t, isZoomed) {
  const style = ROOM_STYLES[roomId] || ROOM_STYLES.desk;
  // 地板
  ctx.fillStyle = style.floor;
  ctx.fillRect(x, y, w, h);
  // 地板纹理格子
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gridSize = isZoomed ? 32 : 16;
  for (let gx = x; gx < x+w; gx += gridSize) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y+h); ctx.stroke();
  }
  for (let gy = y; gy < y+h; gy += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x+w, gy); ctx.stroke();
  }
  // 墙面（上方 25%）
  const wallH = h * 0.25;
  ctx.fillStyle = style.wall;
  ctx.fillRect(x, y, w, wallH);
  // 墙面分界线
  ctx.strokeStyle = style.accent;
  ctx.lineWidth = isZoomed ? 2 : 1;
  ctx.beginPath(); ctx.moveTo(x, y+wallH); ctx.lineTo(x+w, y+wallH); ctx.stroke();
  // 踢脚线
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x, y+wallH, w, isZoomed ? 3 : 1);

  if (!assetsReady) return;
  const seed = roomId.charCodeAt(0) * 7 + roomId.charCodeAt(roomId.length-1) * 13;
  const unit = isZoomed ? h / 10 : h / 8;

  // 根据房间类型放置装饰
  if (roomId === 'desk') {
    // 办公桌（左侧）
    if (loadedAssets.desk) {
      const dW = unit * 3.5, dH = dW * (214/276);
      ctx.drawImage(loadedAssets.desk.img, x + unit*0.8, y + h - dH - unit*0.2, dW, dH);
      // 第二张桌子（右侧偏上）
      if (isZoomed) ctx.drawImage(loadedAssets.desk.img, x + w - dW - unit*1.5, y + h - dH - unit*0.5, dW, dH);
    }
    // 猫在办公椅上工作（中间偏右）
    if (loadedAssets.star_work) {
      const sSize = unit * (isZoomed ? 3 : 2.5);
      const sFrame = Math.floor(t / 100) % 40;
      drawSpriteFrame(ctx, loadedAssets.star_work, sFrame, x + w*0.45, y + h - sSize - unit*0.3, sSize, sSize);
    }
    // 服务器机架（右上角）
    if (loadedAssets.serverroom) {
      const srvH = unit * (isZoomed ? 3.5 : 2.5);
      const srvW = srvH * (180/251);
      const srvFrame = Math.floor(t/166) % 40;
      drawSpriteFrame(ctx, loadedAssets.serverroom, srvFrame, x + w - srvW - unit*0.3, y + wallH + unit*0.2, srvW, srvH);
    }
    // 植物
    if (loadedAssets.plants) {
      const pS = unit * 1.2;
      drawSpriteFrame(ctx, loadedAssets.plants, seed%16, x + w - pS - unit*0.3, y + h - pS - unit*0.2, pS, pS);
    }
  } else if (roomId === 'meeting') {
    // 海报墙（墙面上方排列）
    if (loadedAssets.posters) {
      const pSize = unit * (isZoomed ? 2 : 1.5);
      for (let pi = 0; pi < (isZoomed ? 4 : 2); pi++) {
        drawSpriteFrame(ctx, loadedAssets.posters, (seed+pi*3)%32, x + unit*0.8 + pi*(pSize+unit*0.5), y + unit*0.3, pSize, pSize);
      }
    }
    // 花
    if (loadedAssets.flowers) {
      const fS = unit * 1;
      drawSpriteFrame(ctx, loadedAssets.flowers, (seed+2)%16, x + w - fS*2, y + h - fS - unit*0.2, fS, fS);
      drawSpriteFrame(ctx, loadedAssets.flowers, (seed+7)%16, x + unit*0.5, y + h - fS - unit*0.3, fS, fS);
    }
    // 植物
    if (loadedAssets.plants) {
      const pS = unit * 1.2;
      drawSpriteFrame(ctx, loadedAssets.plants, (seed+5)%16, x + w - pS - unit*0.3, y + h - pS - unit*0.2, pS, pS);
    }
  } else if (roomId === 'boss') {
    // 老板桌（中间偏大）
    if (loadedAssets.desk) {
      const dW = unit * (isZoomed ? 4 : 3), dH = dW * (214/276);
      ctx.drawImage(loadedAssets.desk.img, x + (w-dW)/2, y + h - dH - unit*0.5, dW, dH);
    }
    // 海报/书架（墙上）
    if (loadedAssets.posters) {
      const pSize = unit * 1.8;
      drawSpriteFrame(ctx, loadedAssets.posters, (seed+1)%32, x + unit*0.5, y + unit*0.2, pSize, pSize);
      if (isZoomed) drawSpriteFrame(ctx, loadedAssets.posters, (seed+4)%32, x + w - pSize - unit*0.5, y + unit*0.2, pSize, pSize);
    }
    // 花（桌上/角落）
    if (loadedAssets.flowers) {
      const fS = unit * 1.2;
      drawSpriteFrame(ctx, loadedAssets.flowers, (seed+3)%16, x + w - fS - unit*0.5, y + h - fS - unit*0.3, fS, fS);
    }
  } else if (roomId === 'pantry') {
    // 咖啡机（右上，动画）
    if (loadedAssets.coffee) {
      const cSize = unit * (isZoomed ? 2.5 : 2);
      const cFrame = Math.floor(t/80) % 96;
      drawSpriteFrame(ctx, loadedAssets.coffee, cFrame, x + w - cSize - unit*0.5, y + wallH + unit*0.2, cSize, cSize);
    }
    // 猫（左下走动）
    if (loadedAssets.cats) {
      const catS = unit * 1.5;
      drawSpriteFrame(ctx, loadedAssets.cats, seed%16, x + unit*0.5, y + h - catS - unit*0.2, catS, catS);
    }
    // 植物
    if (loadedAssets.plants) {
      const pS = unit * 1.3;
      drawSpriteFrame(ctx, loadedAssets.plants, (seed+4)%16, x + w*0.4, y + h - pS - unit*0.2, pS, pS);
      drawSpriteFrame(ctx, loadedAssets.plants, (seed+9)%16, x + unit*0.3, y + h - pS*0.8 - unit*0.5, pS*0.8, pS*0.8);
    }
  } else if (roomId === 'canteen') {
    // 植物（多处放置）
    if (loadedAssets.plants) {
      const pS = unit * 1.3;
      drawSpriteFrame(ctx, loadedAssets.plants, (seed+1)%16, x + unit*0.5, y + h - pS - unit*0.2, pS, pS);
      drawSpriteFrame(ctx, loadedAssets.plants, (seed+6)%16, x + w - pS - unit*0.3, y + h - pS - unit*0.2, pS, pS);
    }
    // 花
    if (loadedAssets.flowers) {
      const fS = unit * 1;
      drawSpriteFrame(ctx, loadedAssets.flowers, (seed+8)%16, x + w*0.3, y + h - fS - unit*0.3, fS, fS);
      drawSpriteFrame(ctx, loadedAssets.flowers, (seed+11)%16, x + w*0.6, y + h - fS - unit*0.2, fS, fS);
    }
    // 猫在角落
    if (loadedAssets.cats) {
      const catS = unit * 1.2;
      drawSpriteFrame(ctx, loadedAssets.cats, (seed+3)%16, x + w*0.5, y + h - catS - unit*0.1, catS, catS);
    }
  } else if (roomId === 'home') {
    // 猫坐沙发（重点装饰！）
    if (loadedAssets.star_idle) {
      const sSize = unit * (isZoomed ? 3.5 : 2.5);
      const sFrame = Math.floor(t / 120) % 48;
      drawSpriteFrame(ctx, loadedAssets.star_idle, sFrame, x + unit*0.5, y + h - sSize - unit*0.2, sSize, sSize);
    }
    // 猫（第二只，右下）
    if (loadedAssets.cats) {
      const catS = unit * 1.3;
      drawSpriteFrame(ctx, loadedAssets.cats, (seed+2)%16, x + w - catS - unit*0.5, y + h - catS - unit*0.2, catS, catS);
    }
    // 植物
    if (loadedAssets.plants) {
      const pS = unit * 1.2;
      drawSpriteFrame(ctx, loadedAssets.plants, (seed+7)%16, x + w - pS - unit*0.3, y + h*0.4, pS, pS);
    }
    // 花
    if (loadedAssets.flowers) {
      const fS = unit * 1;
      drawSpriteFrame(ctx, loadedAssets.flowers, (seed+5)%16, x + w*0.55, y + h - fS - unit*0.3, fS, fS);
    }
  }
}

// 全局素材缓存
const loadedAssets = {};
let assetsLoading = false;
let assetsReady = false;

function loadAllAssets() {
  if (assetsLoading) return;
  assetsLoading = true;
  const entries = Object.entries(ASSET_MANIFEST);
  let loaded = 0;
  const total = entries.length;
  console.log(`[Assets] Loading ${total} assets...`);
  entries.forEach(([key, info]) => {
    const img = new Image();
    img.onload = () => {
      loadedAssets[key] = { img, ...info };
      loaded++;
      console.log(`[Assets] ✓ ${key} (${img.naturalWidth}x${img.naturalHeight}) [${loaded}/${total}]`);
      if (loaded >= total) { assetsReady = true; console.log('[Assets] All loaded!'); }
    };
    img.onerror = (e) => {
      console.warn(`[Assets] ✗ ${key} failed:`, e);
      loaded++;
      if (loaded >= total) { assetsReady = true; console.log('[Assets] All done (with errors)'); }
    };
    img.src = info.src;
  });
}

// 从精灵表中绘制某一帧
function drawSpriteFrame(ctx, asset, frameIndex, dx, dy, dw, dh) {
  if (!asset || !asset.img || !asset.cols) return;
  const col = frameIndex % asset.cols;
  const row = Math.floor(frameIndex / asset.cols);
  ctx.drawImage(asset.img, col * asset.fw, row * asset.fh, asset.fw, asset.fh, dx, dy, dw || asset.fw, dh || asset.fh);
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

  // Load Star-Office assets + pre-render pixel sprites
  useEffect(() => {
    loadAllAssets();
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
      ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,0,cw,ch);
      const t = Date.now();
      const pad=8, gap=6, bw=3, labelH=20;
      const zoomed = zoomRef.current;

      if (zoomed) {
        // ─── Zoomed into one room ───
        const loc = locs.find(l=>l.id===zoomed);
        if (!loc) { raf=requestAnimationFrame(render); return; }
        const present = ns.filter(n=>n.region===loc.id);
        const rx=pad, ry=pad, rw=cw-2*pad, rh=ch-2*pad;
        const innerX=rx+bw, innerY=ry+bw, innerW=rw-2*bw, innerH=rh-2*bw;

        // ── 房间背景 + 装饰（每个房间独特风格）──
        drawRoomBg(ctx, innerX, innerY, innerW, innerH, loc.id, t, true);

        drawBorder(ctx, rx, ry, rw, rh);

        // Label - Star-Office style gold plaque
        ctx.fillStyle='rgba(0,0,0,0.6)';
        const labelText = `${loc.emoji} ${loc.name}`;
        ctx.font='bold 14px monospace'; ctx.textBaseline='top';
        const labelW = ctx.measureText(labelText).width + 20;
        ctx.fillRect(rx+bw+4, ry+bw+2, labelW, 22);
        ctx.fillStyle='#ffd700';
        ctx.fillRect(rx+bw+4, ry+bw+2, 3, 22);
        ctx.fillStyle='#ffd700';
        ctx.fillText(labelText, rx+bw+12, ry+bw+5);

        // Back button
        const bbx=cw-pad-62, bby=pad+bw+3;
        ctx.fillStyle='#2a2a45';
        ctx.beginPath(); ctx.roundRect(bbx,bby,54,20,4); ctx.fill();
        ctx.strokeStyle='#ffd700'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(bbx,bby,54,20,4); ctx.stroke();
        ctx.fillStyle='#ffd700'; ctx.font='bold 11px monospace';
        ctx.fillText('◀ 返回', bbx+8, bby+5);

        // NPCs — 按性格分配 guest 精灵 + 自有像素精灵回退
        const NPC_GUEST_MAP = {
          kelly: 'guest1',   // 优雅Boss
          pine: 'guest2',    // 年轻Leader
          frank: 'guest3',   // 摄影达人
          benzema: 'guest4', // 技术宅
          yanfei: 'guest5',  // 活力女
          haoran: 'guest6',  // 稳重奶爸
          xinyi: 'guest1',   // 温柔（复用1，但用不同帧）
        };
        const unit = innerH / 12;
        const sprSize = Math.round(unit * 2.2); // guest精灵显示尺寸（和背景家具协调）
        const nRects=[];
        present.forEach((npc,i)=>{
          const pos = getNpcPosition(npc.id, rx, ry, rw, rh, bw, labelH, sprSize, sprSize, t, loc.id, true);
          const nx = pos.x;
          const floatY = Math.sin(t/1200+i*1.7)*0.6;
          const ny = pos.y + floatY;
          // Shadow
          ctx.fillStyle='rgba(0,0,0,0.25)';
          ctx.beginPath(); ctx.ellipse(nx+sprSize/2, ny+sprSize+2, sprSize*0.35, 4, 0, 0, Math.PI*2); ctx.fill();
          // Guest 精灵（4帧走路动画 ~4fps）
          const guestKey = NPC_GUEST_MAP[npc.id];
          const guestAsset = assetsReady && guestKey && loadedAssets[guestKey];
          if (guestAsset && guestAsset.img && guestAsset.cols) {
            // xinyi 用第二行帧（row 1）避免和 kelly 重复
            const rowOffset = (npc.id === 'xinyi') ? guestAsset.cols : 0;
            const gFrame = rowOffset + Math.floor(t / 250) % guestAsset.cols;
            drawSpriteFrame(ctx, guestAsset, gFrame, nx, ny, sprSize, sprSize);
          } else {
            // 回退到自有像素精灵
            const sc2 = spriteCacheRef.current[npc.id]?.l;
            if (sc2) ctx.drawImage(sc2, nx, ny);
          }
          // Selection highlight
          if (npc.id===sel) {
            ctx.strokeStyle='#ffd700'; ctx.lineWidth=2;
            ctx.strokeRect(nx-3,ny-3,sprSize+6,sprSize+20);
            ctx.fillStyle='rgba(255,215,0,0.06)';
            ctx.fillRect(nx-3,ny-3,sprSize+6,sprSize+20);
          }
          // Name
          ctx.fillStyle='#eee'; ctx.font='bold 11px monospace'; ctx.textAlign='center';
          ctx.fillText(npc.name, nx+sprSize/2, ny+sprSize+6); ctx.textAlign='left';
          // Mood bar
          const mbw=Math.min(30, sprSize), mbx=nx+(sprSize-mbw)/2, mby=ny+sprSize+14;
          ctx.fillStyle='#0e1119'; ctx.fillRect(mbx,mby,mbw,3);
          ctx.fillStyle=moodColor(npc.state.moodValue);
          ctx.fillRect(mbx,mby,mbw*npc.state.moodValue/100,3);
          // Thought bubble
          if (npc.thought||npc.action) {
            const txt = npc.thought || npc.action;
            const display = txt.length>12 ? txt.slice(0,12)+'..' : txt;
            ctx.font='10px monospace';
            const tw2 = ctx.measureText(display).width+10;
            const cx2=nx+sprSize/2, bx2=cx2-tw2/2, by2=ny-16;
            ctx.fillStyle='rgba(20,23,34,0.95)';
            ctx.beginPath(); ctx.roundRect(bx2,by2,tw2,16,3); ctx.fill();
            ctx.strokeStyle = npc.thought ? '#ffd700' : '#2a2a45'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.roundRect(bx2,by2,tw2,16,3); ctx.stroke();
            ctx.fillStyle='rgba(20,23,34,0.95)';
            ctx.beginPath(); ctx.moveTo(cx2-3,by2+16); ctx.lineTo(cx2,by2+19); ctx.lineTo(cx2+3,by2+16); ctx.fill();
            ctx.fillStyle = npc.thought ? '#ffd700' : '#9ca3af';
            ctx.textAlign='center';
            ctx.fillText(display, cx2, by2+3); ctx.textAlign='left';
          }
          nRects.push({id:npc.id, x:nx-3, y:ny-3, w:sprSize+6, h:sprSize+22});
        });
        if (present.length===0) {
          ctx.fillStyle='#9ca3af'; ctx.font='12px monospace'; ctx.textAlign='center';
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
        const NPC_GUEST_MAP_OV = {
          kelly: 'guest1', pine: 'guest2', frank: 'guest3',
          benzema: 'guest4', yanfei: 'guest5', haoran: 'guest6',
          xinyi: 'guest1',
        };
        locs.forEach((loc,i)=>{
          const col=i%cols, row=Math.floor(i/cols);
          const rx=pad+col*(rw+gap), ry=pad+row*(rh+gap);
          const oInnerX=rx+bw, oInnerY=ry+bw, oInnerW=rw-2*bw, oInnerH=rh-2*bw;

          // 房间背景 + 装饰（每个房间独特风格）
          drawRoomBg(ctx, oInnerX, oInnerY, oInnerW, oInnerH, loc.id, t, false);

          drawBorder(ctx, rx, ry, rw, rh);
          // Label — gold plaque
          ctx.fillStyle='rgba(0,0,0,0.55)';
          ctx.fillRect(rx+bw, ry+bw, rw-2*bw, 16);
          ctx.fillStyle='#ffd700'; ctx.font='bold 10px monospace'; ctx.textBaseline='top';
          ctx.fillText(`${loc.emoji} ${loc.name}`, rx+bw+3, ry+bw+3);
          // Count badge
          const present=ns.filter(n=>n.region===loc.id);
          if(present.length>0) {
            ctx.fillStyle='#ffd700';
            ctx.beginPath(); ctx.arc(rx+rw-bw-10, ry+bw+8, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle='#1a1a2e';
          } else {
            ctx.fillStyle='#9ca3af';
          }
          ctx.font='bold 10px monospace'; ctx.textAlign='center';
          ctx.fillText(String(present.length), rx+rw-bw-10, ry+bw+3); ctx.textAlign='left';
          // NPCs — guest sprites
          const oUnit2 = oInnerH / 12;
          const oSprSize = Math.round(oUnit2 * 1.8);
          present.forEach((npc,ni)=>{
            const pos = getNpcPosition(npc.id, rx, ry, rw, rh, bw, labelH, oSprSize, oSprSize+14, t, loc.id, false);
            const nx = pos.x;
            const floatY=Math.sin(t/1200+ni*1.7+i*0.5)*0.5;
            const ny = pos.y + floatY;
            ctx.fillStyle='rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.ellipse(nx+oSprSize/2,ny+oSprSize+1,oSprSize*0.3,2,0,0,Math.PI*2); ctx.fill();
            const guestKey = NPC_GUEST_MAP_OV[npc.id];
            const guestAsset = assetsReady && guestKey && loadedAssets[guestKey];
            if (guestAsset && guestAsset.img && guestAsset.cols) {
              const rowOff = (npc.id === 'xinyi') ? guestAsset.cols : 0;
              const gFrame = rowOff + Math.floor(t / 250) % guestAsset.cols;
              drawSpriteFrame(ctx, guestAsset, gFrame, nx, ny, oSprSize, oSprSize);
            } else {
              const spr=spriteCacheRef.current[npc.id]?.s;
              if(spr) ctx.drawImage(spr,nx,ny);
            }
            if(npc.id===sel){ ctx.strokeStyle='#ffd700'; ctx.lineWidth=1.5; ctx.strokeRect(nx-2,ny-2,oSprSize+4,oSprSize+14); }
            ctx.fillStyle='#eee'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
            ctx.fillText(npc.name, nx+oSprSize/2, ny+oSprSize+3); ctx.textAlign='left';
            const mbw2=Math.min(20, oSprSize), mbx2=nx+(oSprSize-mbw2)/2, mby2=ny+oSprSize+10;
            ctx.fillStyle='#0e1119'; ctx.fillRect(mbx2,mby2,mbw2,3);
            ctx.fillStyle=moodColor(npc.state.moodValue);
            ctx.fillRect(mbx2,mby2,mbw2*npc.state.moodValue/100,3);
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

// ─── 叙事流（左栏 — 旁白+对话交替）───
function NarrativeStream({ dialogues, npcs, isBusy, sceneImages }) {
  const npcMap = {};
  for (const n of npcs) npcMap[n.id] = n;
  const scrollRef = useRef(null);
  const [revealCount, setRevealCount] = useState(0);
  const prevLenRef = useRef(dialogues.length);

  // 新内容到来时，逐段揭示
  useEffect(() => {
    if (dialogues.length > prevLenRef.current) {
      const newItems = dialogues.length - prevLenRef.current;
      prevLenRef.current = dialogues.length;
      // 逐段揭示：每段间隔 400ms
      let revealed = 0;
      setRevealCount(dialogues.length - newItems); // 先只显示旧内容
      const timer = setInterval(() => {
        revealed++;
        setRevealCount(dialogues.length - newItems + revealed);
        if (revealed >= newItems) clearInterval(timer);
      }, 400);
      return () => clearInterval(timer);
    } else {
      prevLenRef.current = dialogues.length;
      setRevealCount(dialogues.length);
    }
  }, [dialogues.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [revealCount]);

  if (dialogues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{color:'#9ca3af'}}>
        <div className="text-center">
          <div className="text-2xl mb-2" style={{opacity:0.5}}>📖</div>
          <div style={{fontSize:12}}>点击 ▶ 开始，故事将在这里展开</div>
        </div>
      </div>
    );
  }

  // 只显示已揭示的内容
  const visibleDialogues = dialogues.slice(0, revealCount);

  // 按时间段分组
  const grouped = [];
  let currentGroup = null;
  for (const d of visibleDialogues) {
    const key = `${d.day}-${d.hour}`;
    if (!currentGroup || currentGroup.key !== key) {
      currentGroup = { key, day: d.day, hour: d.hour, items: [] };
      grouped.push(currentGroup);
    }
    currentGroup.items.push(d);
  }

  // 判断某个item是否是刚刚揭示的（最新出现的那个）
  const isNewestItem = (groupIdx, itemIdx, groups) => {
    if (groupIdx !== 0) return false; // 只有最新章节
    const g = groups[0];
    return itemIdx === g.items.length - 1 && revealCount < dialogues.length;
  };

  return (
    <div ref={scrollRef} className="narrative-stream">
      {(isBusy || revealCount < dialogues.length) && (
        <>
          <div className="narrative-loading animate-fade-in">
            <div className="narrative-loading-dots">
              <span></span><span></span><span></span>
            </div>
            <span>{isBusy && revealCount >= dialogues.length ? "世界正在演进中..." : "故事正在展开..."}</span>
          </div>
          {isBusy && revealCount >= dialogues.length && (
            <div className="narrative-skeleton animate-fade-in">
              <div className="narrative-skeleton-line"></div>
              <div className="narrative-skeleton-line"></div>
              <div className="narrative-skeleton-line"></div>
              <div className="narrative-skeleton-line"></div>
            </div>
          )}
        </>
      )}
      {[...grouped].reverse().slice(0, 30).map((group, gi) => {
        const timeStr = `第${group.day}天 · ${String(group.hour).padStart(2,'0')}:00`;
        const reversedGroups = [...grouped].reverse();
        return (
          <div key={group.key} className={"narrative-chapter " + (gi === 0 ? "narrative-latest" : "")}>
            <div className="narrative-chapter-header animate-fade-in">
              <div className="narrative-chapter-line"></div>
              <span className="narrative-chapter-time">{timeStr}</span>
              <div className="narrative-chapter-line"></div>
            </div>
            {/* 场景插图 */}
            {sceneImages?.[group.key] && sceneImages[group.key].status === "loading" && gi === 0 && (
              <div className="narrative-scene-image animate-fade-in">
                <div className="narrative-scene-image-loading">
                  <span>场景生成中...</span>
                </div>
                <div className="narrative-scene-image-shimmer"></div>
              </div>
            )}
            {sceneImages?.[group.key] && sceneImages[group.key].status === "ready" && (
              <div className={"narrative-scene-image" + (sceneImages[group.key].intervention ? " narrative-scene-image-intervention" : "")}
                   title={sceneImages[group.key].prompt || ""}>
                <img src={sceneImages[group.key].url} alt="scene" loading="lazy" />
              </div>
            )}
            {sceneImages?.[group.key] && sceneImages[group.key].status === "error" && gi === 0 && (
              <div style={{fontSize:10, color:'#e94560', padding:'4px 10px', opacity:0.7}}>
                图片生成失败 — 检查终端日志
              </div>
            )}
            {group.items.map((d, i) => {
              if (d.type === 'narration') {
                return (
                  <div key={i} className="narrative-narration animate-fade-in" style={gi === 0 ? {animationDelay: `${i * 0.1}s`} : undefined}>
                    <div className="narrative-narration-text">{d.content}</div>
                  </div>
                );
              }
              const from = npcMap[d.from];
              const to = npcMap[d.to];
              if (!from) {
                return (
                  <div key={i} className="narrative-event animate-fade-in">
                    <span>{d.text || d.content}</span>
                  </div>
                );
              }
              return (
                <div key={i} className="narrative-dialogue animate-fade-in" style={gi === 0 ? {animationDelay: `${i * 0.1}s`} : undefined}>
                  <div className="narrative-dialogue-header">
                    <span className="narrative-dialogue-from">{from?.emoji} {from?.name}</span>
                    <span className="narrative-dialogue-arrow">→</span>
                    <span className="narrative-dialogue-to">{to?.emoji} {to?.name}</span>
                  </div>
                  <div className="narrative-dialogue-content">"{d.content}"</div>
                  {d.subtext && <div className="narrative-dialogue-subtext">┗ {d.subtext}</div>}
                </div>
              );
            })}
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
      <div className="text-center py-2">
        <div className="text-xl mb-1" style={{color:'#eee'}}>🏢 {world.name}</div>
        <div className="text-xs" style={{color:'#ffd700'}}>第{gameTime.day}天 {String(gameTime.hour).padStart(2, "0")}:00</div>
      </div>

      {/* 资源仪表盘 */}
      <div>
        <div className="panel-section-title">📊 有限资源</div>
        <div className="space-y-2">
          {Object.entries(world.resources).map(([key, res]) => (
            <div key={key} className="poke-card">
              <div className="flex justify-between text-xs">
                <span style={{color:'#ddd'}}>{res.name}</span>
                {res.total && <span style={{color:'#ffd700'}}>{res.current}/{res.total}</span>}
              </div>
              {res.total && (
                <div className="poke-bar mt-1.5">
                  <div className="poke-bar-fill" style={{
                    width: `${(res.current / res.total) * 100}%`,
                    backgroundColor: res.current < res.total * 0.5 ? "#d85858" : "#58c878"
                  }} />
                </div>
              )}
              <div className="text-[10px] mt-0.5" style={{color:'#9ca3af'}}>{res.desc}</div>
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
                <div key={i} className="poke-card text-xs flex items-center gap-2" style={{padding:'6px 10px'}}>
                  <span style={{color:'#ddd'}}>{a?.emoji}{a?.name}</span>
                  <span style={{color:'#d85858'}}>{"⚡".repeat(Math.min(t.level, 5))}</span>
                  <span style={{color:'#ddd'}}>{b?.emoji}{b?.name}</span>
                  <span style={{color:'#9ca3af', marginLeft:'auto'}}>{t.about}</span>
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
          <div className="text-xs text-center py-4" style={{color:'#9ca3af'}}>世界尚未开始...</div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {[...events].reverse().map((ev, i) => (
              <div key={i} className="poke-card text-xs animate-fade-in">
                <span style={{color:'#ffd700', fontWeight:600}}>D{ev.day} {ev.hour}h</span> {ev.text}
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
            <div key={i} className="text-[10px]" style={{color:'#9ca3af'}}>· {rule}</div>
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
      {/* NPC头部 - Pokemon style */}
      <div className="flex items-center gap-3 pb-3" style={{borderBottom:'2px solid #2a2a45'}}>
        <div style={{
          width:48, height:48, borderRadius:8,
          background:'#1a1a2e',
          border:'2px solid #2a2a45',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:24, flexShrink:0
        }}>{npc.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold" style={{color:'#ffd700', fontSize:15}}>{npc.name}</div>
          <div className="text-xs" style={{color:'#9ca3af'}}>{npc.title} | {npc.age}岁</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:'rgba(255,215,0,0.1)', color:'#ffd700', border:'1px solid rgba(255,215,0,0.2)'}}>{npc.state.mood}</span>
            <span className="text-[10px]" style={{color:'#9ca3af'}}>压力{npc.state.pressure} 精力{npc.state.energy}</span>
          </div>
        </div>
      </div>

      {/* Tab栏 - Pokemon style */}
      <div className="flex gap-1 py-2 overflow-x-auto" style={{borderBottom:'2px solid #2a2a45'}}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-2 py-1 rounded-lg text-[10px] cursor-pointer transition-all whitespace-nowrap font-semibold"
            style={tab === t.id ? {
              background:'rgba(255,215,0,0.1)',
              color:'#ffd700', border:'1px solid rgba(255,215,0,0.3)',
              boxShadow:'0 0 8px rgba(255,215,0,0.1)'
            } : {
              background:'transparent', color:'#9ca3af',
              border:'1px solid transparent'
            }}>
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
      <div className="text-xs" style={{color:'#9ca3af'}}>{npc.background}</div>

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
            <div key={i} className="text-[10px] poke-card" style={{padding:'5px 10px'}}>
              <span className="text-accent">D{m.tick}</span> {m.trait}: {m.from.toFixed(2)}→{m.to.toFixed(2)} — {m.reason}
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="panel-section-title">成长经历</div>
        {personality.origin.map((o, i) => (
          <div key={i} className="text-[10px] poke-card" style={{padding:'5px 10px'}}>
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

function GeneBar({ label, value, color = "#58c878" }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] w-20 shrink-0 truncate" style={{color:'#9ca3af'}}>{label}</span>
      <div className="flex-1 poke-bar" style={{height:6}}>
        <div className="poke-bar-fill"
          style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] w-8 text-right" style={{color:'#cbd5e1'}}>{value.toFixed(2)}</span>
    </div>
  );
}

// ── 目标 Tab ──
function GoalsTab({ npc }) {
  const sorted = Object.entries(npc.goals).sort((a, b) => b[1].priority - a[1].priority);
  return (
    <div className="space-y-2">
      <div className="text-[10px]" style={{color:'#9ca3af'}}>目标优先级由基因核心驱力决定，满足度受环境影响</div>
      {sorted.map(([name, goal]) => (
        <div key={name} className="poke-card">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold">{goal.priority >= 4 ? "❗" : "  "} {name}</span>
            <span className="text-[10px]" style={{color:'#ffd700'}}>优先级 {goal.priority}/5</span>
          </div>
          <div className="poke-bar mt-1.5">
            <div className="poke-bar-fill" style={{
              width: `${goal.satisfaction}%`,
              backgroundColor: goal.satisfaction > 60 ? "#58d878" : goal.satisfaction > 30 ? "#e8b848" : "#e86060"
            }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{color:'#9ca3af'}}>{goal.desc}</span>
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
            <div key={i} className="text-[10px] poke-card" style={{padding:'5px 10px'}}>{m}</div>
          ))}
      </div>
      <div>
        <div className="panel-section-title">📝 中期记忆（近期重要事件）</div>
        {(!memories.medium || memories.medium.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : [...memories.medium].reverse().map((m, i) => (
            <div key={i} className="text-[10px] poke-card" style={{padding:'5px 10px'}}>{m}</div>
          ))}
      </div>
      <div>
        <div className="panel-section-title">📚 长期记忆（永久）</div>
        {(!memories.long || memories.long.length === 0)
          ? <div className="text-[10px] text-text-dim">暂无</div>
          : memories.long.map((m, i) => (
            <div key={i} className="text-[10px] poke-card" style={{padding:'5px 10px', borderColor:'#ffd700', color:'#ffd700'}}>{m}</div>
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
                title={"天赋天花板: " + ceiling} />
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
        <div key={g.label} className="poke-card" style={g.warn ? {borderColor:'#e86060'} : {}}>
          <div className="flex justify-between text-xs">
            <span style={{color:'#ddd'}}>{g.label}</span>
            <span style={{ color: g.color }}>{g.value}/100 {g.desc}</span>
          </div>
          <div className="poke-bar mt-1.5">
            <div className="poke-bar-fill" style={{ width: `${g.value}%`, backgroundColor: g.color }} />
          </div>
        </div>
      ))}

      <div className="poke-card">
        <div className="flex justify-between text-xs">
          <span>薪资</span>
          <span style={{color:'#ffd700'}}>¥{state.salary?.toLocaleString()}</span>
        </div>
      </div>

      <div className="poke-card">
        <div className="flex justify-between text-xs">
          <span>绩效</span>
          <span className="font-bold" style={{color:
            state.performance === "S" ? "#58d878" :
            state.performance === "A" ? "#48d0f0" :
            state.performance === "C" ? "#e86060" : "#6878a0"
          }}>{state.performance || "待定"}</span>
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
function relBarStyle(val) {
  if (val >= 0) return { marginLeft: "50%", width: (val / 2) + "%" };
  return { marginLeft: ((val + 100) / 2) + "%", width: (50 - (val + 100) / 2) + "%" };
}

function RelationsTab({ npc, allNpcs }) {
  const rels = npc.relationships || {};
  if (Object.keys(rels).length === 0) return <div className="text-xs" style={{color:'#9ca3af'}}>暂无关系数据</div>;

  return (
    <div className="space-y-2">
      <div className="text-[10px]" style={{color:'#9ca3af'}}>内心真实态度 vs 外在表现 — 差值越大越"城府深"</div>
      {Object.entries(rels).map(([tid, rel]) => {
        const target = allNpcs.find((n) => n.id === tid);
        if (!target) return null;
        const gap = Math.abs(rel.inner - rel.outer);
        return (
          <div key={tid} className="poke-card">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{color:'#ddd'}}>{target.emoji} {target.name}</span>
              {gap > 20 && <span className="text-[10px]" style={{color:'#e86060'}}>🎭 城府深</span>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-8" style={{color:'#9ca3af'}}>内心</span>
                <div className="flex-1 poke-bar relative" style={{height:6}}>
                  <div className="poke-bar-fill" style={{...relBarStyle(rel.inner), backgroundColor: relColor(rel.inner), position:'absolute'}} />
                </div>
                <span className="text-[10px] w-8 text-right" style={{ color: relColor(rel.inner) }}>
                  {rel.inner > 0 ? "+" : ""}{rel.inner}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-8" style={{color:'#9ca3af'}}>表面</span>
                <div className="flex-1 poke-bar relative" style={{height:6}}>
                  <div className="poke-bar-fill" style={{...relBarStyle(rel.outer), backgroundColor: relColor(rel.outer), position:'absolute'}} />
                </div>
                <span className="text-[10px] w-8 text-right" style={{ color: relColor(rel.outer) }}>
                  {rel.outer > 0 ? "+" : ""}{rel.outer}
                </span>
              </div>
            </div>
            <div className="text-[10px] mt-1" style={{color:'#9ca3af'}}>{rel.notes}</div>
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
        <div className="poke-card">
          <div className="text-[10px] text-text-dim mb-1">🎬 当前行为</div>
          <div className="text-xs">{npc.action}</div>
        </div>
      )}
      {npc.thought && (
        <div className="poke-card">
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
      setMessages(prev => [...prev, { role: "assistant", content: "[错误] " + e.message }]);
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
      <div className="text-[10px] mb-2 px-1" style={{color:'#9ca3af'}}>
        以上帝视角和{npc.name}的分身对话，不影响世界运行。TA会按照自己的性格回应你。
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-2" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">{npc.emoji}</div>
            <div className="text-xs" style={{color:'#9ca3af'}}>试着和{npc.name}聊聊吧</div>
            <div className="text-[10px] mt-1" style={{color:'#64748b'}}>比如问问TA最近的经历、对身边人的看法……</div>
            <div className="flex flex-wrap gap-1 mt-3 justify-center">
              {["最近过得怎么样？", "你觉得身边的人怎么样？", "有什么烦心事吗？"].map((q, i) => (
                <button key={i} onClick={() => { setInput(q); }}
                  className="text-[10px] px-2 py-1 cursor-pointer transition-all"
                  style={{borderRadius:8, border:'2px solid #2a2a45', color:'#9ca3af', background:'#1e2c50'}}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex" style={{justifyContent: m.role === "user" ? "flex-end" : "flex-start"}}>
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs"
              style={m.role === "user"
                ? {background:'rgba(255,215,0,0.08)', color:'#ffd700', border:'2px solid rgba(255,215,0,0.2)'}
                : {background:'#1a1a2e', border:'2px solid #2a2a45', color:'#d8dce8'}
              }>
              {m.role === "assistant" && (
                <div className="text-[10px] mb-1 flex items-center gap-1" style={{color:'#9ca3af'}}>
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
            <div className="rounded-lg px-3 py-2 text-xs" style={{background:'#1a1a2e', border:'2px solid #2a2a45'}}>
              <span className="animate-pulse" style={{color:'#9ca3af'}}>{npc.name}正在思考...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex gap-2 pt-2" style={{borderTop:'2px solid #3a5888'}}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"对" + npc.name + "说点什么..."}
          disabled={loading}
          style={{flex:1, background:'#0e1119', border:'2px solid #2a2a45', borderRadius:10, padding:'6px 12px', fontSize:12, color:'#e8e4d8', outline:'none'}}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn-pokemon btn-pokemon-primary"
          style={{fontSize:12, padding:'6px 14px'}}
        >
          发送
        </button>
      </div>
    </div>
  );
}

// ─── 底部时间条（线性时间轴）───
function TimeBar({ gameTime, isPlaying, isBusy, onAdvance, onTogglePlay, speed, onSpeedChange, schedule }) {
  const sched = schedule || SCHEDULE_TEMPLATE;
  const hourLabel = sched.find((s) => s.hour === gameTime.hour)?.label || "";
  // 从日程表动态计算进度和刻度
  const hours = sched.map(s => s.hour).sort((a, b) => a - b);
  const minH = hours[0] || 7;
  const maxH = hours[hours.length - 1] || 22;
  const range = Math.max(1, maxH - minH);
  const progress = ((gameTime.hour - minH) / range) * 100;

  return (
    <div className="time-bar">
      {/* 播放控制 */}
      <button onClick={onTogglePlay}
        className={"btn-pokemon " + (isPlaying ? "btn-pokemon-danger" : "btn-pokemon-primary")}
        style={{fontSize:11, padding:'4px 14px', flexShrink:0}}>
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* 时间信息 */}
      <div style={{flexShrink:0, textAlign:'center', minWidth:90}}>
        <div className="text-xs font-bold" style={{color:'#ffd700'}}>
          第{gameTime.day}天 {String(gameTime.hour).padStart(2, "0")}:00
        </div>
        <div style={{fontSize:9, color:'#9ca3af'}}>{hourLabel}</div>
      </div>

      {/* 时间线 */}
      <div className="timeline-track">
        <div className="timeline-fill" style={{ width: Math.max(1, progress) + '%' }} />
        <div className="timeline-markers">
          {hours.map(h => {
            const pos = ((h - minH) / range) * 100;
            return (
              <div key={h} style={{position:'absolute', left: pos + '%'}}>
                <div className="timeline-marker" />
                <div className="timeline-hour-label">{h}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 速度 + 状态 */}
      <div className="flex items-center gap-2" style={{flexShrink:0}}>
        {isBusy && <span className="animate-pulse-glow" style={{color:'#ffd700', fontSize:11}}>⟳</span>}
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="speed-select">
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
function SimulationScreen({ apiConfig, onSettings, worldPack, onBack }) {
  const wp = worldPack || WORLD_PRESETS.office;

  // 尝试从localStorage恢复存档
  const savedState = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(WORLD_SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.worldId === wp.id) return parsed;
      }
    } catch {}
    return null;
  }, []);

  const [npcs, setNpcs] = useState(() => savedState?.npcs || initNpcs(wp.npcs, wp.relationships));
  const firstHour = (wp.schedule || SCHEDULE_TEMPLATE)[0]?.hour || 7;
  const [gameTime, setGameTime] = useState(() => savedState?.gameTime || { day: 1, hour: firstHour });
  const [events, setEvents] = useState(() => savedState?.events || []);
  const [dialogues, setDialogues] = useState(() => savedState?.dialogues || []);
  const [tensions, setTensions] = useState(() => savedState?.tensions || []);
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(null);
  const [showIntervention, setShowIntervention] = useState(false);
  const [sceneImages, setSceneImages] = useState({});
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const playRef = useRef(false);

  const world = wp.config;

  // 自动存档到localStorage（每次tick结束后）
  useEffect(() => {
    if (gameTime.day === 1 && gameTime.hour === firstHour && dialogues.length === 0) return; // 未开始不存
    try {
      const saveData = {
        worldId: wp.id,
        npcs,
        gameTime,
        events,
        dialogues: dialogues.slice(-200), // 限制存储量
        tensions,
        savedAt: Date.now(),
      };
      localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify(saveData));
    } catch {}
  }, [gameTime, npcs, events, dialogues, tensions]);

  // 手动导出JSON
  const handleExportSave = useCallback(() => {
    const saveData = { worldId: wp.id, worldName: world.name, npcs, gameTime, events, dialogues, tensions, savedAt: Date.now() };
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dreamina-${world.name}-D${gameTime.day}H${gameTime.hour}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowSaveMenu(false);
  }, [wp.id, world.name, npcs, gameTime, events, dialogues, tensions]);

  // 手动导入JSON
  const handleImportSave = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.npcs) setNpcs(data.npcs);
          if (data.gameTime) setGameTime(data.gameTime);
          if (data.events) setEvents(data.events);
          if (data.dialogues) setDialogues(data.dialogues);
          if (data.tensions) setTensions(data.tensions);
          setError(null);
        } catch (err) {
          setError('存档文件格式错误: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setShowSaveMenu(false);
  }, []);

  // 清除存档
  const handleClearSave = useCallback(() => {
    localStorage.removeItem(WORLD_SAVE_KEY);
    setNpcs(initNpcs(wp.npcs, wp.relationships));
    setGameTime({ day: 1, hour: firstHour });
    setEvents([]);
    setDialogues([]);
    setTensions([]);
    setError(null);
    setShowSaveMenu(false);
  }, [wp, firstHour]);

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

      // 构建统一叙事流：旁白和对话交替
      const newNarrativeItems = [];

      // 收集旁白
      const narrations = (result.narrations && Array.isArray(result.narrations)) ? result.narrations : [];
      // 收集对话
      const talks = (result.talks && Array.isArray(result.talks)) ? result.talks : [];

      // 交替排列：旁白1 → 对话1,2 → 旁白2 → 对话3,4 → 旁白3 → 对话5,6
      let ni = 0, ti = 0;
      while (ni < narrations.length || ti < talks.length) {
        if (ni < narrations.length) {
          newNarrativeItems.push({
            type: 'narration',
            day: gameTime.day, hour: gameTime.hour,
            content: narrations[ni],
          });
          ni++;
        }
        // 每段旁白后跟2段对话
        for (let k = 0; k < 2 && ti < talks.length; k++, ti++) {
          const t = talks[ti];
          newNarrativeItems.push({
            type: 'dialogue',
            day: gameTime.day, hour: gameTime.hour,
            from: t.f, to: t.t, content: t.s, subtext: t.subtext || "",
          });
        }
      }

      setDialogues((prev) => [...prev, ...newNarrativeItems]);

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
            text: "🔀 " + mutNpc.name + "发生基因突变：" + result.mutation.trait + " " + result.mutation.old_value + "→" + result.mutation.new_value + "（" + result.mutation.reason + "）"
          }]);
        }
      }

      // 异步生成场景插图（不阻塞主流程）
      const timeKey = `${gameTime.day}-${gameTime.hour}`;
      const currentNarrations = narrations;
      const currentIntervention = intervention;
      console.log("[图片] 开始生成, timeKey:", timeKey, "narrations:", currentNarrations.length);
      setSceneImages((prev) => ({ ...prev, [timeKey]: { status: "loading", url: null } }));
      (async () => {
        try {
          const prompt = await generateImagePrompt(apiConfig, currentNarrations, world, currentIntervention);
          console.log("[图片] prompt生成完毕:", prompt?.slice(0, 80));
          if (!prompt) return;
          const url = await generateSceneImage(apiConfig, prompt);
          console.log("[图片] 图片生成成功:", url?.slice(0, 60));
          setSceneImages((prev) => ({ ...prev, [timeKey]: { status: "ready", url, prompt } }));
        } catch (err) {
          console.warn("[图片] 生成失败:", err.message);
          setSceneImages((prev) => ({ ...prev, [timeKey]: { status: "error" } }));
        }
      })();

      setIntervention(null);

      // 推进时间 — 根据日程表跳到下一个时段
      setGameTime((prev) => {
        const sched = wp.schedule || SCHEDULE_TEMPLATE;
        const hours = sched.map(s => s.hour).sort((a, b) => a - b);
        const currentIdx = hours.indexOf(prev.hour);
        if (currentIdx >= 0 && currentIdx < hours.length - 1) {
          return { day: prev.day, hour: hours[currentIdx + 1] };
        }
        // 当天最后一个时段 → 新的一天
        return { day: prev.day + 1, hour: hours[0] };
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
      {/* ── 顶栏（横跨三栏）── */}
      <header className="sim-header">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack}
              style={{color:'#9ca3af', cursor:'pointer', background:'none', border:'none', fontSize:12, padding:'2px 6px'}}
              className="hover:text-accent">← 选世界</button>
          )}
          <span className="font-bold" style={{color:'#ffd700', fontSize:14}}>{wp.emoji || "⭐"} {world.name}</span>
          <span style={{color:'#555', fontSize:8}}>v2.1</span>
          {error && <span style={{color:'#e94560', fontSize:11}}>{error}</span>}
          {savedState && dialogues.length > 0 && gameTime.day === savedState.gameTime?.day && gameTime.hour === savedState.gameTime?.hour && (
            <span style={{color:'#58c878', fontSize:10, opacity:0.7}}>已恢复存档</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showIntervention && world.interventions.map((iv) => (
            <button key={iv.id}
              onClick={() => setIntervention(intervention === iv.id ? null : iv.id)}
              title={iv.description}
              className={"btn-pokemon " + (intervention === iv.id ? "btn-pokemon-primary" : "btn-pokemon-secondary")}
              style={{fontSize:10, padding:'2px 8px'}}>
              {iv.emoji} {iv.name}
            </button>
          ))}
          {intervention && <span style={{color:'#ffd700', fontSize:10}}>⚡ 生效中</span>}
          <button onClick={() => setShowIntervention(!showIntervention)}
            className={"btn-pokemon " + (showIntervention ? "btn-pokemon-primary" : "btn-pokemon-secondary")}
            style={{fontSize:10, padding:'2px 8px'}}>
            🌩️
          </button>
          <div style={{position:'relative'}}>
            <button onClick={() => setShowSaveMenu(!showSaveMenu)}
              className={"btn-pokemon " + (showSaveMenu ? "btn-pokemon-primary" : "btn-pokemon-secondary")}
              style={{fontSize:10, padding:'2px 8px'}}>
              💾
            </button>
            {showSaveMenu && (
              <div style={{
                position:'absolute', top:'100%', right:0, marginTop:4, zIndex:100,
                background:'#141722', border:'2px solid #2a2a45', borderRadius:6,
                padding:4, minWidth:120, boxShadow:'0 4px 12px rgba(0,0,0,0.5)',
              }}>
                <button onClick={handleExportSave}
                  className="btn-pokemon btn-pokemon-secondary"
                  style={{fontSize:10, padding:'4px 10px', width:'100%', marginBottom:2, textAlign:'left'}}>
                  📤 导出存档
                </button>
                <button onClick={handleImportSave}
                  className="btn-pokemon btn-pokemon-secondary"
                  style={{fontSize:10, padding:'4px 10px', width:'100%', marginBottom:2, textAlign:'left'}}>
                  📥 导入存档
                </button>
                <button onClick={handleClearSave}
                  className="btn-pokemon btn-pokemon-secondary"
                  style={{fontSize:10, padding:'4px 10px', width:'100%', textAlign:'left', color:'#e94560'}}>
                  🗑️ 重置世界
                </button>
              </div>
            )}
          </div>
          <button onClick={onSettings}
            className="btn-pokemon btn-pokemon-secondary"
            style={{fontSize:10, padding:'2px 8px'}}>
            ⚙️
          </button>
        </div>
      </header>

      {/* ── 左栏：叙事流 ── */}
      <div className="dialogue-column">
        <div className="dialogue-header">
          <span>📖 叙事流</span>
          <span style={{color:'#9ca3af', fontSize:10}}>{dialogues.length}</span>
        </div>
        <NarrativeStream dialogues={dialogues} npcs={npcs} isBusy={isBusy} sceneImages={sceneImages} />
      </div>

      {/* ── 中栏：世界预览 Canvas ── */}
      <div className="canvas-column">
        <CanvasMap locations={world.locations} npcs={npcs} selectedNPC={selectedNPC} onSelectNPC={setSelectedNPC} />
      </div>

      {/* ── 右栏：世界总览/NPC面板 ── */}
      <aside className="simulation-panel">
        <div className="panel-header-pokemon">
          <span>{selectedNpcData ? (selectedNpcData.emoji + " " + selectedNpcData.name) : "🏢 世界总览"}</span>
          {selectedNpcData && (
            <button onClick={() => setSelectedNPC(null)}
              style={{fontSize:10, color:'#ffd700', cursor:'pointer', background:'rgba(255,215,0,0.1)', border:'1px solid rgba(255,215,0,0.2)', borderRadius:4, padding:'2px 8px'}}>
              返回
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3" style={{minHeight:0}}>
          {selectedNpcData ? (
            <NPCPanel npc={selectedNpcData} allNpcs={npcs} apiConfig={apiConfig} world={world} gameTime={gameTime} />
          ) : (
            <WorldDashboard world={world} npcs={npcs} events={events} tensions={tensions} gameTime={gameTime} />
          )}
        </div>
        <div className="npc-selector-bar">
          <button onClick={() => setSelectedNPC(null)}
            className={"npc-selector-btn " + (!selectedNPC ? "active" : "")}>
            🏢
          </button>
          {npcs.map((n) => (
            <button key={n.id} onClick={() => setSelectedNPC(n.id === selectedNPC ? null : n.id)}
              title={n.name + " - " + n.state.mood}
              className={"npc-selector-btn " + (n.id === selectedNPC ? "active" : "")}>
              {n.emoji}
            </button>
          ))}
        </div>
      </aside>

      {/* ── 底部时间条 ── */}
      <TimeBar gameTime={gameTime} isPlaying={isPlaying} isBusy={isBusy}
        onAdvance={advanceTick} onTogglePlay={() => setIsPlaying(!isPlaying)}
        speed={speed} onSpeedChange={setSpeed} schedule={wp.schedule} />
    </div>
  );
}

// ─── 世界选择页 ───
function WorldSelectScreen({ onSelect, onCreateNew, apiConfig }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [genError, setGenError] = useState(null);

  const handleGenerate = async () => {
    if (!userPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setGenError(null);
    try {
      const worldData = await generateWorld(userPrompt.trim(), apiConfig);
      // 自动分配精灵配色
      const { spriteColors, npcStations } = autoAssignSprites(worldData.npcs);
      const newWorldPack = {
        id: "custom_" + Date.now(),
        emoji: "🌍",
        label: worldData.config.name,
        tagline: worldData.config.description.slice(0, 40) + "...",
        config: worldData.config,
        npcs: worldData.npcs,
        relationships: worldData.relationships,
        schedule: worldData.schedule,
        npcStations,
        spriteColors,
      };
      onSelect(newWorldPack);
    } catch (e) {
      setGenError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8"
      style={{background:'radial-gradient(ellipse at center, #2a2a45 0%, #1a1a2e 65%, #0e1119 100%)'}}>
      <div className="text-5xl mb-4">🌌</div>
      <h1 className="text-2xl font-bold mb-2" style={{color:'#ffd700'}}>选择你的世界</h1>
      <p className="mb-8 text-sm" style={{color:'#9ca3af'}}>选择一个预设世界，或者用几句话创造一个全新的世界</p>

      {/* 预设世界卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full mb-8">
        {Object.values(WORLD_PRESETS).map((preset) => (
          <button key={preset.id} onClick={() => onSelect(preset)}
            className="text-left cursor-pointer transition-all"
            style={{
              background:'#141722', border:'2px solid #2a2a45', borderRadius:8, padding:20,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffd700'; e.currentTarget.style.background = '#1a1a30'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a45'; e.currentTarget.style.background = '#141722'; }}>
            <div className="text-3xl mb-2">{preset.emoji}</div>
            <div className="font-bold mb-1" style={{color:'#ffd700', fontSize:16}}>{preset.label}</div>
            <div className="text-xs mb-3" style={{color:'#9ca3af'}}>{preset.tagline}</div>
            <div className="flex gap-1">
              {preset.npcs.slice(0, 7).map(n => (
                <span key={n.id} title={n.name} style={{fontSize:14}}>{n.emoji}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* 创造新世界 */}
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)}
          className="cursor-pointer transition-all"
          style={{
            background:'rgba(255,215,0,0.08)', border:'2px dashed rgba(255,215,0,0.3)',
            borderRadius:8, padding:'16px 32px', color:'#ffd700', fontSize:14,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffd700'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)'; }}>
          ✨ 创造新世界
        </button>
      ) : (
        <div className="w-full max-w-2xl"
          style={{background:'#141722', border:'2px solid #2a2a45', borderRadius:8, padding:24}}>
          <div className="text-sm mb-3" style={{color:'#ffd700'}}>✨ 描述你想要的世界</div>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="例如：三国演义，诸葛亮和司马懿的智斗&#10;或者：一个火锅店，五个性格迥异的员工&#10;或者：星际飞船上的叛变，船长和AI的博弈"
            rows={4}
            style={{
              width:'100%', background:'#0e1119', border:'2px solid #2a2a45', borderRadius:4,
              padding:'10px 14px', fontSize:13, color:'#e8e4d8', outline:'none', resize:'vertical',
              fontFamily:'inherit',
            }}
          />
          {genError && <div className="mt-2 text-xs" style={{color:'#e94560'}}>{genError}</div>}
          <div className="flex gap-3 mt-4">
            <button onClick={handleGenerate} disabled={isGenerating || !userPrompt.trim()}
              className="btn-pokemon btn-pokemon-primary"
              style={{padding:'8px 24px', fontSize:13, opacity: (isGenerating || !userPrompt.trim()) ? 0.5 : 1}}>
              {isGenerating ? "⟳ AI正在创造世界..." : "🚀 生成世界"}
            </button>
            <button onClick={() => { setShowCreate(false); setGenError(null); }}
              className="btn-pokemon btn-pokemon-secondary"
              style={{padding:'8px 16px', fontSize:13}}>
              取消
            </button>
          </div>
          {isGenerating && (
            <div className="mt-3 text-xs" style={{color:'#9ca3af'}}>
              AI正在构建世界观、设计角色基因、编织关系网...大约需要30秒
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── App Root ───
export default function App() {
  const [phase, setPhase] = useState("select"); // select → sim → setup
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [apiConfig, setApiConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const handleSaveConfig = (config) => {
    setApiConfig(config);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
    setPhase(selectedWorld ? "sim" : "select");
  };

  const handleSelectWorld = (worldPack) => {
    setSelectedWorld(worldPack);
    // 设置精灵配色
    SPRITE_COLORS = worldPack.spriteColors || {};
    // 清除精灵缓存
    Object.keys(spriteCache).forEach(k => delete spriteCache[k]);
    setPhase("sim");
  };

  if (phase === "setup") {
    return <ApiSetupScreen config={apiConfig} onSave={handleSaveConfig} />;
  }

  if (phase === "select" || !selectedWorld) {
    return <WorldSelectScreen
      onSelect={handleSelectWorld}
      apiConfig={apiConfig}
    />;
  }

  return (
    <SimulationScreen
      key={selectedWorld.id}
      apiConfig={apiConfig}
      worldPack={selectedWorld}
      onSettings={() => setPhase("setup")}
      onBack={() => {
        setSelectedWorld(null);
        setPhase("select");
      }}
    />
  );
}
