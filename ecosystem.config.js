module.exports = {
  apps: [
    {
      name: "lb-scraper",
      script: "npm",
      args: "run dev",
      cwd: "./telegram-scraper",
      watch: false,
      autorestart: true,
      // Reinicia até 10 vezes. Se cair mais que isso em 30 min, para
      // (evita loop infinito de crash por erro de configuração)
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000, // espera 5s antes de reiniciar
      // Logs persistentes em disco
      out_file: "./logs/scraper-out.log",
      error_file: "./logs/scraper-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
