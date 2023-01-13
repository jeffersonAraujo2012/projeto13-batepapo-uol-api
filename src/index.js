import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

import * as schemas from "./schemas/index.js";

//Database connection
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db();
});

//App config
const app = express();
app.use(express.json());
app.use(cors());

app.post("/participants", (req, res) => {
  const participant = req.body;
  const statusValidate = schemas.participants.validate(participant);
  const collection = db.collection("participants");

  //console.log(collection);

  if (statusValidate.error) {
    res.status(422).send("name deve ser string não vazio");
    return;
  }

  //Impedir cadastro de um nome que já esteja sendo utilizado
  //ToDo

  const insertPromise = collection.insertOne({
    ...participant,
    lastStatus: Date.now(),
  });

  insertPromise.then(() => res.sendStatus(201));
  insertPromise.catch(() => res.sendStatus(500));
  //Salvar com o MongoDB uma mensagem no formato:
  //{from: 'xxx', to: 'Todos', text: 'entra na sala...', type: 'status', time: 'HH:MM:SS'}
  //TODO
});

app.get("/participants", async (_, res) => {
  const collection = db.collection("participants");
  const participants = await collection.find({}).toArray();
  res.status(200).send(participants);
});

app.listen(5000, () => {
  console.log("Servidor online");
});
