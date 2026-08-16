const path = require("node:path");
const { config } = require("dotenv");

const hadNodeEnv = "NODE_ENV" in process.env;

config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true
});

if (!hadNodeEnv) {
  delete process.env.NODE_ENV;
}

