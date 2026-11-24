const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'db' to assetExts so SQLite database files in assets can be bundled and required
config.resolver.assetExts.push('db');

module.exports = config;
