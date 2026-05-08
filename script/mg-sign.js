/*
#!name=咪咕视频签到助手
#!desc=【精准修复版】自动捕获最新的 ActivityId 并精准解析签到天数。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png

[rewrite_local]
# 拦截查询接口，动态提取 ActivityId 和 Header
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

/**
 * 逻辑 A：参数捕获
 */
function captureInfo() {
  const url = $request.url;
  const headers = $request.headers;

  // 从 URL 中动态提取最新的 ActivityId (URL 最后一节)
  const activityMatch = url.match(/\/userDiscreteSignDetailInfo\/\d+\/(\w+)/);
  if (activityMatch && activityMatch[1]) {
    const actId = activityMatch[1];
    $.setdata(actId, "migu_activityId");
    $.setdata(JSON.stringify(headers), "migu_headers_storage");
    $.msg($.name, "✅ 参数捕获成功", `已同步最新活动ID: ${actId.substring(0,8)}...`);
  }
  $.done();
}

/**
 * 逻辑 B：签到与强制查询
 */
async function performTask() {
  const headersRaw = $.getdata("migu_headers_storage");
  const actId = $.getdata("migu_activityId") || "17539560138402503653573705807833";
  
  if (!headersRaw) {
    $.msg($.name, "❌ 无法执行", "未发现保存信息，请先进入App签到页");
    $.done(); return;
  }

  const headers = JSON.parse(headersRaw);
  const userId = headers["userId"] || "1819227714";

  // 1. 尝试签到
  let signRes = await doSignIn(headers);
  
  // 2. 强制查询 (包含容错路径)
  let statusRes = await queryStatus(headers, userId, actId);

  $.msg($.name, signRes, statusRes);
  $.done();
}

function doSignIn(headers) {
  return new Promise((resolve) => {
    const options = {
      url: "https://v.miguvideo.com/task/v3/signIn/doSignIn",
      headers: headers,
      body: JSON.stringify({ "actionId": "sign_in_daily", "channelId": "2003" })
    };
    $.post(options, (err, resp, data) => {
      try {
        const res = JSON.parse(data);
        if (res.code == "200" || res.code == "000000") resolve("🎉 签到成功");
        else resolve(`⚠️ 签到反馈: ${res.message || "未知原因"}`);
      } catch (e) { resolve("⚠️ 签到接口异常"); }
    });
  });
}

function queryStatus(headers, userId, actId) {
  return new Promise((resolve) => {
    // 尝试两个可能的域名
    const queryUrl = `https://webapi.miguvideo.com/gateway/mactivity/v2/queryAction/userDiscreteSignDetailInfo/${userId}/${actId}`;
    $.get({ url: queryUrl, headers: headers }, (err, resp, data) => {
      try {
        const res = JSON.parse(data);
        // 咪咕的结构通常在 res.body 里面
        const body = res.body || res; 
        const days = body.signDays !== undefined ? body.signDays : "N/A";
        
        let prizeMsg = "";
        if (body.prizeList && body.prizeList.length > 0) {
          const prize = body.prizeList.find(p => p.prizeStatus == 0) || body.prizeList[0];
          prizeMsg = ` | 下一奖励: ${prize.prizeName || "无"}`;
        }
        
        if (days === "N/A") resolve("📊 无法读取到天数，请检查活动ID");
        else resolve(`📊 累计签到: ${days}天${prizeMsg}`);
      } catch (e) { resolve("📊 进度详情解析失败"); }
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
