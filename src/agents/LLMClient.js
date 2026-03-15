/**
 * LLMClient — 统一的 LLM 调用客户端
 * 封装 fetch 调用（通过 /api/claude 代理）
 * 支持 JSON 输出解析（带容错）、流式 SSE、并发限流、错误重试
 */

// ─── JSON 容错解析（参考 engine.js 中的 parseResponse 逻辑）───
function parseJSON(text) {
  let cleaned = text.trim();

  // 去掉 markdown 代码块包裹
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // 如果不以 { 或 [ 开头，尝试提取第一个 JSON 对象/数组
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const startObj = cleaned.indexOf('{');
    const startArr = cleaned.indexOf('[');
    const start = startObj >= 0 && startArr >= 0
      ? Math.min(startObj, startArr)
      : Math.max(startObj, startArr);
    if (start >= 0) cleaned = cleaned.slice(start);
  }

  // 如果不以 } 或 ] 结尾，截断到最后一个匹配字符
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const lastClose = Math.max(lastBrace, lastBracket);
  if (lastClose >= 0 && cleaned.length - 1 !== lastClose) {
    cleaned = cleaned.slice(0, lastClose + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 尝试修复常见问题
    const fixed = cleaned
      .replace(/,\s*([}\]])/g, '$1')             // 去掉尾逗号
      .replace(/(?<=[{,]\s*)(\w+)\s*:/g, '"$1":') // 补全属性名引号
      .replace(/:\s*'([^']*)'/g, ': "$1"');       // 单引号值转双引号
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error('JSON解析失败: ' + e.message + '\n原文前300字: ' + cleaned.slice(0, 300));
    }
  }
}

// ─── 延迟工具 ───
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 简单的并发限流器
 * 同一时刻最多允许 maxConcurrent 个请求
 */
class Semaphore {
  constructor(max) {
    this._max = max;
    this._current = 0;
    this._queue = [];
  }

  async acquire() {
    if (this._current < this._max) {
      this._current++;
      return;
    }
    // 排队等待
    return new Promise(resolve => {
      this._queue.push(resolve);
    });
  }

  release() {
    this._current--;
    if (this._queue.length > 0) {
      this._current++;
      const next = this._queue.shift();
      next();
    }
  }
}

/**
 * LLMClient 主类
 *
 * @param {Object} apiConfig - { apiKey, baseUrl, model }
 * @param {Object} options
 * @param {number} options.maxRetries - 最大重试次数，默认 3
 * @param {number} options.retryDelay - 重试间隔（ms），默认 1000，指数退避
 * @param {number} options.maxConcurrent - 最大并发数，默认 5
 * @param {number} options.timeout - 单次请求超时（ms），默认 120000
 */
export class LLMClient {
  constructor(apiConfig, options = {}) {
    this.apiConfig = apiConfig;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.timeout = options.timeout ?? 120000;
    this._semaphore = new Semaphore(options.maxConcurrent ?? 5);
  }

  /**
   * 更新 API 配置（如切换模型、key 等）
   */
  updateConfig(newConfig) {
    this.apiConfig = { ...this.apiConfig, ...newConfig };
  }

  /**
   * 底层 fetch 调用（带重试 + 限流 + 超时）
   * @private
   */
  async _fetch(systemPrompt, messages) {
    await this._semaphore.acquire();
    let released = false;
    const releaseSemaphore = () => {
      if (!released) {
        released = true;
        this._semaphore.release();
      }
    };

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt,
            messages,
            apiKey: this.apiConfig.apiKey,
            baseUrl: this.apiConfig.baseUrl,
            model: this.apiConfig.model,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errText = await res.text();
          // 429 或 5xx 可以重试，其他直接报错
          if (res.status === 429 || res.status >= 500) {
            throw new Error(`API错误 (${res.status}): ${errText}`);
          }
          releaseSemaphore();
          throw new Error(`API错误 (${res.status}): ${errText}`);
        }

        const data = await res.json();
        if (!data.text) {
          throw new Error('API返回内容为空');
        }

        releaseSemaphore();
        return data.text;
      } catch (e) {
        lastError = e;
        // 不可重试的错误直接抛出（检查具体HTTP状态码）
        if (e.message && e.message.includes('API错误') && !e.message.includes('429') && !/\b5\d{2}\b/.test(e.message)) {
          releaseSemaphore();
          throw e;
        }
        // 还有重试次数，等待后重试
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`[LLMClient] 第${attempt + 1}次重试，等待${delay}ms...`, e.message);
          await sleep(delay);
        }
      }
    }

    releaseSemaphore();
    throw new Error(`[LLMClient] ${this.maxRetries + 1}次调用均失败: ${lastError?.message}`);
  }

  /**
   * 普通文本调用
   * @param {string} systemPrompt - 系统提示词
   * @param {string} userPrompt - 用户提示词
   * @returns {Promise<string>} 返回文本
   */
  async call(systemPrompt, userPrompt) {
    return this._fetch(systemPrompt, [{ role: 'user', content: userPrompt }]);
  }

  /**
   * JSON 结构化调用（带容错解析）
   * @param {string} systemPrompt - 系统提示词
   * @param {string} userPrompt - 用户提示词
   * @returns {Promise<Object>} 返回解析后的 JSON 对象
   */
  async callJSON(systemPrompt, userPrompt) {
    const text = await this.call(systemPrompt, userPrompt);
    return parseJSON(text);
  }

  /**
   * SSE 流式调用
   * @param {string} systemPrompt - 系统提示词
   * @param {string} userPrompt - 用户提示词
   * @param {Function} onChunk - 每收到一段文本时的回调 (chunk: string) => void
   * @returns {Promise<string>} 最终完整文本
   */
  async callStream(systemPrompt, userPrompt, onChunk) {
    await this._semaphore.acquire();
    let released = false;
    const releaseSemaphore = () => {
      if (!released) {
        released = true;
        this._semaphore.release();
      }
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          apiKey: this.apiConfig.apiKey,
          baseUrl: this.apiConfig.baseUrl,
          model: this.apiConfig.model,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        releaseSemaphore();
        throw new Error(`API错误 (${res.status}): ${errText}`);
      }

      // 如果服务端不支持流式，降级为普通响应
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json();
        const text = data.text || '';
        if (onChunk) onChunk(text);
        releaseSemaphore();
        return text;
      }

      // SSE 流式读取
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 格式解析：以 "data: " 开头的行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最后一行可能不完整，留在 buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const chunk = parsed.delta?.text || parsed.text || parsed.content || '';
              if (chunk) {
                fullText += chunk;
                if (onChunk) onChunk(chunk);
              }
            } catch {
              // 非 JSON 的 data 行，直接作为文本处理
              if (payload && payload !== '[DONE]') {
                fullText += payload;
                if (onChunk) onChunk(payload);
              }
            }
          }
        }
      }

      releaseSemaphore();
      return fullText;
    } catch (e) {
      releaseSemaphore();
      throw new Error(`[LLMClient] 流式调用失败: ${e?.message}`);
    }
  }
}
