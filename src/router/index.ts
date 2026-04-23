//通过vue-router实现路由配置
import { createRouter, createWebHistory } from "vue-router";
import { constantRoute } from "./routers";
import { GET_TOKEN } from "@/utils/tokens.ts";
//创建路由器
const router = createRouter({
  //使用history模式
  history: createWebHistory(),
  //路由配置 懒加载
  routes: constantRoute,
  //滚动行为
  scrollBehavior() {
    return {
      left: 0,
      top: 0,
    };
  },
});

// 路由守卫：未登录跳转登录页，已登录禁止访问登录页
router.beforeEach((to, from, next) => {
  const token = GET_TOKEN();
  if (token) {
    if (to.path === "/login") {
      next("/AI_Filter/AI_Chat");
    } else {
      next();
    }
  } else {
    if (to.path === "/login") {
      next();
    } else {
      next("/login");
    }
  }
});

export default router;
