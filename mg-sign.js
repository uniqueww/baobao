/*
 * #!name=咪咕视频自动签到
 * #!desc=进入签到页面时自动抓取加密参数并执行签到任务。
 * #!author=Codex
 * #!icon=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Migu_Video.png
 *
 * [rewrite_local]
 * # 拦截签到详情接口，获取Header并立即触发签到
 * ^https:\/\/webapi\.miguvideo\.com\/gateway\/mactivity\/v2\/queryAction\/userDiscreteSignDetailInfo url script-request-header https://raw.githubusercontent.com/uniqueww/baobao/main/mg-sign.js
 *
 * [hostname]
 * hostname = webapi.miguvideo.com, v.miguvideo.com
 */

const $ = new Env("咪咕视频签到");

// 脚本入口
if (typeof $request !== "undefined") {
    handleCapture();
} else {
    $.msg($.name, "❌ 运行失败", "此脚本仅支持在重写环境下触发");
    $.done();
}

async function handleCapture() {
    const url = $request.url;
    const headers = $request.headers;

    // 匹配签到详情页接口
    if (url.indexOf("userDiscreteSignDetailInfo") !== -1) {
        const userToken = headers["userToken"] || headers["usertoken"];
        const sign = headers["sign"];
        
        if (userToken && sign) {
            // 备份 Header 供以后使用
            $.setdata(JSON.stringify(headers), "migu_headers");

            $.msg($.name, "✅ 身份信息抓取成功", "正在为您同步执行自动签到...");
            
            // 立即利用当前获取的最新的 RSA 签名和 Token 执行签到
            await doSignIn(headers);
        }
    }
    $.done(); 
}

// 执行签到请求
function doSignIn(capturedHeaders) {
    return new Promise((resolve) => {
        // 根据 HAR 记录推导的签到提交接口
        const signUrl = "https://v.miguvideo.com/task/v3/signIn/doSignIn";
        
        const options = {
            url: signUrl,
            headers: capturedHeaders, // 全套复用 App 刚才计算好的 Header
            body: JSON.stringify({
                "actionId": "sign_in_daily",
                "channelId": "2003"
            })
        };

        $.post(options, (error, response, data) => {
            try {
                const res = JSON.parse(data);
                // 咪咕常见成功码为 200 或 000000
                if (res.code == "200" || res.code == "000000" || res.status == "success") {
                    $.msg($.name, "🎉 签到成功", "奖励已领取，请前往 App 确认");
                } else if (res.message && res.message.includes("已签到")) {
                    $.msg($.name, "提示", "今天已经签到过啦 ☕️");
                } else {
                    $.msg($.name, "⚠️ 签到反馈", res.message || "接口报错，请尝试手动签到");
                }
            } catch (e) {
                $.msg($.name, "❌ 解析失败", "返回数据格式异常");
            }
            resolve();
        });
    });
}

// QX 环境兼容封装
function Env(n) {
    return new (class {
        constructor(n) { this.name = n }
        setdata(v, k) { return $prefs.setValueForKey(v, k) }
        getdata(k) { return $prefs.valueForKey(k) }
        msg(t, s, c) { $notify(t, s, c) }
        post(o, cb) { $task.fetch(o).then(r => cb(null, r, r.body), e => cb(e, null, null)) }
        done() { $done({}) }
    })(n);
}