function initClient(){
    // $('#submitConsentButton').prop('disabled', true);
    checkSession();
}

function checkForms(){
    const mbValue = $('input[name="musicalForm"]:checked').val();
    const vabValue = $('input[name="artForm"]:checked').val();
    if(mbValue && mbValue !== "" && vabValue && vabValue !== ""){
        $('#submitConsentButton').prop('disabled', false);
        return true;
    }
    else {
        $('#submitConsentButton').prop('disabled', true);
        return false;
    }
}

function generateSession(){
    const cSessionId = uuidv4();
    Cookies.set('cSessionId', cSessionId, {expires: 30});
    return cSessionId;
}

function checkSession(){
    const cSessionId = Cookies.get('cSessionId');
    if (cSessionId) {
        let xhr = new XMLHttpRequest();
        xhr.onload = function () {
            if(xhr.status === 200){
                location.replace("/question?cSession=" + cSessionId);
            }
        };
        xhr.open("POST", "/checkSession", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({
            cSession: cSessionId
        }));
    }
}

function submitConsent(){
    // const mbValue = $('input[name="musicalForm"]:checked').val();
    // const vabValue = $('input[name="artForm"]:checked').val();
    // const aInfo = $('textarea[name="optionalForm"]').val();
    $('#submitConsentButton').prop('disabled', true);
    const cSessionId = generateSession();
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
            location.replace("/question?cSession=" + cSessionId);
        }
    }
    xhr.open("POST", "/", true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
        cSession: cSessionId,
        // musicalBackground: mbValue,
        // visualArtBackground: vabValue,
        // additionalInformation: aInfo
    }));
}