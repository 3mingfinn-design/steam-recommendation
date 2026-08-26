# Steam Recommendations

一个基于 Next.js、TypeScript 和 Tailwind CSS 的轻量级 Web 工具。

Steam 查询支持数字 Steam ID、自定义 ID（Vanity URL）和 Steam 个人主页 URL。

## 本地启动

```bash
npm install
npm run dev
```

打开 http://localhost:3000 查看应用。

开始使用分析功能前，请复制 `.env.example` 为 `.env.local`，并填入 Steam Web API Key：

```env
STEAM_API_KEY=your_steam_web_api_key
```

Steam 用户资料和游戏库需要设置为公开，才能被 Steam Web API 返回。

## 常用命令

- `npm run dev`：启动开发服务器
- `npm run lint`：运行 ESLint
- `npm run build`：创建生产构建
- `npm run start`：启动生产服务器
- `npm run sync:steam`：同步 Steam 全量 AppID，并分批刷新本地游戏索引
- `npm run backup`：将当前修改创建为一个 Git 备份提交

## 修改备份与撤销

每次完成一组修改后运行：

```bash
npm run backup -- "说明本次修改"
```

查看备份记录：

```bash
git log --oneline --all
```

撤销最近一次提交但保留工作区文件：

```bash
git revert HEAD
```

`.env.local` 已被 `.gitignore` 忽略，不会进入备份提交。

## Steam 商店索引

- `data/steam-apps.json`：Steam 全量游戏目录及 `last_modified`
- `data/steam-games.json`：已完成详情、类型和公开标签抓取的可推荐游戏
- `data/steam-sync-state.json`：记录目录同步时间和每个 AppID 的处理状态

每次运行 `npm run sync:steam` 会先通过 `IStoreService/GetAppList` 获取新增或变化的游戏，再处理一批详情。批量大小可以在 `.env.local` 中配置：

```env
STEAM_SYNC_DETAIL_LIMIT=100
```

推荐接口先用四维偏好从本地索引筛选最多 80 款，再精确评分并返回固定 15 款。`.github/workflows/sync-steam-index.yml` 会在配置 GitHub Secret `STEAM_API_KEY` 后每日自动刷新索引。
