import express from "express";
import * as path from "path";
import * as ws from "websocket";
import * as http from "http";
import { promisify } from "util";
import { serverController } from "./serverController";
import { getConfig } from "./gameConfig";

let controller = new serverController(8002, getConfig(), 0.1);

const app = express();
app.use('/', express.static(path.resolve(__dirname, '../../static')));
app.get('*', (req,res) => res.redirect('/index.html'));
app.listen(80, () => console.log("Listening to :80!"));
