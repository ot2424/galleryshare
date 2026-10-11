import { createRouter, createWebHistory } from 'vue-router'
import Home from './components/Home.vue'
import Login from './components/Login.vue'
import AdminDashboard from './components/AdminDashboard.vue'
import Gallery from './components/Gallery.vue'
import NotFound from './components/NotFound.vue'
import PrivacyPolicy from './components/PrivacyPolicy.vue'

const routes = [
  {
    path: '/',
    component: Home
  },
  {
    path: '/login',
    component: Login
  },
  {
    path: '/admin',
    component: AdminDashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/gallery/:galleryId',
    component: Gallery,
    props: true
  },
  {
    path: '/datenschutz',
    component: PrivacyPolicy
  },
  {
    path: '/notfound',
    component: NotFound
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/notfound'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('auth')
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
