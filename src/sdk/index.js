/**
 * Dreamina World SDK — 造世界的服务
 *
 * 用法：
 *   import { WORLD_PRESETS, generateWorld, validateWorld } from "./sdk";
 *
 *   // 使用预设世界
 *   const office = WORLD_PRESETS.office;
 *
 *   // AI 生成新世界
 *   const myWorld = await generateWorld("三国演义", apiConfig);
 */

export { validateWorld, normalizeWorld, autoAssignSprites, SPRITE_PALETTE_POOL } from "./world-schema.js";
export { generateWorld } from "./world-generator.js";

// ─── 预设世界 ───
import {
  OFFICE_CONFIG, OFFICE_NPCS, OFFICE_RELATIONSHIPS, OFFICE_SCHEDULE, OFFICE_NPC_STATIONS, OFFICE_SPRITE_COLORS
} from "./presets/office.js";

import {
  HOGWARTS_CONFIG, HOGWARTS_NPCS, HOGWARTS_RELATIONSHIPS, HOGWARTS_SCHEDULE,
  HOGWARTS_NPC_STATIONS, HOGWARTS_SPRITE_COLORS
} from "./presets/hogwarts.js";

export const WORLD_PRESETS = {
  office: {
    id: "office",
    emoji: "🏢",
    label: "即梦办公室",
    tagline: "字节跳动即梦团队的日常",
    config: OFFICE_CONFIG,
    npcs: OFFICE_NPCS,
    relationships: OFFICE_RELATIONSHIPS,
    schedule: OFFICE_SCHEDULE,
    npcStations: OFFICE_NPC_STATIONS,
    spriteColors: OFFICE_SPRITE_COLORS,
  },
  hogwarts: {
    id: "hogwarts",
    emoji: "🧙",
    label: "霍格沃茨魔法学校",
    tagline: "魔法世界的光明与黑暗之战",
    config: HOGWARTS_CONFIG,
    npcs: HOGWARTS_NPCS,
    relationships: HOGWARTS_RELATIONSHIPS,
    schedule: HOGWARTS_SCHEDULE,
    npcStations: HOGWARTS_NPC_STATIONS,
    spriteColors: HOGWARTS_SPRITE_COLORS,
  },
};
