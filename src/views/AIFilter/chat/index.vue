<template>
  <div class="chat-container">
    <!-- Chat messages area -->
    <div class="chat-messages" ref="messagesContainer">
      <el-scrollbar height="calc(100vh - 130px)" always>
        <div v-if="messages.length === 0" class="empty-state">
          <div class="empty-content">
            <el-icon class="empty-icon">
              <ChatDotRound />
            </el-icon>
            <h2>开始一段新的对话</h2>
            <p>AI 助手可以回答问题、提供信息或帮助完成任务</p>
            <el-button type="primary" @click="focusInput" class="start-button"
              >开始对话</el-button
            >
          </div>
        </div>

        <template v-else>
          <div class="messages-list">
            <div
              v-for="(message, index) in messages"
              :key="index"
              :class="['message-wrapper', message.role]"
            >
              <!-- AI Message -->
              <div v-if="message.role === 'assistant'" class="message-item">
                <div class="message-avatar">
                  <el-avatar :size="36" :icon="Service" class="ai-avatar" />
                </div>
                <div class="message-bubble">
                  <div class="message-content">
                    <div
                      class="message-text"
                      v-html="formatMessage(message.content)"
                    ></div>
                    <div class="message-time">{{ message.time }}</div>
                  </div>
                </div>
              </div>

              <!-- User Message -->
              <div v-else class="message-item">
                <div class="message-bubble">
                  <div class="message-content">
                    <div
                      class="message-text"
                      v-html="formatMessage(message.content)"
                    ></div>
                    <div class="message-time">{{ message.time }}</div>
                  </div>
                </div>
                <div class="message-avatar">
                  <el-avatar :size="36" :icon="User" class="user-avatar" />
                </div>
              </div>
            </div>

            <!-- Typing indicator when loading -->
            <div v-if="isLoading" class="message-wrapper assistant">
              <div class="message-item">
                <div class="message-avatar">
                  <el-avatar :size="36" :icon="Service" class="ai-avatar" />
                </div>
                <div class="message-bubble typing-bubble">
                  <div class="typing-indicator">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </el-scrollbar>
    </div>

    <!-- Chat input area - fixed at bottom -->
    <div
      class="chat-input-container"
      :class="{ fold: layoutSettingStore.fold ? true : false }"
    >
      <div class="chat-input">
        <el-input
          v-model="inputMessage"
          type="text"
          :rows="1"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="发送消息给 AI Assistant..."
          @keyup.enter.prevent="handleEnterKey"
          ref="inputField"
        >
          <template #append>
            <el-button
              type="primary"
              :icon="isLoading ? Loading : Position"
              :disabled="!inputMessage.trim() || isLoading"
              @click="sendMessage"
              class="send-button"
            />
          </template>
        </el-input>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  ChatDotRound,
  User,
  Service,
  Position,
  Loading,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
//获取layout小仓库
import useLayoutStore from "@/store/modules/setting";
import { GET_TOKEN } from "@/utils/tokens.ts";

// ===== 切换 SSE 方案时，取消下面这行的注释（同时注释掉 EventSource 方案的代码）=====
// import { SSE } from './sse.js';

const layoutSettingStore = useLayoutStore();

// Configure marked with highlight.js for code syntax highlighting
const renderer = new marked.Renderer();

// 设置 marked 的选项
marked.setOptions({
  renderer: renderer,
  breaks: true, // 将换行符转换为 <br>
});

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
}

const messages = ref<Message[]>([]);
const inputMessage = ref("");
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);
const inputField = ref<HTMLElement | null>(null);
// 使用原生 EventSource 管理 SSE 连接，用于在组件卸载时关闭连接
let currentEventSource: EventSource | null = null;
// ===== 切换 SSE 方案时，取消下面这行的注释，注释掉上面那行 =====
// let currentSource: any = null;

// Format message with markdown
const formatMessage = (content: string): string => {
  const html = marked.parse(content) as string;
  return DOMPurify.sanitize(html);
};

// Get formatted time
const getFormattedTime = (): string => {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Handle Enter key (send on Enter, new line on Shift+Enter)
const handleEnterKey = (e: KeyboardEvent) => {
  if (!e.shiftKey && inputMessage.value.trim()) {
    sendMessage();
  }
};

// Focus the input field
const focusInput = () => {
  if (inputField.value) {
    const input = inputField.value as any;
    if (input.focus) {
      input.focus();
    } else if (input.$el && input.$el.querySelector("textarea")) {
      input.$el.querySelector("textarea").focus();
    }
  }
};

// Scroll to bottom of messages
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    const scrollbar = messagesContainer.value.querySelector(
      ".el-scrollbar__wrap",
    );
    if (scrollbar) {
      scrollbar.scrollTop = scrollbar.scrollHeight;
    }
  }
};

// Watch for changes in messages to scroll to bottom
watch(
  messages,
  () => {
    scrollToBottom();
  },
  { deep: true },
);

// 发送消息并获取 AI 流式响应
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return;

  // 添加用户消息
  const userMessage = inputMessage.value.trim();
  messages.value.push({
    role: "user",
    content: userMessage,
    time: getFormattedTime(),
  });

  // 清空输入框
  inputMessage.value = "";

  await scrollToBottom();

  // 设置加载状态
  isLoading.value = true;

  try {
    // 先添加一条空的 AI 消息占位，后续逐步追加内容
    messages.value.push({
      role: "assistant",
      content: "",
      time: getFormattedTime(),
    });
    const id = messages.value.length - 1;

    // 使用原生 EventSource 替代 fetch + ReadableStream
    // 原因：Safari 的 fetch ReadableStream 会缓冲整个响应，
    // 无法实现逐字流式输出；EventSource 是浏览器原生 SSE API，
    // Chrome 和 Safari 均支持且能正确流式接收数据
    //
    // EventSource 不支持自定义 Header，而后端中间件同时支持
    // 从 Header 和 Cookie 中读取 Token，因此通过临时 Cookie 传递认证信息
    document.cookie = `Token=${GET_TOKEN()}; path=/api; SameSite=Strict`;

    const url =
      import.meta.env.VITE_APP_BASE_API +
      "/ai/run?question=" +
      encodeURIComponent(userMessage);

    const eventSource = new EventSource(url);
    currentEventSource = eventSource;

    // 后端发送的事件格式为 SSE，event type 为 "message"
    // EventSource 的 onmessage 会自动处理 event: message 类型的事件
    eventSource.onmessage = (e) => {
      try {
        // 后端返回格式：{"data": "文本片段"}
        const parsed = JSON.parse(e.data);
        if (parsed.data) {
          messages.value[id].content += parsed.data;
        }
      } catch {
        // JSON 解析失败时作为纯文本追加
        messages.value[id].content += e.data;
      }
    };

    // EventSource 在服务端正常关闭连接时也会触发 error 事件
    // 这里统一关闭连接、停止加载状态
    eventSource.onerror = () => {
      eventSource.close();
      currentEventSource = null;
      isLoading.value = false;
      // 清除临时 Cookie
      document.cookie =
        "Token=; path=/api; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    };
  } catch (error) {
    console.error("Error getting AI response:", error);
    ElMessage.error("获取 AI 响应时出错");
    // 如果 AI 消息内容为空，直接填充错误提示，避免出现空白气泡
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content) {
      lastMsg.content = "抱歉，处理您的请求时遇到了错误。";
    } else {
      messages.value.push({
        role: "assistant",
        content: "抱歉，处理您的请求时遇到了错误。",
        time: getFormattedTime(),
      });
    }
    isLoading.value = false;
  }
};

onMounted(() => {
  focusInput();
});

// EventSource 方案的 onUnmounted
onUnmounted(() => {
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
});

// ====================================================================
// ===== sse.js 方案（XHR）：注释掉上面的 sendMessage 和 onUnmounted， =====
// ===== 取消注释下面的代码，即可切换到 sse.js 方案                    =====
// ====================================================================

// // sse.js 方案的 sendMessage
// const sendMessage = async () => {
//   if (!inputMessage.value.trim() || isLoading.value) return;
//
//   const userMessage = inputMessage.value.trim();
//   messages.value.push({
//     role: "user",
//     content: userMessage,
//     time: getFormattedTime(),
//   });
//   inputMessage.value = "";
//   await scrollToBottom();
//   isLoading.value = true;
//
//   try {
//     let aiResponse = "";
//     messages.value.push({
//       role: "assistant",
//       content: aiResponse,
//       time: getFormattedTime(),
//     });
//     let id = messages.value.length - 1;
//
//     // sse.js 基于 XMLHttpRequest，支持自定义 Header
//     // 但在 Safari 等浏览器中，XHR 的 progress 事件不会对流式响应触发
//     currentSource = new SSE(
//       import.meta.env.VITE_APP_BASE_API +
//         "/ai/run?question=" +
//         encodeURIComponent(userMessage),
//       {
//         headers: {
//           Token: GET_TOKEN(),
//         },
//       },
//     );
//     currentSource.addEventListener("message", function (e: any) {
//       try {
//         messages.value[id].content += JSON.parse(e.data).data;
//       } catch {
//         messages.value[id].content += e.data;
//       }
//     });
//     currentSource.addEventListener("readystatechange", function (e: any) {
//       if (e.readyState === 2) {
//         isLoading.value = false;
//       }
//     });
//
//     await scrollToBottom();
//   } catch (error) {
//     console.error("Error getting AI response:", error);
//     ElMessage.error("获取 AI 响应时出错");
//     messages.value.push({
//       role: "assistant",
//       content: "抱歉，处理您的请求时遇到了错误。",
//       time: getFormattedTime(),
//     });
//     isLoading.value = false;
//   }
// };
//
// // sse.js 方案的 onUnmounted
// onUnmounted(() => {
//   if (currentSource) {
//     currentSource.close();
//     currentSource = null;
//   }
// });
</script>

<style lang="less">
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px); // Adjust based on your top navbar height
  background-color: #f9fafb;
  position: relative;

  .chat-messages {
    flex: 1;
    overflow: hidden;
    padding: 0;
    margin-bottom: 70px; // Space for fixed input

    .empty-state {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      padding: 20px;

      .empty-content {
        text-align: center;
        max-width: 400px;

        .empty-icon {
          font-size: 48px;
          color: #67c23a;
          background-color: rgba(103, 194, 58, 0.1);
          padding: 16px;
          border-radius: 50%;
          margin: 0 auto 20px;
        }

        h2 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #303133;
        }

        p {
          color: #606266;
          margin-bottom: 24px;
        }

        .start-button {
          padding: 12px 24px;
          font-size: 16px;
        }
      }
    }

    .messages-list {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .message-wrapper {
      display: flex;

      &.user {
        justify-content: flex-end;

        .message-item {
          .message-bubble {
            background-color: #e9d8fd; // Light purple like in the image
            color: #4a5568;
            border-radius: 16px 16px 0 16px;
            margin-right: 12px;

            pre {
              background-color: rgba(0, 0, 0, 0.1);
            }

            code {
              background-color: rgba(0, 0, 0, 0.1);
            }

            .message-time {
              color: rgba(74, 85, 104, 0.7);
              text-align: right;
              margin-top: -15px;
            }
          }

          .user-avatar {
            background-color: #805ad5;
            color: white;
          }
        }
      }

      &.assistant {
        justify-content: flex-start;

        .message-item {
          .message-bubble {
            background-color: white;
            border-radius: 16px 16px 16px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            margin-left: 12px;
          }
        }

        .ai-avatar {
          background-color: #805ad5; // Purple to match the theme
          color: white;
        }
      }
    }

    .message-item {
      display: flex;
      align-items: flex-start;
      max-width: 85%;

      .message-avatar {
        flex-shrink: 0;
      }

      .message-bubble {
        padding: 12px 16px;

        .message-content {
          .message-text {
            line-height: 1.6;
            font-size: 14px;
            word-break: break-word;

            p {
              margin: 8px 0;

              &:first-child {
                margin-top: 0;
              }

              &:last-child {
                margin-bottom: 0;
              }
            }

            // 标题
            h1,
            h2,
            h3,
            h4,
            h5,
            h6 {
              margin: 16px 0 8px;
              font-weight: 600;
              &:first-child {
                margin-top: 0;
              }
            }
            h1 {
              font-size: 1.4em;
            }
            h2 {
              font-size: 1.25em;
            }
            h3 {
              font-size: 1.1em;
            }

            // 列表
            ul,
            ol {
              padding-left: 20px;
              margin: 8px 0;
            }
            li {
              margin: 4px 0;
            }

            // 引用
            blockquote {
              border-left: 3px solid #805ad5;
              padding: 4px 12px;
              margin: 8px 0;
              color: #666;
              background-color: #f8f7ff;
              border-radius: 0 4px 4px 0;
            }

            // 分割线
            hr {
              border: none;
              border-top: 1px solid #e0e0e0;
              margin: 12px 0;
            }

            // 表格
            table {
              border-collapse: collapse;
              margin: 8px 0;
              font-size: 13px;
            }
            th,
            td {
              border: 1px solid #dcdfe6;
              padding: 6px 10px;
            }
            th {
              background-color: #f5f7fa;
              font-weight: 600;
            }

            // 行内代码
            code {
              font-family: Consolas, Monaco, "Andale Mono", monospace;
              background-color: #f5f7fa;
              padding: 2px 5px;
              border-radius: 3px;
              font-size: 13px;
              color: #c7254e;
            }

            // 代码块
            pre {
              background-color: #1e1e2e;
              color: #cdd6f4;
              padding: 12px 14px;
              border-radius: 6px;
              overflow-x: auto;
              margin: 10px 0;

              code {
                background-color: transparent;
                padding: 0;
                color: inherit;
                font-size: 13px;
              }
            }

            // 加粗和斜体
            strong {
              font-weight: 600;
            }
            em {
              font-style: italic;
            }
          }

          .message-time {
            font-size: 11px;
            color: #a0aec0;
            margin-top: 4px;
            opacity: 0.7;
          }
        }
      }

      .typing-bubble {
        padding: 12px 16px;
        min-width: 60px;

        .typing-indicator {
          display: flex;
          align-items: center;
          justify-content: center;

          .dot {
            width: 8px;
            height: 8px;
            background-color: #805ad5;
            border-radius: 50%;
            margin: 0 3px;
            animation: bounce 1.4s infinite ease-in-out;

            &:nth-child(1) {
              animation-delay: 0s;
            }

            &:nth-child(2) {
              animation-delay: 0.2s;
            }

            &:nth-child(3) {
              animation-delay: 0.4s;
            }
          }
        }
      }
    }
  }

  .chat-input-container {
    position: fixed;
    width: calc(100% - @menu-width);
    bottom: 0;
    left: @menu-width;
    background-color: #ffffff;
    border-top: 1px solid #ebeef5;
    z-index: 999;
    padding: 16px 20px;
    transition: all 0.2s ease-in-out;

    &.fold {
      width: calc(100% - @menu-fold-width);
      left: @menu-fold-width;
    }

    .chat-input {
      max-width: calc(100% - 40px);
      margin: 0 auto;

      .el-textarea {
        .el-input__wrapper {
          padding-right: 0;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          transition: box-shadow 0.3s;

          &:hover,
          &:focus-within {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          }
        }

        .el-input-group__append {
          padding: 0;
        }

        textarea {
          padding: 12px;
          font-size: 14px;
        }
      }

      .send-button {
        height: 100%;
        border-radius: 0 8px 8px 0;
        width: 50px;

        &:not(:disabled) {
          background-color: #805ad5; // Purple to match the theme
          border-color: #805ad5;

          &:hover {
            background-color: #6b46c1;
            border-color: #6b46c1;
          }
        }
      }
    }
  }
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
  }

  40% {
    transform: translateY(-6px);
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .chat-container {
    .chat-messages {
      .message-item {
        max-width: 95%;
      }
    }

    .chat-input-container {
      left: 0;
      padding: 12px;
    }
  }
}
</style>
