/**
 * CommunicationBus - 通信总线
 *
 * 职责：
 * - NPC之间的消息路由
 * - 同地点才能直接感知/对话
 * - 传闻传播（信息失真模拟）
 * - 消息队列管理与历史记录
 */

/** 通信类型 */
export const MSG_TYPE = {
  PERCEIVE: 'PERCEIVE', // 被动感知（看到某人做了某事）
  SPEAK: 'SPEAK',       // 主动说话（直接对话）
  RUMOR: 'RUMOR',       // 传闻（二手/多手信息，可能失真）
};

/**
 * 单条消息结构
 * @typedef {object} Message
 * @property {string} id - 消息唯一ID
 * @property {string} fromId - 发送者NPC ID
 * @property {string|null} toId - 接收者NPC ID，null表示广播
 * @property {string} type - MSG_TYPE中的一种
 * @property {string} content - 消息内容
 * @property {string} location - 发生地点
 * @property {number} tick - 发生时的tick数
 * @property {object} gameTime - 发生时的游戏时间
 * @property {number} reliability - 可信度 0-1，传闻每经一手降低
 * @property {string|null} originalMessageId - 传闻的原始消息ID
 */

let _msgIdCounter = 0;

function generateMsgId() {
  return `msg_${++_msgIdCounter}_${Date.now().toString(36)}`;
}

export class CommunicationBus {
  /**
   * @param {object} options
   * @param {Function} options.getLocationOf - (npcId) => locationId
   * @param {Function} options.getNpcsAtLocation - (locationId) => npcId[]
   * @param {number} [options.rumorDecay=0.15] - 传闻每经一手的可信度衰减
   * @param {number} [options.maxHistoryPerNpc=200] - 每个NPC保留的最大消息历史
   */
  constructor(options) {
    const {
      getLocationOf,
      getNpcsAtLocation,
      rumorDecay = 0.15,
      maxHistoryPerNpc = 200,
    } = options;

    this._getLocationOf = getLocationOf;
    this._getNpcsAtLocation = getNpcsAtLocation;
    this._rumorDecay = rumorDecay;
    this._maxHistoryPerNpc = maxHistoryPerNpc;

    /** @type {Map<string, Message[]>} NPC ID -> 收到的消息列表 */
    this._inbox = new Map();

    /** @type {Message[]} 当前tick的待处理消息队列 */
    this._pendingQueue = [];

    /** @type {Message[]} 全局消息历史（用于回放/调试） */
    this._globalHistory = [];

    /** @type {Array<Function>} 消息监听器 */
    this._listeners = [];
  }

  /**
   * 注册消息监听器（用于UI展示、日志等）
   * @param {Function} fn - (message) => void
   * @returns {Function} 取消注册函数
   */
  onMessage(fn) {
    this._listeners.push(fn);
    return () => {
      const idx = this._listeners.indexOf(fn);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  /**
   * 通知所有监听器
   * @param {Message} message
   */
  _notifyListeners(message) {
    for (const fn of this._listeners) {
      try {
        fn(message);
      } catch (_) {
        // 监听器异常不影响主流程
      }
    }
  }

  /**
   * 确保NPC有收件箱
   * @param {string} npcId
   */
  _ensureInbox(npcId) {
    if (!this._inbox.has(npcId)) {
      this._inbox.set(npcId, []);
    }
  }

  /**
   * 向NPC收件箱投递消息，维护容量限制
   * @param {string} npcId
   * @param {Message} message
   */
  _deliverToInbox(npcId, message) {
    this._ensureInbox(npcId);
    const inbox = this._inbox.get(npcId);
    inbox.push(message);
    // 超过容量上限时，丢弃最旧的消息
    if (inbox.length > this._maxHistoryPerNpc) {
      inbox.splice(0, inbox.length - this._maxHistoryPerNpc);
    }
  }

  /**
   * 发送点对点消息
   * 必须在同一地点才能SPEAK/PERCEIVE，RUMOR不受限制
   * @param {string} fromId
   * @param {string} toId
   * @param {string} content
   * @param {string} type - MSG_TYPE
   * @param {object} gameTime - 当前游戏时间
   * @returns {Message|null} 发送成功返回消息，失败返回null
   */
  sendMessage(fromId, toId, content, type, gameTime) {
    const fromLocation = this._getLocationOf(fromId);
    const toLocation = this._getLocationOf(toId);

    // 非传闻类型要求同地点
    if (type !== MSG_TYPE.RUMOR && fromLocation !== toLocation) {
      return null;
    }

    const message = {
      id: generateMsgId(),
      fromId,
      toId,
      type,
      content,
      location: fromLocation,
      tick: gameTime.tickCount,
      gameTime: { ...gameTime },
      reliability: type === MSG_TYPE.RUMOR ? 1 - this._rumorDecay : 1,
      originalMessageId: null,
    };

    this._deliverToInbox(toId, message);
    this._globalHistory.push(message);
    this._notifyListeners(message);

    return message;
  }

  /**
   * 广播消息到指定地点的所有NPC
   * @param {string} location - 地点ID
   * @param {object} event - { fromId, content, type }
   * @param {object} gameTime
   * @returns {Message[]} 投递的消息列表
   */
  broadcast(location, event, gameTime) {
    const { fromId, content, type = MSG_TYPE.PERCEIVE } = event;
    const npcsAtLocation = this._getNpcsAtLocation(location);
    const messages = [];

    for (const npcId of npcsAtLocation) {
      // 不给自己广播
      if (npcId === fromId) continue;

      const message = {
        id: generateMsgId(),
        fromId,
        toId: npcId,
        type,
        content,
        location,
        tick: gameTime.tickCount,
        gameTime: { ...gameTime },
        reliability: 1,
        originalMessageId: null,
      };

      this._deliverToInbox(npcId, message);
      this._globalHistory.push(message);
      this._notifyListeners(message);
      messages.push(message);
    }

    return messages;
  }

  /**
   * 传播传闻（信息失真）
   * 从spreaderNpcId向同地点NPC传播一条已有消息的传闻版本
   * @param {string} spreaderId - 传播者ID
   * @param {Message} originalMessage - 原始消息
   * @param {string} rumorContent - 传闻内容（可能与原文不同，模拟失真）
   * @param {object} gameTime
   * @returns {Message[]} 投递的消息列表
   */
  spreadRumor(spreaderId, originalMessage, rumorContent, gameTime) {
    const location = this._getLocationOf(spreaderId);
    const npcsAtLocation = this._getNpcsAtLocation(location);
    const messages = [];

    // 计算传闻可信度：在原消息可信度基础上衰减
    const reliability = Math.max(
      0,
      (originalMessage.reliability || 1) - this._rumorDecay
    );

    for (const npcId of npcsAtLocation) {
      if (npcId === spreaderId) continue;

      const message = {
        id: generateMsgId(),
        fromId: spreaderId,
        toId: npcId,
        type: MSG_TYPE.RUMOR,
        content: rumorContent,
        location,
        tick: gameTime.tickCount,
        gameTime: { ...gameTime },
        reliability,
        originalMessageId: originalMessage.id,
      };

      this._deliverToInbox(npcId, message);
      this._globalHistory.push(message);
      this._notifyListeners(message);
      messages.push(message);
    }

    return messages;
  }

  /**
   * 获取NPC当前能感知到的信息
   * 返回该NPC收件箱中最近的消息
   * @param {string} npcId
   * @param {number} [limit=20] - 返回最近多少条
   * @returns {Message[]}
   */
  getPerception(npcId, limit = 20) {
    this._ensureInbox(npcId);
    const inbox = this._inbox.get(npcId);
    // 返回最近的消息（不做深拷贝，调用方不应修改）
    return inbox.slice(-limit);
  }

  /**
   * 获取NPC自某个tick以来收到的新消息
   * @param {string} npcId
   * @param {number} sinceTick
   * @returns {Message[]}
   */
  getMessagesSince(npcId, sinceTick) {
    this._ensureInbox(npcId);
    const inbox = this._inbox.get(npcId);
    // 从后往前找，因为消息按时间排序
    let startIdx = inbox.length;
    for (let i = inbox.length - 1; i >= 0; i--) {
      if (inbox[i].tick < sinceTick) break;
      startIdx = i;
    }
    return inbox.slice(startIdx);
  }

  /**
   * 获取全局消息历史
   * @param {number} [limit=100]
   * @returns {Message[]}
   */
  getGlobalHistory(limit = 100) {
    return this._globalHistory.slice(-limit);
  }

  /**
   * 清空某NPC的收件箱
   * @param {string} npcId
   */
  clearInbox(npcId) {
    this._inbox.set(npcId, []);
  }

  /**
   * 重置通信总线
   */
  reset() {
    this._inbox.clear();
    this._pendingQueue.length = 0;
    this._globalHistory.length = 0;
    _msgIdCounter = 0;
  }
}
