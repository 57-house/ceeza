const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuration pour gérer les fichiers WASM nécessaires à expo-sqlite sur le web
config.resolver.assetExts.push('wasm', 'bin');

module.exports = config;

