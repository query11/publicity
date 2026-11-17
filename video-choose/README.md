# 开 Plus 还是 Pro？5 种开通方式哪种不踩坑

16:9 / 1920×1080 / 30fps / 2 分 18 秒，B 站横屏讲解风格，带 AI 配音（男声）。把选题 ②（5 种开通方式避坑）和 ⑤（Plus / Pro 怎么选）合成一条：先选档位，再选方式，最后给一张避坑清单。

| 时间 | 段落 | 画面 |
|---|---|---|
| 0:00 | 钩子 | 4 个节拍，每句一个画面：①「Plus 会员 · 生效中」卡片被盖上「已失效」红章（故障抖动 + 红闪，示意）②「问题多半出在**开通方式**」大字 + 画圈 ③「买的额度」满格 vs「实际用到」一小截，剩下标「用不完」④「开哪档 / 怎么开 / 怎么避坑」+「这条一次讲清」。背景音乐在盖章那一下才进来 |
| 0:14 | PART 1 选档位 | Plus / Pro 5x / Pro 20x 三张卡片：用量条、Pro 模型、适合谁 |
| 0:44 | | 决策图：Plus 额度经常不够？→ 要整天高强度、多任务？→ 对应档位；拿不准先开 Plus |
| 0:53 | PART 2 选方式 | 5 种方式逐个讲优点和门槛 / 风险：官方订阅、外区 App Store、共享号 / 拼车、成品号、直充自己的号 |
| 1:35 | | 对比表：上手门槛、是不是自己的号、隐私、出问题找谁 |
| 1:44 | PART 3 避坑清单 | 5 条清单逐条打勾 |
| 2:03 | 片尾 | 无推广版：「开会员 记住三步」总结 + 点赞 / 收藏 / 评论；带店铺版：我家的做法 + 卖点 + 店铺二维码 |

## 成品

两个版本只有片尾不同：

- `dist/plus-pro-choose-1080p.mp4`：**无推广版，B 站发这个**。没有店铺名、二维码、链接、卖点。
- `dist/plus-pro-choose-shop-1080p.mp4`：带店铺版，片尾有店铺名、卖点和二维码。在 B 站属于商业推广，只有做了商业声明、绑定花火订单时才能用。
- `dist/subtitles.srt` / `dist/subtitles-shop.srt`：字幕文件（和配音逐句对应）
- 成片都是 H.264 + AAC，响度 -16 LUFS
- `dist/cover-hook.png`：封面（推荐）：「刚开的会员 没几天就掉了？」+ 盖了「已失效」章的会员卡，和开头钩子一致
- `dist/cover.png`：封面（信息型）：「开 Plus 还是 Pro？5 种开通方式 哪种不踩坑」
- `发布文案与配音稿.md`：B 站标题 / 简介（带章节时间）/ 标签 / 置顶评论 / 配音说明 / 发布前要确认的事

## 内容口径

- 画面、字幕、配音、封面里只说「Plus / Pro」，不说 GPT，不出现任何金额。
- 档位用店里和社区通用的「Pro 5x / Pro 20x」叫法。Pro 5x 的额度已经翻倍，现在约是 Plus 的 10 倍（名字没改），卡片上标了「已翻倍」；Pro 20x 约 20 倍。官方近几个月调整频繁，画面和口播都提示「以官网为准」。
- 5 种方式的优缺点都如实写，对比表里「直充自己的号」在隐私、售后两栏也标的是「一般」（要交登录凭证、售后看店铺质保），不把自家方式说成没有缺点。成品号店里也在卖，所以写的是适合谁、不适合谁，没有贬低。
- 不点名任何店铺；无推广版连自家店铺也不出现（上一条视频被 B 站判为未声明的商业推广并限流，违规位置是内容全程）。
- 配音是 AI 合成的：画面右下角全程标「AI 配音」，简介里也写明，投稿时勾选 AI 生成内容声明。

## 配音

- 开源 TTS 模型 Kokoro v1.1-zh（Apache-2.0）通过 sherpa-onnx 在本地合成，音色 58 号（男声），1.05 倍速（约 4.7 字 / 秒），句间 0.25 秒。
- `tools/voice.py` 逐句合成、去掉首尾静音、统一音量，存为 `assets/voice/*.flac`（已提交，重新渲染不需要模型），并把每句时长写进 `stage/voice.js`。
- 合成后用语音识别模型 SenseVoice 回听每一句，按拼音对比原文（同音字不算错），报告在 `out/voice_asr.txt`。

## 背景音乐和音效

都由 `tools/audio.py` 程序合成，不涉及第三方版权素材。

- 118 BPM 流行 / house 风格：四拍底鼓、2、4 拍拍手、16 分音符踩镲加反拍开镲、八度跳动的贝斯、Am-F-C-G 切分和弦、铺底 pad；PART 2 起加高音琶音，PART 3 加打击乐、和弦更亮，能量逐段往上走。
- 开头第一句只有一个上升的音效，鼓点在「已失效」盖章那一下（`MUSIC.start`）和盖章音效、故障音效一起进来。
- 每个 PART 都从强拍开始并带一声镲；切换前一拍音乐停住，接军鼓 fill 和上升音效；结尾落在一个长和弦上。段落时间点由 `stage/stage.js` 的 `MUSIC.parts` 导出。
- 人声说话时音乐自动压低约 10 dB（80 ms 预读，350 ms 恢复），句间和段落间隙里回来。说话时人声比音乐高约 11 dB；在完整混音上做语音识别，准确率和纯人声基本一样。

## 重新生成

依赖：Node 18+、Python 3（numpy、soundfile）、ffmpeg、Playwright 自带的 Chromium。

```bash
cd video-choose
npm install
pip install soundfile
bash tools/build.sh          # 无推广版
bash tools/build.sh --shop   # 带店铺版
node tools/cover.js dist/cover-hook.png cover-hook.html   # 钩子版封面
```

改文案：字幕 / 配音句子都在 `stage/script.js` 里。改完先重新生成配音（需要模型，约 600 MB，只有这一步需要）：

```bash
pip install sherpa-onnx soundfile pypinyin
bash tools/get_models.sh
python3 tools/voice.py
```

整条时间轴按每句配音的实际长度自动排，改一句话，后面的画面会跟着顺延。换音色或语速：`VOICE_SID=62 VOICE_SPEED=1.2 python3 tools/voice.py`。
卡片内容（三档、5 种方式、对比表、清单）在 `stage/stage.js` 的 `TIERS` / `METHODS` / `TABLE` / `CHECKS` 里。

预览：浏览器打开 `stage/index.html?play` 实时播放（没有声音），`stage/index.html?t=60` 看某一秒的画面；加 `shop`（如 `index.html?shop&play`）看带店铺版。
