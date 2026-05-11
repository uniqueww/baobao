/*
#!name=咪咕视频自动签到
#!desc=【深度修复版】解决 405 REJECTED 错误。支持动态签名捕获，自动过滤 OPTIONS 干扰请求。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png

[rewrite_local]
# 捕获查询与执行接口，严格限制不拦截 OPTIONS
^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v(2|3)\/(queryAction|login\/action)\/ url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js, tag=咪咕视频自动签到, enabled=true

[hostname]
hostname = webapi.miguvideo.com, v.miguvideo.com
*/

const $ = new Env("咪咕视频助手");

if (typeof $request !== "undefined") {
  captureInfo();
} else {
  performTask();
}

/**
 * 逻辑 A：参数捕获 (增加方法过滤)
 */
function captureInfo() {
  const method = $request.method;
  const url = $request.url;

  // 关键修复：忽略所有预检请求，防止空签名覆盖
  if (method === "OPTIONS") {
    $.done();
    return;
  }

  const headers = $request.headers;
  // 深度清洗 Header
  let cleanHeaders = {};
  const blackList = ['host', 'content-length', 'connection', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site'];
  Object.keys(headers).forEach(key => {
    if (!blackList.includes(key.toLowerCase())) {
      cleanHeaders[key] = headers[key];
    }
  });

  // 1. 捕获查询接口
  if (url.indexOf("queryAction") !== -1) {
    const activityMatch = url.match(/\/userDiscreteSignDetailInfo\/\d+\/(\w+)/);
    if (activityMatch) $.setdata(activityMatch[1], "migu_activityId");
    $.setdata(JSON.stringify(cleanHeaders), "migu_headers_query");
    console.log(`[捕获] 查询接口更新，方法: ${method}`);
  }

  // 2. 捕获执行接口 (Action)
  if (url.indexOf("v3/login/action") !== -1) {
    $.setdata(url, "migu_execute_url");
    $.setdata(JSON.stringify(cleanHeaders), "migu_headers_action");
    $.msg($.name, "🚀 提交接口捕获成功", "签名已独立锁定，可全自动签到");
    console.log(`[捕获] 执行接口更新，方法: ${method}, URL: ${url}`);
  }
  $.done();
}

/**
 * 逻辑 B：任务执行
 */
async function performTask() {
  const queryH = $.getdata("migu_headers_query");
  const actionH = $.getdata("migu_headers_action");
  const execUrl = $.getdata("migu_execute_url");
  const actId = $.getdata("migu_activityId") || "17539560138402503653573705807833";
  
  if (!queryH || !actionH || !execUrl) {
    $.msg($.name, "❌ 无法签到", "参数不完整。请打开App，点一下签到按钮。");
    $.done(); return;
  }

  const qHeaders = JSON.parse(queryH);
  const aHeaders = JSON.parse(actionH);
  const userId = qHeaders["userId"] || "1819227714";

  // 1. 查询
  console.log("[任务] 正在查询签到状态...");
  let status = await queryStatus(qHeaders, userId, actId);

  let signMsg = "";
  if (status.isSigned) {
    signMsg = "☕️ 今日已签到";
  } else {
    // 2. 签到 (显式声明 POST)
    console.log("[任务] 正在执行签到请求...");
    signMsg = await doSignIn(execUrl, aHeaders);
    // 3. 刷新状态
    status = await queryStatus(qHeaders, userId, actId);
  }

  $.msg($.name, signMsg, `📊 累计签到: ${status.day}天 | ${status.prize}`);
  $.done();
}

function doSignIn(url, headers) {
  return new Promise((resolve) => {
    // 显式指定 POST，并带上固定的 Body
    const options = {
      url: url,
      method: "POST",
      headers: headers,
      body: JSON.stringify({ "from": "CMVIDEO" })
    };
    // 咪咕网关强制要求 Content-Type
    options.headers["Content-Type"] = "application/json;charset=utf-8";

    $.post(options, (err, resp, data) => {
      console.log(`[任务] 签到响应码: ${resp ? resp.statusCode : 'ERR'}, 数据: ${data}`);
      try {
        const res = JSON.parse(data);
        if (res.code == "200" || res.success) resolve("🎉 签到成功");
        else resolve(`⚠️ 失败: ${res.resultDesc || res.message || "签名无效"}`);
      } catch (e) { resolve("❌ 接口返回异常"); }
    });
  });
}

function queryStatus(headers, userId, actId) {
  return new Promise((resolve) => {
    const queryUrl = `https://webapi.miguvideo.com/gateway/mactivity/v2/queryAction/userDiscreteSignDetailInfo/${userId}/${actId}`;
    $.get({ url: queryUrl, headers: headers }, (err, resp, data) => {
      let result = { day: "0", prize: "获取中", isSigned: false };
      try {
        const res = JSON.parse(data);
        const body = res.body || {};
        result.day = body.day !== undefined ? body.day : "0";
        result.isSigned = body.signed || false;
        if (body.discreteSignDetailInfos) result.prize = `下阶段: ${body.discreteSignDetailInfos[0].wareName}`;
      } catch (e) {}
      resolve(result);
    });
  });
}

// —— QX 标准封装 ——
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
