import express from "express";
import * as path from "path";
import * as ws from "websocket";
import * as http from "http";
import { promisify } from "util";
import { serverController } from "./serverController";

new serverController(8001);

// const wsHttpServer = http.createServer(() => console.log("received request!"));
// wsHttpServer.on('listening', () => console.log("WS listening to :4001"));
// wsHttpServer.listen(4001);
// const wsServer = new ws.server({
//     httpServer: wsHttpServer,
//     autoAcceptConnections: false
// });
// wsServer.on('request', con => {
//     const connection = con.accept('test');
//     connection.on('message', msg => {
//         if (msg.type === 'utf8') connection.send(msg.utf8Data);
//     });
// });

const app = express();
app.use('/static', express.static(path.resolve(__dirname, '../static')));
app.get('/', (req,res) => res.redirect('/static/html/index.html'));
app.listen(80, () => console.log("Listening to :80!"));
