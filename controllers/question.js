let cSessionId;
let qSessionId;
let submitted = false;
let audioElem;
let nextQuestionCounter = 0;
let nextQuestionThreshold = 5;

function initClient(qSession){
  qSessionId = qSession;
  $('#submitAnswerButton').prop('disabled', true);
  $('#audioPauseIcon').hide();
  $(window).on("beforeunload", () => {
    if(!submitted) {
      let host = window.location.protocol + "//" + window.location.host + "/close";
      let xhr = new XMLHttpRequest();
      xhr.open("POST", host, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        qSession: qSessionId,
      }));
    }
  });
  audioElem = $('#audioSource');
  if(audioElem){
    audioElem.on('timeupdate', () => {
      let currentTime = audioElem.get(0).currentTime;
      let duration = audioElem.get(0).duration;
      let progressPercentage = (currentTime / duration) * 100;
      $('#progressBar').width(progressPercentage + '%')
    });
    audioElem.on("ended", () => {
      $('#audioPlayIcon').show();
      $('#audioPauseIcon').hide();
    });
  }
  const cSessionIdCookie = Cookies.get("cSessionId")
  const cSessionIdUrl = new URLSearchParams(window.location.search).get('cSession');
  if(cSessionIdCookie && checkUuid(cSessionIdCookie)){
    cSessionId = cSessionIdCookie;
    $("#cSessionId").text("cSession: " + cSessionId);
  }
  else if(cSessionIdUrl && checkUuid(cSessionIdUrl)){
    cSessionId = cSessionIdCookie;
    $("#cSessionId").text("cSession: " + cSessionId);
  }
  else {
    $("#cSessionId").text("cSession: sessionLess");
  }
  $("#qSessionId").text("qSession: " + qSessionId);
}

function playPauseAudio(){
  if(audioElem.get(0).paused) {
    audioElem.get(0).play();
    $('#audioPlayIcon').hide();
    $('#audioPauseIcon').show();
  }
  else {
    audioElem.get(0).pause();
    $('#audioPlayIcon').show();
    $('#audioPauseIcon').hide();
  }
}

function onFormClick(){
  let value = $('input[name="answerForm"]:checked').val();
  if(value && value !== "" && !submitted) {
    $('#submitAnswerButton').prop('disabled', false);
  }
}

function submitAnswer(){
  let value = $('input[name="answerForm"]:checked').val();
  if(value && value !== "") {
    $('#submitAnswerButton').prop('disabled', true);
    submitted = true;

    let host = window.location.protocol + "//" + window.location.host;
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        $('#mainContainer').hide()
        $('#confirmationContainer').show();
        setInterval(nextQuestionCheck, 1000)
      }
    }
    xhr.open("POST", "/question", true);
    xhr.setRequestHeader('Content-Type', 'application/json');
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
    $('#getNextQuestionButtonTextCountDown').text((nextQuestionThreshold - nextQuestionCounter) + ")");
  }
}

function checkUuid(value){
  return /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(value);
}