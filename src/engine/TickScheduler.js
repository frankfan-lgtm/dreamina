/**
 * TickScheduler - Tick调度器
 *
 * 职责：
 * - 管理游戏时间推进
 * - 每个tick并行调用所有NPC Agent的决策
 * - 收集决策结果后统一更新世界状态
 * - 支持暂停/恢复/变速
 * - 支持注册tick前/后的hook
 */

/** 时间阶段枚举 */
const PHASE = {
  DAWN: 'dawn',       // 黎明 5-7
  MORNING: 'morning', // 上午 7-12
  AFTERNOON: 'afternoon', // 下午 12-17
  EVENING: 'evening', // 傍晚 17-20
  NIGHT: 'night',     // 夜晚 20-5
};

/**
 * 根据小时数计算时间阶段
 * @param {number} hour
 * @returns {string}
 */
function getPhaseFromHour(hour) {
  if (hour >= 5 && hour < 7) return PHASE.DAWN;
  if (hour >= 7 && hour < 12) return PHASE.MORNING;
  if (hour >= 12 && hour < 17) return PHASE.AFTERNOON;
  if (hour >= 17 && hour < 20) return PHASE.EVENING;
  return PHASE.NIGHT;
}

export class TickScheduler {
  /**
   * @param {object} options
   * @param {number} [options.minutesPerTick=15] - 每个tick代表的游戏分钟数
   * @param {number} [options.startDay=1] - 起始天数
   * @param {number} [options.startHour=8] - 起始小时
   */
  constructor(options = {}) {
    const { minutesPerTick = 15, startDay = 1, startHour = 8 } = options;

    /** @type {number} 每tick推进的游戏分钟 */
    this._minutesPerTick = minutesPerTick;

    /** @type {number} 当前总分钟数（从第1天0:00起算） */
    this._totalMinutes = (startDay - 1) * 1440 + startHour * 60;

    /** @type {number} tick计数 */
    this._tickCount = 0;

    /** @type {number} 速度倍率 */
    this._speed = 1;

    /** @type {boolean} 是否暂停 */
    this._paused = false;

    /** @type {boolean} 是否正在执行tick */
    this._ticking = false;

    /** @type {number|null} 自动tick的定时器id */
    this._timerId = null;

    /** @type {number} 自动tick基础间隔(ms) */
    this._baseInterval = 1000;

    /** @type {Array<Function>} tick前钩子 */
    this._beforeHooks = [];

    /** @type {Array<Function>} tick后钩子 */
    this._afterHooks = [];

    /** @type {Array<Function>} NPC Agent决策函数列表 */
    this._agentDecisionFns = [];
  }

  /**
   * 获取当前游戏时间
   * @returns {{ day: number, hour: number, minute: number, phase: string, tickCount: number }}
   */
  getGameTime() {
    const day = Math.floor(this._totalMinutes / 1440) + 1;
    const minuteOfDay = this._totalMinutes % 1440;
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    return {
      day,
      hour,
      minute,
      phase: getPhaseFromHour(hour),
      tickCount: this._tickCount,
    };
  }

  /**
   * 设置速度倍率
   * @param {number} multiplier - 1/2/4/8
   */
  setSpeed(multiplier) {
    this._speed = multiplier;
    // 如果自动tick正在运行，重启以应用新速度
    if (this._timerId !== null) {
      this.stopAutoTick();
      this.startAutoTick();
    }
  }

  /** 暂停 */
  pause() {
    this._paused = true;
  }

  /** 恢复 */
  resume() {
    this._paused = false;
  }

  /** @returns {boolean} */
  isPaused() {
    return this._paused;
  }

  /** @returns {boolean} */
  isTicking() {
    return this._ticking;
  }

  /**
   * 注册tick前钩子
   * @param {Function} fn - async (gameTime) => void
   */
  beforeTick(fn) {
    this._beforeHooks.push(fn);
  }

  /**
   * 注册tick后钩子
   * @param {Function} fn - async (gameTime, decisions) => void
   */
  afterTick(fn) {
    this._afterHooks.push(fn);
  }

  /**
   * 注册NPC Agent决策函数
   * 每个tick会并行调用所有已注册的决策函数
   * @param {Function} fn - async (gameTime) => decision
   */
  registerAgent(fn) {
    this._agentDecisionFns.push(fn);
  }

  /**
   * 移除NPC Agent决策函数
   * @param {Function} fn
   */
  unregisterAgent(fn) {
    const idx = this._agentDecisionFns.indexOf(fn);
    if (idx !== -1) this._agentDecisionFns.splice(idx, 1);
  }

  /**
   * 执行一个tick
   * 流程：beforeHooks -> 并行Agent决策 -> 时间推进 -> afterHooks
   * @returns {Promise<{ gameTime: object, decisions: Array }>}
   */
  async executeTick() {
    if (this._paused) return null;
    if (this._ticking) return null; // 防止重入

    this._ticking = true;

    try {
      const gameTimeBefore = this.getGameTime();

      // 执行tick前钩子（顺序执行）
      for (const hook of this._beforeHooks) {
        await hook(gameTimeBefore);
      }

      // 并行调用所有NPC Agent的决策
      const decisionPromises = this._agentDecisionFns.map((fn) =>
        fn(gameTimeBefore).catch((err) => ({
          error: true,
          message: err?.message || String(err),
        }))
      );
      const decisions = await Promise.all(decisionPromises);

      // 推进时间
      this._totalMinutes += this._minutesPerTick;
      this._tickCount++;

      const gameTimeAfter = this.getGameTime();

      // 执行tick后钩子（顺序执行）
      for (const hook of this._afterHooks) {
        await hook(gameTimeAfter, decisions);
      }

      return { gameTime: gameTimeAfter, decisions };
    } finally {
      this._ticking = false;
    }
  }

  /**
   * 启动自动tick循环
   */
  startAutoTick() {
    if (this._timerId !== null) return;

    const loop = async () => {
      await this.executeTick();
      // 根据速度倍率调整间隔
      const interval = this._baseInterval / this._speed;
      this._timerId = setTimeout(loop, interval);
    };

    const interval = this._baseInterval / this._speed;
    this._timerId = setTimeout(loop, interval);
  }

  /**
   * 停止自动tick循环
   */
  stopAutoTick() {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  /**
   * 重置调度器状态
   * @param {object} [options] - 同构造函数参数
   */
  reset(options = {}) {
    this.stopAutoTick();
    const { minutesPerTick = 15, startDay = 1, startHour = 8 } = options;
    this._minutesPerTick = minutesPerTick;
    this._totalMinutes = (startDay - 1) * 1440 + startHour * 60;
    this._tickCount = 0;
    this._speed = 1;
    this._paused = false;
    this._ticking = false;
  }
}

export { PHASE };
