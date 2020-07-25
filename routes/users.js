var express = require('express');
var router = express.Router();
var fs = require('fs');

/* GET users listing. */


router.get('/room', function(req, res, next) {
	console.log('room');
	fs.readFile('robby.html', function(err, data){
        if(err)
            console.log('error');
        else{
            res.writeHead(200, {'Content-Type' : 'text/html'});
            res.end(data);
        }
    });
});

module.exports = router;
