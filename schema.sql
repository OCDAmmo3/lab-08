DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS weather;
DROP TABLE IF EXISTS events;

CREATE TABLE locations(
    search_query VARCHAR(255),
    formatted_query VARCHAR(255),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7)
);

CREATE TABLE weather(
    search_query VARCHAR(255),
    forecast VARCHAR(255),
    day VARCHAR(255)
);

CREATE TABLE events(
    search_query VARCHAR(255),
    link VARCHAR,
    event_name VARCHAR(255),
    event_date DATE,
    summary VARCHAR
);