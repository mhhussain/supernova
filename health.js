
function health(app) {

    this.h = {
        status: 'startup',
        msg: ''
    };
    
    // set up end points
    app.get('/health', (req, res) => {
        res.json(this.h);
    });

    // kill
    app.post('/poison', (req, res) => {
        this.h.status = 'poisoned';
        this.h.msg = 'app poisoned';
        
        res.json('app.poison');
    });

    // rez
    app.post('/replenish', (req, res) => {
        this.h.status = 'listening';
        this.h.msg = `listening after replenish`;
        
        res.json('app.replenish');
    });
};

health.prototype.status = function status() {
    return this.h.status;
};

health.prototype.updateStatus = function updateStatus(o) {
    this.h = o;
};

module.exports = health;
