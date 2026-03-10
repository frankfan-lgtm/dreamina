/**
 * 预设世界：即梦办公室（原有世界，从 world.js 迁移）
 * 保留原有的精灵配色
 */

// 从原始 world.js 重新导出，保持向后兼容
export { WORLD_CONFIG as OFFICE_CONFIG } from "../../world.js";
export { NPCS as OFFICE_NPCS } from "../../world.js";
export { INITIAL_RELATIONSHIPS as OFFICE_RELATIONSHIPS } from "../../world.js";
export { SCHEDULE_TEMPLATE as OFFICE_SCHEDULE } from "../../world.js";
export { NPC_STATIONS as OFFICE_NPC_STATIONS } from "../../world.js";

// 办公室的精灵配色（从 App.jsx 中提取，保持不变）
export const OFFICE_SPRITE_COLORS = {
  kelly: {
    H: "#2a1520", h: "#3a2530", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#5a3868", t: "#4a2858", P: "#2a2038", p: "#1a1028", B: "#3a2848",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "female",
  },
  pine: {
    H: "#1a1a28", h: "#28283a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#2a6a48", t: "#1a5a38", P: "#2a3040", p: "#1a2030", B: "#223038",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  frank: {
    H: "#2a2035", h: "#3a3048", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#3a6a9a", t: "#2a5a8a", P: "#2a2a3a", p: "#1a1a2a", B: "#2a3848",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  benzema: {
    H: "#1a1a1a", h: "#2a2a2a", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#3a3a42", t: "#2a2a32", P: "#1a1a22", p: "#121218", B: "#2a2a30",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  yanfei: {
    H: "#2a1818", h: "#3a2828", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#d06848", t: "#b05838", P: "#3a3048", p: "#2a2038", B: "#2a2838",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "female",
  },
  haoran: {
    H: "#2a2020", h: "#3a3030", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#8a7a60", t: "#7a6a50", P: "#3a3a42", p: "#2a2a32", B: "#4a4038",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "male",
  },
  xinyi: {
    H: "#3a2838", h: "#4a3848", S: "#f0c8a0", s: "#d8b090", M: "#d8a088",
    T: "#7080a8", t: "#607098", P: "#3a3048", p: "#2a2038", B: "#2a2838",
    E: "#12101a", W: "#f0f0e8", A: "#f0c8a0",
    body: "female",
  },
};
