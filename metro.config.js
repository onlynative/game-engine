// Maps the package name to the in-repo source so the demo app imports the
// engine the same way external consumers will. Keeps private-import leaks loud.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const enginePath = path.resolve(projectRoot, 'src/engine');

config.resolver = config.resolver ?? {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@onlynative/game-engine': enginePath,
};

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), enginePath]),
);

module.exports = config;
