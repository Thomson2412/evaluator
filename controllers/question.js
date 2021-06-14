let sessionId;
let submitted = false;
let audioElem;
let nextQuestionCounter = 0;
let nextQuestionThreshold = 5;

function initClient(session){
  sessionId = session;
  $('#submitAnswerButton').prop('disabled', true);
  $('#audioPauseIcon').hide();
  $(window).on("beforeunload", () => {
    if(!submitted) {
      let host = window.location.protocol + "//" + window.location.host + "/close";
      let xhr = new XMLHttpRequest();
      xhr.open("POST", host, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        session: sessionId,
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
    xhr.open("POST", host, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
      session: sessionId,
      value: value
    }));
  }
}

function nextQuestion(){
  location.reload();
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