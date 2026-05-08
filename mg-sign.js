/*
#!name=咪咕视频自动签到
#!desc=打开咪咕视频签到页面时自动抓取参数并执行签到。支持资源解析器一键导入。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png
#!homepage=https://github.com/uniqueww/baobao

[rewrite_local]
# 拦截签到详情接口，获取Header并立即触发签到
^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/mg-sign.js

[hostname]
hostname = webapi.miguvideo.com, v.miguvideo.com
*/

/**
 * 脚本说明：
 * 1. 采用 Env 封装，支持持久化存储。
 * 2. 自动兼容 QX 的脚本触发环境。
 * 3. 拦截请求头(script-request-header)模式，确保 sign 绝对有效。
 */

const $ = new Env("咪咕视频签到");

// 执行入口
if (typeof $request !== "undefined") {
  getAndSign();
} else {
  $.msg($.name, "❌ 运行失败", "此脚本仅支持在重写环境下触发");
  $.done();
}

async function getAndSign() {
  const url = $request.url;
  const headers = $request.headers;

  // 1. 验证目标 URL 是否正确
  if (url.indexOf("userDiscreteSignDetailInfo") !== -1) {
    const userToken = headers["userToken"] || headers["usertoken"];
    const sign = headers["sign"];

    if (userToken && sign) {
      // 存储到本地，支持 BoxJS 或后续调用
      $.setdata(JSON.stringify(headers), "migu_headers");

      $.msg($.name, "✅ 身份信息抓取成功", "正在为您同步执行签到任务...");
      
      // 2. 利用当前最新 Header 立即执行签到
      await doCheckIn(headers);
    }
  }
  $.done();
}

function doCheckIn(headers) {
  return new Promise((resolve) => {
    // 签到提交接口
    const signUrl = "https://v.miguvideo.com/task/v3/signIn/doSignIn";
    const options = {
      url: signUrl,
      headers: headers,
      body: JSON.stringify({
        "actionId": "sign_in_daily",
        "channelId": "2003"
      })
    };

    $.post(options, (error, response, data) => {
      try {
        const res = JSON.parse(data);
        if (res.code == "200" || res.code == "000000" || res.status == "success") {
          $.msg($.name, "🎉 签到成功", "奖励已领取，请前往 App 确认");
        } else if (res.message && (res.message.includes("已签到") || res.message.includes("重复"))) {
          $.msg($.name, "提示", "今天已经签到过啦 ☕️");
        } else {
          $.msg($.name, "⚠️ 签到异常", res.message || "接口报错");
        }
      } catch (e) {
        $.msg($.name, "❌ 解析失败", "服务器返回格式异常");
      }
      resolve();
    });
  });
}

// —— QX 环境标准封装 (Env.js 简化版) ——
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
