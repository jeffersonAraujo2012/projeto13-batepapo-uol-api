import { MongoClient } from "mongodb";

export default async function findParticipantByName(req, res, next) {
  //Database connection
  const mongoClient = new MongoClient(process.env.DATABASE_URL);
  let db;

  await mongoClient.connect().then(() => {
    db = mongoClient.db();
  });

  const name = req.headers.user;
  console.log(name);
  const collection = db.collection("participants");

  const user = await collection.findOne({name: name});
  req.findedUser = user;
  
  next();
}
