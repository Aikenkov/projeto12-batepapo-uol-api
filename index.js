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
    type: joi.string().equal("message").equal("private_message").required(),
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

    const exist = await db.collection("participants").findOne({ name: user });
    if (!exist) {
        return res.sendStatus(422);
    }

    try {
        const message = await db.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: now,
        });
        return res.send(message);
        //return res.sendStatus(201);
    } catch (error) {
        return res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const { user } = req.headers;
    const limit = parseInt(req.query.limit);
    let messages;

    const exist = await db.collection("participants").findOne({ name: user });
    if (!exist) {
        return res.sendStatus(422);
    }

    try {
        messages = await db.collection("messages").find().toArray();
    } catch (error) {
        return res.sendStatus(500);
    }

    const filteredMessages = messages.filter(
        (item) =>
            item.to === user ||
            item.from === user ||
            item.type === "message" ||
            item.type === "status"
    );

    if (limit > 0) {
        filteredMessages.splice(0, filteredMessages.length - limit);
    }

    res.send(filteredMessages);
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;

    const exist = await db.collection("participants").findOne({ name: user });
    if (!exist) {
        return res.sendStatus(404);
    }

    try {
        await db
            .collection("participants")
            .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
        return res.sendStatus(200);
    } catch (error) {
        return res.send(404);
    }
});

setInterval(logOut, 15000);

async function logOut() {
    let participants;
    try {
        participants = await db.collection("participants").find().toArray();
    } catch (error) {
        console.log(500);
    }

    let absent = await participants.filter(
        (user) => user.lastStatus < Date.now() - 10000
    );

    absent.forEach((user) => {
        try {
            db.collection("participants").deleteOne({ name: user.name });
            db.collection("messages").insertOne({
                from: user.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: now,
            });
        } catch (error) {
            console.log(501);
        }
    });
}

app.listen(5000, () => console.log("escutando na porta 5000"));
