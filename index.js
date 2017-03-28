const program = require('commander');
const async = require('async');
const request = require('request-promise');

program
  .version('0.0.1')
  .option('-U, --api-uri <required>','API URL')
  .option('-L, --api-user <required>','API User')
  .option('-P, --api-pass <required>','API Password')
  .option('-S, --spie-uri <required>','SPIE URL')
  .option('-K, --spie-sec <required>','SPIE Secret')
  .parse(process.argv);

let loginUri = program.apiUri + 'service/api/User/Login';
let loginOptions = {
  method: 'POST',
  url: loginUri,
  json: true,
  body: { Email: program.apiUser, Password: program.apiPass }
};

let spieHeaders = {
        "content-type": "application/json",
        "accept": "application/json",
        "secret": program.spieSec
    }

let defVer = 'none';

request({
    url: program.spieUri + 'Versions/GetVersions',
    json: true,
    headers: spieHeaders
})
.then(function (resSpie) {
    defVer = resSpie.find(a => a.IsDefault).Version;
    console.log(defVer);

    let output = [];

    request(loginOptions)
        .then(function (resLogin) {
            let auth = resLogin.d.results.Token;
            let companies = resLogin.d.results.Companies;
            console.log(companies.length);
            async.forEachOfSeries(companies, function(company, key, callback) {
                console.log((key + 1) + ' - ' + company.CompanyName);
                let selectUri = program.apiUri + 'service/api/User/SelectCompany/' + company.Id;
                let selectOptions = {
                  method: 'POST',
                  url: selectUri,
                  json: true,
                  headers: { 'Authorization-Token': auth, 'Company-Version': company.CompanyVersionNumber }
                };
                request(selectOptions)
                    .then(function (resSelect) {
                        let c = resSelect.d.results;
                        request({
                            url: program.spieUri + 'CompanyConfig/GetConfig/' + c.Settings.APIKey,
                            json: true,
                            headers: spieHeaders
                        })
                        .then(function (resSpie) {
                            let enabled = c.Settings.Integration || false;
                            let entry = {
                                'CompanyName': c.CompanyName,
                                'APIKey': c.Settings.APIKey,
                                'Enabled': enabled,
                                'APIVer': resSpie ? resSpie.IntegrationEngineVersion : enabled ? defVer : 'n/a'
                            };
                            output.push(entry);
                            callback();
                        })
                        .catch (function (errSpie) {
                            callback('Error in SPIE request: ' + errSpie);
                        });
                    })
                    .catch (function (errSelect) {
                        console.log('Error in company request: ' + errSelect);
                        callback();
                        //callback('Error in company request: ' + errSelect);
                    });
            }, function(err){
                if (err) { console.log(err); }
                console.log('Finished');
                //console.log(output);
                output.forEach(item => console.log(item))
            });
        })
        .catch(function (errLogin) {
            console.log(errLogin);
        });
})
.catch (function (errSpie) {
    console.log('Error in SPIE request: ' + errSpie);
});

