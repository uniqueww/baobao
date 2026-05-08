/*
#!name=咪咕视频签到助手
#!desc=【抓取与签到分离】打开App静默抓取参数，通过定时任务或手动运行执行签到。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png

[rewrite_local]
# 1. 信息抓取：进入签到页时仅保存参数，不执行签到动作
^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js

[task_local]
# 2. 自动签到：每天 9:00 执行，也可在任务列表手动点击运行
0 9 * * * https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js, tag=咪咕视频自动签到, enabled=true

[hostname]
hostname = webapi.miguvideo.com, v.miguvideo.com
*/

/**
 * 核心逻辑：
 * - 当 $request 有值时，代表处于重写环境（App访问中），仅执行 captureInfo()。
 * - 当 $request 无值时，代表处于任务环境（手动/定时），仅执行 performSignIn()。
 */

const $ = new Env("咪咕视频");

if (typeof $request !== "undefined") {
  // 重写模式：静默抓取，绝不签到
  captureInfo();
} else {
  // 任务模式：读取参数，执行签到
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
      // 存储全套 Header 以应对复杂的 sign 校验
      $.setdata(JSON.stringify(headers), "migu_headers_storage");
      $.msg($.name, "✅ 身份抓取成功", "最新参数已存入本地，请手动运行签到任务");
    }
  }
  $.done(); // 释放请求
}

/**
 * 逻辑 B：执行签到 (仅签到，不抓取)
 */
async function performSignIn() {
  const savedHeadersRaw = $.getdata("migu_headers_storage");
  
  if (!savedHeadersRaw) {
    $.msg($.name, "❌ 无法签到", "本地未发现已保存的身份信息，请先打开咪咕视频签到页");
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

  $.post(options, (error, response, data) => {
    try {
      const res = JSON.parse(data);
      if (res.code == "200" || res.code == "000000" || res.status == "success") {
        $.msg($.name, "🎉 签到成功", "奖励已领取到账");
      } else if (res.message && res.message.includes("已签到")) {
        $.msg($.name, "提示", "今天已经签到过啦 ☕️");
      } else {
        $.msg($.name, "⚠️ 签到反馈", res.message || "未知错误");
      }
    } catch (e) {
      $.msg($.name, "❌ 签到出错", "服务器返回数据解析失败");
    }
    $.done();
  });
}

// —— QX 标准环境封装 (Env.js 简化版) ——
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
