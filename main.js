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
const cookieParser = require("cookie-parser");

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
    const certificateLocation = config[7];
    const uri = "mongodb://" + user + ":" + pass + "@" + location + ":" + port +"/" + db + "?authSource=" + db;
    const client = new MongoClient(uri, {"useUnifiedTopology": true});

    app.set("view engine", "pug")
    app.use(express.json());
    app.use(cookieParser());
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

    const privateKey = fs.readFileSync(path.join(certificateLocation, 'privkey.pem'), 'utf8');
    const certificate = fs.readFileSync(path.join(certificateLocation, 'cert.pem'), 'utf8');
    const ca = fs.readFileSync(path.join(certificateLocation, '/chain.pem'), 'utf8');

    const credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };

    let httpServer = http.createServer(app);
    let httpsServer = https.createServer(credentials, app);
    httpServer.listen(httpPort, () => {
        console.log(`Evaluator listening at http://localhost:${httpPort}`);
    });
    httpsServer.listen(httpsPort, () => {
        console.log(`Evaluator listening at https://localhost:${httpsPort}`);
    })

    try {
        await client.connect();
        setInterval(checkQSessionList, qSessionCheckInterval);

        app.get("/", async(req, res, next) => {
            console.log("GET /: " + req.ip);
            async function runAsync () {
                res.render("welcome", {});
            }
            runAsync()
                .catch(next);
        });

        app.post("/", async(req, res, next) => {
            console.log("POST /: " + req.ip);
            async function runAsync () {
                let cSessionId = req.body["cSession"];
                let musicalBackground = req.body["musicalBackground"];
                let visualArtBackground = req.body["visualArtBackground"];
                let additionalInformation = req.body["additionalInformation"];
                console.log("cSession: " + cSessionId);
                await putUser(client, cSessionId, musicalBackground, visualArtBackground, additionalInformation);
                res.sendStatus(200);
            }
            runAsync()
                .catch(next);
        });

        app.get("/question", async(req, res, next) => {
            console.log("GET /question: " + req.ip);
            async function runAsync () {
                let cSession = req.cookies["cSessionId"];
                if(!cSession){
                    cSession = req.query["cSession"];
                }
                console.log("cSession " + cSession);
                let question = await getQuestion(client, cSession);
                if(question !== null && question !== undefined && question !== "end") {
                    let qSessionId = uuid.v4();
                    let date = new Date();
                    qSessionList[qSessionId] = {
                        "question": question,
                        "time": date.getTime(),
                        "shifted": false
                    }
                    console.log("Created qSession " + qSessionId);
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
                        const randomInt = getRandomInt(1);
                        if (randomInt === 1) {
                            contentArr.push(contentArr.shift());
                            mutedArr.push(mutedArr.shift());
                            qSessionList[qSessionId]["shifted"] = true;
                        }
                        options["content"] = contentArr;
                        options["isMuted"] = mutedArr;
                    }
                    if (question["type"] === 3){
                        let contentArrFull = [...question["content"]];
                        let contentArrImg = [contentArrFull[0], contentArrFull[1]]
                        const randomInt = getRandomInt(1);
                        if (randomInt === 1) {
                            contentArrFull[0] = contentArrImg[1];
                            contentArrFull[1] = contentArrImg[0];
                            qSessionList[qSessionId]["shifted"] = true;
                        }
                        options["content"] = contentArrFull;
                    }
                    if (question["type"] === 4 || question["type"] === 5){
                        let contentArrFull = [...question["content"]];
                        let contentArrAudio;
                        if(question["type"] === 4)
                            contentArrAudio = contentArrFull.slice(1);
                        else
                            contentArrAudio = contentArrFull;
                        let contentArrIDAudio = [];
                        contentArrAudio.forEach((a, i) => contentArrIDAudio.push({"id": i, "audio": a}))
                        shuffle(contentArrIDAudio)
                        let contentOut = [];
                        if(question["type"] === 4){
                            let contentImg = contentArrFull[0];
                            contentOut.push(contentImg);
                        }
                        contentArrIDAudio.forEach((a) => {contentOut.push(a.audio)});
                        let order = [];
                        contentArrIDAudio.forEach((a) => {order.push(a.id)});
                        qSessionList[qSessionId]["order"] = order;
                        options["content"] = contentOut;
                    }
                    console.log("Render question");
                    res.render("question", options);
                }
                else if(question === "end") {
                    console.log("Render end");
                    res.render("end", {});
                }
                else {
                    console.log("Render oops");
                    res.render("oops", {});
                }
            }
            runAsync()
                .catch(next);
        });

        app.post("/question", async(req, res, next) => {
            console.log("POST /question: " + req.ip);
            async function runAsync () {
                let cSessionId = req.body["cSession"];
                let qSessionId = req.body["qSession"];
                let answer = req.body["value"];
                console.log("cSession: " + cSessionId);
                console.log("qSession: " + qSessionId);
                await putAnswer(client, qSessionId, cSessionId, answer);
                res.sendStatus(200);
            }
            runAsync()
                .catch(next);
        });

        app.post("/checkSession", async(req, res, next) => {
            console.log("POST /checkSession: " + req.ip);
            async function runAsync () {
                let cSessionId = req.body["cSession"];
                console.log("cSession: " + cSessionId);
                if(uuid.validate(cSessionId)) {
                    let user = await client.db().collection("users").findOne({"cSessionId": cSessionId});
                    if (user) {
                        console.log("Found user: " + user["_id"]);
                        res.sendStatus(200);
                    }
                    else {
                        console.log("User not found");
                        res.sendStatus(204);
                    }
                }
                else {
                    console.log("Invalid uuid: " + cSessionId);
                    res.sendStatus(204);
                }
            }
            runAsync()
                .catch(next);
        });

        app.post("/close", (req, res) => {
            console.log("POST /close: " + req.ip);
            let qSessionId = req.body["qSession"];
            console.log("Close qSession: " + qSessionId);
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
        return questions[getRandomInt(questions.length)];
    }
    else {
        let answeredQuestionsIds = await answersCollection.distinct("_id");
        answeredQuestionsIds.push(userAnsweredQuestionsIds);
        let unansweredQuestions = await questionsCollection.distinct("_id", {_id: {$nin: answeredQuestionsIds}});
        if(unansweredQuestions.length > 0){
            let randomIndex = getRandomInt(unansweredQuestions.length);
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
                return questions[getRandomInt(questions.length)];
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
        if (isStringNumber(answer)){
            answer = parseInt(answer);
        }
        else {
            answer = null;
        }
        if((question["type"] === 2 || question["type"] === 3) && qSessionList[qSessionId]["shifted"]){
            if(answer === 1){
                answer = 2;
            }
            else if(answer === 2){
                answer = 1;
            }
        }
        if((question["type"] === 4 || question["type"] === 5) && answer !== null) {
            if (answer >= 0) {
                let order = qSessionList[qSessionId]["order"];
                answer = order[parseInt(answer) - 1];
            }
        }
        let toPutAnswer = {
            "qId": question["_id"],
            "qType": question["type"],
            "cSessionId": cSession,
            "result": answer
        }
        let result = await answersCollection.insertOne(toPutAnswer);
        console.log("Delete session after answer: " + qSessionId);
        delete qSessionList[qSessionId]
        console.log(result["result"]);

        if(cSession !== null && uuid.validate(cSession)) {
            let user = await usersCollection.findOne({"cSessionId": cSession});
            if(user) {
                let userAnsweredQuestionsIds = [];
                if (user["answeredQuestionIds"]) {
                    userAnsweredQuestionsIds = user["answeredQuestionIds"];
                }
                userAnsweredQuestionsIds.push(question["_id"]);
                let updateResult = await usersCollection.updateOne(
                    {cSessionId: cSession},
                    {
                        $set: {
                            answeredQuestionIds: userAnsweredQuestionsIds
                        }
                    }
                );
                console.log(updateResult["result"]);
            }
        }
    }
    else {
        console.log("qSession not available!")
    }
}

async function putUser(client, cSessionId, mb, ab, aInfo){
    if(!uuid.validate(cSessionId)) {
        return;
    }
    if(!isStringNumber(mb)) {
        mb = null;
    }
    if(!isStringNumber(ab)) {
        ab = null;
    }
    if(typeof aInfo === 'string' || aInfo instanceof String){
        aInfo = aInfo.replace(/[^a-zA-Z0-9-.,!? ]/g, "");
    }
    else {
        aInfo = null;
    }

    const answers = client.db().collection("users");
    let toPutUser = {
        "cSessionId": cSessionId,
        "musicalBackground": mb,
        "visualArtBackground": ab,
        "additionalInformation": aInfo
    }
    let result = await answers.insertOne(toPutUser);
    console.log(result["result"]);
}

function getRandomMin(countObject){
    let min = Math.min(...countObject.map(item => item.count));
    let minItems = countObject.filter(item => item.count === min)
    let randomIndex = getRandomInt(minItems.length);
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

function isStringNumber(input){
    return /^[-]?[0-9]+$/.test(input);
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

main().catch(console.error);
