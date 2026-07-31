'use strict';

import 'font-awesome/css/font-awesome.css';

// Vue Components
import { createApp } from 'vue';
import Popup from './Popup.vue';
import { router } from '@/lib/useRouter.js';
import { i18n } from '@/services/i18n';
import './styles/shared.scss';

document.documentElement.setAttribute('theme', 'light');

const app = createApp(Popup);
app.config.globalProperties.$router = router;
app.config.globalProperties.$t = i18n.t;
app.mount('#app');
