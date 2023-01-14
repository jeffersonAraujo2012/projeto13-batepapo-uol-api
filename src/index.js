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
  const participants = await fetch("http://localhost:5000/participants").then(
    (res) => res.json()
  );
  participants.forEach(async (participant) => {
    if (Date.now() - participant.lastStatus > 10) {
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
}, 15000);

app.post("/participants", findParticipantByName, (req, res) => {
  const participant = req.body;
  const statusValidate = schemas.participants.validate(participant);
  const collection = db.collection("participants");
  const messages = db.collection("messages");

  if (statusValidate.error) {
    res.status(422).send("name deve ser string não vazio");
    return;
  }

  if (req.findedUser) return res.status(409).send("Nome de usuário em uso");

  const insertPromise = collection.insertOne({
    ...participant,
    lastStatus: Date.now(),
  });

  insertPromise.then(() => res.sendStatus(201));
  insertPromise.catch(() => res.sendStatus(500));

  messages.insertOne({
    from: participant.name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs().format("HH:mm:ss"),
  });
});

app.get("/participants", async (_, res) => {
  const collection = db.collection("participants");
  const participants = await collection.find({}).toArray();
  res.status(200).send(participants);
});

app.post("/messages", (req, res) => {
  const message = req.body;
  const from = req.headers.user;
  const collection = db.collection("messages");
  const statusValidade = schemas.messages.validate(message);
  //Já o from da mensagem, ou seja, o remetente, não será enviado
  //pelo body. Será enviado pelo front através de um header na
  //requisição, chamado User
  //ToDo

  if (statusValidade.error) {
    return res.sendStatus(422);
  }

  const insertPromise = collection.insertOne({
    ...message,
    from: from,
    time: dayjs().format("HH:mm:ss"),
  });
  insertPromise.then(() => res.sendStatus(201));
  insertPromise.catch((err) => res.status(500).send(err));
});

app.get("/messages", async (req, res) => {
  const user = req.headers.user;
  const limit = Number(req.query.limit);
  const collection = db.collection("messages");

  try {
    const messages = await collection
      .find({ $or: [{ from: user }, { to: user }, { to: "Todos" }] })
      .limit(limit)
      .toArray();

    res.status(201).send(messages);
  } catch (error) {
    res.status(500).send({ msg: "Algo deu errado internamente", error });
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
