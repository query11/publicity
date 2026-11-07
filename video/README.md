# plus小店 · Plus 会员付款后充值流程视频

16:9 / 1920×1080 / 30fps / 49 秒，B 站横屏教程风格，只演示**付款之后**的操作：

| 时间 | 段落 | 画面 |
|---|---|---|
| 0:00 | 片头 | Plus 会员自助充值教程：复制卡密 → 填写信息 → 提交充值 |
| 0:04 | STEP 1 复制卡密 | 示意画面：付款成功、自动发货、复制卡密、使用说明 |
| 0:12 | STEP 2 填写卡密和账号凭证 | **真实页面**（chong.cccard.uk，演示数据）：粘贴 CDK 自动识别套餐 → 按指南获取 Session → 粘贴并校验账号 |
| 0:22 | STEP 3 提交充值 | **真实页面**：开始充值 → 确认弹窗 → 排队中 → 升级中 → 充值成功 |
| 0:32 | 小贴士 | **真实页面**：16688「订单查询」用下单邮箱找回卡密 |
| 0:40 | 片尾 | 3 步回顾 + 卖点 + 店铺二维码（扫码直达 16688.com.cn/shop/S382939） |

## 成品

- `dist/plus-shop-recharge-demo-1080p.mp4`：成片（H.264 + AAC，响度 -16 LUFS）
- `dist/subtitles.srt`：字幕文件（可上传为 B 站 CC 字幕，或导入剪映）
- `dist/cover.png`：封面图（1920×1080）
- `发布文案与配音稿.md`：B 站标题 / 简介 / 标签建议，以及可直接用于 AI 配音的配音稿

## 画面处理

- **只显示「Plus」**：截取充值站时，截图前在页面里把「Chat GPT 会员自助充值」「ChatGPT Plus」「登录 ChatGPT」等文字改成「Plus 会员自助充值」「Plus」「登录账号」等，每张截图前都会检查页面上已没有 GPT 字样（`tools/capture_recharge.js` 的 `dropGpt`）。字幕、卡片、封面里也只写 Plus。
- **不显示任何具体金额**：套餐标价等金额在页面里做了模糊处理；示意画面里也不写金额。
- **充值站使用演示数据**：页面的所有接口请求都在本地拦截，用演示数据应答，没有把卡密、Session 或其他任何数据发到对方服务器。画面中的卡密 `PLUS-7XK2-M9QF-4TBA`、邮箱 `demo@example.com` 都是虚构的，Session 内容做了模糊处理。
- **不提交任何订单或查询**：订单查询页只输入邮箱、悬停按钮，没有点击查询。
- 画面右上角标有「示意画面 / 演示数据」，片尾有说明文字。

## 重新生成

依赖：Node 18+、Python 3（numpy）、ffmpeg、Playwright 自带的 Chromium。

```bash
cd video
npm install
bash tools/build.sh             # 用仓库里已有的截图素材渲染
bash tools/build.sh --capture   # 先重新截取真实页面（页面有改版时用，需要能访问这两个网站）
```

调整画面：所有动画都写在 `stage/stage.js` 的时间轴里（镜头 `CAM`、屏幕切换 `SCREENS`、光标 `WCUR`、字幕 `CAPS`）。
用浏览器打开 `stage/index.html?play` 可以实时预览，`stage/index.html?t=20` 查看某一秒的画面。

背景音乐和音效由 `tools/audio.py` 程序合成，不涉及第三方版权素材，可替换成自己的 BGM。

## 目录

```
stage/      动画舞台（HTML/CSS/JS，逐帧确定性渲染）和封面
assets/     真实页面截图（2 倍分辨率，已处理金额和 GPT 字样）
tools/      截图、渲染、音频、字幕、封面脚本
dist/       成品
```
