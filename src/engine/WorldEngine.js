/**
 * WorldEngine - 世界引擎主类
 *
 * AI多智能体世界模拟引擎的"物理层"。
 * 不做决策，只维护约束：时间、空间、通信、资源。
 *
 * 每个NPC是独立的AI Agent，有独立LLM调用。
 * WorldEngine负责调度、路由、约束验证。
 */

import { TickScheduler, PHASE } from './TickScheduler.js';
import { CommunicationBus, MSG_TYPE } from './CommunicationBus.js';
import { ResourceManager } from './ResourceManager.js';

// ========== 简易EventEmitter实现 ==========

class EventEmitter {
  constructor() {
    /** @type {Map<string, Array<Function>>} */
    this._handlers = new Map();
  }

  /**
   * 订阅事件
   * @param {string} eventName
   * @param {Function} callback
   * @returns {Function} 取消订阅函数
   */
  on(eventName, callback) {
    if (!this._handlers.has(eventName)) {
      this._handlers.set(eventName, []);
    }
    this._handlers.get(eventName).push(callback);
    return () => this.off(eventName, callback);
  }

  /**
   * 一次性订阅
   * @param {string} eventName
   * @param {Function} callback
   */
  once(eventName, callback) {
    const wrapper = (...args) => {
      this.off(eventName, wrapper);
      callback(...args);
    };
    this.on(eventName, wrapper);
  }

  /**
   * 取消订阅
   * @param {string} eventName
   * @param {Function} callback
   */
  off(eventName, callback) {
    const handlers = this._handlers.get(eventName);
    if (!handlers) return;
    const idx = handlers.indexOf(callback);
    if (idx !== -1) handlers.splice(idx, 1);
  }

  /**
   * 发射事件
   * @param {string} eventName
   * @param {*} data
   */
  emit(eventName, data) {
    const handlers = this._handlers.get(eventName);
    if (!handlers || handlers.length === 0) return;
    // 复制一份防止回调中修改handlers
    const snapshot = handlers.slice();
    for (const fn of snapshot) {
      try {
        fn(data);
      } catch (err) {
        console.error(`[WorldEngine] 事件处理器异常 (${eventName}):`, err);
      }
    }
  }

  /**
   * 移除所有监听器
   * @param {string} [eventName] - 不传则清除全部
   */
  removeAllListeners(eventName) {
    if (eventName) {
      this._handlers.delete(eventName);
    } else {
      this._handlers.clear();
    }
  }
}

// ========== WorldEngine 主类 ==========

export class WorldEngine {
  /**
   * @param {object} worldConfig - 世界配置
   * @param {object} worldConfig.time - 时间配置 { minutesPerTick, startDay, startHour }
   * @param {Array} worldConfig.locations - 地点列表 [{ id, name, connections }]
   * @param {Array} worldConfig.resources - 资源列表 [{ id, name, total, ... }]
   * @param {Array} npcs - NPC列表 [{ id, name, location, agentFn }]
   * @param {object} [relationships] - 关系图 { "npcId1->npcId2": { type, strength, ... } }
   */
  constructor(worldConfig, npcs, relationships = {}) {
    this._config = worldConfig;

    // ---- 事件系统 ----
    this._emitter = new EventEmitter();

    // ---- NPC管理 ----
    /** @type {Map<string, object>} NPC ID -> NPC数据 */
    this._npcs = new Map();
    for (const npc of npcs) {
      this._npcs.set(npc.id, { ...npc });
    }

    // ---- 空间管理 ----
    /** @type {Map<string, string>} NPC ID -> 当前地点ID */
    this._npcLocations = new Map();
    for (const npc of npcs) {
      this._npcLocations.set(npc.id, npc.location || npc.region || 'default');
    }

    /** @type {Map<string, object>} 地点ID -> 地点信息 */
    this._locations = new Map();
    if (worldConfig.locations) {
      for (const loc of worldConfig.locations) {
        this._locations.set(loc.id, { ...loc });
      }
    }

    // ---- 关系图 ----
    this._relationships = this._normalizeRelationships(relationships);

    // ---- Tick调度器 ----
    this._scheduler = new TickScheduler(worldConfig.time || {});

    // ---- 资源管理器 ----
    this._resourceManager = new ResourceManager({
      onEvent: (eventName, data) => {
        this._emitter.emit(eventName, data);
      },
    });
    if (worldConfig.resources) {
      this._resourceManager.initResources(worldConfig.resources);
    }

    // ---- 通信总线 ----
    this._commBus = new CommunicationBus({
      getLocationOf: (npcId) => this.getLocationOf(npcId),
      getNpcsAtLocation: (locationId) => this.getNpcsAtLocation(locationId),
    });

    // ---- 张力系统（世界中的紧张关系/冲突） ----
    /** @type {Array<object>} 当前张力列表 */
    this._tensions = [];

    // ---- 事件注入队列 ----
    /** @type {Array<object>} 待注入的事件 */
    this._injectedEvents = [];

    // ---- 注册NPC Agent到调度器 ----
    this._registerAgents();

    // ---- 注册tick钩子 ----
    this._scheduler.beforeTick(async (gameTime) => {
      this._emitter.emit('tick:before', gameTime);
    });

    this._scheduler.afterTick(async (gameTime, decisions) => {
      // 资源再生
      this._resourceManager.tickRegenerate(gameTime.tickCount);
      // 处理注入事件
      this._processInjectedEvents(gameTime);
      // 发射tick完成事件
      this._emitter.emit('tick:after', { gameTime, decisions });
    });
  }

  /**
   * 检测并转换关系格式
   * 兼容嵌套格式 { npcId: { otherId: { inner, outer, notes } } }
   * 和箭头键格式 { "npcId->otherId": {...} }
   */
  _normalizeRelationships(rawRelationships) {
    const normalized = {};
    for (const [fromId, targets] of Object.entries(rawRelationships)) {
      if (typeof targets === 'object' && !targets.type && !targets.strength) {
        // 嵌套格式: { npcId: { otherId: { inner, outer, notes } } }
        for (const [toId, rel] of Object.entries(targets)) {
          normalized[`${fromId}->${toId}`] = rel;
        }
      } else {
        // 已经是扁平格式
        normalized[fromId] = targets;
      }
    }
    return normalized;
  }

  /**
   * 将所有NPC的agentFn注册到调度器
   */
  _registerAgents() {
    for (const [npcId, npc] of this._npcs) {
      if (typeof npc.agentFn === 'function') {
        const wrappedFn = async (gameTime) => {
          // 为Agent提供上下文
          const context = {
            npcId,
            gameTime,
            perception: this.getPerception(npcId),
            location: this.getLocationOf(npcId),
            nearbyNpcs: this.getNpcsAtLocation(this.getLocationOf(npcId)).filter(
              (id) => id !== npcId
            ),
            resources: this._resourceManager.getResources(),
            relationships: this._getRelationshipsFor(npcId),
          };

          const decision = await npc.agentFn(context);

          // 处理Agent返回的决策动作
          if (decision) {
            await this._executeDecision(npcId, decision, gameTime);
          }

          return { npcId, decision };
        };
        this._scheduler.registerAgent(wrappedFn);
      }
    }
  }

  /**
   * 获取某NPC的所有关系
   * @param {string} npcId
   * @returns {object}
   */
  _getRelationshipsFor(npcId) {
    const result = {};
    for (const key of Object.keys(this._relationships)) {
      if (key.startsWith(`${npcId}->`) || key.endsWith(`->${npcId}`)) {
        result[key] = this._relationships[key];
      }
    }
    return result;
  }

  /**
   * 执行NPC的决策动作
   * @param {string} npcId
   * @param {object} decision - { actions: [{ type, ... }] }
   * @param {object} gameTime
   */
  async _executeDecision(npcId, decision, gameTime) {
    const actions = decision.actions || [];
    for (const action of actions) {
      switch (action.type) {
        case 'move':
          this.moveNpc(npcId, action.toLocation);
          break;
        case 'speak':
          this.sendMessage(npcId, action.toId, action.content, MSG_TYPE.SPEAK);
          break;
        case 'broadcast':
          this.broadcast(this.getLocationOf(npcId), {
            fromId: npcId,
            content: action.content,
            type: MSG_TYPE.SPEAK,
          });
          break;
        case 'spreadRumor':
          if (action.originalMessage) {
            this._commBus.spreadRumor(
              npcId,
              action.originalMessage,
              action.content,
              gameTime
            );
          }
          break;
        default:
          // 自定义动作通过事件系统转发
          this._emitter.emit('npc:action', { npcId, action, gameTime });
      }
    }
  }

  /**
   * 处理注入的事件
   * @param {object} gameTime
   */
  _processInjectedEvents(gameTime) {
    while (this._injectedEvents.length > 0) {
      const event = this._injectedEvents.shift();
      this._emitter.emit('event:injected', { event, gameTime });

      // 如果事件指定了地点，广播给该地点的NPC
      if (event.location) {
        this._commBus.broadcast(
          event.location,
          {
            fromId: event.fromId || '__system__',
            content: event.content || event.description,
            type: MSG_TYPE.PERCEIVE,
          },
          gameTime
        );
      }

      // 如果事件包含资源变化
      if (event.resourceChange) {
        const { resourceId, amount } = event.resourceChange;
        if (amount > 0) {
          this._resourceManager.replenishResource(resourceId, amount, event.description);
        } else if (amount < 0) {
          this._resourceManager.consumeResource(resourceId, -amount, event.description, gameTime.tickCount);
        }
      }

      // 如果事件会产生张力
      if (event.tension) {
        this._tensions.push({
          ...event.tension,
          createdAt: gameTime,
        });
        this._emitter.emit('tension:created', event.tension);
      }
    }
  }

  // =====================
  //  时间系统 API
  // =====================

  /**
   * 推进一个时间步
   * @returns {Promise<{ gameTime: object, decisions: Array }|null>}
   */
  async tick() {
    return await this._scheduler.executeTick();
  }

  /**
   * 获取当前游戏时间
   * @returns {{ day: number, hour: number, minute: number, phase: string, tickCount: number }}
   */
  getGameTime() {
    return this._scheduler.getGameTime();
  }

  /**
   * 设置速度倍率
   * @param {number} multiplier - 1/2/4/8
   */
  setSpeed(multiplier) {
    this._scheduler.setSpeed(multiplier);
    this._emitter.emit('speed:changed', { multiplier });
  }

  /** 暂停 */
  pause() {
    this._scheduler.pause();
    this._emitter.emit('engine:paused', this.getGameTime());
  }

  /** 恢复 */
  resume() {
    this._scheduler.resume();
    this._emitter.emit('engine:resumed', this.getGameTime());
  }

  // =====================
  //  通信总线 API
  // =====================

  /**
   * 广播事件到指定地点
   * @param {string} location - 地点ID
   * @param {object} event - { fromId, content, type }
   * @returns {Array} 投递的消息列表
   */
  broadcast(location, event) {
    const gameTime = this.getGameTime();
    const messages = this._commBus.broadcast(location, event, gameTime);
    this._emitter.emit('comm:broadcast', { location, event, messages });
    return messages;
  }

  /**
   * NPC间发送消息
   * @param {string} fromId
   * @param {string} toId
   * @param {string} content
   * @param {string} [type=MSG_TYPE.SPEAK]
   * @returns {object|null}
   */
  sendMessage(fromId, toId, content, type = MSG_TYPE.SPEAK) {
    const gameTime = this.getGameTime();
    const message = this._commBus.sendMessage(fromId, toId, content, type, gameTime);
    if (message) {
      this._emitter.emit('comm:message', message);
    }
    return message;
  }

  /**
   * 获取NPC当前能感知到的信息
   * @param {string} npcId
   * @param {number} [limit=20]
   * @returns {Array}
   */
  getPerception(npcId, limit = 20) {
    return this._commBus.getPerception(npcId, limit);
  }

  // =====================
  //  资源管理 API
  // =====================

  /**
   * 获取所有资源状态
   * @returns {object}
   */
  getResources() {
    return this._resourceManager.getResources();
  }

  /**
   * 消耗资源
   * @param {string} resourceId
   * @param {number} amount
   * @param {string} reason
   * @returns {{ success: boolean, remaining: number, message?: string }}
   */
  consumeResource(resourceId, amount, reason) {
    const tick = this.getGameTime().tickCount;
    return this._resourceManager.consumeResource(resourceId, amount, reason, tick);
  }

  /**
   * 分配资源给NPC
   * @param {string} resourceId
   * @param {string} toNpcId
   * @param {number} amount
   * @param {string} [reason='']
   * @returns {{ success: boolean, remaining: number, message?: string }}
   */
  allocateResource(resourceId, toNpcId, amount, reason = '') {
    const tick = this.getGameTime().tickCount;
    return this._resourceManager.allocateResource(resourceId, toNpcId, amount, reason, tick);
  }

  // =====================
  //  空间管理 API
  // =====================

  /**
   * 移动NPC到新地点
   * @param {string} npcId
   * @param {string} toLocation
   * @returns {{ success: boolean, message?: string }}
   */
  moveNpc(npcId, toLocation) {
    if (!this._npcs.has(npcId)) {
      return { success: false, message: `NPC ${npcId} 不存在` };
    }

    // 验证目标地点是否存在（如果有地点配置的话）
    if (this._locations.size > 0 && !this._locations.has(toLocation)) {
      return { success: false, message: `地点 ${toLocation} 不存在` };
    }

    // 验证连通性（如果地点定义了connections）
    const fromLocation = this._npcLocations.get(npcId);
    if (this._locations.has(fromLocation)) {
      const locData = this._locations.get(fromLocation);
      if (locData.connections && locData.connections.length > 0) {
        if (!locData.connections.includes(toLocation)) {
          return {
            success: false,
            message: `从 ${fromLocation} 无法直接到达 ${toLocation}`,
          };
        }
      }
    }

    const prevLocation = this._npcLocations.get(npcId);
    this._npcLocations.set(npcId, toLocation);

    // 广播离开和到达事件
    const gameTime = this.getGameTime();
    const npcName = this._npcs.get(npcId).name || npcId;

    this._commBus.broadcast(
      prevLocation,
      {
        fromId: npcId,
        content: `${npcName} 离开了这里`,
        type: MSG_TYPE.PERCEIVE,
      },
      gameTime
    );

    this._commBus.broadcast(
      toLocation,
      {
        fromId: npcId,
        content: `${npcName} 来到了这里`,
        type: MSG_TYPE.PERCEIVE,
      },
      gameTime
    );

    this._emitter.emit('npc:moved', {
      npcId,
      from: prevLocation,
      to: toLocation,
      gameTime,
    });

    return { success: true };
  }

  /**
   * 获取某地点的所有NPC ID列表
   * @param {string} locationId
   * @returns {string[]}
   */
  getNpcsAtLocation(locationId) {
    const result = [];
    for (const [npcId, loc] of this._npcLocations) {
      if (loc === locationId) {
        result.push(npcId);
      }
    }
    return result;
  }

  /**
   * 获取NPC当前所在地点
   * @param {string} npcId
   * @returns {string|null}
   */
  getLocationOf(npcId) {
    return this._npcLocations.get(npcId) || null;
  }

  // =====================
  //  事件系统 API
  // =====================

  /**
   * 订阅事件
   * @param {string} eventName
   * @param {Function} callback
   * @returns {Function} 取消订阅函数
   */
  on(eventName, callback) {
    return this._emitter.on(eventName, callback);
  }

  /**
   * 发射事件
   * @param {string} eventName
   * @param {*} data
   */
  emit(eventName, data) {
    this._emitter.emit(eventName, data);
  }

  /**
   * 上帝干预：注入事件
   * 事件将在下一个tick结束时处理
   * @param {object} event - { description, location?, resourceChange?, tension?, ... }
   */
  injectEvent(event) {
    this._injectedEvents.push(event);
    this._emitter.emit('event:queued', event);
  }

  // =====================
  //  世界状态 API
  // =====================

  /**
   * 获取完整世界状态快照
   * 注意：返回浅引用，调用方不应修改返回值
   * @returns {object}
   */
  getWorldState() {
    const npcs = {};
    for (const [id, npc] of this._npcs) {
      npcs[id] = {
        id,
        name: npc.name,
        location: this._npcLocations.get(id),
      };
    }

    const locations = {};
    for (const [id, loc] of this._locations) {
      locations[id] = {
        ...loc,
        npcs: this.getNpcsAtLocation(id),
      };
    }

    return {
      gameTime: this.getGameTime(),
      npcs,
      locations,
      resources: this._resourceManager.getResources(),
      tensions: this._tensions,
      relationships: this._relationships,
      paused: this._scheduler.isPaused(),
    };
  }

  /**
   * 获取当前张力列表
   * @returns {Array<object>}
   */
  getTensions() {
    return this._tensions;
  }

  /**
   * 添加张力
   * @param {object} tension - { id, type, involvedNpcs, description, intensity }
   */
  addTension(tension) {
    this._tensions.push({
      ...tension,
      createdAt: this.getGameTime(),
    });
    this._emitter.emit('tension:created', tension);
  }

  /**
   * 移除张力
   * @param {string} tensionId
   */
  removeTension(tensionId) {
    const idx = this._tensions.findIndex((t) => t.id === tensionId);
    if (idx !== -1) {
      const removed = this._tensions.splice(idx, 1)[0];
      this._emitter.emit('tension:resolved', removed);
    }
  }

  // =====================
  //  自动运行控制
  // =====================

  /** 启动自动tick循环 */
  start() {
    this._scheduler.startAutoTick();
    this._emitter.emit('engine:started', this.getGameTime());
  }

  /** 停止自动tick循环 */
  stop() {
    this._scheduler.stopAutoTick();
    this._emitter.emit('engine:stopped', this.getGameTime());
  }

  /**
   * 重置世界引擎到初始状态
   */
  reset() {
    this.stop();
    this._scheduler.reset(this._config.time || {});
    this._commBus.reset();
    this._resourceManager.reset();
    if (this._config.resources) {
      this._resourceManager.initResources(this._config.resources);
    }
    this._tensions.length = 0;
    this._injectedEvents.length = 0;
    this._emitter.removeAllListeners();

    // 重新注册内部 tick 钩子（removeAllListeners 会清除它们）
    this._scheduler.beforeTick(async (gameTime) => {
      this._emitter.emit('tick:before', gameTime);
    });

    this._scheduler.afterTick(async (gameTime, decisions) => {
      this._resourceManager.tickRegenerate(gameTime.tickCount);
      this._processInjectedEvents(gameTime);
      this._emitter.emit('tick:after', { gameTime, decisions });
    });
  }
}

export { PHASE, MSG_TYPE };
