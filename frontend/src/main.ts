import { createApp } from 'vue';
import { createPinia } from 'pinia';
import {
  Button,
  ConfigProvider,
  DropdownItem,
  DropdownMenu,
  Empty,
  Field,
  Form,
  Popup,
  Stepper,
  Tab,
  Tabbar,
  TabbarItem,
  Tabs,
  Tag,
  Uploader,
} from 'vant';
import 'vant/lib/index.css';
import App from './App.vue';
import router from './router';
import './styles/base.css';
import './styles/theme.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.component('VanConfigProvider', ConfigProvider);
[
  Button,
  DropdownItem,
  DropdownMenu,
  Empty,
  Field,
  Form,
  Popup,
  Stepper,
  Tab,
  Tabbar,
  TabbarItem,
  Tabs,
  Tag,
  Uploader,
].forEach((component) => {
  app.use(component);
});
app.mount('#app');
