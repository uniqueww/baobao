/*
#!name=咪咕视频签到助手(Debug)
#!desc=【排错专用】会将接口返回的完整原始数据打印在日志中。
#!author=Codex

[rewrite_local]
^https:\/\/(webapi|v)\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js, tag=咪咕视频签到Debug, enabled=true

[hostname]
hostname = webapi.miguvideo.com, v.miguvideo.com
*/

const $ = new Env("咪咕视频Debug");

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
    console.log(`[Migu-Capture] 抓取成功! ActivityId: ${actId}`);
  }
  $.done();
}

async function performTask() {
  const headersRaw = $.getdata("migu_headers_storage");
  const actId = $.getdata("migu_activityId");
  
  console.log(`[Migu-Debug] 当前使用的 ActivityId: ${actId}`);

  if (!headersRaw) {
    $.msg($.name, "❌ 错误", "未发现本地参数，请先进入App抓取");
    $.done(); return;
  }

  const headers = JSON.parse(headersRaw);
  const userId = headers["userId"] || "1819227714";

  console.log(`[Migu-Debug] 开始执行签到...`);
  let signMsg = await doSignIn(headers);
  
  console.log(`[Migu-Debug] 开始执行详情查询...`);
  let statusDetail = await queryStatus(headers, userId, actId);

  $.msg($.name, signMsg, statusDetail);
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
      console.log(`[Migu-Debug] 签到返回状态码: ${resp ? resp.statusCode : '无'}`);
      console.log(`[Migu-Debug] 签到返回原始数据: ${data}`);
      resolve("任务运行中...");
    });
  });
}

function queryStatus(headers, userId, actId) {
  return new Promise((resolve) => {
    const queryUrl = `https://webapi.miguvideo.com/gateway/mactivity/v2/queryAction/userDiscreteSignDetailInfo/${userId}/${actId}`;
    console.log(`[Migu-Debug] 查询请求URL: ${queryUrl}`);
    
    $.get({ url: queryUrl, headers: headers }, (err, resp, data) => {
      console.log(`[Migu-Debug] 查询返回状态码: ${resp ? resp.statusCode : '无'}`);
      console.log(`[Migu-Debug] 查询返回原始数据: ${data}`);
      
      try {
        const res = JSON.parse(data);
        const body = res.body || res;
        const days = body.signDays !== undefined ? body.signDays : "未找到";
        resolve(`📊 累计签到: ${days}天`);
      } catch (e) {
        resolve("📊 查询解析失败，见日志");
      }
    });
  });
}

// —— QX 环境封装 ——
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
