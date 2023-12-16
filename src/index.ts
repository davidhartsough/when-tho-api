import { onRequest } from "firebase-functions/v2/https";
import { log } from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import removeAccents from "remove-accents";

initializeApp();
const db = getFirestore();

const cors = "when-tho.web.app";

type Poll = {
  name: string;
  timestamps: number[];
};

function isString(str: unknown): str is string {
  return typeof str === "string" && str.length > 1;
}

function getPoll({ name, timestamps }: Poll): Poll {
  return { name, timestamps };
}

export const poll = onRequest({ cors }, async (req, res) => {
  log("poll invoked");
  const { id } = req.query;
  log(id);
  if (!isString(id)) {
    log("400 invalid");
    res.status(400).json({ message: "Invalid request", id });
  } else {
    log("let's go get the poll");
    const doc = await db.collection("polls").doc(id).get();
    if (!doc.exists) {
      log("404 not found");
      res.status(404).json({ message: "Not found", id });
    } else {
      const poll = doc.data() as Poll;
      log(`got a poll titled: "${poll.name}"`);
      log("200 success");
      res.status(200).json({
        id: doc.id,
        poll: { id: doc.id, ...poll },
      });
    }
  }
});

// name: string, poll: string, {ts}: number
type Vote = Record<string, string | number>;
type VotesRes = {
  poll?: Poll;
  votes: Vote[];
};

export const votes = onRequest({ cors }, async (req, res) => {
  log("votes invoked");
  const { id } = req.query;
  log(id);
  if (!isString(id)) {
    log("400 invalid");
    res.status(400).json({ message: "Invalid request", id });
  } else {
    log("let's go get everything");
    const data: VotesRes = { votes: [] };
    if (req.query.poll === "true") {
      const doc = await db.collection("polls").doc(id).get();
      if (!doc.exists) {
        log("404 not found");
        res.status(404).json({ message: "Not found", id });
      } else {
        const poll = doc.data() as Poll;
        log(`got a poll titled: "${poll.name}"`);
        data.poll = poll;
      }
    }
    const snapshot = await db.collection("votes").where("poll", "==", id).get();
    data.votes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    log("200 success");
    res.status(200).json({ id, ...data });
  }
});

function isValidTimeStampNumber(ts: number): boolean {
  return (
    typeof ts === "number" && Number.isSafeInteger(ts) && ts > 1600000000000
  );
}

function isPoll(poll: Poll): poll is Poll {
  return (
    isString(poll.name) &&
    poll.name.length > 1 &&
    Array.isArray(poll.timestamps) &&
    poll.timestamps.every(isValidTimeStampNumber)
  );
}

const numberOptions = "40123456789";
const getRandomNumber = (cap: number) => Math.floor(Math.random() * cap);
const getRandomItem = (str: string) => str.charAt(getRandomNumber(str.length));
const getRandomChar = () => getRandomItem(numberOptions);
function generateRandomId() {
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += getRandomChar();
  }
  return id;
}
function generateId(title: string): string {
  let titleId = title.toLowerCase().slice(0, 30);
  titleId = removeAccents(titleId);
  titleId = titleId.replace(/ /g, "-").replace(/[^a-z0-9-]/gi, "");
  return `${titleId}-${generateRandomId()}`;
}

export const create = onRequest({ cors }, async (req, res) => {
  log("create invoked");
  if (req.method !== "POST") {
    log("400 invalid method");
    res.status(400).json({ message: "Invalid method" });
  }
  const { poll } = req.body;
  try {
    if (!isPoll(poll)) {
      log("400 invalid");
      res.status(400).json({ message: "Invalid request", poll });
    }
  } catch (error) {
    log("400 invalid");
    log(error);
    res.status(400).json({ message: "Invalid request", poll, error });
  }
  const data = getPoll(poll);
  log(`let's go make a poll titled: "${data.name}"`);
  const id = generateId(data.name);
  log(id);
  await db.collection("polls").doc(id).create(data);
  log("200 success");
  res.status(200).json({
    id,
    poll: { id, ...data },
  });
});

type HourVotes = Record<string, number>;
type VoteSubmission = {
  poll: string;
  name: string;
  votes: HourVotes;
};

function isValidVoteNumber(n: number): boolean {
  return (
    typeof n === "number" &&
    !Number.isNaN(n) &&
    Number.isSafeInteger(n) &&
    n >= 0 &&
    n <= 3
  );
}

function isValidVote(vote: Record<string, number>): boolean {
  return Object.entries(vote).every(
    ([key, val]) =>
      isString(key) &&
      isValidTimeStampNumber(Number(key)) &&
      isValidVoteNumber(val)
  );
}

function isVoteSubmission(
  submission: VoteSubmission
): submission is VoteSubmission {
  return (
    isString(submission.poll) &&
    isString(submission.name) &&
    isValidVote(submission.votes)
  );
}

function getVoteSubmission({
  poll,
  name,
  votes,
}: VoteSubmission): VoteSubmission {
  return { poll, name, votes };
}

export const vote = onRequest({ cors }, async (req, res) => {
  log("vote invoked");
  if (req.method !== "POST") {
    log("400 invalid method");
    res.status(400).json({ message: "Invalid method" });
  }
  const submission = req.body.vote;
  try {
    if (!isVoteSubmission(submission)) {
      log("400 invalid");
      res.status(400).json({ message: "Invalid request", vote: submission });
    }
  } catch (error) {
    log("400 invalid");
    log(error);
    res.status(400).json({
      message: "Invalid request",
      vote: submission,
      error,
    });
  }
  const data = getVoteSubmission(submission);
  log(`let's go cast a vote from: "${data.name}"`);
  const { id } = await db.collection("votes").add(data);
  log("200 success");
  res.status(200).json({ id });
});
