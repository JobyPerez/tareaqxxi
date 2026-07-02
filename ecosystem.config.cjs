module.exports = {
  apps: [
    {
      name: "tareaqxxi",
      script: "server.js",
      cwd: "/home/ubuntu/DEV-JPG/tareaqxxi",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
