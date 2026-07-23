module.exports = {
  apps: [
    {
      name: 'wg-controller',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',

      // همیشه بعد از کرش یا خروج، دوباره اجرا شود
      autorestart: true,
      max_restarts: 1000000, // عملا نامحدود
      min_uptime: '10s', // اگر کمتر از این مدت زنده بماند، "کرش سریع" حساب می‌شود
      restart_delay: 3000, // 3 ثانیه قبل از هر ری‌استارت صبر کن
      exp_backoff_restart_delay: 100, // اگر پشت‌سرهم کرش کرد، فاصله‌ها را افزایشی کن

      // اگر پروسه بیش از حد رم مصرف کرد، خودش را ری‌استارت کند
      max_memory_restart: '400M',

      // ری‌استارت خودکار روزانه ساعت 4 صبح برای جلوگیری از نشتی حافظه بلندمدت (اختیاری)
      cron_restart: '0 4 * * *',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // لاگ‌ها
      out_file: '/var/log/wg-controller/out.log',
      error_file: '/var/log/wg-controller/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
