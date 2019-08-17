let axios = require('axios');

function supernova(h, configs, app) {

    this.ptin = 0;
    this.ptout = 0;
    this.errors = 0;
    this.particlemap = {};
    
    app.get('/status/ptin', (req, res) => {
        res.json(this.ptin);
    });
    
    app.get('/status/ptout', (req, res) => {
        res.json(this.ptout);
    });

    app.get('/status/errors', (req, res) => {
        res.json(this.errors);
    });
    
    app.get('/status/cid/:correlationId', (req, res) => {
        let { correlationId } = req.params;
        res.json(this.particlemap[correlationId]);
    });
    
    app.get('/particlemap', (req, res) => {
        res.json(this.particlemap);
    });

    app.post('/reset', (req, res) => {
        this.ptin = 0;
        this.ptout = 0;
        this.errors = 0;
        this.particlemap = {};
        res.json(h.status());
    });
    
    // entry point
    app.post('/particlemap/add', (req, res) => {
        let { particleInfo } = req.body;
        if (!particleInfo) {
            res.status(400).json(new Error('contract missing: [particleInfo]'));
            return;
        }
    
        this.particlemap[particleInfo.correlationId] = {
            endpoint: particleInfo.endpoint,
            bouncec: 0,
            ptc: 0,
            errors: 0,
            particlerepeater: particleInfo.particlerepeater
        };
    
        var success = true;
    

        let particle  = JSON.stringify({
            endpoint: particleInfo.endpoint,
            return: {
                success: `${configs.novaurl}/pong/s`,
                fail: `${configs.novaurl}/pong/f`
            },
            data: {
                correlationId: particleInfo.correlationId
            }
        });

        axios.post(configs.particleaccelerator, particle).catch((err) => {
            this.particlemap[particleInfo] = null;
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
        if (h.status() != 'listening') {
            res.status(503).json('bad health status');
            return;
        }

        let rdata = req.body;
        if (!rdata) {
            res.json('particle.missing');
            return;
        }
    
        let cid = rdata.correlationId;
    
        // particle counter
        this.ptin++;
    
        // update particlemap
        this.particlemap[cid].bouncec++;
        this.particlemap[cid].ptc++;
    
        // if particle is a fault
        if (rdata.fault) {
            res.json(`particle.recieved [${cid}]`);
            return;
        }
    
        // create particle response
        let particleconfig = this.particlemap[cid];
    
        if (!particleconfig) {
            res.status(400).json(new Error(`no particlemap for [${cid}]`));
            return;
        }
    
        res.json(`particle.received [${cid}]`);
    
        if (particleconfig.particlerepeater) {
            for (var i = 0; i < particleconfig.particlerepeater; i++) {
                let p = JSON.stringify({
                    endpoint: particleconfig.endpoint,
                    return: {
                        success: `${configs.novaurl}/pong/s`,
                        fail: `${configs.novaurl}/pong/f`,
                    },
                    data: {
                        correlationId: cid,
                        fault: true
                    }
                });
                axios.post(configs.particleaccelerator, p);
            }
        }

        let mp = JSON.stringify({
            endpoint: particleconfig.endpoint,
            return: {
                success: `${configs.novaurl}/pong/s`,
                fail: `${configs.novaurl}/pong/f`,
            },
            data: {
                correlationId: cid,
                fault: false
            }
        });
        axios.post(configs.particleaccelerator, mp);
    
        this.particlemap[cid].ptc += +particleconfig.particlerepeater;
        this.particlemap[cid].ptc++;
        this.ptout += +particleconfig.particlerepeater;
        this.ptout++;
    
        return;
    });
    
    app.post('/pong/f', (req, res) => {
        // remove particle from map
        if (h.status() != 'listening') {
            res.status(503).json('bad health status');
            return;
        }
    
        let rdata = req.body;
        if (!rdata) {
            res.json('particle.missing');
            return;
        }
    
        this.errors++;

        let cid = rdata.correlationId;
        this.particlemap[cid].errors++;

        res.json('failure.received');
    });
};

module.exports = supernova;
