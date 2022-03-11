const _path = require('path');

module.exports = {
    mode: "production",
    entry: "./build/client/entry.js",
    output: {
        path: _path.resolve(__dirname, 'static/js'),
        filename: 'bundle.js',
        publicPath: '/static/js',
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
    }
};