DROP TABLE IF EXISTS locations;

CREATE TABLE locations(
    search_query VARCHAR(255),
    formatted_query VARCHAR(255),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7)
);

CREATE TABLE weather(
    forecast VARCHAR(255),
    day VARCHAR(255)
);

CREATE TABLE events(

);