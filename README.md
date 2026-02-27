# 动漫花园RSS订阅工具 - 桌面版 (Anime Garden RSS Desktop)

[![Release](https://img.shields.io/github/v/release/juju-w/anime_garden_sub_desktop?style=flat-square)](https://github.com/juju-w/anime_garden_sub_desktop/releases)
[![License](https://img.shields.io/github/license/juju-w/anime_garden_sub_desktop?style=flat-square)](LICENSE)

基于 **Tauri (Rust + React)** 构建的跨平台桌面动漫 RSS 订阅与自动下载工具。它是 [Anime Garden Sub NAS版](https://github.com/juju-w/nas_anime_garden_sub) 的原生桌面实现，旨在为普通电脑用户提供极致流畅的追番体验。

## 核心特性

- **⚡ Rust 高性能内核**：使用 Rust 编写的 RSS 抓取与解析引擎，速度极快且内存占用极低。
- **🚀 跨平台原生体验**：支持 macOS (Intel/ARM), Windows, Linux。
- **🔍 智能关键字过滤**：支持多关键字匹配（如：`简繁内封`, `1080P`），精准筛选资源。
- **📥 灵活同步模式**：
  - **Archive (补完模式)**：下载当前订阅源中所有符合条件的集数。
  - **Monitor (追踪模式)**：仅记录当前状态，仅下载未来发布的新集数。
- **🔗 外部下载器支持**：原生对接 Aria2 RPC，并支持一键批量复制磁力链给迅雷、极空间等。
- **🌍 多语言持久化**：支持中、英、日三语，自动记忆用户语言偏好。
- **💾 本地数据安全**：使用 SQLite 进行本地数据持久化，数据不经云端，私密安全。

## 界面预览

> 请在 `docs/images/` 目录下查看截图。

- **Dashboard**: 直观管理订阅任务。
- **History**: 紧凑的下载历史，支持一键复制。
- **Settings**: 轻松配置下载器连接。

## 开发与构建

### 前提条件

- [Rust](https://www.rust-lang.org/learn/get-started#installing-rust) 环境 (Cargo)
- [Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/)
- 对应的平台编译工具 (Xcode, Visual Studio, etc.)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri dev
```

### 构建正式版

#### macOS (Apple Silicon)
```bash
pnpm tauri build --target aarch64-apple-darwin
```

#### Windows
```bash
pnpm tauri build
```

## 关联项目

- **NAS 版**: [nas_anime_garden_sub](https://github.com/juju-w/nas_anime_garden_sub) (适合 24 小时在线的服务器部署)

## 开源协议

MIT
