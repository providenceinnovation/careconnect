const http = require('https');

const confHost = 'conference.dev.provinnovate.com';
const confPath = '/conferences';
const confServiceKey = 'th-Service-Token XCAqD2QkUj';
const symptomToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imt5bGUuamFja3NvbkBwcm92aWRlbmNlLm9yZyIsInJvbGUiOiJVc2VyIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvc2lkIjoiMjAyMyIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvdmVyc2lvbiI6IjIwMCIsImh0dHA6Ly9leGFtcGxlLm9yZy9jbGFpbXMvbGltaXQiOiI5OTk5OTk5OTkiLCJodHRwOi8vZXhhbXBsZS5vcmcvY2xhaW1zL21lbWJlcnNoaXAiOiJQcmVtaXVtIiwiaHR0cDovL2V4YW1wbGUub3JnL2NsYWltcy9sYW5ndWFnZSI6ImVuLWdiIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9leHBpcmF0aW9uIjoiMjA5OS0xMi0zMSIsImh0dHA6Ly9leGFtcGxlLm9yZy9jbGFpbXMvbWVtYmVyc2hpcHN0YXJ0IjoiMjAxNy0wOC0xMSIsImlzcyI6Imh0dHBzOi8vc2FuZGJveC1hdXRoc2VydmljZS5wcmlhaWQuY2giLCJhdWQiOiJodHRwczovL2hlYWx0aHNlcnZpY2UucHJpYWlkLmNoIiwiZXhwIjoxNTAyNDcwODkwLCJuYmYiOjE1MDI0NjM2OTB9.0IToQ5v2TCFva8bHHvA_yDq_RxWCASlJ8bKBgsAajqo'

exports.handler = (event, context, callback) => {
    let speech = routeRequest(event.body, callback);
};

function routeRequest(bodyString, callback) {
    console.log('Received request body:');
    console.log(bodyString);
    let body = JSON.parse(bodyString);
    let action = body.result.action;
    let response = null;
    if (action === 'virtual_visit') {
        response = virtualVisitHandler(body, callback, body.result.parameters.condition);
    } else if (action === 'schedule') {
        response = scheduleHandler(body, callback);
    } else if (action === 'triage') {
        triage(body, callback);
    } else {
        response = defaultHandler(body, callback);
    }
}

function virtualVisitHandler(body, callback, diagnosis) {
    console.log('virtual_visit');

    callConfService().then((output) => {
        let response = `Ok, we'll start a video chat session now. Please click this link to start a video chat session now: https://th.dev.provinnovate.com/conference/${output}`;
        callback(null, success(formatResponse(response)));
    })
}

function scheduleHandler(body, callback) {
    callSchedService().then((output) => {
        callback(null, success(formatResponse('worked')));
    });
}

function triage(body, callback) {
    let contexts = body.result.contexts;

    for (let i in contexts) {
        let context = contexts[i];
        console.log(context);
        if (context.name === 'symptoms-followup') {
            let symptoms = context.parameters.symptoms;
            console.log('symptoms are: ' + symptoms);

            let diagnosis = predictDiagnosis(symptoms);
            if (diagnosis) {
                callback(null, success(formatResponse(`It sounds like you may have ${diagnosis}, but I cannot be sure without seeing it. Would you like Aaron, our nurse practitioner, to take a look at you through our video chat now?`)));
            } else {
                callGetSymptomList().then((symptomList) => {
                    let pickedSyptoms = [];
                    symptoms.forEach((symptom) => {
                        symptomList.forEach((apiSymptom) => {
                            if (apiSymptom.Name.toLowerCase().includes(symptom.toLowerCase())) {
                                pickedSyptoms.push(apiSymptom.ID);
                            }
                        });
                    });
                    return pickedSyptoms;
                }).then((reducedSymptoms) => {
                    return callDiagnosis(reducedSymptoms).then((result) => {
                        let diagnosis = pickDiagnosis(result);
                        if (diagnosis) {
                            callback(null, success(formatResponse(`You may have ${diagnosis}, can I connect you to a nurse for further advice?`)));
                        } else {
                            callback(null, success(formatResponse(`I'm unsure of your diagnosis, can I connect you to a nurse for further advice?`)));
                        }                        
                    });
                });                
            }
        }
    }
}

function predictDiagnosis(symptoms) {
    if (symptoms.includes('pink eye') ||
        symptoms.includes('red eye') ||
        symptoms.includes('itchy eye') ||
        symptoms.includes('burning eye') ||
        symptoms.includes('swollen eye') ||
        symptoms.includes('eye')
    ) {
        return 'pink eye';
    } else if (symptoms.includes('broken')) {
        return 'broken bone';
    } else {
        return null;
    }
}

function defaultHandler(body) {
    let response = 'default handler';
    console.log(response);
    return response;
}

function formatResponse(speech) {
    return { 'speech': speech, 'displayText': speech };
}

function success(result) {
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
        },
        body: JSON.stringify(result),
    }
};

function callConfService() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            site: 'careconnect',
            patientEmail: 'Aaron.Hefel@providence.org',
            scheduledTime: '2017-08-10T17:53:24.211+0000'
        });
        const options = {
            host: confHost,
            path: confPath,
            port: 443,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authorization': confServiceKey
            }
        }
        const req = http.request(options, (res) => {
            res.setEncoding('utf8');
            let output = '';
            res.on('data', function (chunk) {
                console.log('Response: ' + chunk);
                let responseData = JSON.parse(chunk);
                console.log(responseData.id);
                output = responseData.id;
            });

            res.on('error', (error) => {
                reject(error);
            });

            res.on('end', () => {
                resolve(output);
            });
        });
        req.write(postData);
        req.end();
    });
};

function callSchedService() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            "providerId": "1260906",
            "providerNationalId": "INT-1260906",
            "departmentId": "7875275",
            "date": "yyyy-MM-dd",
            "time": "hh:mm",
            "duration": "20",
            "slotType": "Retail",
            "visitTypeId": "12d0747f-85b9-4d11-895a-53e4b101f64f",
            "ehrSystemId": 1,
            "isPatient": null,
            "firstName": "First Name",
            "lastName": "Last Name",
            "dateOfBirth": "2000-11-11T00:00:00-08:00",
            "guardian": null,
            "middleName": "Middle Name",
            "suffixName": "Sr.",
            "phoneNumber": "5555555555",
            "gender": "Male",
            "reasonForVisit": "REASON FOR VISIT",
            "socialSecurityNumber": "000-00-1234",
            "insurerName": "Insurer Name",
            "subscriberId": "Subsciber ID",
            "groupNumber": "Group Number",
            "email": "email@address.com",
            "address": {
                "line1": "Address Line 1",
                "line2": "Address Line 2",
                "city": "City",
                "state": "WA",
                "postalCode": "98034",
                "countryCode": ""
            }
        });
        const options = {
            host: 'platdevnassau.provinnovate.com',
            path: '/schedule/appointment',
            port: 443,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }
        const req = http.request(options, (res) => {
            res.setEncoding('utf8');
            let output = '';
            res.on('data', function (chunk) {
                console.log('Response: ' + chunk);
                let responseData = JSON.parse(chunk);
                console.log(responseData.id);
                output = responseData.id;
            });

            res.on('error', (error) => {
                reject(error);
            });

            res.on('end', () => {
                resolve(output);
            });
        });
        req.write(postData);
        req.end();
    });
};

function callGetSymptomList() {
    return new Promise((resolve, reject) => {
        const options = {
            host: 'sandbox-healthservice.priaid.ch',
            path: `/symptoms?token=${symptomToken}&language=en-gb&format=json`,
            port: 443,
            method: 'GET'
        }
        const req = http.request(options, (res) => {
            res.setEncoding('utf8');
            let output = '';
            res.on('data', function (chunk) {
                console.log('Response: ' + chunk);
                let responseData = JSON.parse(chunk);
                output = responseData;
            });

            res.on('error', (error) => {
                reject(error);
            });

            res.on('end', () => {
                resolve(output);
            });
        });
        req.write('');
        req.end();
    });
};

function callDiagnosis(symptoms) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            site: 'careconnect',
            patientEmail: 'Aaron.Hefel@providence.org',
            scheduledTime: '2017-08-10T17:53:24.211+0000'
        });
        let mappedSymp = symptoms.map((symptomId) => {
            return `%22${symptomId}%22`;
        });
        console.log(mappedSymp);
        let myPath = `/diagnosis?symptoms=[${mappedSymp}]&gender=male&year_of_birth=1988&token=${symptomToken}&language=en-gb&format=json`;
        console.log(myPath);
        const options = {
            host: 'sandbox-healthservice.priaid.ch',
            path: myPath,
            port: 443,
            method: 'GET'
        }
        const req = http.request(options, (res) => {
            res.setEncoding('utf8');
            let output = '';
            res.on('data', function (chunk) {
                console.log('Response: ' + chunk);
                let responseData = JSON.parse(chunk);
                output = responseData;
            });

            res.on('error', (error) => {
                reject(error);
            });

            res.on('end', () => {
                resolve(output);
            });
        });
        req.write(postData);
        req.end();
    });
};

function pickDiagnosis(data) {
    if (data[0]) {
        console.log(data[0].Issue.Name);
        return data[0].Issue.Name;
    }
}