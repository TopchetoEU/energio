// @ts-ignore
import webpackPipe from "webpack-stream";
import nodemonPipe from "gulp-nodemon";
import webpack, { Configuration as webpackConfig } from "webpack";
import sassPipe from "gulp-sass";
import sass from "sass";
import typescriptPipe, { Settings as typescriptConfig } from "gulp-typescript";
import merge from "merge-stream";
import { src, dest, parallel, task, watch as gulpWatch } from "gulp";
import * as _path from "path";

const webpackConf = (devMode = false, watch = false) =>  ({
    mode: devMode ? 'development' : 'production',
    watch,
    entry: "./src/client/entry.ts",
    devtool: 'source-map',
    output: {
        path: _path.resolve(__dirname, 'static/js'),
        filename: 'bundle.js',
        publicPath: '/static/js',
    },
    module: {
        rules: [{
            test: /\.tsx?$/,
            use: 'ts-loader',
        }],
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ],
    }
});
const typescriptConf: typescriptConfig = {
    rootDir: 'src',
    target: 'ES6',
    module: "commonjs",
    outDir: "build",
    strict: true,
    esModuleInterop: true,
    experimentalDecorators: true,
    forceConsistentCasingInFileNames: true,
};

const style = () => 
    src('src/style.scss')
        .pipe(sassPipe(sass)())
        .pipe(dest('static/css'), { end: true });

const client = (devMode = false, watch = false) => () => {
    const conf = webpackConf(devMode, watch);

    return src(conf.entry as string | string[])
        .pipe((webpackPipe as Function)(conf as any, webpack)) // stupid webpack dep bug
        .pipe(dest('static/js'));
}
const server = () => {
    const tsPipe = (dir: string) => src(`src/${dir}/**/*.ts`)
        .pipe(typescriptPipe(typescriptConf))
        .pipe(dest(`build/${dir}`), { end: true });
    return merge(tsPipe('server'), tsPipe('common'));
}

task('style', () => src('src/style.scss')
    .pipe(sassPipe(sass)())
    .pipe(dest('static/css'), { end: true })
);
task('devel:server', server);
task('devel:client', client(true, false));
task('devel', parallel('devel:server', 'devel:client', 'style'));

task('prod:server', server);
task('prod:client', client(false, false));
task('prod', parallel('prod:server', 'prod:client', 'style'));

task('watch:server', () => {
    return nodemonPipe({
        delay: 1,
        script: 'src/server/server.ts',
        watch: ['src/server', 'src/common']
    });
});
task('watch:client', client(true, true));
task('watch', parallel('watch:server', 'watch:client'));
