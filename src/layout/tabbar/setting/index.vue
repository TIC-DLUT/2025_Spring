<template>
  <el-button
    type="primary"
    size="small"
    icon="Refresh"
    :circle="true"
    @click="updateRefresh"
  ></el-button>
  <el-button
    type="primary"
    size="small"
    icon="FullScreen"
    :circle="true"
    @click="fullScreen"
  ></el-button>
  <el-button
    type="primary"
    size="small"
    icon="Setting"
    :circle="true"
  ></el-button>

  <img
    src="@/assets/icons/AI.svg"
    style="width: 30px; height: 30px; margin: 0px 10px"
    alt="userHead"
  />
  <!-- 下拉菜单 -->
  <el-dropdown @command="handleCommand">
    <span class="el-dropdown-link">
      Dropdown List
      <el-icon class="el-icon--right">
        <arrow-down />
      </el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="logout">退出登录</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script lang="ts">
export default {
  name: "Setting",
};
</script>

<script setup lang="ts">
import { useRouter } from "vue-router";
import useLayoutStore from "@/store/modules/setting";
import useUserStore from "@/store/modules/user";
import { ElMessageBox } from "element-plus";

const layoutStore = useLayoutStore();
const userStore = useUserStore();
const $router = useRouter();

const updateRefresh = () => {
  layoutStore.refresh = !layoutStore.refresh;
};
const fullScreen = () => {
  //Dom对象的一个属性，判断当前是不是全屏模式
  let full = document.fullscreenElement;
  //切换全屏
  if (!full) {
    //利用document对象的方法，让元素进入全屏模式
    document.documentElement.requestFullscreen();
  } else {
    //退出全屏
    document.exitFullscreen();
  }
};

// 下拉菜单命令处理
const handleCommand = (command: string) => {
  if (command === "logout") {
    ElMessageBox.confirm("确定要退出登录吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    })
      .then(() => {
        // 清除用户状态和本地 Token
        userStore.logout();
        // 跳转到登录页
        $router.push("/login");
      })
      .catch(() => {
        // 用户取消，什么都不做
      });
  }
};
</script>

<style scoped></style>
