let e =  require('express');
let m = require('mongodb').MongoClient;

let configs = require('./config');
let health = require('./src/health');
let supernova = require('./src/supernova');

/// setup
m.connect(configs.mongo.url, (err, db) => {
    if (err) {
        // console.log(err);
        throw err;
    }
    let dbo = db.db(configs.mongo.db);
    dbo.collection('particles').drop((err, delOK) => {
        if (err) {
            // collection does not exist
            console.log(err);
            // throw err;
        }
        dbo.createCollection('particles', (err, res) => {
            if (err) {
                // console.log(err);
                throw err;
            }
            db.close();
        });
    });
});

/// start up
let app = e();

// uses
app.use(e.json());

let h = new health(app);

new supernova(h, configs, app);

app.listen(configs.port, () => { 
    h.updateStatus({
        status: 'listening',
        msg: `listening on port [${configs.port}]`
    });
});
