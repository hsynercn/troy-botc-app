const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');

if (!fs.existsSync(index)) {
  throw new Error('Expo web export did not create dist/index.html');
}

// Static aliases are a convenience; arbitrary IDs require the SPA hosting rewrite.
for (const route of ['home', 'login', 'home/login', 'game-nights', 'leaderboard', 'profile']) {
  const routeDirectory = path.join(dist, route);
  fs.mkdirSync(routeDirectory, { recursive: true });
  fs.copyFileSync(index, path.join(routeDirectory, 'index.html'));
}