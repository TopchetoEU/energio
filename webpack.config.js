const _path = require('path');

module.exports = {
    mode: "production",
    entry: "./build/client/entry.js",
    output: {
        path: _path.resolve(__dirname, 'static/js'),
        filename: 'bundle.js',
        publicPath: '/static/js',
        sourceMapFilename: 'sourcemap.js',
        // library: {
        //     type: "umd",
        //     name: "shooter-lib",
        // },
        // uniqueName: "shooter",
    },
    module: {
        rules: [{
            test: (/\.js$/g),
            include: [ _path.resolve(__dirname, 'build/client') ],
            // loader: "babel-loader",
            // options: {
            //     presets: ["es2015"]
            // },
            // use: [
            //     "htmllint-loader",
            //     {
            //         loader: "html-loader",
            //         options: {
            //         // ...
            //         }
            //     }
            // ],
        }],
    },
    // devServer: {
    //     contentBase: _path.resolve(__dirname, 'static'),
    //     compress: true,
    //     hot: true,
    //     port: 10,
    //     publicPath: '/',
    //     host: '192.168.0.104',
    //     disableHostCheck: true,
    //     open: true,
    // },
};