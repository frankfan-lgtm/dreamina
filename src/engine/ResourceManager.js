/**
 * ResourceManager - 资源管理器
 *
 * 职责：
 * - 管理多种资源类型（HC、晋升名额、薪资预算、项目资源等）
 * - 资源消耗/分配/恢复
 * - 资源变化事件通知
 * - 资源稀缺度计算
 */

/**
 * 资源定义
 * @typedef {object} ResourceDef
 * @property {string} id - 资源唯一ID
 * @property {string} name - 资源名称
 * @property {number} total - 总量
 * @property {number} available - 当前可用量
 * @property {number} [min=0] - 最小值
 * @property {number} [max] - 最大值（默认等于total）
 * @property {boolean} [renewable=false] - 是否可再生
 * @property {number} [regenPerTick=0] - 每tick再生量
 */

/**
 * 资源分配记录
 * @typedef {object} Allocation
 * @property {string} resourceId
 * @property {string} npcId
 * @property {number} amount
 * @property {string} reason
 * @property {number} tick
 */

export class ResourceManager {
  /**
   * @param {object} options
   * @param {Function} [options.onEvent] - 事件回调 (eventName, data) => void
   */
  constructor(options = {}) {
    /** @type {Map<string, ResourceDef>} 资源池 */
    this._resources = new Map();

    /** @type {Allocation[]} 分配历史 */
    this._allocationHistory = [];

    /** @type {Array<{resourceId: string, amount: number, reason: string, tick: number}>} 消耗历史 */
    this._consumptionHistory = [];

    /** @type {Function|null} 事件回调 */
    this._onEvent = options.onEvent || null;

    /** @type {Array<Function>} 资源变化监听器 */
    this._changeListeners = [];
  }

  /**
   * 注册资源变化监听器
   * @param {Function} fn - (eventName, data) => void
   * @returns {Function} 取消注册函数
   */
  onChange(fn) {
    this._changeListeners.push(fn);
    return () => {
      const idx = this._changeListeners.indexOf(fn);
      if (idx !== -1) this._changeListeners.splice(idx, 1);
    };
  }

  /**
   * 触发事件
   * @param {string} eventName
   * @param {object} data
   */
  _emit(eventName, data) {
    if (this._onEvent) {
      try { this._onEvent(eventName, data); } catch (_) {}
    }
    for (const fn of this._changeListeners) {
      try { fn(eventName, data); } catch (_) {}
    }
  }

  /**
   * 初始化资源池
   * @param {ResourceDef[]} resources
   */
  initResources(resources) {
    this._resources.clear();
    for (const res of resources) {
      this._resources.set(res.id, {
        id: res.id,
        name: res.name || res.id,
        total: res.total,
        available: res.available ?? res.total,
        min: res.min ?? 0,
        max: res.max ?? res.total,
        renewable: res.renewable ?? false,
        regenPerTick: res.regenPerTick ?? 0,
      });
    }
  }

  /**
   * 获取所有资源状态
   * @returns {object} resourceId -> { id, name, total, available, scarcity }
   */
  getResources() {
    const result = {};
    for (const [id, res] of this._resources) {
      result[id] = {
        id: res.id,
        name: res.name,
        total: res.total,
        available: res.available,
        scarcity: this.getScarcity(id),
      };
    }
    return result;
  }

  /**
   * 获取单个资源
   * @param {string} resourceId
   * @returns {ResourceDef|null}
   */
  getResource(resourceId) {
    return this._resources.get(resourceId) || null;
  }

  /**
   * 计算资源稀缺度
   * 0 = 充裕，1 = 完全耗尽
   * @param {string} resourceId
   * @returns {number}
   */
  getScarcity(resourceId) {
    const res = this._resources.get(resourceId);
    if (!res) return 1;
    if (res.total === 0) return 1;
    return 1 - res.available / res.total;
  }

  /**
   * 消耗资源
   * @param {string} resourceId
   * @param {number} amount
   * @param {string} reason
   * @param {number} [tick=0] - 当前tick
   * @returns {{ success: boolean, remaining: number, message?: string }}
   */
  consumeResource(resourceId, amount, reason, tick = 0) {
    const res = this._resources.get(resourceId);
    if (!res) {
      return { success: false, remaining: 0, message: `资源 ${resourceId} 不存在` };
    }
    if (amount <= 0) {
      return { success: false, remaining: res.available, message: '消耗量必须大于0' };
    }
    if (res.available < amount) {
      return {
        success: false,
        remaining: res.available,
        message: `资源 ${res.name} 不足，需要 ${amount}，仅剩 ${res.available}`,
      };
    }

    res.available -= amount;

    const record = { resourceId, amount, reason, tick };
    this._consumptionHistory.push(record);

    this._emit('resource:consumed', {
      resourceId,
      amount,
      remaining: res.available,
      scarcity: this.getScarcity(resourceId),
      reason,
    });

    // 稀缺度超过阈值时发出警告
    const scarcity = this.getScarcity(resourceId);
    if (scarcity >= 0.8) {
      this._emit('resource:critical', {
        resourceId,
        name: res.name,
        available: res.available,
        total: res.total,
        scarcity,
      });
    }

    return { success: true, remaining: res.available };
  }

  /**
   * 分配资源给NPC
   * @param {string} resourceId
   * @param {string} toNpcId
   * @param {number} amount
   * @param {string} [reason='']
   * @param {number} [tick=0]
   * @returns {{ success: boolean, remaining: number, message?: string }}
   */
  allocateResource(resourceId, toNpcId, amount, reason = '', tick = 0) {
    const consumeResult = this.consumeResource(resourceId, amount, `分配给${toNpcId}: ${reason}`, tick);
    if (!consumeResult.success) {
      return consumeResult;
    }

    const allocation = { resourceId, npcId: toNpcId, amount, reason, tick };
    this._allocationHistory.push(allocation);

    this._emit('resource:allocated', {
      resourceId,
      toNpcId,
      amount,
      remaining: consumeResult.remaining,
      reason,
    });

    return consumeResult;
  }

  /**
   * 恢复/补充资源
   * @param {string} resourceId
   * @param {number} amount
   * @param {string} [reason='']
   * @returns {{ success: boolean, available: number }}
   */
  replenishResource(resourceId, amount, reason = '') {
    const res = this._resources.get(resourceId);
    if (!res) {
      return { success: false, available: 0 };
    }

    const prev = res.available;
    res.available = Math.min(res.max, res.available + amount);
    const actual = res.available - prev;

    if (actual > 0) {
      this._emit('resource:replenished', {
        resourceId,
        amount: actual,
        available: res.available,
        reason,
      });
    }

    return { success: true, available: res.available };
  }

  /**
   * 每tick再生资源（由TickScheduler调用）
   * @param {number} tick
   */
  tickRegenerate(tick) {
    for (const [, res] of this._resources) {
      if (res.renewable && res.regenPerTick > 0 && res.available < res.max) {
        this.replenishResource(res.id, res.regenPerTick, `tick ${tick} 自动再生`);
      }
    }
  }

  /**
   * 获取分配历史
   * @param {string} [npcId] - 可选，筛选某NPC的
   * @param {number} [limit=50]
   * @returns {Allocation[]}
   */
  getAllocationHistory(npcId, limit = 50) {
    let history = this._allocationHistory;
    if (npcId) {
      history = history.filter((a) => a.npcId === npcId);
    }
    return history.slice(-limit);
  }

  /**
   * 获取消耗历史
   * @param {number} [limit=50]
   * @returns {Array}
   */
  getConsumptionHistory(limit = 50) {
    return this._consumptionHistory.slice(-limit);
  }

  /**
   * 获取所有资源的稀缺度排名
   * @returns {Array<{ id: string, name: string, scarcity: number }>}
   */
  getScarcityRanking() {
    const ranking = [];
    for (const [id, res] of this._resources) {
      ranking.push({
        id,
        name: res.name,
        scarcity: this.getScarcity(id),
      });
    }
    ranking.sort((a, b) => b.scarcity - a.scarcity);
    return ranking;
  }

  /**
   * 重置资源管理器
   */
  reset() {
    this._resources.clear();
    this._allocationHistory.length = 0;
    this._consumptionHistory.length = 0;
  }
}
