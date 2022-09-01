import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

//console.log(process.env.BOLINHA, process.env.MONGO_URI);
const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect().then(() => {
    db = mongoClient.db("apiuol");
});

const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
});

app.post("/participants", async (req, res) => {
    const participant = req.body.name;
    const now = dayjs().format("HH:mm:ss");

    const alreadyExists = await db
        .collection("participants")
        .findOne({ name: participant });

    if (alreadyExists) {
        return res.status(409).send({ message: "Nome já existente" });
    }

    try {
        const value = await schema.validateAsync({
            username: participant,
        });
    } catch (err) {
        return res.status(422).send({ message: "Nome irregular" });
    }

    try {
        const newParticipant = await db
            .collection("participants")
            .insertOne({ name: participant, lastStatus: Date.now() });

        const loginMessage = await db.collection("messages").insertOne({
            from: participant,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: now,
        });

        return res.sendStatus(201);
    } catch (error) {
        return res.sendStatus(500);
    }
});

app.listen(5000, () => console.log("escutando na porta 5000"));
