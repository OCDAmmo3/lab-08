const express = require('express');
const cors = require('cors');
require('dotenv').config();
const superagent = require('superagent');
const pg = require('pg');

const client = new pg.Client(process.env.DB_CONNECTION_STRING);
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

function Event(eventData) {
	this.link = eventData.url;
	this.name = eventData.name.text;
	this.event_date = eventData.url;
	this.summary = eventData.description.text;
}

// const geoData = require('./data/geo.json');
// const weatherData = require('./data/darksky.json');

app.get('/location', (request, response) => {
	try {
		let SQL = 'SELECT * FROM locations WHERE search_query=$1;';
		let VALUES = [request.query.data];

		console.log(request.query.data);

		client.query(SQL, VALUES).then(results => {
			console.log("RESULTS", results.rows);
			if (results.rows.length === 0) {
				superagent.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODEAPI_KEY}`)
					.then((geoData) => {
						const location = new Location(request.query.location, geoData.body);
						SQL = 'INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4)'
						VALUES = Object.values(location);
						client.query(SQL, VALUES).then(results => {
							console.log(results);
							response.send(location);
						});
					});
			} else {
				console.log('I came from database')
				response.send(results);
			}
		});
	}
	catch (error) {
		response.status(500).send({
			status: 500,
			responseText: error.message
		});
	}
});

app.get('/events', (request, response) => {
	try {
		console.log(request.query)
		superagent.get(`https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITEAPI_KEY}&location.address=${request.query.data.formatted_query}&location.within=10km`)
		.then((eventData) => {
			const sliceIndex = eventData.body.events.length > 20 ? 20 : eventData.body.events.length;
			console.log(eventData.body)
			const events = eventData.body.events.slice(0, sliceIndex).map((event) => new Event(event));
			response.send(events);
		})
	} catch (error) {
		response.status(500).send({
			status: 500,
			responseText: error.message
		});
	}
});

app.get('/weather', (req, res) => {
	try {
		console.log(req.query.data);
		superagent.get(`https://api.darksky.net/forecast/${process.env.DARKSKYAPI_KEY}/${req.query.data.latitude},${req.query.data.longitude}`)
			.then((weatherData) => {
				console.log(weatherData.body.daily.data);
				let weather = weatherData.body.daily.data.map((day) => {
					return new Weather(day);
				})
				res.send(weather)
			});
	}
	catch (error) {
		res.status(500).send({
			status: 500,
			responseText: error.message
		});
	}
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log('Server has started...');
});