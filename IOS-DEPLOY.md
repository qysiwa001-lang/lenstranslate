# 译镜 · 做成 iOS App 的完整指南

当前项目已完成 PWA 改造（App 图标、manifest、Service Worker 离线缓存）。
下面三条路线按成本从低到高排列。

---

## 路线 A：PWA（免费，约 10 分钟，推荐先用这个）

iPhone 上像原生 App 一样有图标、全屏运行、可用相机。不需要 Mac，不需要上架。

### 第 1 步：部署到 HTTPS（iPhone 相机强制要求 HTTPS）

任选一个免费托管：

**方案 1：GitHub Pages**
1. 注册 github.com 账号，新建仓库（如 `lenstranslate`）
2. 把本文件夹里的所有文件上传（网页端点 Add file → Upload files 拖入即可）
3. 仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save
4. 得到地址：`https://<你的用户名>.github.io/lenstranslate/`

**方案 2：Vercel / Cloudflare Pages**
1. 注册 vercel.com 或 pages.cloudflare.com
2. 选择"上传文件夹部署"，把整个 camera-translator 文件夹拖进去
3. 自动得到 `https://xxx.vercel.app` 这样的地址

### 第 2 步：iPhone 安装到主屏幕
1. iPhone 用 **Safari** 打开上面的地址（必须 Safari，微信内打开不支持添加）
2. 首次使用某语言会下载识别模型，建议在 WiFi 下进行，下载一次后永久缓存
3. 点底部「分享」按钮 → 下滑选「**添加到主屏幕**」
4. 桌面上出现"译镜"图标，点开即全屏 App，授权相机即可使用

> 局限：PWA 不进 App Store；iOS 上首次允许相机后体验与原生一致。

---

## 路线 B：Capacitor 套壳上架 App Store（需要 Mac）

把现有网页包成真正的 .ipa 安装包。**需要一台 Mac**（或云 Mac 如 macincloud.com），
上架 App Store 需要 Apple 开发者账号（$99/年，苹果官网开发者页面注册）。

在 Mac 上执行（需要已装 Node.js 和 Xcode）：

```bash
# 1. 把 camera-translator 文件夹拷到 Mac
# 2. 在该文件夹内执行：
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/camera
npx cap init "译镜" com.yourname.lenstranslate --web-dir .
npx cap add ios
npx cap sync
npx cap open ios   # 自动打开 Xcode
```

在 Xcode 里：
1. 左侧项目 → Signing & Capabilities → 选你的开发者账号 Team
2. Info.plist 添加两条权限说明（苹果强制）：
   - `NSCameraUsageDescription` →「用于拍摄需要翻译的文字」
   - `NSPhotoLibraryUsageDescription` →「用于从相册选择图片翻译」
3. 顶部选真机或模拟器 → 点运行按钮测试
4. Product → Archive → 上传到 App Store Connect → 提交审核

不上架的免费替代：用 Xcode 直接装到自己的 iPhone（免费 Apple ID 签名，
7 天有效期需重签），或用 TestFlight 邀请内测（需付费开发者账号）。

---

## 路线 C：原生 Swift 重写（最佳体验，工作量最大）

用 SwiftUI + 苹果自带 **Vision 框架**（VNRecognizeTextRequest）做 OCR：
- 识别速度比 Tesseract.js 快数倍，且离线
- 原生支持中/英/日/韩/法/意/德/西/葡/越/泰/阿拉伯等语言
- 翻译可接 Translation 框架（iOS 17+ 系统级离线翻译）或云翻译 API

适合后续真正产品化时考虑。当前 Web 版可以作为功能原型。

---

## 三条路线对比

| | PWA | Capacitor | 原生 Swift |
|---|---|---|---|
| 需要 Mac | 否 | 是 | 是 |
| 费用 | 0 | $99/年（上架才需要） | $99/年 |
| 相机/OCR | 浏览器 API + Tesseract.js | 原生插件增强 | Vision 框架（最快最准） |
| 分发 | 链接分享，添加到主屏幕 | App Store | App Store |
| 现有代码复用 | 100% | ~95% | 重写 |
