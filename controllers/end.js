function initClient(){
  hideURLParams(["cSession"]);
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