const express = require('express');
const cors = require('cors');
require('dotenv').config();
const superagent = require('superagent');
const pg = require('pg');

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

const app = express();
app.use(cors());

/*
[
  {
    "forecast": "Partly cloudy until afternoon.",
    "time": "Mon Jan 01 2001"
  },
  {
    "forecast": "Mostly cloudy in the morning.",
    "time": "Tue Jan 02 2001"
  },
  ...
]
*/
function select(table, column, value) {
	const SQL = `SELECT * FROM ${table} WHERE ${column}=$1`;
	const VALUES = [value];
	console.log(value);
	return client.query(SQL, VALUES);
}

function Weather(weatherData) {
	this.forecast = weatherData.summary;
	this.day = new Date(weatherData.time * 1000).toString().slice(0, 15);
}

function Location(query, geoData) {
	this.search_query = query;
	this.formatted_query = geoData.results[0].formatted_address;
	this.latitude = geoData.results[0].geometry.location.lat;
	this.longitude = geoData.results[0].geometry.location.lng;
}

function Event(search_query, link, name, event_date, summary) {
	this.search_query = search_query
	this.link = link;
	this.name = name;
	this.event_date = event_date;
	this.summary = summary;
}

// const geoData = require('./data/geo.json');
// const weatherData = require('./data/darksky.json');

app.get('/location', (request, response) => {
	select('locations', 'search_query', request.query.data).then(results => {
		if (results.rows.length === 0) {
			superagent.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODEAPI_KEY}`)
				.then((geoData) => {
					const location = new Location(request.query.location, geoData.body);
					SQL = 'INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4)'
					VALUES = Object.values(location);
					client.query(SQL, VALUES).then(results => {
						response.send(location);
					});
				});
		} else {
			console.log('I came from database')
			response.send(results);
		}
	}).catch(error => console.log(error));
});

app.get('/events', (request, response) => {
	select('events', 'search_query', request.query.data.search_query).then(results => {
		if (results.rows.length === 0) {
			superagent.get(`https://www.eventbriteapi.com/v3/events/search/?token=${process.env.EVENTBRITEAPI_KEY}&location.address=${request.query.data.search_query}&location.within=10km`)
				.then((eventData) => {
					const sliceIndex = eventData.body.events.length > 20 ? 20 : eventData.body.events.length;
					const events = eventData.body.events.slice(0, sliceIndex).map((event) => new Event(request.query.data.search_query, event.url, event.name.text, event.start.local, event.description.text));
					events.forEach((event) => {
						const query = 'INSERT INTO events (search_query, link, event_name, event_date, summary) VALUES ($1, $2, $3, $4, $5)';
						client.query(query, Object.values(event));
					});
					console.log('API');
					response.send(events);
				})
				.catch((error) => handleError(error, response));
		}
		else {
			response.send(results.rows);
			console.log('DB');
		}
	}).catch(error => console.log(error));
});

// app.get('/weather', (req, res) => {
// 	select('weather', 'search_query', request.query.data.search_query).then(results => {
// 		if(results.rows.length === 0) {
// 		superagent.get(`https://api.darksky.net/forecast/${process.env.DARKSKYAPI_KEY}/${req.query.data.latitude},${req.query.data.longitude}`)
// 			.then((weatherData) => {
// 				let weather = weatherData.body.daily.data.map((day) => {
// 					return new Weather(day);
// 				})
// 				res.send(weather)
// 			}).catch(error => console.log(error));
// });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log('Server has started...');
});