const express = require("express")
const app = express()
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");
const {MongoClient} = require("mongodb");
const httpPort = 3000;
const httpsPort = 3443;

async function main(){
    const dbData = getDbData();
    const user = dbData[0];
    const db = dbData[1];
    const pass = dbData[2];
    const uri = "mongodb://" + user + ":" + pass + "@192.168.178.8:27017/" + db + "?authSource=" + db;
    const client = new MongoClient(uri, {"useUnifiedTopology": true});

    app.set("view engine", "pug")
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
    app.use("/img", express.static(path.join(__dirname, "img/")));

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

        app.get("/", async(req, res, next) => {
            async function runAsync () {
                // let question = "filler";
                let question = await getQuestion(client);
                res.render("index", {question: question["question"], message: "Hello there!"});
            }
            runAsync()
                .catch(next)
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
    let cursor = client.db().collection("answers").find();
    let answerAmount = await cursor.count();
    if(answerAmount === 0){
        let questions =  await client.db().collection("questions").find().toArray();
        return questions[Math.floor(Math.random() * questions.length)];
    }
    else {
        let answeredQuestionsIds = await client.db().collection("answers").distinct("_id");
        let unansweredQuestions =
            await client.db().collection("questions").distinct("_id", {_id: {$nin: answeredQuestionsIds}});
        if(unansweredQuestions.length > 0){
            let randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
            let toGetId = unansweredQuestions[randomIndex];
            return await client.db().collection("questions").findOne({_id: toGetId});
        }
        else {
            let idCount = await client.db().collection("answers").aggregate(
                [{$group: {_id: "$_id", count: {$sum: 1}}}]
            ).toArray();
            let min = Math.min(...idCount.map(item => item.count));
            let randomIndex = Math.floor(Math.random() * idCount.length);
            let toGetId = idCount.filter(item => item.count === min)[randomIndex]["_id"];
            return await client.db().collection("questions").find({_id: toGetId});
        }
    }
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



main().catch(console.error);
