/* Narration = captions = AI voice-over lines.
 * Each line: [id, caption (HTML, <b> = highlight), extra pause after the line (s), optional text to speak if it differs]
 * tools/voice.py turns every line into a voice clip and writes stage/voice.js with the real durations;
 * stage.js lays the whole timeline out from those durations.
 * Wording rules: only "Plus / Pro", no "GPT", no monetary amounts.
 */
window.NARRATION = {
  main: [
    ['h1', '开会员之前，先想清楚<b>两件事</b>', 0],
    ['h2', '<b>开哪一档</b>？<b>用什么方式开</b>？', 0],
    ['h3', '选错了，要么<b>白花钱</b>，要么会员<b>说没就没</b>', 0.5],

    ['p1', '先看档位：<b>Plus</b>、<b>Pro 5x</b>，还有 <b>Pro 20x</b>', 0],
    ['p2', '区别主要在<b>用量</b>，Pro 还能用更强的 <b>Pro 模型</b>', 0],
    ['p3a', '注意，Pro 5x 额度已经翻倍，现在约是 Plus 的 <b>10 倍</b>', 0],
    ['p3b', 'Pro 20x 大约是 <b>20 倍</b>，具体以官网为准', 0.1],
    ['p4', '日常聊天、写东西、查资料，<b>Plus</b> 就够了', 0],
    ['p5', '天天写代码、跑长任务，选 <b>Pro 5x</b>', 0],
    ['p6', '整天高强度、多任务同时跑，才需要 <b>Pro 20x</b>', 0.25],
    ['p7a', '拿不准就看这张图：<b>Plus 额度经常不够</b>，再升 Pro', 0.1],
    ['p7b', '还不确定？<b>先开 Plus</b>，不够再升级', 0.5],

    ['m0', '再看开通方式，常见的有 <b>5 种</b>', 0],
    ['m1a', '一，<b>官方订阅</b>：自己绑卡付款，最正规', 0],
    ['m1b', '但要有能境外支付的卡，<b>很多国内卡会被拒</b>', 0.15],
    ['m2a', '二，<b>外区 App Store 内购</b>：走苹果扣费，也很稳', 0],
    ['m2b', '但要准备<b>外区 Apple ID 和礼品卡</b>，步骤多', 0.15],
    ['m3a', '三，<b>共享号拼车</b>：价格最低', 0],
    ['m3b', '但大家共用一个号，<b>聊天记录互相能看到</b>', 0.15],
    ['m4a', '四，<b>成品号</b>：买来就能用', 0],
    ['m4b', '但不是你原来的号，<b>以前的记录都不在</b>', 0.15],
    ['m5a', '五，<b>直充自己的号</b>：会员充到你自己的号上', 0],
    ['m5b', '不用弄卡，但要提交<b>登录凭证</b>，一定挑靠谱的店', 0.3],
    ['s1', '总结：有境外卡走<b>官方订阅</b>，有外区 Apple ID 走 <b>App Store</b>', 0],
    ['s2', '都没有、又想用自己的号，<b>直充最省事</b>', 0.5],

    ['c0', '最后是 <b>5 条避坑清单</b>，建议截图', 0],
    ['c1', '一，会员<b>充在自己的号上</b>', 0],
    ['c2', '二，官网能看到<b>订阅和账单</b>', 0],
    ['c3', '三，<b>质保写清楚</b>，掉了怎么赔', 0],
    ['c4', '四，<b>不交账号密码</b>，充完退出所有设备', 0],
    ['c5', '五，价格<b>低得离谱</b>的，多问一句', 1.0],
  ],
  // default ending: no shop name / QR / selling points
  endClean: [
    ['o1', '记住：按<b>用量</b>选档位，按<b>条件</b>选方式', 0],
    ['o2', '下单前对照<b>避坑清单</b>过一遍，有用就收藏', 0],
    ['o3', '你现在用的是哪一种？<b>评论区聊聊</b>', 0],
  ],
  // shop ending (index.html?shop): commercial promotion, needs a 商业声明 / 花火 order on Bilibili
  endShop: [
    ['o1', '我家就是第 5 种：<b>直充自己的号</b>，Plus、Pro 都能充', 0],
    ['o2', '质保 30 天，可开国内发票，<b>16688 搜 plus小店</b>', 0, '质保三十天，可开国内发票，一六六八八，搜 Plus 小店'],
    ['o3', '你现在用的是哪一种？<b>评论区聊聊</b>', 0],
  ],
};
