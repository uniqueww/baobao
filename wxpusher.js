/**
 * WxPusher推送服务
 * author: uniqueww
 * desc: 配置WXPUSHER_APP_TOKEN （apptoken）和 WXPUSHER_DEFULT（默认主题ID）
 */
const axios = require('axios');


const getConfig = () => {
  const appToken = process.env.WXPUSHER_APP_TOKEN;
  //topicIds 是一个逗号分隔的字符串
  const topicIds = process.env.WXPUSHER_DEFULT;
  if (!appToken || !topicIds) {
    console.log('请先设置 WXPUSHER_APP_TOKEN 和 WXPUSHER_DEFULT');
    process.exit(0);
  }
  const topicIdsArray = topicIds.split(',');
  return { appToken, topicIdsArray };
}

const { appToken, topicIdsArray } = getConfig();

// 发送WxPusher通知消息
async function wxPusherNotify(text,summary,desp,topicIds = topicIdsArray) {
  try {
    const response = await axios.post('https://wxpusher.zjiecode.com/api/send/message', {
      appToken: appToken,
      content: text,
      summary: summary,
      url: desp,
      contentType: 2,
      topicIds: topicIds
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.code === 1000) {
      console.log('WxPusher发送通知消息成功。\n');
    } else {
      console.log(`WxPusher发送通知消息异常 ${response.data.msg}\n`);
    }
  } catch (error) {
    console.error('WxPusher发送通知消息失败\n', error);
  }
}

// 导出函数
module.exports = wxPusherNotify;