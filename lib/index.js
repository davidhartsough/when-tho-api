"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vote = exports.create = exports.votes = exports.poll = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger_1 = require("firebase-functions/logger");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const remove_accents_1 = __importDefault(require("remove-accents"));
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const cors = "when-tho.web.app";
function isString(str) {
    return typeof str === "string" && str.length > 1;
}
function getPoll({ name, timestamps }) {
    return { name, timestamps };
}
exports.poll = (0, https_1.onRequest)({ cors }, async (req, res) => {
    (0, logger_1.log)("poll invoked");
    const { id } = req.query;
    (0, logger_1.log)(id);
    if (!isString(id)) {
        (0, logger_1.log)("400 invalid");
        res.status(400).json({ message: "Invalid request", id });
    }
    else {
        (0, logger_1.log)("let's go get the poll");
        const doc = await db.collection("polls").doc(id).get();
        if (!doc.exists) {
            (0, logger_1.log)("404 not found");
            res.status(404).json({ message: "Not found", id });
        }
        else {
            const poll = doc.data();
            (0, logger_1.log)(`got a poll titled: "${poll.name}"`);
            (0, logger_1.log)("200 success");
            res.status(200).json({
                id: doc.id,
                poll: Object.assign({ id: doc.id }, poll),
            });
        }
    }
});
exports.votes = (0, https_1.onRequest)({ cors }, async (req, res) => {
    (0, logger_1.log)("votes invoked");
    const { id } = req.query;
    (0, logger_1.log)(id);
    if (!isString(id)) {
        (0, logger_1.log)("400 invalid");
        res.status(400).json({ message: "Invalid request", id });
    }
    else {
        (0, logger_1.log)("let's go get everything");
        const data = { votes: [] };
        if (req.query.poll === "true") {
            const doc = await db.collection("polls").doc(id).get();
            if (!doc.exists) {
                (0, logger_1.log)("404 not found");
                res.status(404).json({ message: "Not found", id });
            }
            else {
                const poll = doc.data();
                (0, logger_1.log)(`got a poll titled: "${poll.name}"`);
                data.poll = poll;
            }
        }
        const snapshot = await db.collection("votes").where("poll", "==", id).get();
        data.votes = snapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        (0, logger_1.log)("200 success");
        res.status(200).json(Object.assign({ id }, data));
    }
});
function isValidTimeStampNumber(ts) {
    return (typeof ts === "number" && Number.isSafeInteger(ts) && ts > 1600000000000);
}
function isPoll(poll) {
    return (isString(poll.name) &&
        poll.name.length > 1 &&
        Array.isArray(poll.timestamps) &&
        poll.timestamps.every(isValidTimeStampNumber));
}
const numberOptions = "40123456789";
const getRandomNumber = (cap) => Math.floor(Math.random() * cap);
const getRandomItem = (str) => str.charAt(getRandomNumber(str.length));
const getRandomChar = () => getRandomItem(numberOptions);
function generateRandomId() {
    let id = "";
    for (let i = 0; i < 4; i++) {
        id += getRandomChar();
    }
    return id;
}
function generateId(title) {
    let titleId = title.toLowerCase().slice(0, 30);
    titleId = (0, remove_accents_1.default)(titleId);
    titleId = titleId.replace(/ /g, "-").replace(/[^a-z0-9-]/gi, "");
    return `${titleId}-${generateRandomId()}`;
}
exports.create = (0, https_1.onRequest)({ cors }, async (req, res) => {
    (0, logger_1.log)("create invoked");
    if (req.method !== "POST") {
        (0, logger_1.log)("400 invalid method");
        res.status(400).json({ message: "Invalid method" });
    }
    const { poll } = req.body;
    try {
        if (!isPoll(poll)) {
            (0, logger_1.log)("400 invalid");
            res.status(400).json({ message: "Invalid request", poll });
        }
    }
    catch (error) {
        (0, logger_1.log)("400 invalid");
        (0, logger_1.log)(error);
        res.status(400).json({ message: "Invalid request", poll, error });
    }
    const data = getPoll(poll);
    (0, logger_1.log)(`let's go make a poll titled: "${data.name}"`);
    const id = generateId(data.name);
    (0, logger_1.log)(id);
    await db.collection("polls").doc(id).create(data);
    (0, logger_1.log)("200 success");
    res.status(200).json({
        id,
        poll: Object.assign({ id }, data),
    });
});
function isValidVoteNumber(n) {
    return (typeof n === "number" &&
        !Number.isNaN(n) &&
        Number.isSafeInteger(n) &&
        n >= 0 &&
        n <= 3);
}
function isValidVote(vote) {
    return Object.entries(vote).every(([key, val]) => isString(key) &&
        isValidTimeStampNumber(Number(key)) &&
        isValidVoteNumber(val));
}
function isVoteSubmission(submission) {
    return (isString(submission.poll) &&
        isString(submission.name) &&
        isValidVote(submission.votes));
}
function getVoteSubmission({ poll, name, votes, }) {
    return { poll, name, votes };
}
exports.vote = (0, https_1.onRequest)({ cors }, async (req, res) => {
    (0, logger_1.log)("vote invoked");
    if (req.method !== "POST") {
        (0, logger_1.log)("400 invalid method");
        res.status(400).json({ message: "Invalid method" });
    }
    const submission = req.body.vote;
    try {
        if (!isVoteSubmission(submission)) {
            (0, logger_1.log)("400 invalid");
            res.status(400).json({ message: "Invalid request", vote: submission });
        }
    }
    catch (error) {
        (0, logger_1.log)("400 invalid");
        (0, logger_1.log)(error);
        res.status(400).json({
            message: "Invalid request",
            vote: submission,
            error,
        });
    }
    const data = getVoteSubmission(submission);
    (0, logger_1.log)(`let's go cast a vote from: "${data.name}"`);
    const { id } = await db.collection("votes").add(data);
    (0, logger_1.log)("200 success");
    res.status(200).json({ id });
});
//# sourceMappingURL=index.js.map