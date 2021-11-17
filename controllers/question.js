let cSessionId;
let qSessionId;
let submitted = false;
let audioElems = [];
let video0Elem;
let video1Elem;
let nextQuestionCounter = 0;
let nextQuestionThreshold = 5;
let isPlayed = new Set();
let isFinished = new Set();

function initClient(qSession){
  qSessionId = qSession;
  $("#submitAnswerButton").prop("disabled", true);
  $("#audioPauseIcon").hide();
  $(window).on("beforeunload", () => {
    if(!submitted) {
      let host = window.location.protocol + "//" + window.location.host + "/close";
      let xhr = new XMLHttpRequest();
      xhr.open("POST", host, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({
        qSession: qSessionId,
      }));
    }
  });

  $("audio").each(function (index){
    let audioElem = $(this);
    let elemId = this.id.toString();
    let numId = parseInt(elemId.substr(-1));
    audioElems[numId] = audioElem;
    audioElem.on("timeupdate", () => updateProgressBar(audioElem));
    audioElem.on("ended", () => {
      if(!isFinished.has(numId))
        isFinished.add(numId);
      let playIcon = $("#audioPlayIcon" + numId);
      playIcon.show();
      $("#audioPauseIcon" + numId).hide();
      playIcon.parent().css("background", "#C5E1A5");
    });
  });

  video0Elem = $("#videoSource0");
  video1Elem = $("#videoSource1");
  initVideoElems(video0Elem, video0Elem);
  video0Elem.on("loadedmetadata", () => {
    initVideoElems(video0Elem, video0Elem);
  });
  video1Elem.on("loadedmetadata", () => {
    initVideoElems(video0Elem, video0Elem);
  });

  const cSessionIdCookie = Cookies.get("cSessionId")
  const cSessionIdUrl = new URLSearchParams(window.location.search).get("cSession");
  if(cSessionIdCookie && checkUuid(cSessionIdCookie)){
    cSessionId = cSessionIdCookie;
    $("#cSessionId").text("cSession: " + cSessionId);
  }
  else if(cSessionIdUrl && checkUuid(cSessionIdUrl)){
    cSessionId = cSessionIdCookie;
    $("#cSessionId").text("cSession: " + cSessionId);
  }
  else if(cookieCheck()){
    location.replace("/");
  }
  else {
    $("#cSessionId").text("cSession: sessionLess");
  }
  hideURLParams(["cSession"]);
  $("#qSessionId").text("qSession: " + qSessionId);
}

function initVideoElems(video0Elem, video1Elem) {
  if (video0Elem.length && video1Elem.length) {
    if(!isNaN(video0Elem.get(0).duration) && !isNaN(video1Elem.get(0).duration)) {
      let mainVideoElem;
      if (video0Elem.get(0).duration <= video1Elem.get(0).duration)
        mainVideoElem = video0Elem;
      else
        mainVideoElem = video1Elem;
      mainVideoElem.on("timeupdate", () => updateProgressBar(mainVideoElem));
      mainVideoElem.on("ended", () => {
        isFinished.add(0);
        let playIcon = $("#audioPlayIcon");
        playIcon.show();
        $("#audioPauseIcon").hide();
        playIcon.parent().css("background", "#C5E1A5");
        video0Elem.get(0).pause();
        video1Elem.get(0).pause();
        video0Elem.get(0).currentTime = 0;
        video1Elem.get(0).currentTime = 0;
      });
    }
  }
}

function playPauseAudio(id){
  let audioElem = audioElems[id];
  if(audioElem.get(0).paused){
    if(!isPlayed.has(id))
      isPlayed.add(id);
    submitEnable();
    audioElem.get(0).play();
    let playIcon = $("#audioPlayIcon" + id);
    playIcon.hide();
    $("#audioPauseIcon" + id).show();
    if(!isFinished.has(id))
      playIcon.parent().css("background", "#FFCC80");
  }
  else {
    audioElem.get(0).pause();
    $("#audioPlayIcon" + id).show();
    $("#audioPauseIcon" + id).hide();
  }
  if(!audioElems[id].get(0).paused) {
    for(let key in audioElems){
      key = parseInt(key);
      if(key !== id){
        if(!audioElems[key].get(0).paused) {
          audioElems[key].get(0).pause();
          audioElems[key].get(0).currentTime = 0;
          $("#audioPlayIcon" + key).show();
          $("#audioPauseIcon" + key).hide();
        }
      }
    }
  }
}

function playPauseVideo(){
  if(video0Elem.get(0).paused || video1Elem.get(0).paused) {
    isPlayed.add(0);
    submitEnable();
    video0Elem.get(0).play();
    video1Elem.get(0).play();
    let playIcon = $("#audioPlayIcon");
    playIcon.hide();
    $("#audioPauseIcon").show();
    if(!isFinished.has(0))
      playIcon.parent().css("background", "#FFCC80");
  }
  else {
    video0Elem.get(0).pause();
    video1Elem.get(0).pause();
    $("#audioPlayIcon").show();
    $("#audioPauseIcon").hide();
  }
}

function updateProgressBar(elem){
  let currentTime = elem.get(0).currentTime;
  let duration = elem.get(0).duration;
  let progressPercentage = (currentTime / duration) * 100;
  $("#progressBar").width(progressPercentage + "%");
}

function onFormClick(){
  submitEnable();
}

function submitEnable(){
  let value = $('input[name="radioForm"]:checked').val();
  if(value && value !== "" && !submitted) {
    if (audioElems.length > 0) {
      if (isPlayed.size === audioElems.length)
        $("#submitAnswerButton").prop("disabled", false);
    } else if (video0Elem.length && video1Elem.length) {
      if (isPlayed.has(0))
        $("#submitAnswerButton").prop("disabled", false);
    }
    else {
      $("#submitAnswerButton").prop("disabled", false);
    }
  }
}

function submitAnswer(){
  let value = $('input[name="radioForm"]:checked').val();
  if(value && value !== "") {
    $("#submitAnswerButton").prop("disabled", true);
    submitted = true;
    for(let key in audioElems){
      key = parseInt(key);
      if(!audioElems[key].get(0).paused) {
        audioElems[key].get(0).pause();
      }
    }
    if(video0Elem.length && video1Elem.length){
      video0Elem.get(0).pause();
      video1Elem.get(0).pause();
    }
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        $("#mainContainer").hide();
        $("#confirmationContainer").show();
        setInterval(nextQuestionCheck, 1000)
      }
    }
    xhr.open("POST", "/question", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify({
      qSession: qSessionId,
      cSession: cSessionId,
      value: value
    }));
  }
}

function nextQuestion(){
  if(checkUuid(cSessionId)) {
    location.replace("/question?cSession=" + cSessionId);
  }
  else {
    location.replace("/question");
  }
}

function nextQuestionCheck(){
  nextQuestionCounter++;
  if(nextQuestionCounter >= nextQuestionThreshold){
    nextQuestion();
  }
  else {
    $("#getNextQuestionButtonTextCountDown").text((nextQuestionThreshold - nextQuestionCounter) + ")");
  }
}

function checkUuid(value){
  return /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(value);
}

function hideURLParams(hide) {
  //Parameters to hide (ie ?success=value, ?error=value, etc)
  for(const h in hide) {
    if(getURLParameter(h)) {
      history.replaceState(null, document.getElementsByTagName("title")[0].innerHTML, window.location.pathname);
    }
  }
}

function getURLParameter(name) {
  return decodeURI((RegExp(name + "=" + "(.+?)(&|$)").exec(location.search)||[undefined,null])[1]);
}

function cookieCheck(){
  Cookies.set("test", "test");
  const test = Cookies.get("test");
  if (test === "test"){
    Cookies.remove("test");
    return true;
  }
  else {
    return false;
  }
}