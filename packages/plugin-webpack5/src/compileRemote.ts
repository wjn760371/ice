import * as path from 'path';
import * as fse from 'fs-extra';
import { IPluginAPI } from '@alib/build-scripts';

interface IExposes {
  [key: string]: string;
}

export default (api: IPluginAPI, { runtimeFolder, cacheFolder, externalMap, remoteEntry, remoteName, depsPath, compileKeys, pkgDeps }) => {
  const { context, onHook } = api;
  const { webpack } = context;
  const { ModuleFederationPlugin } = (webpack as any).container;

  // create empty entry for build remote runtime
  const mfEntry = path.join(cacheFolder, 'index.js');
  fse.writeFileSync(mfEntry, '', 'utf-8');
  const wepackConfig = {
    mode: process.env.NODE_ENV,
    entry: mfEntry,
    output: {
      chunkLoadingGlobal: 'webpackJsonp',
      uniqueName: 'runtime',
      path: runtimeFolder,
    },
    externals: externalMap,
    optimization: {
      minimize: false,
      chunkIds: 'named',
    },
    plugins: [
      new (webpack as any).ProgressPlugin({}),
      new ModuleFederationPlugin({
        name: remoteName,
        filename: remoteEntry,
        exposes: compileKeys.reduce((pre: IExposes, cur: string) => {
          pre[`./${cur}`] = cur;
          return pre;
        }, {}),
      }),
    ],
  };

  // build runtime before server
  onHook('before.start.load', async () => {
    await new Promise((resolve, reject) => {
      (webpack as any)(wepackConfig, (err, stat) => {
        if (err) {
          reject(err);
        }
        // write cache after webpack compile success
        fse.writeFileSync(depsPath, JSON.stringify(pkgDeps), 'utf-8');
        resolve(stat);
      });
    });
  });
};