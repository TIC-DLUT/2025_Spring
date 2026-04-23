## 为什么要渲染 Markdown

AI 的回答经常包含代码块、列表、加粗等格式。如果直接显示纯文本：

````
你可以用以下代码实现：\n```python\nprint("hello")\n```
````

用户看到的就是一堆符号，完全不可读。

用 Markdown 渲染后：

你可以用以下代码实现：

```python
print("hello")
```

清晰多了。所以我们需要把 AI 返回的 Markdown 文本转换成 HTML，然后显示在页面上。

## marked.js

[marked](https://marked.js.org/) 是一个轻量级的 Markdown 解析库，把 Markdown 文本转换成 HTML 字符串：

```typescript
import { marked } from "marked";

const html = marked.parse("# Hello **World**");
// <h1>Hello <strong>World</strong></h1>
```

本项目中的配置：

```typescript
const renderer = new marked.Renderer();

marked.setOptions({
  renderer: renderer,
  breaks: true, // 换行符转换为 <br>
});
```

`breaks: true` 意味着文本中的一个换行就会变成 `<br>`，不需要空两行才换行。这对于 AI 回答的显示很重要，因为 AI 的回答经常有单行换行。

## v-html 与 XSS 风险

渲染 Markdown 得到了 HTML 字符串，怎么显示到页面上？

Vue 中用 `v-html` 指令：

```vue
<div v-html="htmlString"></div>
```

但 `v-html` 有一个严重的安全风险：**XSS（跨站脚本攻击）**。

如果 AI 返回的内容（或者被恶意注入的内容）包含这样的文本：

```markdown
<img src="x" onerror="alert(document.cookie)">
```

marked 会把它转成 HTML，`v-html` 会直接执行其中的 JavaScript！用户的 Cookie、Token 就被偷走了。

> 记住一条铁律：**永远不要直接渲染用户输入或外部数据的 HTML**。

## DOMPurify

[DOMPurify](https://github.com/cure53/DOMPurify) 是一个 HTML 净化库，它会过滤掉 HTML 中所有危险的标签和属性，只保留安全的内容。

```typescript
import DOMPurify from "dompurify";

const dirty = '<img src="x" onerror="alert(1)"><p>安全的文本</p>';
const clean = DOMPurify.sanitize(dirty);
// <p>安全的文本</p>  ← 危险的 img 被移除了
```

## 本项目的渲染流程

```typescript
const formatMessage = (content: string): string => {
  const html = marked.parse(content) as string; // Markdown → HTML
  return DOMPurify.sanitize(html); // HTML → 安全的 HTML
};
```

在模板中使用：

```vue
<div class="message-text" v-html="formatMessage(message.content)"></div>
```

两步：先解析 Markdown 为 HTML，再用 DOMPurify 过滤危险内容。

## 样式处理

渲染出的 HTML 是没有样式的——`<code>` 不会自动有代码框样式，`<pre>` 不会自动有背景色。所以我们需要自己写 CSS：

```css
.message-text {
  line-height: 1.6;
  font-size: 14px;
  word-break: break-word;

  // 段落
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
  h1, h2, h3 {
    margin: 16px 0 8px;
    font-weight: 600;
  }

  // 列表
  ul, ol {
    padding-left: 20px;
    margin: 8px 0;
  }
  li {
    margin: 4px 0;
  }

  // 引用块
  blockquote {
    border-left: 3px solid #805ad5;
    padding: 4px 12px;
    margin: 8px 0;
    color: #666;
    background-color: #f8f7ff;
    border-radius: 0 4px 4px 0;
  }

  // 表格
  table {
    border-collapse: collapse;
    margin: 8px 0;
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
    font-family: Consolas, Monaco, monospace;
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
    }
  }
}
```

几个设计要点：

- **段落**：`margin: 8px 0` 让段落间有呼吸感，首尾段落去掉多余 margin
- **引用**：左侧紫色边线 + 浅紫背景，和项目主题色呼应
- **行内代码**：红色文字 `#c7254e` + 浅灰背景，和代码块区分开
- **代码块**：深色背景 `#1e1e2e`（Catppuccin 风格），圆角 6px 比 4px 更现代
- **表格**：浅灰表头 + 细边框，简洁不突兀

> 提示：项目中已经安装了 `highlight.js` 依赖。如果你想让代码块有语法高亮（不同关键字显示不同颜色），可以在 marked 的 renderer 中集成 highlight.js。作为入门项目，当前的纯色代码块已经够用了。

## 总结

Markdown 渲染的三板斧：

1. **marked**：Markdown → HTML
2. **DOMPurify**：过滤 XSS
3. **CSS**：让渲染出来的 HTML 好看

其中 DOMPurify 是**必须的**，不能省略。不管你多信任数据来源，永远不要假设外部数据是安全的。

---

[回到主页](./README.md)
