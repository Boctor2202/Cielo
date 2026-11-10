// Metro configuration for the pnpm monorepo.
// Expo's default config already detects workspaces; we make the monorepo settings explicit
// so that the TypeScript sources of packages/* (symlinked by pnpm) are watched and transformed.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Symlinks (pnpm isolated node_modules) and package "exports" are resolved by Metro by default.

module.exports = config;
