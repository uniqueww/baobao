/**
 * 金价监控
 * cron: 0 8-20 * * *
 * const $ = new Env('金价监控');
 * author: uniqueww
 * desc: 监控金价是否达到预期价格，以及每周三金价推送
 */
const axios = require('axios');
// 在其他文件中调用
const wxPusher = require('./wxpusher.js');
const imageUrl = 'https://webquotepic.eastmoney.com/GetPic.aspx?token=44c9d251add88e27b65ed86506f6e5da&nid=118.SHAU&type=r&imageType=rf';
// API Key 和环境变量的目标金价

const getConfig = () => {
    const API_KEY = process.env.TS_API_KEY;
    const TARGET_PRICE = process.env.TARGET_PRICE || 580; // 从环境变量读取金价，默认值为580
    if (!API_KEY) {
        console.log('TS_API_KEY 必须设置');
        process.exit(1);
    }
    return { API_KEY, TARGET_PRICE };
}

const { API_KEY, TARGET_PRICE } = getConfig();

// 通知函数（可以根据需要替换为实际的通知逻辑，例如发送邮件或消息）
function sendNotification(message, summary) {
    // 构造 HTML 格式的消息内容
    const htmlMessage = `
        <div style="font-family: 'Arial', sans-serif; text-align: center; line-height: 1.8; color: #333; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 10px; max-width: 600px; margin: 20px auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #4CAF50; font-size: 24px; margin-bottom: 10px; font-weight: bold;">✨ 金价通知 ✨</h2>
            <p style="font-size: 16px; color: #555; margin-bottom: 20px;">${message}</p>
            <a href=${imageUrl} style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #4CAF50; text-decoration: none; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">点击查看详情</a>
        </div>
    `;
    wxPusher(htmlMessage, summary, imageUrl);
}

// 查询金价的函数
async function fetchGoldPrice() {
    try {
        const response = await axios.get('https://api.tanshuapi.com/api/gold/v1/shgold2', {
            params: { key: API_KEY }
        });

        if (response.data.code !== 1) {
            console.error('API 返回错误:', response.data.msg);
            return;
        }

        const data = response.data.data.list;
        const goldPrice = parseFloat(data['Au9999'].price); // 获取 Au9999 的最新金价
        console.log(`当前 Au9999 金价: ${goldPrice} 元/克`);

        // 判断是否需要发送通知
        const now = new Date();
        const isWednesday = now.getDay() === 3; // 判断是否是周三
        const isWithinTime = now.getHours() === 9; // 判断是否在早上9点
        if (goldPrice < TARGET_PRICE) {
            const message = `
                当前金价为 <span style="color: #E53935; font-weight: bold;">${goldPrice} 元/克</span>，
                低于设定的目标金价 <span style="color: #4CAF50; font-weight: bold;">${TARGET_PRICE} 元/克</span>！
            `;
            const summary = `金价波动啦，快来围观~ 🎉`;
            sendNotification(message, summary.substring(0, 100)); // 限制摘要长度为100字符
        } else if (isWednesday && isWithinTime) {
            const message = `
                <b style="color: #FF9800;">今天是周三！</b><br>
                当前金价为 <span style="color: #4CAF50; font-weight: bold;">${goldPrice} 元/克</span>！
            `;
            const summary = `特别的日子，特别的通知！💌`;
            sendNotification(message, summary.substring(0, 100)); // 限制摘要长度为100字符
        } else {
            console.log('不符合发送通知的条件。');
        }
    } catch (error) {
        console.error('查询金价时出错:', error.message);
    }
}

fetchGoldPrice();


