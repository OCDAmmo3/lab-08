'use strict';

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const superagent = require('superagent');
const pg = require('pg');

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

const app = express();
app.use(cors());

app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/events', getEvents);
app.get('/yelps', getYelps);
app.get('/movies', getMovies);

const timeouts = {
  weather: 15000,
  events: 15000,
  yelps: 15000,
  movies: 15000
}

function Location(query, geoData) {
  this.search_query = query;
  this.formatted_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lng;
}

Location.prototype.save = function(){
  const SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;`;
  const VALUES = [this.search_query, this.formatted_query, this.latitude, this.longitude];
  return client.query(SQL, VALUES).then(result => {
    this.id = result.rows[0].id;
    return this;
  })
}

function Weather(weatherData) {
  this.created_at = Date.now();
  this.forecast = weatherData.summary;
  this.time = new Date(weatherData.time * 1000).toString().slice(0, 15);
}

Weather.prototype.save = function(location_id){
  const SQL = `INSERT INTO weather (forecast, time, created_at, location_id) VALUES($1, $2, $3, $4);`;
  const VALUES = [this.forecast, this.time, this.created_at, location_id];
  client.query(SQL, VALUES);
}

function Event(eventsData) {
  this.created_at = Date.now();
  this.link = eventsData.url;
  this.name = eventsData.name.text;
  this.date = new Date(eventsData.start.local).toString().slice(0, 15);
  this.summary = eventsData.description.text;
}

Event.prototype.save = function(location_id){
  const SQL = `INSERT INTO events (link, name, date, summary, created_at, location_id) VALUES($1, $2, $3, $4, $5, $6);`;
  const VALUES = [this.link, this.name, this.date, this.summary, this.created_at, location_id];
  client.query(SQL, VALUES);
}

function Yelp(yelpsData) {
  this.created_at = Date.now();
  this.name = yelpsData.name;
  this.image_url = yelpsData.image_url;
  this.price = yelpsData.price;
  this.rating = yelpsData.rating;
  this.url = yelpsData.url;
}

Yelp.prototype.save = function(location_id){
  const SQL = `INSERT INTO yelps (name, image_url, price, rating, url, created_at, location_id) VALUES($1, $2, $3, $4, $5, $6, $7);`;
  const VALUES = [this.name, this.image_url, this.price, this.rating, this.url, this.created_at, location_id];
  client.query(SQL, VALUES);
}

function Movie(moviesData) {
  this.created_at = Date.now();
  this.title = moviesData.title;
  this.overview = moviesData.overview;
  this.average_votes = moviesData.vote_average;
  this.total_votes = moviesData.vote_count;
  this.image_url = moviesData.poster_path;
  this.popularity = moviesData.popularity;
  this.released_on = moviesData.released_date;
}

Movie.prototype.save = function(location_id){
  const SQL = `INSERT INTO movies (title, overview, average_votes, total_votes, image_url, popularity, released_on, created_at, location_id) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
  const VALUES = [this.title, this.overview, this.average_votes, this.total_votes, this.image_url, this.popularity, this.released_on, this.created_at, location_id];
  client.query(SQL, VALUES);
}

function deleteData(tableName, location_id){
  const SQL = `DELETE FROM ${tableName} WHERE location_id=$1`
  const VALUES = [location_id];
  return client.query(SQL, VALUES);
}

function lookupData(lookupHandler) {
  const SQL = `SELECT * FROM ${lookupHandler.tableName} WHERE ${lookupHandler.column}=$1`;
  const VALUES = [lookupHandler.query];
  client.query(SQL, VALUES).then(result => {
    if(result.rowCount === 0){
      lookupHandler.cacheMiss();
    } else {
      lookupHandler.cacheHit(result);
    }
  })
}

// const geoData = require('./data/geo.json');
// const weatherData = require('./data/darksky.json');

function getLocation(request, response){
  lookupData({
    tableName: 'locations',
    column: 'search_query',
    query: request.query.data,
    cacheHit: function(result){
      response.send(result.rows[0]);
    },
    cacheMiss: function(){
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODEAPI_KEY}`;
      superagent.get(url)
        .then(geoData => {
          const location = new Location(this.query, geoData.body);
          location.save().then(location => response.send(location));
        })
    }
  })
}

function getWeather(request, response){
  lookupData({
    tableName: 'weather',
    column: 'location_id',
    query: request.query.data.id,
    cacheHit: function(result){
      let ageOfResults = (Date.now() - result.rows[0].created_at);
      if(ageOfResults > timeouts.weather){
        deleteData('weather', request.query.data.id).then(() => {
          this.cacheMiss();
        })
      } else {
        response.send(result.rows);
      }
    },
    cacheMiss: function(){
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`
      superagent.get(url)
        .then(weatherData => {
          console.log(weatherData);
          const weatherSummaries = weatherData.body.hourly.data.map(day => {
            const summary = new Weather(day);
            summary.save(request.query.data.id);
            return summary;
          })
          response.send(weatherSummaries);
        })
    }
  })
}

function getEvents(request, response){
  lookupData({
    tableName: 'events',
    column: 'location_id',
    query: request.query.data.id,
    cacheHit: function(result){
      let ageOfResults = (Date.now() - result.rows[0].created_at);
      if(ageOfResults > timeouts.events){
        deleteData('events', request.query.data.id).then(() => {
          this.cacheMiss();
        })
      } else {
        response.send(result.rows);
      }
    },
    cacheMiss: function(){
      const url = `https://www.eventbriteapi.com/v3/events/search/?token=${process.env.EVENTBRITE_API_KEY}&location.latitude=${request.query.data.latitude}&location.longitude=${request.query.data.longitude}&location.within=10km`
      superagent.get(url)
        .then(eventsData => {
          const eventSummaries = eventsData.body.events.map(event => {
            const summary = new Event(event);
            summary.save(request.query.data.id);
            return summary;
          })
          response.send(eventSummaries);
        })
    }
  })
}

function getYelps(request, response){
  lookupData({
    tableName: 'yelps',
    column: 'location_id',
    query: request.query.data.id,
    cacheHit: function(result){
      let ageOfResults = (Date.now() - result.rows[0].created_at);
      if(ageOfResults > timeouts.yelps){
        deleteData('yelps', request.query.data.id).then(() => {
          this.cacheMiss();
        })
      } else {
        response.send(result.rows);
      }
    },
    cacheMiss: function(){
      const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`
      superagent.get(url)
      .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
        .then(yelpsData => {
          const yelpsSummaries = yelpsData.body.businesses.map(business => {
            const summary = new Yelp(business);
            summary.save(request.query.data.id);
            return summary;
          })
          response.send(yelpsSummaries);
        })
    }
  })
}

function getMovies(request, response){
  lookupData({
    tableName: 'movies',
    column: 'location_id',
    query: request.query.data.id,
    cacheHit: function(result){
      let ageOfResults = (Date.now() - result.rows[0].created_at);
      if(ageOfResults > timeouts.movies){
        deleteData('movies', request.query.data.id).then(() => {
          this.cacheMiss();
        })
      } else {
        response.send(result.rows);
      }
    },
    cacheMiss: function(){
      const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&language=en-US&page=1&query=${request.query.data.search_query}`
      superagent.get(url)
        .then(moviesData => {
          const moviesSummaries = moviesData.body.results.map(day => {
            const summary = new Movie(day);
            summary.save(request.query.data.id);
            return summary;
          })
          response.send(moviesSummaries);
        })
    }
  })
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});