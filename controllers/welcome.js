function initClient(){
    $('#submitConsentButton').prop('disabled', true);
    checkSession();
    setInputCheck($("#consentFormInput").get(0), function(value) {
        return isAgeValid(value);
    });
}

function setInputCheck(textbox, inputFilter) {
    ["input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop"].forEach(function(event) {
        textbox.addEventListener(event, function() {
            checkForms();
            if (inputFilter(this.value)) {
                this.oldValue = this.value;
                this.oldSelectionStart = this.selectionStart;
                this.oldSelectionEnd = this.selectionEnd;
            } else if (this.hasOwnProperty("oldValue")) {
                this.value = this.oldValue;
                this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
            } else {
                this.value = "";
            }
        });
    });
}

function isAgeValid(value){
    return /^\d{0,2}$/.test(value);
}

function checkForms(){
    const ageValue = $("#consentFormInput").val();
    const ageValid = isAgeValid(ageValue);
    const mbValue = $('input[name="answerForm"]:checked').val();
    if(ageValue.length > 0 && ageValid && mbValue && mbValue !== ""){
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
        location.replace("/question?cSession=" + cSessionId);
    }
}

function submitConsent(){
    if (checkForms()) {
        const ageValue = $("#consentFormInput").val();
        const mbValue = $('input[name="answerForm"]:checked').val();
        $('#submitConsentButton').prop('disabled', true);
        const cSessionId = generateSession();
        let host = window.location.protocol + "//" + window.location.host;
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                location.replace("/question?cSession=" + cSessionId);
            }
        }
        xhr.open("POST", host, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({
            cSession: cSessionId,
            age: ageValue,
            musicalBackground: mbValue
        }));
    }
}