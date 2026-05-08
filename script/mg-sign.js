/*
#!name=咪咕视频签到助手
#!desc=【增强反馈版】打开App抓取参数。执行任务时，无论签到是否成功，均会强制查询并输出当前累计签到天数及奖励信息。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png

[rewrite_local]
# 1. 信息抓取：进入签到页时仅保存参数
^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js

[task_local]
# 2. 自动任务：签到 + 状态强制查询
0 9 * * * https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js, tag=咪咕视频自动签到, enabled=true

[hostname]
hostname = webapi.miguvideo.com, v.miguvideo.com
*/

const $ = new Env("咪咕视频");

if (typeof $request !== "undefined") {
  captureInfo();
} else {
  performTask();
}

/**
 * 逻辑 A：参数静默抓取
 */
function captureInfo() {
  const url = $request.url;
  const headers = $request.headers;
  if (url.indexOf("userDiscreteSignDetailInfo") !== -1) {
    const userToken = headers["userToken"] || headers["usertoken"];
    if (userToken) {
      $.setdata(JSON.stringify(headers), "migu_headers_storage");
      $.msg($.name, "✅ 身份抓取成功", "最新参数已就绪，脚本已准备好执行任务");
    }
  }
  $.done();
}

/**
 * 逻辑 B：任务执行 (签到 + 强制状态查询)
 */
async function performTask() {
  const savedHeadersRaw = $.getdata("migu_headers_storage");
  if (!savedHeadersRaw) {
    $.msg($.name, "❌ 无法执行", "未发现保存的信息，请先打开咪咕视频签到页");
    $.done();
    return;
  }

  const savedHeaders = JSON.parse(savedHeadersRaw);
  
  // --- 步骤 1: 尝试签到 ---
  let signResultMsg = "";
  try {
    signResultMsg = await doSignIn(savedHeaders);
  } catch (e) {
    signResultMsg = "❌ 签到请求发生异常";
  }
  
  // --- 步骤 2: 强制查询状态 (无论步骤1是否报错) ---
  let statusDetailMsg = "";
  try {
    statusDetailMsg = await queryStatus(savedHeaders);
  } catch (e) {
    statusDetailMsg = "📊 累计进度查询失败";
  }

  // --- 步骤 3: 汇总通知 ---
  // 即使 signResultMsg 是失败的，statusDetailMsg 也会展示当前的累计天数
  $.msg($.name, signResultMsg, statusDetailMsg);
  $.done();
}

// 签到请求逻辑
function doSignIn(headers) {
  return new Promise((resolve) => {
    const signUrl = "https://v.miguvideo.com/task/v3/signIn/doSignIn";
    const options = {
      url: signUrl,
      headers: headers,
      body: JSON.stringify({ "actionId": "sign_in_daily", "channelId": "2003" })
    };

    $.post(options, (error, response, data) => {
      if (error) {
        resolve("⚠️ 签到接口网络错误");
      } else {
        try {
          const res = JSON.parse(data);
          if (res.code == "200" || res.code == "000000") {
            resolve("🎉 签到成功");
          } else if (res.message && (res.message.includes("已签到") || res.message.includes("重复"))) {
            resolve("☕️ 今日已签到");
          } else {
            resolve("⚠️ 签到未完成: " + (res.message || "未知原因"));
          }
        } catch (e) {
          resolve("⚠️ 签到返回格式异常");
        }
      }
    });
  });
}

// 状态查询逻辑 (基于 HAR 包中的详情接口)
function queryStatus(headers) {
  return new Promise((resolve) => {
    const userId = headers["userId"] || "1819227714";
    const activityId = "17539560138402503653573705807833";
    const queryUrl = `https://webapi.miguvideo.com/gateway/mactivity/v2/queryAction/userDiscreteSignDetailInfo/${userId}/${activityId}`;
    
    const options = { url: queryUrl, headers: headers };

    $.get(options, (error, response, data) => {
      if (error) {
        resolve("📊 网络故障，无法读取进度");
      } else {
        try {
          const res = JSON.parse(data);
          if (res.code == "200" && res.body) {
            const days = res.body.signDays || "0";
            const prizeList = res.body.prizeList || [];
            let prizeStr = "";
            if (prizeList.length > 0) {
                // 提取第一个未领取的奖品名称
                const nextPrize = prizeList.find(p => p.prizeStatus == 0) || prizeList[0];
                prizeStr = ` | 下一奖品: ${nextPrize.prizeName || "未知"}`;
            }
            resolve(`📊 累计签到: ${days}天${prizeStr}`);
          } else {
            resolve("📊 无法解析当前进度信息");
          }
        } catch (e) {
          resolve("📊 进度详情数据异常");
        }
      }
    });
  });
}

// —— QX 环境标准封装 ——
function Env(name) {
  return new (class {
    constructor(name) { this.name = name }
    getdata(key) { return $prefs.valueForKey(key) }
    setdata(val, key) { return $prefs.setValueForKey(val, key) }
    msg(t, s, c) { $notify(t, s, c) }
    get(o, cb) { $task.fetch(o).then(r => cb(null, r, r.body), e => cb(e, null, null)) }
    post(o, cb) { $task.fetch(o).then(r => cb(null, r, r.body), e => cb(e, null, null)) }
    done() { $done({}) }
  })(name);
}
