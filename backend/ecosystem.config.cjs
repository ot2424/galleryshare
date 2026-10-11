module.exports = {
  apps: [{
    name: "galleryshare-api",
    cwd: __dirname,
    script: "./index.js",
    env: { NODE_ENV: "production", PORT: "3000", HOST: "127.0.0.1" },
    instances: 1,
    autorestart: true,
    restart_delay: 5000
  }]
};
