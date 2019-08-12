let axios = require('axios');
let e =  require('express');

let configs = require('./config');

/// start up
// health object
let health = {
    status: 'startup',
    msg: ''
};

// particlemap
let particlemap = {};
let ptout = 0;
let ptin = 0;

let app = e();

// uses
app.use(e.json());

// gets
app.get('/health', (req, res) => {
    res.json(health);
});

app.get('/requestmap', (req, res) =>  {
    res.json({
        pong: {
            health: 'pong',
            success: '/pong/s',
            fail: '/pong/f',
        }
    })
});

app.get('/status/ptin', (req, res) => {
    res.json(ptin);
});

app.get('/status/ptout', (req, res) => {
    res.json(ptout);
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
        res.status(400).json(new Error('contract missing: [particleInfo]'));
        return;
    }

    particlemap[particleInfo.correlationId] = {
        endpoint: particleInfo.endpoint,
        bouncec: 0,
        ptc: 0,
        particlerepeater: particleInfo.particlerepeater
    };

    var success = true;

    axios.post(configs.particleaccelerator, {
        particle: {
            endpoint: particleInfo.endpoint,
            return: {
                success: `${configs.novaurl}/pong/s`,
                fail: `${configs.novaurl}/pong/f`
            },
            data: {
                correlationId: particleInfo.correlationId
            }
        }
    }).catch((err) => {
        particlemap[particleInfo] = null;
        success = false;
        return;
    }).finally(() => {
        if (success) {
            res.json('particle.fired');
        } else {
            res.status(400).json(new Error('failed to create particle'));
        }
        return;
    });
});

app.post('/pong/s', (req, res) => {
    if (health.status != 'listening') {
        res.status(503).json('bad health status');
        return;
    }

    let { rdata } = req.body;
    if (!rdata) {
        res.json('particle.missing');
        return;
    }

    let cid = rdata.correlationId;

    // particle counter
    ptin++;

    // update particlemap
    particlemap[cid].bouncec++;
    particlemap[cid].ptc++;

    // if particle is a fault
    if (rdata.fault) {
        res.json(`particle.recieved [${cid}]`);
        return;
    }

    // create particle response
    let particleconfig = particlemap[cid];

    if (!particleconfig) {
        res.status(400).json(new Error(`no particlemap for [${cid}]`));
        return;
    }

    res.json(`particle.received [${cid}]`);

    if (particleconfig.particlerepeater) {
        for (var i = 0; i < particleconfig.particlerepeater; i++) {
            axios.post(configs.particleaccelerator, {
                particle: {
                    endpoint: particleconfig.endpoint,
                    return: {
                        success: `${configs.novaurl}/pong/s`,
                        fail: `${configs.novaurl}/pong/f`,
                    },
                    data: {
                        correlationId: cid,
                        fault: true
                    }
                }
            });
        }
    }

    axios.post(configs.particleaccelerator, {
        particle: {
            endpoint: particleconfig.endpoint,
            return: {
                success: `${configs.novaurl}/pong/s`,
                fail: `${configs.novaurl}/pong/f`,
            },
            data: {
                correlationId: cid,
                fault: false
            }
        }
    });

    particlemap[cid].ptc += +particleconfig.particlerepeater;
    particlemap[cid].ptc++;
    ptout += +particleconfig.particlerepeater;
    ptout++;

    return;
});

app.post('/pong/f', (req, res) => {
    // remove particle from map
    res.json('failure.received');
});

// kill and rez
app.post('/poison', (req, res) => {
    health.status = 'poisoned';
    health.msg = 'app poisoned';
    
    res.json('app.poison');
});

app.post('/replenish', (req, res) => {
    health.status = 'listening';
    health.msg = `listening on port [${configs.port}]`;
    
    res.json('app.replenish');
})

app.listen(configs.port, () => { 
    health.status = 'listening';
    health.msg = `listening on port [${configs.port}]`;
});
