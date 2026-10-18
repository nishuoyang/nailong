(function () {
  try {
    var stored = localStorage.getItem('theme')
    var dark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (dark) document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  } catch (error) {
    /* localStorage can be unavailable in private modes; light remains the default. */
  }
})()
