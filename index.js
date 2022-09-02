import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
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

const nameSchema = joi.object({
    name: joi.string().trim().min(1).max(30).required().strict(),
});

const messageSchema = joi.object({
    to: joi.string().trim().min(1).required(),
    text: joi.string().trim().min(1).required(),
    type: joi.string().equal("message").equal("private_message"),
});

const now = dayjs().format("HH:mm:ss");

app.post("/participants", async (req, res) => {
    const participant = req.body.name;

    const validation = nameSchema.validate(
        {
            name: participant,
        },
        { abortEarly: false }
    );

    if (validation.error) {
        const erros = validation.error.details.map(
            (details) => details.message
        );
        return res.status(422).send(erros);
    }

    const alreadyExists = await db
        .collection("participants")
        .findOne({ name: participant });

    if (alreadyExists) {
        return res.status(409).send({ message: "Nome já existente" });
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

app.get("/participants", async (req, res) => {
    try {
        const participants = await db
            .collection("participants")
            .find()
            .toArray();

        res.send(participants);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    const validation = messageSchema.validate(
        {
            to,
            text,
            type,
        },
        { abortEarly: false }
    );

    if (validation.error) {
        const erros = validation.error.details.map(
            (details) => details.message
        );
        return res.status(422).send(erros);
    }

    res.send(text);
});

app.listen(5000, () => console.log("escutando na porta 5000"));
