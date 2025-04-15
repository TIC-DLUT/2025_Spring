//进行axios二次封装 请求与响应拦截器
import axios from "axios"

//创建aixos实例 进行配置
let request = axios.create({
    baseURL: import.meta.env.VITE_APP_BASE_API,
    timeout: 5000, //请求超时时间
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    }
});


//请求拦截器
request.interceptors.request.use((config) => {
    //config配置对象  headers属性请求头 经常给服务器携带公共参数
    return config;
});

//响应拦截器
request.interceptors.response.use(
    (res) => {
        //成功回调   简化数据
        return res.data;
    },
    (err) => {
        //失败回调  处理http网络错误
        let message = '';
        const status = err.response.status;
        switch (status) {
            case 400:
                message = "参数出错";
                break;
            default:
                message = err.message;
                break;
        }
        //失败回调  处理http网络错误
        return Promise.reject(new Error(message));
    })

//对外暴露
export default request;