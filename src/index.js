import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

import * as schemas from "./schemas/index.js";
import findParticipantByName from "./middlewares/findParticipantByName.js";

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

//Remoção de usuários inativos
setInterval(async () => {
  const agora = Date.now();
  const participants = await db.collection("participants").find({}).toArray();
  
  participants.forEach(async (participant) => {
    if (agora - participant.lastStatus >= 10000) {

      try {
        const result = await db
          .collection("participants")
          .deleteOne({ _id: ObjectId(participant._id) });

        if (result.deletedCount === 1) {
          await db.collection("messages").insertOne({
            from: participant.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss"),
          });
        }
      } catch (err) {
        return console.log("Alguma coisa deu errada internamente: " + err);
      }
    }
  });
}, 10000);

app.post("/participants", findParticipantByName, async (req, res) => {
  const participant = req.body;
  const statusValidate = schemas.participants.validate(participant);
  const collection = db.collection("participants");
  const messages = db.collection("messages");

  if (statusValidate.error) {
    res.status(422).send("name deve ser string não vazio");
    return;
  }

  if (req.findedUser) return res.status(409).send("Nome de usuário em uso");

  try {
    await collection.insertOne({
      ...participant,
      lastStatus: Date.now(),
    });

    await messages.insertOne({
      from: participant.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    return res.status(500).send("Erro interno: " + error);
  }
});

app.get("/participants", async (_, res) => {
  const collection = db.collection("participants");
  const participants = await collection.find({}).toArray();
  res.status(200).send(participants);
});

app.post("/messages", findParticipantByName, async (req, res) => {
  const message = req.body;
  const from = req.headers.user;
  const collection = db.collection("messages");
  const statusValidade = schemas.messages.validate(message);

  if (statusValidade.error || !req.findedUser) {
    return res.sendStatus(422);
  }

  try {
    await collection.insertOne({
      ...message,
      from: from,
      time: dayjs().format("HH:mm:ss"),
    });
    await db
      .collection("participants")
      .updateOne({ name: from }, { $set: { lastStatus: Date.now() } });
    return res.sendStatus(201);
  } catch (err) {
    return res.status(500).send(err);
  }
});

app.get("/messages", async (req, res) => {
  const user = req.headers.user;
  const limit = req.query.limit ? Number(req.query.limit) : Infinity;
  const collection = db.collection("messages");

  if (limit <= 0 || isNaN(limit)) return res.sendStatus(422);

  try {
    let messages;

    messages = await collection
        .find({ $or: [{ from: user }, { to: user }, { to: "Todos" }] })
        .toArray();
    
    messages.reverse();

    if (limit !== Infinity) {
      messages = messages.slice(0, limit);
    }

    return res.status(200).send(messages);
  } catch (error) {
    return res.status(500).send({ msg: "Algo deu errado internamente", error });
  }
});

app.post("/status", findParticipantByName, async (req, res) => {
  const collection = db.collection("participants");
  const user = req.findedUser;

  if (!user) return res.sendStatus(404);

  try {
    await collection.updateOne(user, { $set: { lastStatus: Date.now() } });
    return res.sendStatus(200);
  } catch (error) {
    return res.status(500).send("Erro interno! Cód: I-103");
  }
});

app.listen(5000, () => {
  console.log("Servidor online");
});
