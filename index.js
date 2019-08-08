let axios = require('axios');
let e =  require('express');

let configs = {
    port: 7004,
    pongurl: 'http://localhost:7004/pong'
};

/// start up
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

    qlock--;

    if (qe.length == 0) {
        console.log('empty beat');
        return;
    }

    for (var i = qe.shift(); i != undefined; i = qe.shift()) {
        axios.post(i.to, { letter: i.letter });
    }

}, 1000);


let app = e();

// uses
app.use(e.json());

app.get('/ping', (req, res) => {
    console.log('ping received');
    res.json('pong');
});

app.get('/ping/inout', (req, res) => {
    res.json({pingin,pingout});
});

app.get('/status/q', (req, res) => {
    res.json({q:q.length});
});

app.get('/status/cid/:correlationId', (req, res) => {
    let { correlationId } = req.params;
    res.json(pingmap[correlationId]);
});

app.get('/status', (req, res) => {
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
    let { letter } = req.body;
    if (!letter) {
        res.send('missing pong object');
        return;
    }

    let cid = letter.correlationId;

    // update pingmap
    pingmap[cid].bouncec++;
    pingmap[cid].pongc++;

    // if ping is a fault
    if (letter.fault) {
        res.send(`pong recieved [${cid}]`);
        return;
    }

    // create pong response
    let pingconfig = pingmap[cid];

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

app.listen(configs.port, () => console.log(`listening on port ${configs.port}`));
