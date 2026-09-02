const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

const a2uiSubpaths = {
  "@a2ui/web_core/v0_9": require.resolve("@a2ui/web_core/v0_9"),
  "@a2ui/web_core/v0_9/basic_catalog": require.resolve(
    "@a2ui/web_core/v0_9/basic_catalog",
  ),
};

const reactNativeEntry = require.resolve("react-native", { paths: [projectRoot] });
const reactEntry = require.resolve("react", { paths: [projectRoot] });

config.watchFolders = [
  ...new Set([...(config.watchFolders ?? []), workspaceRoot]),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "react-native": path.dirname(reactNativeEntry),
  react: path.dirname(reactEntry),
};

config.resolver.unstable_enablePackageExports = true;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const mapped = a2uiSubpaths[moduleName];
  if (mapped) {
    return { type: "sourceFile", filePath: mapped };
  }
  if (moduleName === "react-native") {
    return { type: "sourceFile", filePath: reactNativeEntry };
  }
  if (moduleName === "react") {
    return { type: "sourceFile", filePath: reactEntry };
  }
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith(".") || !moduleName.includes("/")) {
      throw error;
    }
    const searchFrom = context.originModulePath
      ? path.dirname(context.originModulePath)
      : projectRoot;
    try {
      return {
        type: "sourceFile",
        filePath: require.resolve(moduleName, {
          paths: [searchFrom, projectRoot],
        }),
      };
    } catch {
      throw error;
    }
  }
};

module.exports = config;
