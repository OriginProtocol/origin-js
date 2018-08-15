This directory contains code for indexing servers:
 - listener: Server that listens to events emitted by Origin contracts and indexes them.
 - apollo: GraphQL server for indexed data
 - lib: library for indexing data in various backend. Currently Postgres and Elasticsearch are supported.

To start the listener:
======================
 - Use origin-box to start an origin-js container.
    #> docker-compose up origin-js"

 - If you want to index data in Postgres, start the postgres container.
   #> docker-compose up postgres

 - [TODO: Automate this step as part of origin-box setup]
   Create the postgres DB schema:
   #> docker exec -ti origin-js /bin/bash
   #> cd daemon/indexing
   #> node node_modules/db-migrate/bin/db-migrate -e origin-box-genesis db:create indexing
   #> node node_modules/db-migrate/bin/db-migrate up

 - If you want to index data in ELasticsearch, start the elasticsearch container.
   #> docker-compose up elasticsearch

 - Spawn a bash in the origin-js container and start the listener. Use --elasticsearch and/or --db options to pick the indexer(s).
   #> docker exec -ti origin-js /bin/bash
   #> cd daemon/indexing
   #> node listener/listener-js --elasticsearch --db
 - You should see messages in the console indicating events are being indexed.


To start the Apollo GraphQL server:
===================================
 - [TODO: update origin-box config]
   Update origin-box:docker-compose.yml, for image origin-js to proxy port 4000 which is used by Apollo server.

 - Use origin-box to start an origin-js container.
    #> docker-compose up origin-js"

 - Spawn a bash in the origin-js container and start the Apollo server.
   #> docker exec -ti origin-js /bin/bash
   #> cd daemon/indexing
   #> node apollo/index.js

 - The server should start and you can point your browser to http://localhost:4000 to access the GraphQL playground.


