const path = require("node:path");
const { config } = require("dotenv");

// `next build`/`next start` only default NODE_ENV when it is unset, so
// .env's development-oriented NODE_ENV must not leak into these commands.
// Other scripts (dev, db:seed, db:reset:dev, fixtures:ingest) rely on
// register-env.cjs loading NODE_ENV from .env as a local-only safety guard,
// so that behavior stays untouched here.
const hadNodeEnv = "NODE_ENV" in process.env;

config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true
});

if (!hadNodeEnv) {
  delete process.env.NODE_ENV;
}
