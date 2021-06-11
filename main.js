const express = require("express")
const app = express()
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");
const {MongoClient} = require("mongodb");
const httpPort = 3000;
const httpsPort = 3443;
const sessionCheckInterval = 3600000;
const sessionTimeout = 3600000 * 4;
const { v4: uuidv4 } = require('uuid');

let sessionList = {};

async function main(){
    const dbData = getDbData();
    const user = dbData[0];
    const db = dbData[1];
    const pass = dbData[2];
    const uri = "mongodb://" + user + ":" + pass + "@192.168.178.8:27017/" + db + "?authSource=" + db;
    const client = new MongoClient(uri, {"useUnifiedTopology": true});

    app.set("view engine", "pug")
    app.use(express.json());
    app.use((req, res, next) => {
        if (req.secure) {
            next();
        }
        else {
            res.redirect("https://" + req.hostname + ":3443");
        }
    });

    // app.use("/", express.static(path.join(__dirname, "www/")));
    app.use("/js", express.static(path.join(__dirname, "js/")));
    app.use("/controllers", express.static(path.join(__dirname, "controllers/")));
    app.use("/css", express.static(path.join(__dirname, "css/")));
    app.use("/content", express.static(path.join(__dirname, "content/")));
    app.use("/icons", express.static(path.join(__dirname, "icons/")));

    let privateKey  = fs.readFileSync(path.join(__dirname, "/private/selfsigned.key"));
    let certificate = fs.readFileSync(path.join(__dirname, "/private/selfsigned.crt"));
    let credentials = {key: privateKey, cert: certificate};

    let httpServer = http.createServer(app);
    let httpsServer = https.createServer(credentials, app);
    httpServer.listen(httpPort, () => {
        console.log(`Example app listening at http://localhost:${httpPort}`);
    });
    httpsServer.listen(httpsPort, () => {
        console.log(`Example app listening at http://localhost:${httpsPort}`);
    })

    try {
        await client.connect();
        setInterval(checkSessionList, sessionCheckInterval);

        app.get("/", async(req, res, next) => {
            async function runAsync () {
                let sessionId = uuidv4();
                let question = await getQuestion(client);
                let date = new Date();
                sessionList[sessionId] = {
                    "question": question,
                    "time": date.getTime()
                }
                res.render("index", {
                    question: question["question"],
                    type: question["type"],
                    content: question["content"],
                    session: sessionId
                });
            }
            runAsync()
                .catch(next)
        });

        app.post("/", async(req, res, next) => {
            async function runAsync () {
                let sessionId = req.body["session"];
                let answer = req.body["value"];
                await putAnswer(client, sessionId, answer);
                res.sendStatus(200);
            }
            runAsync()
                .catch(next)
        });

        app.post("/close", (req, res) => {
            let sessionId = req.body["session"];
            delete sessionList[sessionId];
        });

        process.on("SIGINT", async () => {
            await client.close();
            console.log("MongoDB disconnected on app termination");
            process.exit(0);
        });

    } catch (e) {
        console.error(e);
    }
}

async function getQuestion(client) {
    const answersCollection = client.db().collection("answers");
    const questionsCollection = client.db().collection("questions");

    let cursor = answersCollection.find();
    let answerAmount = await cursor.count();
    if(answerAmount === 0){
        let questions =  await questionsCollection.find().toArray();
        return questions[Math.floor(Math.random() * questions.length)];
    }
    else {
        let answeredQuestionsIds = await answersCollection.distinct("_id");
        let unansweredQuestions = await questionsCollection.distinct("_id", {_id: {$nin: answeredQuestionsIds}});
        if(unansweredQuestions.length > 0){
            let randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
            let toGetId = unansweredQuestions[randomIndex];
            return await questionsCollection.findOne({_id: toGetId});
        }
        else {
            let idCount = await answersCollection.aggregate(
                [{$group: {_id: "$qId", count: {$sum: 1}}}]
            ).toArray();
            let lowestRandomId = getRandomMin(idCount)["_id"];
            return await questionsCollection.findOne({_id: lowestRandomId});
        }
    }
}

async function putAnswer(client, sessionId, answer){
    const answers = client.db().collection("answers");
    let question = sessionList[sessionId]["question"];
    if(question) {
        let toPutAnswer = {
            "qId": question["_id"],
            "qType": question["type"],
            "result": answer
        }
        let result = await answers.insertOne(toPutAnswer);
        delete sessionList[sessionId]
        //console.log(result);
    }
    else {
        console.log("Session not available!")
    }
}

function getRandomMin(countObject){
    let min = Math.min(...countObject.map(item => item.count));
    let randomIndex = Math.floor(Math.random() * countObject.length);
    return  countObject.filter(item => item.count === min)[randomIndex];
}

function getDbData(){
    const dbConnectionData = fs.readFileSync(path.join(__dirname, "/private/dbData.txt"), "UTF-8")
    const lines = dbConnectionData.split(/\r?\n/);
    let result = [];
    lines.forEach((line) => {
        result.push(line)
    });
    return result
}

function checkSessionList(){
    let toRemoveSessions = [];
    for (let key in sessionList) {
        let sessionValues = sessionList[key];
        let creationTime = sessionValues["time"];
        let date = new Date();
        let existenceTime = date.getTime() - creationTime;
        console.log("Existence time: " + existenceTime);
        if(existenceTime > sessionTimeout){
            console.log("Add session to remove: " + key);
            toRemoveSessions.push(key);
        }
    }
    for(let sessionId of toRemoveSessions){
        console.log("Delete session: " + sessionId);
        delete sessionList[sessionId]
    }
}

main().catch(console.error);
