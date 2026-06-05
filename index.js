const app = require('./src/app');
const { PORT, NODE_ENV } = require('./src/config');

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT} [${NODE_ENV}]`);
  });
}

module.exports = app;
