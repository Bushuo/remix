import * as fs from "fs";
import * as path from "path";

import type { RemixConfig } from "../config";

type PackageDependencies = { [packageName: string]: string };

export function getPackageDependencies(
  packageJsonFile: string
): PackageDependencies {
  let pkg = JSON.parse(fs.readFileSync(packageJsonFile, "utf8"));
  return pkg?.dependencies || {};
}

export function getAppDependencies(config: RemixConfig): PackageDependencies {
  return getPackageDependencies(
    path.resolve(config.rootDirectory, "package.json")
  );
}

export function getDependenciesToBundle(...pkg: string[]): string[] {
  let aggregatedDeps = new Set<string>(pkg);
  let visitedPackages = new Set<string>();

  pkg.forEach((p) => {
    getPackageDependenciesRecursive(p, aggregatedDeps, visitedPackages);
  });

  return Array.from(aggregatedDeps);
}

function tryResolvePackageByName(pkg: string): string | null {
  try {
    return require.resolve(pkg);
  } catch (err: any) {
    switch (err?.code) {
      case "ERR_PACKAGE_PATH_NOT_EXPORTED":
        // happens when a dependency has no main field and can not be resolved just by its name
        console.error(`Package "${pkg}"'s "package.json" does not provide a "main" field. 
        Please exclude subdependencies yourself!`);
        break;

      case "ERR_MODULE_NOT_FOUND":
        // happens when a dependency can not be resolved such as `@types/*`
        console.error(`Package "${pkg}" could not be resolved!`);
        break;
      default:
        break;
    }
  }
  return null;
}

function getPackageDependenciesRecursive(
  pkg: string,
  aggregatedDeps: Set<string>,
  visitedPackages: Set<string>
): void {
  visitedPackages.add(pkg);

  let pkgPath = tryResolvePackageByName(pkg);
  if (!pkgPath) {
    return;
  }

  let pkgLocation = `node_modules/${pkg}`;
  let lastIndexOfPackageName = pkgPath.lastIndexOf(pkgLocation);
  if (lastIndexOfPackageName !== -1) {
    pkgPath = pkgPath.substring(0, lastIndexOfPackageName + pkgLocation.length);
  }
  let pkgJson = path.join(pkgPath, "package.json");
  if (!fs.existsSync(pkgJson)) {
    console.log(pkgJson, `does not exist`);
    return;
  }

  let dependencies = getPackageDependencies(pkgJson);

  Object.keys(dependencies).forEach((dep) => {
    aggregatedDeps.add(dep);
    if (!visitedPackages.has(dep)) {
      getPackageDependenciesRecursive(dep, aggregatedDeps, visitedPackages);
    }
  });
}
