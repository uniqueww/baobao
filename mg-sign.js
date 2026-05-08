/*
#!name=咪咕视频签到助手
#!desc=【抓取与签到分离版】打开App抓取参数，通过定时任务或手动点击执行签到。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png

[rewrite_local]
# 1. 信息抓取：进入签到页时仅保存参数，不执行签到
^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/mg-sign.js

[task_local]
# 2. 自动签到：每天 9:00 执行一次，也可手动点击运行
0 9 * * * https://raw.githubusercontent.com/uniqueww/baobao/main/mg-sign.js, tag=咪咕视频自动签到, enabled=true

[hostname]
hostname = webapi.miguvideo.com, v.miguvideo.com
*/

const $ = new Env("咪咕视频");

// —— 逻辑分流 ——
if (typeof $request !== "undefined") {
  // 环境 1：重写环境 -> 仅执行抓取
  captureInfo();
} else {
  // 环境 2：任务环境（手动点击或定时） -> 执行签到
  performSignIn();
}

/**
 * 逻辑 A：信息抓取 (仅保存，不签到)
 */
function captureInfo() {
  const url = $request.url;
  const headers = $request.headers;

  if (url.indexOf("userDiscreteSignDetailInfo") !== -1) {
    const userToken = headers["userToken"] || headers["usertoken"];
    if (userToken) {
      // 将整个请求头存入本地，保持 sign 的原汁原味
      $.setdata(JSON.stringify(headers), "migu_headers_storage");
      $.msg($.name, "✅ 身份抓取成功", "已保存最新参数，请通过任务列表或定时执行签到");
    }
  }
  $.done(); // 必须释放请求
}

/**
 * 逻辑 B：执行签到 (读取保存的参数)
 */
async function performSignIn() {
  const savedHeadersRaw = $.getdata("migu_headers_storage");
  
  if (!savedHeadersRaw) {
    $.msg($.name, "❌ 签到失败", "本地未发现保存的身份信息，请先打开咪咕视频签到页抓取");
    $.done();
    return;
  }

  const savedHeaders = JSON.parse(savedHeadersRaw);
  const signUrl = "https://v.miguvideo.com/task/v3/signIn/doSignIn";
  
  const options = {
    url: signUrl,
    headers: savedHeaders,
    body: JSON.stringify({
      "actionId": "sign_in_daily",
      "channelId": "2003"
    })
  };

  $.msg($.name, "🚀 正在签到", "使用已保存的最新参数...");

  $.post(options, (error, response, data) => {
    try {
      const res = JSON.parse(data);
      if (res.code == "200" || res.code == "000000" || res.status == "success") {
        $.msg($.name, "🎉 签到成功", "奖励已领取");
      } else if (res.message && res.message.includes("已签到")) {
        $.msg($.name, "提示", "今日已经签到过啦 ☕️");
      } else {
        $.msg($.name, "⚠️ 签到结果", res.message || "未知错误");
      }
    } catch (e) {
      $.msg($.name, "❌ 解析失败", "返回数据异常");
    }
    $.done();
  });
}

// —— QX 标准环境封装 ——
function Env(name) {
  return new (class {
    constructor(name) { this.name = name }
    getdata(key) { return $prefs.valueForKey(key) }
    setdata(val, key) { return $prefs.setValueForKey(val, key) }
    msg(title, subtitle, content) { $notify(title, subtitle, content) }
    post(options, callback) {
      $task.fetch(options).then(
        (response) => { callback(null, response, response.body) },
        (reason) => { callback(reason.error, null, null) }
      );
    }
    done(val = {}) { $done(val) }
  })(name);
}
