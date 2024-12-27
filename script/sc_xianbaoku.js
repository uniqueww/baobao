/**
 * 线报酷监控
 * cron: 5 8-23 * * *
 * const $ = new Env('线报酷监控');
 * author: uniqueww
 * desc: 线报酷微信立减金监控，可魔改线报酷其他监控
 */
const axios = require("axios");
const wxPusher = require('../wxpusher.js');
const fs = require("fs");

const timeout = 15000;
const domin = "http://new.ixbk.net";
const newUrl = domin + "/plus/json/rank/yixiaoshi.json";

const pingbifenlei = "微博线报|线报活动|食品饮料|个护美妆|服饰鞋帽|居家生活|母婴儿童|数码电子|运动户外|宠物天地|医疗保健|更多好物|豆瓣线报|豆瓣买组|豆瓣拼组|豆瓣发组|豆瓣狗组|爱猫生活|爱猫澡盆|小嘀咕|酷安|葫芦侠三楼|小刀娱乐网|3K8资讯网|技术QQ网|YYOK大全|活动资讯网|免费赚钱中心线报活动|食品饮料|个护美妆|服饰鞋帽|居家生活|母婴儿童|数码电子|运动户外|宠物天地|医疗保健|更多好物买组|拼组|发组|狗组|爱猫生活|爱猫澡盆";
const pingbitime = "5";
const PUSH_TOPIC = process.env.XBTOPIC;

function daysComputed(time) {
    const oldTimeFormat = new Date(time.replace(/-/g, "/"));
    const nowDate = new Date();
    const diffTime = nowDate.getTime() - oldTimeFormat.getTime();
    return diffTime > 0 ? parseInt(diffTime / (60 * 60 * 24 * 1000)) : 0;
}

function listfilter(group, pingbifenlei, pingbitime) {
    if (pingbitime && group.louzhuregtime) {
        if (pingbitime > daysComputed(group.louzhuregtime)) {
            return false;
        }
    }
    if (pingbifenlei && group.catename) {
        if (group.catename.match(new RegExp(pingbifenlei, "i"))) {
            return false;
        }
    }
    return true;
}

function ensureFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "[]");
    }
}

function fixJsonFile(filePath) {
    ensureFileExists(filePath);
    try {
        JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        console.error(`JSON解析错误，重置文件${filePath}：`, error);
        fs.writeFileSync(filePath, "[]");
    }
}

function readMessages(filePath) {
    fixJsonFile(filePath);
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data || "[]");
}

function isMessageInFile(message, filePath) {
    const messages = readMessages(filePath);
    return messages.some((existingMessage) => existingMessage.id === message.id);
}

function appendMessageToFile(message, filePath) {
    ensureFileExists(filePath);
    const messages = readMessages(filePath);
    messages.push({ id: message.id });
    if (messages.length > 100) {
        messages.splice(0, messages.length - 100);
    }
    fs.writeFileSync(filePath, JSON.stringify(messages), "utf8");
}

function getFileName(url) {
    const parts = url.split("/");
    return parts[parts.length - 1];
}

function generateRegexString(keywords) {
    return ".*" + keywords.map((keyword) => `(?=.*${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`).join("") + ".*";
}


(async () => {
    console.debug("开始获取线报酷数据...");
    try {
        const response = await axios.get(newUrl, { timeout });
        const xbkdata = response.data || [];
        let items = [];

        xbkdata.forEach((item) => {
            if (!isMessageInFile(item, getFileName(newUrl))) {
                appendMessageToFile(item, getFileName(newUrl));
                if (listfilter(item, pingbifenlei, pingbitime)) {
                    items.push(item);
                }
            }
        });

        //自定义包含的关键词
        const patterns = [
            generateRegexString(["招商", "立减金"]),
            generateRegexString(["招行", "立减金"]),
            generateRegexString(["平安", "立减金"]),
            generateRegexString(["工行", "立减金"]),
            generateRegexString(["工商", "立减金"]),
            generateRegexString(["中行", "立减金"]),
            generateRegexString(["中国银行", "立减金"]),
        ];
        const zkt_gjc = patterns.join("|");

        items = items.filter((item) => new RegExp(zkt_gjc, "i").test(item.title));

        let hebingdata = "";
        for (const item of items) {
            const text = item.title;
            const desp = domin + item.url;
            await wxPusher(text, text, desp, ...(PUSH_TOPIC ? PUSH_TOPIC : null));

            if (hebingdata) hebingdata += "\n\n";
            hebingdata += `${item.title}【${item.catename}】${desp}`;
        }

        console.log("*******************************************");
        console.debug(`获取到${xbkdata.length}条数据，筛选后的新数据${items.length}条，本次任务结束`);
    } catch (error) {
        console.error("获取和解析线报酷时发生错误:", error);
    }
})();
