import express from "express";
import * as path from "path";
import * as ws from "websocket";
import * as http from "http";
import { promisify } from "util";
import { serverController } from "./serverController";

new serverController(8001);

const app = express();
app.use('/static', express.static(path.resolve(__dirname, '../../static')));
app.get('/', (req,res) => res.redirect('/static/html/index.html'));
app.listen(80, () => console.log("Listening to :80!"));
