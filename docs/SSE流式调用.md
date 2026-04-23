## 什么是流式传输

当你问 ChatGPT、Kimi、DeepSeek 一个问题时，你会发现回答是**一个字一个字蹦出来的**，而不是等了很久之后一次性显示全部内容。这就是流式传输。

流式传输的好处很明显：

- 用户**不需要等待**完整回答生成完毕，立刻就能看到内容
- 体感上**响应更快**，用户知道"AI 正在思考"
- 如果回答很长，不用盯着空白屏幕等

## SSE vs WebSocket vs 轮询

实现"服务器向浏览器实时发送数据"，常见的方案有三种：

### 轮询（Polling）

浏览器每隔一段时间（比如 1 秒）发一个请求问服务器："有新数据吗？"

缺点：大部分请求都是无效的，浪费资源；实时性差。

### WebSocket

建立一条全双工的持久连接，双方可以随时互相发消息。

缺点：比较重，需要额外的协议升级；对于"服务器单向推送"的场景有点杀鸡用牛刀。

### SSE（Server-Sent Events）

服务器通过 HTTP 连接向浏览器**单向推送**数据。浏览器建立连接后，服务器可以持续发送事件，浏览器通过监听事件来接收数据。

优点：

- 基于标准 HTTP，不需要额外协议
- 浏览器原生支持 `EventSource` API
- 自动重连（连接断开后浏览器会自动尝试重连）
- 轻量，适合"服务器向客户端单向推数据"的场景

本项目用的是 SSE，因为 AI 对话正是"服务器单向推送"的场景——用户发一个问题，服务器持续把 AI 生成的文字推回来。

## SSE 协议格式

SSE 本质上就是一个特殊的 HTTP 响应，`Content-Type` 为 `text/event-stream`。服务器端发送的每条消息遵循这样的格式：

```
event: message
data: {"data": "你好"}

event: message
data: {"data": "，我是"}

event: message
data: {"data": "AI 助手"}

```

规则很简单：

- 每条事件由若干 `字段: 值` 的行组成
- `event:` 指定事件类型（不写则默认为 `message`）
- `data:` 是事件携带的数据
- 事件之间用**空行**（`\n\n`）分隔

浏览器端的 `EventSource` 会自动按这个格式解析，不需要手动切分。

## 浏览器原生 EventSource

浏览器提供了原生的 `EventSource` API 来接收 SSE 数据：

```javascript
const source = new EventSource("/api/ai/run?question=你好");

source.onmessage = (e) => {
  console.log(e.data); // 收到服务器推送的数据
};

source.onerror = () => {
  source.close(); // 出错或流结束时关闭连接
};
```

用起来很简单，但它有一个限制：**不支持自定义请求头**。

原生的 `EventSource` 只能发 GET 请求，不能设置自定义 Header。但我们的后端鉴权中间件要求请求中带上 `Token`。

## 解决方案：Cookie 传递 Token

来看一下后端的鉴权中间件是怎么读取 Token 的：

```go
// 后端中间件（middleware/useraccessmiddleware.go）
func UserAccessMiddleware(sctx *servicecontext.ServiceContext) gin.HandlerFunc {
    return func(ctx *gin.Context) {
        // 同时检查 Header 和 Cookie
        tokenHeader := ctx.GetHeader("Token")
        tokenCookie, _ := ctx.Cookie("Token")

        // 都不存在，才返回 401
        if tokenHeader == "" && tokenCookie == "" {
            ctx.JSON(401, ...)
            ctx.Abort()
            return
        }

        // 取一个有值的
        if tokenHeader == "" {
            token = tokenCookie
        } else {
            token = tokenHeader
        }
        // ... 解析 Token
    }
}
```

关键点：中间件**同时从 Header 和 Cookie 中读取 Token**。所以我们可以通过 Cookie 传递 Token，`EventSource` 请求会自动携带同源 Cookie。

前端在建立 SSE 连接前设置临时 Cookie：

```typescript
// 将 Token 写入 Cookie，EventSource 请求会自动携带
document.cookie = `Token=${GET_TOKEN()}; path=/api; SameSite=Strict`;

// 建立连接，浏览器会自动带上 Cookie
const eventSource = new EventSource(url);
```

这样既用上了原生 `EventSource`，又满足了后端的鉴权需求。当 SSE 流结束后，清除临时 Cookie：

```typescript
document.cookie = "Token=; path=/api; expires=Thu, 01 Jan 1970 00:00:00 GMT";
```

## 实现：AI 对话页面

### 发送消息与建立 SSE 连接

```typescript
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return;

  const userMessage = inputMessage.value.trim();

  // 1. 把用户消息添加到消息列表
  messages.value.push({
    role: "user",
    content: userMessage,
    time: getFormattedTime(),
  });
  inputMessage.value = "";
  isLoading.value = true;

  // 2. 先添加一条空的 AI 消息占位
  messages.value.push({
    role: "assistant",
    content: "",
    time: getFormattedTime(),
  });
  const id = messages.value.length - 1;

  // 3. 通过 Cookie 传递 Token（后端中间件同时支持 Header 和 Cookie）
  document.cookie = `Token=${GET_TOKEN()}; path=/api; SameSite=Strict`;

  // 4. 建立原生 EventSource 连接
  const eventSource = new EventSource(
    import.meta.env.VITE_APP_BASE_API +
      "/ai/run?question=" +
      encodeURIComponent(userMessage),
  );

  // 5. 监听消息：每收到一段文字，追加到 AI 消息中
  eventSource.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      if (parsed.data) {
        messages.value[id].content += parsed.data;
      }
    } catch {
      messages.value[id].content += e.data;
    }
  };

  // 6. 监听结束或错误：关闭连接，清除 Cookie
  eventSource.onerror = () => {
    eventSource.close();
    isLoading.value = false;
    document.cookie =
      "Token=; path=/api; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  };
};
```

逐步解读：

**步骤 2**：先添加一条空的 AI 消息占位，后面每收到一段文字就往这条消息里追加内容。这样页面上就能看到 AI 回答"一点一点变长"的效果。

**步骤 3**：设置 Cookie。`path=/api` 确保 Cookie 只在 `/api` 路径下发送，`SameSite=Strict` 防止跨站请求携带。

**步骤 4**：`encodeURIComponent` 把中文和特殊字符编码，防止 URL 出错。

**步骤 5**：后端每生成一段文字，就通过 SSE 推送一个 `message` 事件，数据格式是 `{"data": "一小段文字"}`。我们解析出来追加到消息内容中。

**步骤 6**：`onerror` 在连接异常**和**服务端正常关闭连接时都会触发。这里统一关闭连接、停止 loading、清除 Cookie。

### 为什么不用 finally 来关闭 loading

这是一个容易犯错的地方。看这段有问题的代码：

```typescript
// 错误写法
try {
  const eventSource = new EventSource(url);
  eventSource.onmessage = (e) => {
    messages.value[id].content += e.data;
  };
} finally {
  isLoading.value = false; // 这行会立刻执行！
}
```

`finally` 块会在 try 里的**同步代码执行完后立即执行**。但 SSE 是异步的——建立连接后，`try` 块就执行完了，数据还在慢慢传输中。如果在 `finally` 里关掉 loading，loading 动画会在数据还没到达时就消失了。

正确的做法是在 `onerror` 回调中关闭 loading，因为那是 SSE 流真正结束的时机。

### 关闭 SSE 连接

当用户离开对话页面时（比如切换路由），需要关闭 SSE 连接，否则会造成内存泄漏：

```typescript
import { onUnmounted } from "vue";

// 组件级变量，保存当前 EventSource 引用
let currentEventSource: EventSource | null = null;

// sendMessage 中赋值
currentEventSource = eventSource;

// 组件卸载时关闭
onUnmounted(() => {
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
});
```

`onUnmounted` 是 Vue 的生命周期钩子，在组件被销毁时自动执行。

## Vite 代理对 SSE 的特殊处理

SSE 流式传输要求服务器推送的数据**不被中间层缓冲**。我们的 Vite 开发代理默认可能会压缩或缓冲响应，导致前端收不到流式数据。

因此在 `vite.config.ts` 中，代理配置需要额外处理 SSE 响应：

```typescript
server: {
  proxy: {
    "/api": {
      target: "http://127.0.0.1:8080",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ""),
      // SSE 流式响应的特殊处理
      configure: (proxy) => {
        proxy.on("proxyRes", (proxyRes) => {
          if (proxyRes.headers["content-type"] === "text/event-stream") {
            // 删除压缩编码，防止代理尝试解压导致缓冲
            delete proxyRes.headers["content-encoding"];
            // 禁止缓存
            proxyRes.headers["cache-control"] = "no-cache";
            // 禁止 Nginx 等反向代理缓冲（生产环境有用）
            proxyRes.headers["x-accel-buffering"] = "no";
          }
        });
      },
    },
  },
},
```

三个关键操作：

1. **删除 `content-encoding`**：代理可能会尝试解压响应，解压过程会缓冲数据
2. **设置 `cache-control: no-cache`**：防止响应被缓存
3. **设置 `x-accel-buffering: no`**：告诉 Nginx 等反向代理不要缓冲此响应

## 后端是如何推送 SSE 的

配合后端代码看一下完整链路（Go/Gin）：

```go
// 设置 SSE 必需的响应头
ctx.Header("Content-Type", "text/event-stream")
ctx.Header("Cache-Control", "no-cache")
ctx.Header("Connection", "keep-alive")

// 调用 AI API，每收到一段文字就推送给前端
client.ChatStream(model, messages, func(s string) {
    message := map[string]string{"data": s}
    messageJSON, _ := json.Marshal(message)
    ctx.SSEvent("message", string(messageJSON))
    ctx.Writer.Flush()  // 立刻发送，不缓冲
})
```

`ctx.Writer.Flush()` 很关键——它确保每生成一段文字就**立刻发送**给前端，而不是等到整个回答生成完。

## 完整数据流

```
用户输入问题
    ↓
前端设置 Cookie（Token） → 建立 EventSource 连接 → GET /api/ai/run?question=xxx
    ↓
Vite 代理转发（禁用压缩/缓冲）→ http://127.0.0.1:8080/ai/run?question=xxx
    ↓
Gin 中间件从 Cookie 中读取 Token 并验证
    ↓
路由处理函数调用 AI API
    ↓
AI 每生成一段文字 → 后端通过 SSE 推送 event: message\ndata: {"data": "xxx"}\n\n
    ↓
前端 onmessage 触发 → 追加到消息列表 → 页面实时更新
    ↓
AI 回答完毕 → SSE 连接关闭 → onerror 触发 → loading 关闭 → Cookie 清除
```

## 替代方案：sse.js（基于 XHR）

### 为什么了解 sse.js 也有价值

在实际开发中，你可能会遇到后端**只支持 Header 传递 Token**（不支持 Cookie）的情况。这时原生 `EventSource` 就不能用了，需要一种**支持自定义 Header** 的 SSE 客户端。

[sse.js](https://github.com/mpetazzoni/sse.js) 就是这样一个方案。它基于 `XMLHttpRequest` 实现，支持自定义 Header：

```typescript
import { SSE } from "./sse.js";

const source = new SSE(url, {
  headers: { Token: getToken() },
});

source.addEventListener("message", function (e) {
  messages.value[id].content += JSON.parse(e.data).data;
});

source.addEventListener("readystatechange", function (e) {
  if (e.readyState === 2) {
    // CLOSED
    isLoading.value = false;
  }
});
```

### sse.js 的问题：Safari 兼容性

sse.js 依赖 XHR 的 `progress` 事件来接收流式数据。但 Safari 对 XHR 的 `progress` 事件行为与 Chrome 不同——Safari 会**缓冲整个响应**，直到请求完成才触发一次 progress，无法实现逐字输出。

这就是本项目最终选择原生 `EventSource` + Cookie 的原因。

### 两种方案对比

|               | 原生 EventSource + Cookie     | sse.js (XHR)                   |
| ------------- | ----------------------------- | ------------------------------ |
| 自定义 Header | 不支持，通过 Cookie 绕过      | 支持                           |
| 浏览器兼容性  | 所有现代浏览器                | Chrome 正常，Safari 有缓冲问题 |
| 代码复杂度    | 简单，浏览器原生 API          | 需要引入第三方库               |
| 自动重连      | 内置                          | 不支持                         |
| 适用场景      | 后端同时支持 Header 和 Cookie | 后端只支持 Header              |

本项目代码中保留了 sse.js 方案作为注释，可以切换对比效果（详见代码中的标记）。

---
