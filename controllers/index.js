

function initClient(){

}



function submitAnswer(){
  let inputElem = $('#usernameInput');
  let newName = inputElem.val();
  if(newName !== "") {
    inputElem.prop( "disabled", true );
  }
}
