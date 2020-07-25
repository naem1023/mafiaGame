var express = require('express');
var fs = require('fs');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index');
});

router.get('/robby', function(req, res, next) {
    res.render('robby');
});

router.get('/ingame', function(req, res, next) {
    res.render('ingame');
});

router.get('/madeby', function(req, res, next) {
    res.render('madeby');
});

module.exports = router;
