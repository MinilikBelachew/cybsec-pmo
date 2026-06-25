module.exports = {
  apps : [
    {
      name: "cybersec-frontend",
      cwd: "./frontend",      // Moves into /var/www/konax/web/frontend
      script: "npm",
      args: "start",          // Runs 'npm start' (requires 'next build' first)
      env: {
        PORT: 3000,           // Next.js will pick this up
        NODE_ENV: "production"
      }
    },
    {
      name: "cybersec-backend",
      cwd: "./backend",       // Moves into /var/www/konax/web/backend
      script: "./dist/src/main.js", 
      env: {
        PORT: 6001,
        NODE_ENV: "production"
      }
    }
  ]
}