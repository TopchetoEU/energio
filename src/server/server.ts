import express from "express";
import * as path from "path";
import { serverController } from "./serverController";
import { getConfig } from "./gameConfig";
import { v4 as uuidV4 } from "uuid";
let nextId = 0;

export function getNextObjId() {
    return uuidV4();
}

let controller = new serverController(8002, getConfig(), 0.1);

const app = express();
app.use('/', express.static(path.resolve(__dirname, '../../static')));
app.get('*', (req,res) => res.redirect('/index.html'));
const server = app.listen(80, () => console.log("Listening to :80!"));

// Nodemon weirdness
process.once('SIGUSR2', function () {
    process.exit(0);
});
process.on('SIGINT', function () {
    process.exit(0);
});

process.once('exit', () => {
    controller.httpServer.close();
    server.close();
});