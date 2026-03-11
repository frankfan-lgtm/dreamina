/**
 * 世界 Schema — 定义一个可模拟世界需要的所有数据结构
 * 同时提供校验函数，确保 AI 生成的世界数据符合规范
 */

// ─── 默认精灵配色池（自动分配给 NPC）───
export const SPRITE_PALETTE_POOL = [
  // 风格1: 深紫领袖
  { H: "#2a1520", h: "#3a2530", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#5a3868", t: "#4a2858", P: "#2a2038", p: "#1a1028", B: "#3a2848", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格2: 森林绿
  { H: "#1a1a28", h: "#28283a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#2a6a48", t: "#1a5a38", P: "#2a3040", p: "#1a2030", B: "#223038", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格3: 时尚蓝
  { H: "#2a2035", h: "#3a3048", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#3a6a9a", t: "#2a5a8a", P: "#2a2a3a", p: "#1a1a2a", B: "#2a3848", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格4: 黑灰科技
  { H: "#1a1a1a", h: "#2a2a2a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#3a3a42", t: "#2a2a32", P: "#1a1a22", p: "#121218", B: "#2a2a30", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格5: 珊瑚橙活力
  { H: "#2a1818", h: "#3a2828", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#d06848", t: "#b05838", P: "#3a3048", p: "#2a2038", B: "#2a2838", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格6: 卡其休闲
  { H: "#2a2020", h: "#3a3030", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#8a7a60", t: "#7a6a50", P: "#3a3a42", p: "#2a2a32", B: "#4a4038", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格7: 淡蓝紫温柔
  { H: "#3a2838", h: "#4a3848", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#7080a8", t: "#607098", P: "#3a3048", p: "#2a2038", B: "#2a2838", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格8: 暗红沉稳
  { H: "#1a1018", h: "#2a2028", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#8a3038", t: "#7a2028", P: "#2a1a22", p: "#1a1018", B: "#3a2028", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格9: 金棕贵族
  { H: "#3a2a18", h: "#4a3a28", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#8a7a38", t: "#7a6a28", P: "#3a3028", p: "#2a2018", B: "#4a3a28", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
  // 风格10: 深海蓝
  { H: "#181828", h: "#28283a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088", T: "#2a3a6a", t: "#1a2a5a", P: "#1a1a30", p: "#101020", B: "#1a2a40", E: "#12101a", W: "#f0f0e8", A: "#f0c8a0" },
];

/**
 * 为世界的 NPC 自动分配精灵配色和工位
 * @param {object} worldPack - { config, npcs, relationships }
 * @returns {{ spriteColors: object, npcStations: object }}
 */
export function autoAssignSprites(npcs) {
  const spriteColors = {};
  const npcStations = {};

  npcs.forEach((npc, i) => {
    const palette = SPRITE_PALETTE_POOL[i % SPRITE_PALETTE_POOL.length];
    spriteColors[npc.id] = {
      ...palette,
      body: npc.gender === "female" ? "female" : "male",
    };
    // 第一个 NPC 放在 boss 位，其他放 desk
    if (i === 0) {
      npcStations[npc.id] = { room: npc.region, seat: 0 };
    } else {
      npcStations[npc.id] = { room: npc.region, seat: i - 1 };
    }
  });

  return { spriteColors, npcStations };
}

/**
 * 校验世界数据是否符合 Schema
 * 返回 { valid: true } 或 { valid: false, errors: [...] }
 */
export function validateWorld(worldPack) {
  const errors = [];
  const { config, npcs, relationships, schedule } = worldPack;

  // config
  if (!config) {
    errors.push("缺少 config");
    return { valid: false, errors };
  }
  if (!config.name) errors.push("config.name 不能为空");
  if (!config.description) errors.push("config.description 不能为空");
  if (!config.locations || config.locations.length < 3) errors.push("至少需要3个地点");
  if (!config.interventions || config.interventions.length < 2) errors.push("至少需要2个干预事件");
  if (!config.rules || config.rules.length < 2) errors.push("至少需要2条世界规则");
  if (!config.resources) errors.push("缺少资源定义");

  // npcs
  if (!npcs || npcs.length < 3) {
    errors.push("至少需要3个NPC");
  } else {
    const locationIds = new Set((config.locations || []).map(l => l.id));
    const npcIds = new Set();
    for (const npc of npcs) {
      if (!npc.id) errors.push(`NPC缺少id`);
      if (npcIds.has(npc.id)) errors.push(`NPC id重复: ${npc.id}`);
      npcIds.add(npc.id);
      if (!npc.name) errors.push(`NPC ${npc.id} 缺少name`);
      if (!npc.region || !locationIds.has(npc.region)) {
        errors.push(`NPC ${npc.id} 的region "${npc.region}" 不在locations中`);
      }
      if (!npc.gene) errors.push(`NPC ${npc.id} 缺少gene(基因系统)`);
      if (!npc.personality) errors.push(`NPC ${npc.id} 缺少personality`);
      if (!npc.skills) errors.push(`NPC ${npc.id} 缺少skills`);
      if (!npc.state) errors.push(`NPC ${npc.id} 缺少state`);
      if (!npc.goals) errors.push(`NPC ${npc.id} 缺少goals`);
    }
  }

  // schedule
  if (!schedule || schedule.length < 4) {
    errors.push("日程模板至少需要4个时段（3小时为一个tick）");
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * 将通过校验的世界数据标准化（补全缺省值）
 */
export function normalizeWorld(worldPack) {
  const { config, npcs, relationships, schedule } = worldPack;

  // 确保每个NPC有完整的memories结构
  const normalizedNpcs = npcs.map(npc => ({
    ...npc,
    memories: npc.memories || { short: [], medium: [], long: [] },
    relationships: {},
    action: "",
    thought: "",
    decisionChain: "",
  }));

  // 如果没有relationships，生成空的
  const normalizedRelationships = relationships || {};

  // 如果没有schedule，生成默认的
  const normalizedSchedule = schedule || generateDefaultSchedule(config.locations);

  return {
    config,
    npcs: normalizedNpcs,
    relationships: normalizedRelationships,
    schedule: normalizedSchedule,
  };
}

function generateDefaultSchedule(locations) {
  const locIds = locations.map(l => l.id);
  const main = locIds[0] || "loc1";
  const secondary = locIds[Math.min(1, locIds.length - 1)];
  const social = locIds[Math.min(2, locIds.length - 1)];
  const rest = locIds[locIds.length - 1] || "loc6";
  return [
    { hour: 7, label: "起床 → 早间", defaultLocation: rest },
    { hour: 10, label: "上午核心", defaultLocation: main },
    { hour: 13, label: "午间 → 下午", defaultLocation: social },
    { hour: 16, label: "下午 → 傍晚", defaultLocation: secondary },
    { hour: 19, label: "夜晚活动", defaultLocation: main },
    { hour: 22, label: "深夜 → 休息", defaultLocation: rest },
  ];
}
