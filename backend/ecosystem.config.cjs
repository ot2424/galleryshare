module.exports = {
  apps: [
    {
      name: "wedding-backend",
      script: "./index.js",
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};

