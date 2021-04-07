#!/usr/bin/env node

const NodeHub = require("./src/NodeHub");
const commandLineArgs = require("command-line-args");

const optionDefinitions = [
  { name: "port", alias: "p", type: Number },
  { name: "configdir", alias: "c", type: String },
];

const options = commandLineArgs(optionDefinitions);
var config = {};
if ("port" in options) {
  config.port = options.port;
}
if ("configdir" in options) {
  config.configdir = options.configdir;
} else {
  config.configdir = "./NodeHub/conf";
}
var node = new NodeHub(config);
node.start();

process.on("exit", () => {
  node.disconnect();
});
