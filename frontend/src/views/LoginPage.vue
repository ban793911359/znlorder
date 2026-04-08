<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__title">微信成交后订单录单 H5</div>
      <div class="login-card__subtitle">运营端 / 仓库端登录</div>

      <van-form @submit="handleSubmit">
        <van-field
          v-model="form.username"
          name="username"
          label="账号"
          placeholder="请输入账号"
          :rules="[{ required: true, message: '请输入账号' }]"
        />
        <van-field
          v-model="form.password"
          name="password"
          type="password"
          label="密码"
          placeholder="请输入密码"
          :rules="[{ required: true, message: '请输入密码' }]"
        />
        <div class="login-actions">
          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="submitting"
          >
            登录
          </van-button>
        </div>
      </van-form>

      <div class="login-tips">
        <div>测试账号：</div>
        <div>operator / Operator@123</div>
        <div>warehouse / Warehouse@123</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showSuccessToast } from 'vant';
import { login } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  username: '',
  password: '',
});

const submitting = ref(false);

onMounted(() => {
  if (authStore.isLoggedIn) {
    router.replace(authStore.getHomePath());
  }
});

async function handleSubmit() {
  submitting.value = true;
  try {
    const response = await login(form);
    authStore.setAuth(response.data);
    showSuccessToast('登录成功');
    router.replace(authStore.getHomePath());
  } finally {
    submitting.value = false;
  }
}
</script>
