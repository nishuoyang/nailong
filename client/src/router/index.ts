import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth', top: 96 }
    if (to.path === from.path) return false
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), meta: { title: '发现' } },
    { path: '/story', name: 'story', component: () => import('@/pages/StoryPage.vue'), meta: { title: '奶蛙史' } },
    { path: '/studio', name: 'studio', component: () => import('@/pages/StudioPage.vue'), meta: { title: '表情包工坊' } },
    { path: '/images/:id', name: 'image-detail', component: () => import('@/pages/ImageDetailPage.vue'), meta: { title: '图片' } },
    { path: '/featured', name: 'featured', component: () => import('@/pages/FeaturedPage.vue'), meta: { title: '精选推荐' } },
    { path: '/other', name: 'other', component: () => import('@/pages/OtherPage.vue'), meta: { title: '其他推荐' } },
    { path: '/collections', name: 'collections', component: () => import('@/pages/CollectionsPage.vue'), meta: { title: '收藏夹' } },
    { path: '/collections/:id', name: 'collection-detail', component: () => import('@/pages/CollectionDetailPage.vue'), meta: { title: '收藏夹' } },
    { path: '/tags/:slug', name: 'tag', component: () => import('@/pages/TagPage.vue'), meta: { title: '标签' } },
    { path: '/feed', name: 'feed', component: () => import('@/pages/FeedPage.vue'), meta: { title: '关注动态', requiresAuth: true } },
    { path: '/search', name: 'search', component: () => import('@/pages/SearchPage.vue'), meta: { title: '搜索' } },
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { guest: true, title: '登录' } },
    { path: '/register', name: 'register', component: () => import('@/pages/RegisterPage.vue'), meta: { guest: true, title: '加入' } },
    { path: '/upload', name: 'upload', component: () => import('@/pages/UploadPage.vue'), meta: { requiresAuth: true, title: '投稿' } },
    { path: '/profile', name: 'profile', component: () => import('@/pages/ProfilePage.vue'), meta: { requiresAuth: true, title: '个人主页' } },
    { path: '/users/:id', name: 'user-profile', component: () => import('@/pages/UserProfilePage.vue'), meta: { title: '用户主页' } },
    { path: '/adminpage', name: 'admin-entry', component: () => import('@/pages/AdminPageEntry.vue'), meta: { title: '管理员入口' } },
    { path: '/admin', name: 'admin-dashboard', component: () => import('@/pages/admin/DashboardPage.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '管理概览' } },
    { path: '/admin/images', name: 'admin-images', component: () => import('@/pages/admin/ImageManagePage.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '图片管理' } },
    { path: '/admin/comments', name: 'admin-comments', component: () => import('@/pages/admin/CommentManagePage.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '评论管理' } },
    { path: '/admin/bio-review', name: 'admin-bio-review', component: () => import('@/pages/admin/BioReviewPage.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '简介审核' } },
    { path: '/admin/users', name: 'admin-users', component: () => import('@/pages/admin/UserManagePage.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '用户管理' } },
    { path: '/admin/settings', name: 'admin-settings', component: () => import('@/pages/admin/SettingsPage.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '站点设置' } },
    { path: '/admin/categories', name: 'admin-categories', component: () => import('@/pages/admin/CategoryManagePage.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '分类管理' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue'), meta: { title: '走丢了' } },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (authStore.isLoggedIn && !authStore.user) {
    await authStore.restoreUser()
  }

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guest && authStore.isLoggedIn) {
    return { name: 'home' }
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'home' }
  }

  return true
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = title ? `${title} · 奶龙宇宙` : '奶龙宇宙 · 图片档案馆'
})

export default router
