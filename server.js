const { initContent } = require('./src/content-store');
const { createApp } = require('./src/app');

(async () => {
  await initContent();
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Mesterbygg Stryn-nettsida køyrer på port ${port}`);
  });
})().catch((err) => {
  console.error('Klarte ikkje starte tenaren:', err);
  process.exit(1);
});
