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

// particlemap
let particlemap = {};
let ptout = 0;
let ptin = 0;

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
            axios.post(i.to, { particle: i.particle })
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

app.get('/status/ptin', (req, res) => {
    res.json(ptin);
});

app.get('/status/ptout', (req, res) => {
    res.json(ptout);
});

app.get('/status/q', (req, res) => {
    res.json(q.length);
});

app.get('/status/cid/:correlationId', (req, res) => {
    let { correlationId } = req.params;
    res.json(particlemap[correlationId]);
});

app.get('/particlemap', (req, res) => {
    res.json(particlemap);
});

// entry point
app.post('/particlemap/add', (req, res) => {
    let { particleInfo } = req.body;
    if (!particleInfo) {
        res.status(400).send(new Error('contract missing: [particleInfo]'));
        return;
    }

    particlemap[particleInfo.correlationId] = {
        endpoint: particleInfo.endpoint,
        bouncec: 0,
        ptc: 0,
        particlerepeater: particleInfo.particlerepeater
    };

    var success = true;

    axios.post(particleInfo.endpoint, {
        particle: {
            correlationId: particleInfo.correlationId,
            back: configs.novaurl
        }
    }).catch((err) => {
        particlemap[particleInfo] = null;
        success = false;
        return;
    }).finally(() => {
        if (success) {
            res.send('particle fired');
        } else {
            res.status(400).send(new Error('failed to create particle'));
        }
        return;
    });

});

app.post('/pong', (req, res) => {
    if (health.status != 'listening') {
        res.status(503).send('bad health status');
        return;
    }

    let { particle } = req.body;
    if (!particle) {
        res.send('missing particle');
        return;
    }

    let cid = particle.correlationId;

    // particle counter
    ptin++;

    // update particlemap
    particlemap[cid].bouncec++;
    particlemap[cid].ptc++;

    // if particle is a fault
    if (particle.fault) {
        res.send(`particle recieved [${cid}]`);
        return;
    }

    // create particle response
    let particleconfig = particlemap[cid];

    if (!particleconfig) {
        res.status(400).send(new Error(`no particlemap for [${cid}]`));
        return;
    }

    let particlereturns = [];

    if (particleconfig.particlerepeater) {
        for (var i = 0; i < particleconfig.particlerepeater; i++) {
            particlereturns.push({
                to: particleconfig.endpoint,
                "particle": {
                    correlationId: cid,
                    back: configs.novaurl,
                    fault: true
                }
            });
        }
    }

    particlereturns.push({
        to: particleconfig.endpoint,
        "particle": {
            correlationId: cid,
            back: configs.novaurl,
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
    q = q.concat(particlereturns);
    // release lock
    qlock--;

    particlemap[cid].ptc += +particleconfig.particlerepeater;
    particlemap[cid].ptc++;
    ptout += +particleconfig.particlerepeater;
    ptout++;

    res.send(`particle recieved [${cid}]`);
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
