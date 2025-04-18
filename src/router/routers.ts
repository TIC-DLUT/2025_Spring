//对外暴露配置路由

// 静态路由
export const constantRoute = [
    {path: '/', redirect: '/login', meta: {title: '重定向登录', hidden: true, icon: "Position"}},
    {
        path: '/login',
        component: () => import('@/views/login/index.vue'),
        name: 'login',
        meta: {title: '登录', hidden: true, icon: "Position"}
    },
    {
        path: '/layout', component: () => import('@/layout/index.vue'), name: 'layout',
        // 二级路由
        children: [
            {
                path: '/layout/home',
                component: () => import('@/views/home/index.vue'),
                name: 'home',
                meta: {title: '首页', hidden: false, icon: "House"}
            }
        ],
        meta: {title: '', hidden: false, icon: ""}
    },
    {
        path: '/AI_Filter',
        component: () => import('@/layout/index.vue'),
        name: 'AI_Filter',
        redirect: '/AI_Filter/AI_Chat',
        children: [
            {
                path: '/AI_Filter/AI_Chat',
                component: () => import('@/views/AIFilter/chat/index.vue'),
                name: 'AI_Chat',
                meta: {title: 'AI对话', hidden: false, icon: "ChatSquare"}
            },
        ],
        meta: {title: 'AI能力选择', hidden: false, icon: "Filter"}
    },
    {
        path: '/404',
        component: () => import('@/views/404/index.vue'),
        name: '404',
        meta: {title: '404', hidden: true, icon: "Position"}
    },
    {path: '/:pathMatch(.*)*', redirect: '/404', name: 'any', meta: {title: '兜底', hidden: true, icon: "Position"}},
]