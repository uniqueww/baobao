/*
#!name=咪咕视频签到助手
#!desc=【精准修复版】基于Debug日志修复接口路径与天数解析。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png

[rewrite_local]
# 拦截查询接口，动态提取参数
^https:\/\/(webapi|v)\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js

[task_local]
# 自动任务
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

function captureInfo() {
  const url = $request.url;
  const headers = $request.headers;
  const activityMatch = url.match(/\/userDiscreteSignDetailInfo\/\d+\/(\w+)/);
  if (activityMatch && activityMatch[1]) {
    const actId = activityMatch[1];
    $.setdata(actId, "migu_activityId");
    $.setdata(JSON.stringify(headers), "migu_headers_storage");
    $.msg($.name, "✅ 参数捕获成功", "已同步最新活动ID及Header");
  }
  $.done();
}

async function performTask() {
  const headersRaw = $.getdata("migu_headers_storage");
  const actId = $.getdata("migu_activityId") || "17539560138402503653573705807833";
  
  if (!headersRaw) {
    $.msg($.name, "❌ 无法执行", "请先进入App签到页抓取参数");
    $.done(); return;
  }

  const headers = JSON.parse(headersRaw);
  const userId = headers["userId"] || "1819227714";

  // --- 步骤 1: 强制查询当前状态 ---
  let statusInfo = await queryStatus(headers, userId, actId);
  
  // --- 步骤 2: 判断是否需要签到 ---
  let signRes = "";
  if (statusInfo.isSigned) {
    signRes = "☕️ 今日已签到";
  } else {
    signRes = await doSignIn(headers, userId, actId);
    // 签到后再查一次更新天数
    statusInfo = await queryStatus(headers, userId, actId);
  }

  // --- 步骤 3: 汇总通知 ---
  $.msg($.name, signRes, `📊 累计签到: ${statusInfo.day}天 | ${statusInfo.prize}`);
  $.done();
}

// 签到请求 (修复 404 问题，使用 mactivity 专用接口)
function doSignIn(headers, userId, actId) {
  return new Promise((resolve) => {
    const signUrl = `https://webapi.miguvideo.com/gateway/mactivity/v2/executeAction/userDiscreteSign/${userId}/${actId}`;
    $.post({ url: signUrl, headers: headers, body: "{}" }, (err, resp, data) => {
      try {
        const res = JSON.parse(data);
        if (res.code == "200" || res.success) resolve("🎉 签到成功");
        else resolve(`⚠️ 失败: ${res.message || "未知原因"}`);
      } catch (e) { resolve("❌ 签到接口异常"); }
    });
  });
}

// 状态查询 (根据你的日志精准解析)
function queryStatus(headers, userId, actId) {
  return new Promise((resolve) => {
    const queryUrl = `https://webapi.miguvideo.com/gateway/mactivity/v2/queryAction/userDiscreteSignDetailInfo/${userId}/${actId}`;
    $.get({ url: queryUrl, headers: headers }, (err, resp, data) => {
      let result = { day: "N/A", prize: "未查询到奖品", isSigned: false };
      try {
        const res = JSON.parse(data);
        const body = res.body || {};
        result.day = body.day !== undefined ? body.day : "0";
        result.isSigned = body.signed || false;
        
        if (body.discreteSignDetailInfos && body.discreteSignDetailInfos.length > 0) {
          const next = body.discreteSignDetailInfos[0];
          result.prize = `下个目标: ${next.wareName || "未知"}`;
        }
      } catch (e) { console.log("解析出错:" + e); }
      resolve(result);
    });
  });
}

function Env(n) {
  return new (class {
    constructor(n) { this.name = n }
    getdata(k) { return $prefs.valueForKey(k) }
    setdata(v, k) { return $prefs.setValueForKey(v, k) }
    msg(t, s, c) { $notify(t, s, c) }
    get(o, cb) { $task.fetch(o).then(r => cb(null, r, r.body), e => cb(e, null, null)) }
    post(o, cb) { $task.fetch(o).then(r => cb(null, r, r.body), e => cb(e, null, null)) }
    done() { $done({}) }
  })(n);
}
