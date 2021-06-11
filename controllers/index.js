let sessionId;
let submitted = false;
let audioElem;

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
    audioElem.on("ended", () => {
      $('#audioPlayIcon').show();
      $('#audioPauseIcon').hide();
    });
  }
}

function playPauseAudio(){
  let audioElemSource = audioElem.get(0);
  if(audioElemSource.paused) {
    audioElemSource.play();
    $('#audioPlayIcon').hide();
    $('#audioPauseIcon').show();
  }
  else {
    audioElemSource.pause();
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
        location.reload();
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
