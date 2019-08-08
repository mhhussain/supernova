let axios = require('axios');
let e =  require('express');

let configs = require('./config');

/// start up
// health object
let health = {
    status: 'startup',
    msg: ''
};

// q setup
var qlock = 0;
let q = [];

// pingmap
let pingmap = {};
let pingout = 0;
let pingin = 0;

// create consumer
setInterval(() => {
    // retrieve lock
    while (true) {
        if (qlock == 0) {
            qlock++;
            break;
        } else if (qlock == 1) {
            continue;
        } else {
            throw 'deadlock';
        }
    }

    let qe = Array.from(q);
    q = [];
    // release lock
    qlock--;

    // process q items
    if (qe.length > 0) {
        for (var i = qe.shift(); i != undefined; i = qe.shift()) {
            axios.post(i.to, { letter: i.letter })
                .catch((err) => {
                    // need to log this
                    console.log(err);
                });
        }
    }

}, 1000);


let app = e();

// uses
app.use(e.json());

// gets
app.get('/health', (req, res) => {
    res.json(health);
});

app.get('/status/pingin', (req, res) => {
    res.json(pingin);
});

app.get('/status/pingout', (req, res) => {
    res.json(pingout);
});

app.get('/status/q', (req, res) => {
    res.json(q.length);
});

app.get('/status/cid/:correlationId', (req, res) => {
    let { correlationId } = req.params;
    res.json(pingmap[correlationId]);
});

app.get('/status/pingmap', (req, res) => {
    res.json(pingmap);
});

app.post('/game/start', (req, res) => {
    // let { gameObj } = req.body;
    let correlationId = 'aa0000a0-0000-00a0-000a-0000a00000a0';

    pingmap[correlationId] = {
        endpoint: 'http://localhost:4007/ping',
        bouncec: 0,
        pingc: 1, // put this in the then block
        pongc: 0,
        pingrepeater: 5
    };

    axios.post('http://localhost:4007/ping', {
        letter: {
            correlationId,
            back: configs.pongurl            
        }
    });

    res.send('done');
});

app.post('/pong', (req, res) => {
    if (health.status != 'listening') {
        res.error('bad health status');
        return;
    }

    let { letter } = req.body;
    if (!letter) {
        res.send('missing particle object');
        return;
    }

    let cid = letter.correlationId;

    // update pingmap
    pingmap[cid].bouncec++;
    pingmap[cid].pongc++;

    // if ping is a fault
    if (letter.fault) {
        res.send(`particle recieved [${cid}]`);
        return;
    }

    // create pong response
    let pingconfig = pingmap[cid];

    if (!pingconfig) {
        res.error(`no pingmap for [${cid}]`);
        return;
    }

    let pingreturns = [];

    if (pingconfig.pingrepeater) {
        for (var i = 0; i < pingconfig.pingrepeater; i++) {
            pingreturns.push({
                to: pingconfig.endpoint,
                "letter": {
                    correlationId: cid,
                    back: configs.pongurl,
                    fault: true
                }
            });
        }
    }

    pingreturns.push({
        to: pingconfig.endpoint,
        "letter": {
            correlationId: cid,
            back: configs.pongurl,
            fault: false
        }
    });

    // retrieve lock
    while (true) {
        if (qlock == 0) {
            qlock++;
            break;
        }
    }
    q = q.concat(pingreturns);
    // release lock
    qlock--;

    pingmap[cid].pingc += pingconfig.pingrepeater;
    pingmap[cid].pingc++;
    pingout++;

    res.send(`pong recieved [${letter.correlationId}]`);
    
    console.log(`pong recieved [${letter.correlationId}]`);
});

//app.listen(configs.port, () => console.log(`listening on port ${configs.port}`));

// kill and rez
app.post('/poison', (req, res) => {
    health.status = 'poisoned';
    health.msg = 'app poisoned';
    
    res.send('app poisoned');
});

app.post('/replenish', (req, res) => {
    health.status = 'listening';
    health.msg = `listening on port [${configs.port}]`;
    
    res.send('app replenished');
})

app.listen(configs.port, () => { 
    health.status = 'listening';
    health.msg = `listening on port [${configs.port}]`;
});
