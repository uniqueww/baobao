
//const var let的区别
//总结来说，const用于不可变的常量，let用于可变的变量且具有块级作用域，而var则用于可变的变量但具有函数作用域或全局作用域。
//使用let和const可以帮助避免var带来的作用域问题，是现代JavaScript编程的推荐做法。


const axios = require("axios");

const huaxiaozhu = axios.create({
    baseURL: "https://as.hongyibo.com.cn",
    headers: {
        "Content-Type": "application/json",
    },
});
huaxiaozhu.get("/ep/as/toggles", {
    params: {
        __lang: "zh-CN",
        api_version: "1.0",
        app_version: "1.10.12",
        bundle_ver: "1.10.12.120516481",
        channel: "123765",
        city: "19",
        key: "51f2decd53107b8940c28f3a203b7f35",
        location_cityid: "19",
        location_country: "CN",
        map_type: "soso",
        ns: "kflower_passenger",
        order_city: "19",
        origin_id: "1",
        os_type: "ios",
        os_version: "17.6.1",
        ticket: "",
        uid: "0",
    },
    headers: {
        "User-Agent": "KFlower/1.10.12 (iOS)",
        "Accept-Language": "zh-Hans-CN;q=1",
        "Connection": "keep-alive",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept": "*/*",
    },
}).then((res) => {
    console.log(res.data);
}).catch((err) => {
    console.log(err);
});

