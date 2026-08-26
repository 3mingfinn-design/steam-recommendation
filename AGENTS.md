# AGENTS.md

## 项目技术栈

- Next.js（App Router）
- TypeScript
- Tailwind CSS
- npm

暂不引入数据库、用户登录或复杂状态管理。

## 项目目录规范

- `app/`：路由、页面、布局和全局样式
- `components/`：可复用的 React UI 组件
- `lib/`：工具函数、类型和业务辅助逻辑
- `public/`：静态资源
- `data/`：Steam 全量目录、本地推荐索引和增量同步状态
- `scripts/`：可重复运行的数据同步脚本

新增功能优先保持页面编排与可复用组件分离；环境变量示例写入 `.env.example`，本地秘密配置只放在 `.env.local`。

## 开发命令

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
npm run sync:steam
npm run backup -- "说明本次修改"
```

## 修改代码后的检查流程

1. 先运行 `npm run lint`，修复 ESLint 报告的问题。
2. 再运行 `npm run build`，确认生产构建成功。
3. 涉及页面交互时运行 `npm run dev`，在浏览器检查页面和控制台。
4. 提交前确认没有把 `.env.local` 或其他秘密配置加入 Git。
5. 完成一组修改后创建一次 Git 备份提交，方便使用 `git revert HEAD` 撤销。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
