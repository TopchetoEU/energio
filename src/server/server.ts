import express from "express";
import * as path from "path";
import { serverController } from "./serverController";
import { getConfig } from "./gameConfig";
import { v4 as uuidV4 } from "uuid";
import { props } from "../common/props/decorators";
import { player } from "../common/player";
import { planet } from "../common/planet";
let nextId = 0;

export function getNextObjId() {
    return uuidV4();
}

const clientPort = 80;
const serverPort = 8002;

let controller = new serverController(serverPort, getConfig(), 0.1);

const app = express();
app.use('/', express.static(path.resolve(__dirname, '../../static')));
app.get('*', (req, res) => res.redirect('/index.html'));
const server = app.listen(clientPort, () => console.log("Listening to :80!"));

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
