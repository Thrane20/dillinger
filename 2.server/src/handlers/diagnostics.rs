use axum::extract::Query;
use std::collections::HashMap;

pub async fn ping(Query(query): Query<HashMap<String, String>>) -> String {
    // Access the query string here using the `query` variable
    println!("Ping function executed - got the following query parameters: {:?}", query);
    "pong".to_string()
}
