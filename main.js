const express = require("express")
const app = express()
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");
const {MongoClient} = require("mongodb");
const qSessionCheckInterval = 3600000;
const qSessionTimeout = 3600000 * 4;
const uuid = require('uuid');

let qSessionList = {};

async function main(){
    const config = getConfig();
    const user = config[0];
    const db = config[1];
    const pass = config[2];
    const location = config[3];
    const port = config[4];
    const httpPort = config[5];
    const httpsPort = config[6];
    const uri = "mongodb://" + user + ":" + pass + "@" + location + ":" + port +"/" + db + "?authSource=" + db;
    const client = new MongoClient(uri, {"useUnifiedTopology": true});

    app.set("view engine", "pug")
    app.use(express.json());
    app.use((req, res, next) => {
        if (req.secure) {
            next();
        }
        else {
            res.redirect("https://" + req.hostname + ":" + httpsPort);
        }
    });

    // app.use("/", express.static(path.join(__dirname, "www/")));
    app.use("/js", express.static(path.join(__dirname, "js/")));
    app.use("/controllers", express.static(path.join(__dirname, "controllers/")));
    app.use("/css", express.static(path.join(__dirname, "css/")));
    app.use("/content", express.static(path.join(__dirname, "content/")));
    app.use("/icons", express.static(path.join(__dirname, "icons/")));
    app.use("/img", express.static(path.join(__dirname, "img/")));
    app.use("/manifest", express.static(path.join(__dirname, "manifest/")));

    const privateKey = fs.readFileSync('/etc/letsencrypt/live/soloheisbeer.com/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/etc/letsencrypt/live/soloheisbeer.com/cert.pem', 'utf8');
    const ca = fs.readFileSync('/etc/letsencrypt/live/soloheisbeer.com/chain.pem', 'utf8');

    const credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };

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
        setInterval(checkQSessionList, qSessionCheckInterval);

        app.get("/", async(req, res, next) => {
            async function runAsync () {
                res.render("welcome", {});
            }
            runAsync()
                .catch(next);
        });

        app.post("/", async(req, res, next) => {
            async function runAsync () {
                let cSessionId = req.body["cSession"];
                let age = req.body["age"];
                let musicalBackground = req.body["musicalBackground"];
                await putUser(client, cSessionId, age, musicalBackground);
                res.sendStatus(200);
            }
            runAsync()
                .catch(next);
        });

        app.get("/question", async(req, res, next) => {
            async function runAsync () {
                let cSession = req.query["cSession"];
                let question = await getQuestion(client, cSession);
                if(question !== null && question !== undefined && question !== "end") {
                    let qSessionId = uuid.v4();
                    let date = new Date();
                    qSessionList[qSessionId] = {
                        "question": question,
                        "time": date.getTime(),
                        "shifted": false
                    }
                    let options = {
                        qId: question["_id"].toString(),
                        question: question["question"],
                        type: question["type"],
                        scaleLow: question["scale"][0],
                        scaleHigh: question["scale"][1],
                        content: question["content"],
                        qSession: qSessionId
                    }
                    if (question["type"] === 2){
                        let mutedArr = [false, true]
                        let contentArr = [...question["content"]];
                        const randomInt = Math.round(Math.random());
                        if (randomInt === 1) {
                            contentArr.push(contentArr.shift());
                            mutedArr.push(mutedArr.shift());
                            qSessionList[qSessionId]["shifted"] = true;
                        }
                        options["content"] = contentArr;
                        options["isMuted"] = mutedArr;
                    }
                    res.render("question", options);
                }
                else if(question === "end") {
                    res.render("end", {});
                }
                else {
                    res.render("oops", {});
                }
            }
            runAsync()
                .catch(next);
        });

        app.post("/question", async(req, res, next) => {
            async function runAsync () {
                let cSessionId = req.body["cSession"];
                let qSessionId = req.body["qSession"];
                let answer = req.body["value"];
                await putAnswer(client, qSessionId, cSessionId, answer);
                res.sendStatus(200);
            }
            runAsync()
                .catch(next);
        });

        app.post("/checkSession", async(req, res, next) => {
            async function runAsync () {
                let cSessionId = req.body["cSession"];
                if(uuid.validate(cSessionId)) {
                    let user = await client.db().collection("users").findOne({"cSessionId": cSessionId});
                    if (user) {
                        res.sendStatus(200);
                    }
                    else {
                        res.sendStatus(204);
                    }
                }
                else {
                    res.sendStatus(204);
                }
            }
            runAsync()
                .catch(next);
        });

        app.post("/close", (req, res) => {
            let qSessionId = req.body["qSession"];
            if(uuid.validate(qSessionId) && qSessionList[qSessionId]) {
                delete qSessionList[qSessionId];
            }
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

async function getQuestion(client, cSession) {
    const answersCollection = client.db().collection("answers");
    const questionsCollection = client.db().collection("questions");
    const usersCollection = client.db().collection("users");

    let userAnsweredQuestionsIds = [];
    if(uuid.validate(cSession)) {
        let user = await usersCollection.findOne({"cSessionId": cSession});
        if (user && user["answeredQuestionIds"]) {
            userAnsweredQuestionsIds = user["answeredQuestionIds"];
        }
    }

    let cursor = answersCollection.find();
    let answerAmount = await cursor.count();
    if(answerAmount === 0){
        let questions =  await questionsCollection.find().toArray();
        return questions[Math.floor(Math.random() * questions.length)];
    }
    else {
        let answeredQuestionsIds = await answersCollection.distinct("_id");
        answeredQuestionsIds.push(userAnsweredQuestionsIds);
        let unansweredQuestions = await questionsCollection.distinct("_id", {_id: {$nin: answeredQuestionsIds}});
        if(unansweredQuestions.length > 0){
            let randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
            let toGetId = unansweredQuestions[randomIndex];
            return await questionsCollection.findOne({_id: toGetId});
        }
        else {
            let idCount = await answersCollection.aggregate(
                [
                    {$group: {_id: "$qId", count: {$sum: 1}}},
                    {$match: {_id: {$nin: userAnsweredQuestionsIds}}}
                ]
            ).toArray();
            if(idCount.length === 0){
                return "end";
            }
            let lowestRandom = getRandomMin(idCount);
            let lowestRandomId = lowestRandom["_id"];
            const result = await questionsCollection.findOne({_id: lowestRandomId});
            if (result){
                return result;
            }
            else {
                console.log("No question found by ID, FALLBACK!")
                let questions =  await questionsCollection.find().toArray();
                return questions[Math.floor(Math.random() * questions.length)];
            }
        }
    }
}

async function putAnswer(client, qSessionId, cSession, answer){
    const answersCollection = client.db().collection("answers");
    const usersCollection = client.db().collection("users");
    let question = null;
    if(uuid.validate(qSessionId) && qSessionList[qSessionId]) {
        question = qSessionList[qSessionId]["question"];
    }
    if(question) {
        if(!uuid.validate(cSession)){
            cSession = null;
        }
        if (!checkIfStringIsNumber(answer)){
            answer = null;
        }
        if(question["type"] === 2 && qSessionList[qSessionId]["shifted"]){
            if(answer === "1"){
                answer = "2";
            }
            else if(answer === "2"){
                answer = "1";
            }
        }
        let toPutAnswer = {
            "qId": question["_id"],
            "qType": question["type"],
            "cSessionId": cSession,
            "result": answer
        }
        let result = await answersCollection.insertOne(toPutAnswer);
        delete qSessionList[qSessionId]
        console.log(result);
        if(cSession !== null && uuid.validate(cSession)) {
            let user = await usersCollection.findOne({"cSessionId": cSession});
            if(user) {
                let userAnsweredQuestionsIds = [];
                if (user["answeredQuestionIds"]) {
                    userAnsweredQuestionsIds = user["answeredQuestionIds"];
                }
                userAnsweredQuestionsIds.push(question["_id"]);
                let updateResult = await usersCollection.update(
                    {cSessionId: cSession},
                    {
                        $set: {
                            answeredQuestionIds: userAnsweredQuestionsIds
                        }
                    }
                );
                console.log(updateResult);
            }
        }
    }
    else {
        console.log("qSession not available!")
    }
}

async function putUser(client, cSessionId, age, mb){
    if(!uuid.validate(cSessionId)) {
        return;
    }
    if(checkIfStringIsNumber(age) || checkIfStringIsNumber(mb)) {
        age = null;
        mb = null;
    }

    const answers = client.db().collection("users");
    let toPutUser = {
        "cSessionId": cSessionId,
        "age": age,
        "musicalBackground": mb
    }
    let result = await answers.insertOne(toPutUser);
    console.log(result);
}

function getRandomMin(countObject){
    let min = Math.min(...countObject.map(item => item.count));
    let minItems = countObject.filter(item => item.count === min)
    let randomIndex = Math.floor(Math.random() * minItems.length);
    return minItems[randomIndex];
}

function getConfig(){
    const dbConnectionData = fs.readFileSync(path.join(__dirname, "/private/config.txt"), "UTF-8")
    const lines = dbConnectionData.split(/\r?\n/);
    let result = [];
    lines.forEach((line) => {
        result.push(line)
    });
    return result
}

function checkQSessionList(){
    let toRemoveQSessions = [];
    for (const key in qSessionList) {
        const qSessionValues = qSessionList[key];
        const creationTime = qSessionValues["time"];
        const date = new Date();
        const existenceTime = date.getTime() - creationTime;
        console.log("Existence time: " + existenceTime);
        if(existenceTime > qSessionTimeout){
            console.log("Add session to remove: " + key);
            toRemoveQSessions.push(key);
        }
    }
    for(const qSessionId of toRemoveQSessions){
        console.log("Delete session: " + qSessionId);
        delete qSessionList[qSessionId]
    }
}

function checkIfStringIsNumber(input){
    return /^[0-9]+$/.test(input);
}

main().catch(console.error);
