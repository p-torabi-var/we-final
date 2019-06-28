var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var shid = require('shortid');
const low = require('lowdb');
const FileSync = require('./node_modules/lowdb/adapters/FileSync');

const adapter = new FileSync('./db.json');
const db = low(adapter);

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
//user routes
app.get('/api/areas', function(req, res, next) {
    let qString = req.query;
    let areas = [];
    let t = db.get('addresses').value();
    if('area' in qString){
        t.forEach(function (address) {
            if(address.area.startsWith(qString.area)){
                areas.push(address.area);
            }
        })
    }
    res.json(areas);
});
app.get('/api/restaurants', function(req, res, next) {
  let qString = req.query;
  let qObject = {};
  if('area' in qString){
    let t = db.get('addresses').find({area: qString.area}).value();
    if(t){
      qObject['address'] = t.id;
    }
  }
  let rests = db.get('restaurants').filter(qObject).value();
  let this_rests = [];
  if('category' in qString){
    let qCats = qString.category;
    if(!(qCats instanceof Array)){
      qCats = [qCats]
    }
    let all_cats = db.get('cats').value();
    let this_cats = [];
    all_cats.forEach(function (item) {
      if(qCats.includes(item.name)){
        this_cats.push(item.id);
      }
    });
    this_rests = [];
    rests.forEach(function (item) {
      if(item.categories.filter(value => this_cats.includes(value)).length > 0){
        this_rests.push(item);
      }
    });
  }
  else{
    this_rests = rests;
  }
  res.json(this_rests);
});
app.get('/api/restaurants/:id', function(req, res, next) {
  let rest = db.get('restaurants').find({ id: req.params.id }).value();
  res.json(rest);
});
app.get('/api/restaurants/:id/comments', function(req, res, next) {
  let comment_ids = db.get('restaurants').find({ id: req.params.id }).get('comments').value();
  let comments = [];
  comment_ids.forEach(function (item) {
    let t = db.get('comments').find({ id: item }).value();
    comments.push(t);
  });
  comments.sort(function(a, b){
    let keyA = new Date(a.created_at),
        keyB = new Date(b.created_at);
    // Compare the 2 dates
    if(keyA > keyB) return -1;
    if(keyA < keyB) return 1;
    return 0;
  });
  res.json(comments);
});
app.post('/api/restaurants/:id/comments', function(req, res, next) {
    if(req.body.author && req.body.quality && req.body.packaging && req.body.deliveryTime) {
        let rest_id = shid.generate().toString();
        let quality = parseInt(req.body.quality) || 0;
        let packaging = parseInt(req.body.packaging) || 0;
        let deliveryTime = parseInt(req.body.deliveryTime) || 0;
        let comment = {
            id: rest_id,
            author: req.body.author,
            quality: quality,
            packaging: packaging,
            deliveryTime: deliveryTime,
            text: req.body.text || '',
            created_at: new Date(Date.now()).toLocaleString()
        };
        db.get('comments').push(comment).write();
        db.get('restaurants').find({id: req.params.id}).get('comments').push(rest_id).write();
        let total_rating = db.get('restaurants').find({id: req.params.id}).get('total_rating').value();
        total_rating += quality + packaging + deliveryTime;
        db.get('restaurants').find({id: req.params.id}).set('total_rating', total_rating).write();
        let no_comments = db.get('restaurants').find({id: req.params.id}).get('comments').value().length;
        db.get('restaurants').find({id: req.params.id}).set('average_rating', total_rating / (no_comments * 3)).write();
        res.json(db.get('restaurants').find({id: req.params.id}).value());
    }
    else {
        res.end('required fields not provided');
    }
});
app.post('/api/restaurants', function(req, res, next) {
    if(req.body.name && req.body.address && req.body.categories){
        let rest_id = shid.generate().toString();
        let foods;
        if(req.body.foods){
            foods = req.body.foods.split(', ');
        }
        else {
            foods = [];
        }
        let rest = {
            id : rest_id,
            name : req.body.name,
            logo: req.body.logo || 'default',
            openingTime: parseInt(req.body.openingTime) || 9,
            closingTime: parseInt(req.body.closingTime) || 21,
            address: req.body.address,
            categories: req.body.categories.split(', '),
            foods : foods,
            comments : [],
            total_rating : 0,
            average_rating: 0
        };
        db.get('restaurants').push(rest).write();
        res.json(db.get('restaurants').find({ id: rest_id }).value());
    }
    else {
        res.end('required fields not provided');
    }
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
