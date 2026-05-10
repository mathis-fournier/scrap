// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: "finder-api",
            script: "./server.js",
            watch: false,
            env: { NODE_ENV: "production" }
        },
        {
            name: "finder-cron",
            script: "./cron.js",
            watch: false,
            env: { NODE_ENV: "production" }
        },
        {
            name: "finder-worker",
            script: "./scraperWorker.js",
            watch: false,
            env: { NODE_ENV: "production" }
        }
    ]
};