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
                    console.log('letter failed to send');
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

app.get('/pingmap', (req, res) => {
    res.json(pingmap);
});

// entry point
app.post('/pingmap/add', (req, res) => {
    let { particleInfo } = req.body;
    if (!particleInfo) {
        res.status(400).send(new Error('contract missing: [particleInfo]'));
        return;
    }

console.log(particleInfo);

    pingmap[particleInfo.correlationId] = {
        endpoint: particleInfo.endpoint,
        bouncec: 0,
        pongc: 0,
        pingrepeater: particleInfo.pingrepeater
    };

    var success = true;

    axios.post(particleInfo.endpoint, {
        letter: {
            correlationId: particleInfo.correlationId,
            back: configs.pongurl
        }
    }).catch((err) => {
        console.log('jfeijfeoieifefie');
        pingmap[particleInfo] = null;
        success = false;
        return;
    }).finally(() => {
        if (success) {
            res.send('ping created');
        } else {
            res.status(400).send(new Error('failed to create ping'));
        }
        return;
    });

});

app.post('/pong', (req, res) => {
    if (health.status != 'listening') {
        res.status(503).send('bad health status');
        return;
    }

    let { letter } = req.body;
    if (!letter) {
        res.send('missing particle object');
        return;
    }

    let cid = letter.correlationId;

    // ping counter
    pingin++;

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
        res.status(400).send(new Error(`no pingmap for [${cid}]`));
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
});

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
