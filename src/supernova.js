let axios = require('axios');
let mongoc = require('mongodb').MongoClient;

function supernova(h, configs, app) {

    this.ptin = 0;
    this.ptout = 0;
    this.errors = 0;
    this.mongoConfig = configs.mongo;
    
    app.get('/status/ptin', (req, res) => {
        res.json(this.ptin);
    });
    
    app.get('/status/ptout', (req, res) => {
        res.json(this.ptout);
    });

    app.get('/status/errors', (req, res) => {
        res.json(this.errors);
    });
    
    app.post('/reset', (req, res) => {
        this.ptin = 0;
        this.ptout = 0;
        this.errors = 0;
        // this.particlemap = {}; // this needs to be figured out
        res.json(h.status());
    });
    
    // entry point
    app.post('/particlemap/add', (req, res) => {
        let { particleInfo } = req.body;
        if (!particleInfo) {
            res.status(400).json(new Error('contract missing: [particleInfo]'));
            return;
        }

        let p = {
            correlationId: particleInfo.correlationId,
            endpoint: particleInfo.endpoint,
            bouncec: 0,
            ptc: 0,
            errors: 0,
            particlerepeater: particleInfo.particlerepeater
        };

        mongoc.connect(this.mongoConfig.url, (err, db) => {
            if (err) {
                console.log(err);
                res.json('particle.misfire');
                return;
            }
            let dbo = db.db(this.mongoConfig.db);
            dbo.collection('particles').insertOne(p, (err, mongores) => {
                if (err) {
                    console.log(err);
                    res.json('particle.misfire');
                    return;
                }

                db.close();

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
                    // need to delete particle from mongo here
                    // this.particlemap[particleInfo] = null;
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

        // if particle is a fault
        if (rdata.fault) {
            res.json(`particle.recieved [${cid}]`);
            return;
        }
        
        // there's a reason for this...
        res.json(`particle.received [${cid}]`);

        // update particlemap
        mongoc.connect(this.mongoConfig.url, (err, db) => {
            if (err) {
                console.log(err);
                return;
            }
            let dbo = db.db(this.mongoConfig.db);
            dbo.collection('particles').findOne({ correlationId: cid }, (err, result) => {
                if (err) {
                    console.log(err);
                    return;
                }
                result.bouncec++;
                result.ptc++;

                // create particle response
                let particleconfig = result;
            
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
            
                result.ptc += +particleconfig.particlerepeater;
                result.ptc++;
                this.ptout += +particleconfig.particlerepeater;
                this.ptout++;
                
                let newrec = { $set: result };

                dbo.collection('particles').updateOne({ correlationId: cid }, newrec, (err, res) => {
                    if (err) {
                        throw err;
                    }
                    db.close();
                });
            });
        });
    
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

        res.json('failure.received');
    });
};

module.exports = supernova;
