/*
#!name=咪咕视频自动签到
#!desc=【日志增强版】支持动态接口捕获与全流程日志输出。请先进入App签到页触发抓取，再执行任务。
#!author=Codex
#!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png

[rewrite_local]
# 1. 捕获查询接口（获取Header和ActivityId）
^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js
# 2. 捕获执行接口（获取动态生成的提交URL）
^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v3\/login\/action\/ url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js

[task_local]
# 每天 9:00 自动执行
0 9 * * * https://raw.githubusercontent.com/uniqueww/baobao/main/script/mg-sign.js, tag=咪咕视频自动签到, enabled=true

[hostname]
hostname = webapi.miguvideo.com, v.miguvideo.com
*/

const $ = new Env("咪咕视频助手");

// —— 逻辑分流 ——
if (typeof $request !== "undefined") {
  captureInfo();
} else {
  performTask();
}

/**
 * 逻辑 A：动态捕获 (Rewrite 模式)
 */
function captureInfo() {
  const url = $request.url;
  const headers = $request.headers;

  // 1. 捕获基础信息
  if (url.indexOf("userDiscreteSignDetailInfo") !== -1) {
    console.log(`[捕获] 正在解析查询接口...`);
    const activityMatch = url.match(/\/userDiscreteSignDetailInfo\/\d+\/(\w+)/);
    if (activityMatch) {
      $.setdata(activityMatch[1], "migu_activityId");
      console.log(`[捕获] ActivityId 获取成功: ${activityMatch[1]}`);
    }
    $.setdata(JSON.stringify(headers), "migu_headers");
    console.log(`[捕获] Headers 已保存`);
    $.msg($.name, "✅ 身份信息已更新", "等待捕获执行接口 (点一次签到即可)");
  }
  
  // 2. 捕获动态提交URL
  if (url.indexOf("v3/login/action") !== -1) {
    console.log(`[捕获] 发现动态签到接口: ${url}`);
    $.setdata(url, "migu_execute_url");
    $.msg($.name, "🚀 提交接口捕获成功", "全自动签到参数已就绪");
  }
  $.done();
}

/**
 * 逻辑 B：任务执行 (Task 模式)
 */
async function performTask() {
  console.log(`[任务] 脚本启动...`);
  const headersRaw = $.getdata("migu_headers");
  const execUrl = $.getdata("migu_execute_url");
  const actId = $.getdata("migu_activityId") || "17539560138402503653573705807833";
  
  if (!headersRaw || !execUrl) {
    console.log(`[任务] 失败: 缺少关键参数。Headers: ${!!headersRaw}, URL: ${!!execUrl}`);
    $.msg($.name, "❌ 无法签到", "缺少关键参数，请先进入App签到页并点一次签到");
    $.done(); return;
  }

  const headers = JSON.parse(headersRaw);
  const userId = headers["userId"] || "1819227714";

  console.log(`[任务] 正在查询当前签到状态...`);
  let status = await queryStatus(headers, userId, actId);
  console.log(`[任务] 当前天数: ${status.day}, 是否已签到: ${status.isSigned}`);

  let signMsg = "";
  if (status.isSigned) {
    signMsg = "☕️ 今日已签到";
    console.log(`[任务] 检测到今日已签到，跳过执行步骤`);
  } else {
    console.log(`[任务] 正在执行签到请求... URL: ${execUrl}`);
    signMsg = await doSignIn(execUrl, headers);
    console.log(`[任务] 签到请求结果: ${signMsg}`);
    // 签到后再查一次更新进度
    status = await queryStatus(headers, userId, actId);
  }

  $.msg($.name, signMsg, `📊 累计签到: ${status.day}天 | ${status.prize}`);
  $.done();
}

// 签到执行
function doSignIn(url, headers) {
  return new Promise((resolve) => {
    $.post({ url: url, headers: headers, body: JSON.stringify({"from":"CMVIDEO"}) }, (err, resp, data) => {
      if (err) resolve("❌ 网络请求错误");
      try {
        const res = JSON.parse(data);
        console.log(`[任务] 签到接口响应: ${data}`);
        if (res.code == "200" || res.success) resolve("🎉 签到成功");
        else resolve(`⚠️ 失败: ${res.message || "未知原因"}`);
      } catch (e) { resolve("❌ 提交接口返回异常"); }
    });
  });
}

// 状态查询
function queryStatus(headers, userId, actId) {
  return new Promise((resolve) => {
    const queryUrl = `https://webapi.miguvideo.com/gateway/mactivity/v2/queryAction/userDiscreteSignDetailInfo/${userId}/${actId}`;
    $.get({ url: queryUrl, headers: headers }, (err, resp, data) => {
      let result = { day: "0", prize: "获取中...", isSigned: false };
      if (err) console.log(`[任务] 查询状态请求失败: ${err}`);
      try {
        const res = JSON.parse(data);
        console.log(`[任务] 查询接口响应: ${data}`);
        const body = res.body || {};
        result.day = body.day !== undefined ? body.day : "0";
        result.isSigned = body.signed || false;
        if (body.discreteSignDetailInfos) result.prize = `下阶段: ${body.discreteSignDetailInfos[0].wareName}`;
      } catch (e) { console.log(`[任务] 解析查询结果出错: ${e}`); }
      resolve(result);
    });
  });
}

// —— QX 环境标准封装 ——
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
