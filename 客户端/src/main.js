import Vue from 'vue';
import App from './App.vue';

/* 导入公共的样式 && ELEMENT */
import './assets/reset.min.css';
import './assets/common.less';
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';

import qs from 'qs';
import axios from "axios";
axios.defaults.baseURL = 'http://127.0.0.1:8888/'
axios.defaults.headers['Content-Type'] = 'multipart/form-data';
axios.defaults.transformRequest = (data, headers) => {
  let contentType = headers['Content-Type'];
  if (contentType == 'application/x-www-form-urlencoded') return qs.stringify(data)
  return data
}
axios.interceptors.response.use(config => {
  return config.data;
})
Vue.prototype.axios = axios
Vue.use(ElementUI);

Vue.config.productionTip = false;
new Vue({
  render: h => h(App),
}).$mount('#app');