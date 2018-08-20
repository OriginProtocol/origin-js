CREATE TABLE offer (
  listing_id  VARCHAR(32),
  offer_id    INT,
  status      SMALLINT,
  data        JSONB NOT NULL,
  PRIMARY KEY(listing_id, offer_id, status)
);
