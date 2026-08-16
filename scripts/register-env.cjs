const path = require("node:path");
const { config } = require("dotenv");

config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true
});

